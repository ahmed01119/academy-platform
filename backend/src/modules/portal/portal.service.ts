import crypto from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { TenantTransactionClient } from '@academy/database';
import { PrismaService } from '../database/prisma.service';
import {
  ErrorCode,
  type GuardianChildSummary,
  type GuardianPortalData,
  type PlayerPortalEvaluation,
  type PlayerPortalProfile,
  type PlayerQrCardResponse,
  type TenantContext,
  type CreatePlayerJoinRequest,
  type PlayerJoinRequestItem,
  type ApplicationStatus,
  type JoinRequesterType,
} from '@academy/shared';
import { RedisService } from '../redis/redis.service';
import { PasswordService } from '../auth/password.service';
import { insertApplicantAccount, isDuplicateEmailError } from '../auth/applicant-account';
import { rateLimitIpKey } from '../../common/client-ip';
import { databaseFunctionErrorCode, singleRow } from '../../common/db-function-error';

const CLAIM_ATTEMPT_LIMIT = 10;
const CLAIM_ATTEMPT_WINDOW_SECONDS = 60 * 60;
const CLAIM_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base 32
/** Public join form: new applicant accounts per IP and hour. */
const JOIN_ACCOUNT_LIMIT = 10;
const JOIN_ACCOUNT_WINDOW_SECONDS = 60 * 60;
const JOIN_REQUEST_ERRORS = [
  'REQUESTER_TYPE_INVALID',
  'GUARDIAN_NAME_REQUIRED',
  'PLAYER_PROFILE_EXISTS',
  'DUPLICATE_PENDING_REQUEST',
  'ACADEMY_NOT_AVAILABLE',
  'TOO_MANY_PENDING_REQUESTS',
  'APPLICANT_NOT_PERMITTED',
  'PLAYER_NAME_INVALID',
  'CONTACT_EMAIL_INVALID',
  'CONTACT_PHONE_INVALID',
  'GUARDIAN_NAME_INVALID',
  'DATE_OF_BIRTH_INVALID',
] as const;

/** Unbiased random code from the Crockford base-32 alphabet. */
export function randomClaimCode(length: number): string {
  let code = '';
  while (code.length < length) {
    const byte = crypto.randomBytes(1)[0] ?? 0;
    if (byte < 256 - (256 % CLAIM_CODE_ALPHABET.length)) {
      code += CLAIM_CODE_ALPHABET[byte % CLAIM_CODE_ALPHABET.length];
    }
  }
  return code;
}

/** SHA-256 of the normalised code (trimmed, upper-cased), the only form stored (matches M2's conversion). */
export function hashClaimCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase(), 'utf8').digest('hex');
}

@Injectable()
export class PortalService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
  ) {}

  /**
   * Retrieves player portal data for an authenticated player user.
   */
  async getPlayerPortalData(actorUserId: string): Promise<{
    profile: PlayerPortalProfile;
    upcomingSessions: Array<{
      id: string;
      sessionDate: string;
      startTime: string;
      endTime: string;
      groupName: string;
      branchName?: string;
    }>;
    attendanceSummary: {
      totalEligible: number;
      present: number;
      late: number;
      absent: number;
      attendanceRate: number;
    };
    recentEvaluations: PlayerPortalEvaluation[];
  }> {
    return this.prisma.withPortalUserTransaction({ actorUserId }, async (tx) => {
      const player = await tx.player.findFirst({
        where: { userId: actorUserId },
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          groupMemberships: {
            where: { status: 'ACTIVE' },
            include: {
              group: {
                include: {
                  branch: { select: { name: true } },
                  coaches: {
                    where: { isHeadCoach: true },
                    include: { coachUser: { select: { name: true } } },
                  },
                },
              },
            },
          },
        },
      });

      if (!player) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'No player profile linked to your account',
        });
      }

      // Compute attendance stats
      const records = await tx.attendanceRecord.findMany({
        where: { playerId: player.id },
      });

      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let excusedCount = 0;

      for (const r of records) {
        if (r.status === 'PRESENT') presentCount++;
        else if (r.status === 'LATE') lateCount++;
        else if (r.status === 'ABSENT') absentCount++;
        else if (r.status === 'EXCUSED') excusedCount++;
      }

      const totalEligible = presentCount + lateCount + absentCount + excusedCount;
      const attendanceRate =
        totalEligible > 0
          ? Number((((presentCount + lateCount) / totalEligible) * 100).toFixed(1))
          : 0;

      // Group info
      const primaryGroup = player.groupMemberships[0]?.group;
      const headCoach = primaryGroup?.coaches[0]?.coachUser;

      const profile: PlayerPortalProfile = {
        playerId: player.id,
        tenantId: player.tenant.id,
        tenantName: player.tenant.name,
        tenantSlug: player.tenant.slug,
        firstName: player.firstName,
        lastName: player.lastName,
        gender: player.gender,
        dateOfBirth: player.dateOfBirth.toISOString().split('T')[0]!,
        photoUrl: player.photoUrl,
        branchName: primaryGroup?.branch?.name,
        groupName: primaryGroup?.name,
        headCoachName: headCoach?.name,
        status: player.status,
        totalSessionsAttended: presentCount + lateCount,
        attendanceRate,
      };

      // Upcoming sessions
      const groupIds = player.groupMemberships.map((gm) => gm.groupId);
      const upcomingSessionsRaw = await tx.attendanceSession.findMany({
        where: {
          groupId: { in: groupIds },
          sessionDate: { gte: new Date() },
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        },
        orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }],
        take: 10,
        include: {
          group: {
            include: { branch: { select: { name: true } } },
          },
        },
      });

      const upcomingSessions = upcomingSessionsRaw.map((s) => ({
        id: s.id,
        sessionDate: s.sessionDate.toISOString().split('T')[0]!,
        startTime: s.startTime,
        endTime: s.endTime,
        groupName: s.group?.name ?? s.groupName,
        branchName: s.group?.branch?.name,
      }));

      // Recent evaluations (published only, hide private coach notes)
      const evals = await tx.playerEvaluation.findMany({
        where: { playerId: player.id, isPublished: true },
        orderBy: { evaluationDate: 'desc' },
        take: 5,
        include: {
          evaluatorUser: { select: { name: true } },
          session: { select: { sessionDate: true } },
        },
      });

      const recentEvaluations = evals.map((e) => ({
        id: e.id,
        evaluationDate: e.evaluationDate.toISOString().split('T')[0]!,
        evaluatorName: e.evaluatorUser.name,
        overallScore: e.overallScore,
        technicalScore: e.technicalScore,
        tacticalScore: e.tacticalScore,
        physicalScore: e.physicalScore,
        behavioralScore: e.behavioralScore,
        strengths: e.strengths,
        areasForImprovement: e.areasForImprovement,
        guardianFeedback: e.guardianFeedback,
        suggestedGoals: e.suggestedGoals,
      }));

      return {
        profile,
        upcomingSessions,
        attendanceSummary: {
          totalEligible,
          present: presentCount,
          late: lateCount,
          absent: absentCount,
          attendanceRate,
        },
        recentEvaluations,
      };
    });
  }

  /**
   * Retrieves guardian portal data with all linked children.
   */
  async getGuardianPortalData(actorUserId: string): Promise<GuardianPortalData> {
    return this.prisma.withPortalUserTransaction({ actorUserId }, async (tx) => {
      const guardians = await tx.guardian.findMany({
        where: { userId: actorUserId },
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          player: {
            include: {
              groupMemberships: {
                where: { status: 'ACTIVE' },
                include: {
                  group: {
                    include: { branch: { select: { name: true } } },
                  },
                },
              },
              evaluations: {
                where: { isPublished: true },
                orderBy: { evaluationDate: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      if (guardians.length === 0) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'No guardian profile linked to your account',
        });
      }

      const primaryGuardian = guardians[0]!;

      const children: GuardianChildSummary[] = [];

      for (const g of guardians) {
        const p = g.player;

        const records = await tx.attendanceRecord.findMany({
          where: { playerId: p.id },
        });

        let present = 0;
        let late = 0;
        let total = 0;

        for (const ar of records) {
          if (['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'].includes(ar.status)) {
            total++;
            if (ar.status === 'PRESENT') present++;
            else if (ar.status === 'LATE') late++;
          }
        }

        const attendanceRate =
          total > 0 ? Number((((present + late) / total) * 100).toFixed(1)) : 0;
        const primaryGroup = p.groupMemberships[0]?.group;

        children.push({
          playerId: p.id,
          tenantId: g.tenant.id,
          tenantName: g.tenant.name,
          tenantSlug: g.tenant.slug,
          firstName: p.firstName,
          lastName: p.lastName,
          relationship: g.relationship,
          branchName: primaryGroup?.branch?.name,
          groupName: primaryGroup?.name,
          photoUrl: p.photoUrl,
          dateOfBirth: p.dateOfBirth.toISOString().split('T')[0]!,
          attendanceRate,
          latestScore: p.evaluations[0]?.overallScore,
          upcomingSessionsCount: 0,
        });
      }

      return {
        guardianId: primaryGuardian.id,
        name: `${primaryGuardian.firstName} ${primaryGuardian.lastName}`,
        phone: primaryGuardian.phone,
        email: primaryGuardian.email,
        children,
      };
    });
  }

  /**
   * Generates a single-use claim token for an enrolled player or guardian.
   */
  async generateClaimToken(
    tenantContext: TenantContext,
    targetType: 'PLAYER' | 'GUARDIAN',
    targetId: string,
  ): Promise<{ claimToken: string; expiresAt: string }> {
    // S9: 10 Crockford base-32 characters (50 bits, no I/L/O/U) instead of 8 hex characters (32 bits). Only the
    // SHA-256 hash is stored; the code itself is shown once to the staff member who hands it over.
    const claimToken = `ACAD-${randomClaimCode(10)}`;
    const claimHash = hashClaimCode(claimToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        if (targetType === 'PLAYER') {
          const player = await tx.player.findUnique({
            where: { tenantId: tenantContext.tenantId, id: targetId },
          });
          if (!player) {
            throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Player not found' });
          }
          await tx.player.update({
            where: { tenantId: tenantContext.tenantId, id: targetId },
            data: { claimToken: claimHash, claimExpiresAt: expiresAt },
          });
        } else {
          const guardian = await tx.guardian.findUnique({
            where: { tenantId: tenantContext.tenantId, id: targetId },
          });
          if (!guardian) {
            throw new NotFoundException({
              code: ErrorCode.NOT_FOUND,
              message: 'Guardian not found',
            });
          }
          await tx.guardian.update({
            where: { tenantId: tenantContext.tenantId, id: targetId },
            data: { claimToken: claimHash, claimExpiresAt: expiresAt },
          });
        }

        return { claimToken, expiresAt: expiresAt.toISOString() };
      },
    );
  }

  /**
   * Redeems a claim code to link the authenticated user to a Player or Guardian profile.
   *
   * redeem_portal_claim (definer function) does the work under the user's actor context: it compares the code's hash,
   * checks expiry and that the academy is ACTIVE, refuses records linked to another account (now guardians too),
   * links, clears the code (single use) and writes the audit entry in the same statement sequence.
   * Attempts are limited per account (S9) so codes cannot be guessed online.
   */
  async redeemClaimToken(
    actorUserId: string,
    claimToken: string,
  ): Promise<{ success: boolean; type: 'PLAYER' | 'GUARDIAN'; entityId: string; message: string }> {
    const attempts = await this.redisService.incrementRateLimit(
      `ratelimit:portal-claim:${actorUserId}`,
      CLAIM_ATTEMPT_WINDOW_SECONDS,
    );
    if (attempts.count > CLAIM_ATTEMPT_LIMIT) {
      throw new BadRequestException({
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: `محاولات كثيرة. حاول مرة أخرى بعد ${Math.ceil(attempts.remainingTime / 60)} دقيقة (Too many attempts. Try again later.)`,
      });
    }

    const claimHash = hashClaimCode(claimToken);
    try {
      const rows = await this.prisma.withPortalUserTransaction(
        { actorUserId },
        (tx) =>
          tx.$queryRaw<
            Array<{
              entity_type: 'PLAYER' | 'GUARDIAN';
              entity_id: string;
              first_name: string;
              last_name: string;
            }>
          >`SELECT entity_type, entity_id::text AS entity_id, first_name, last_name
           FROM public.redeem_portal_claim(${claimHash})`,
      );
      const claimed = singleRow(rows);
      const name = `${claimed.first_name} ${claimed.last_name}`;
      return {
        success: true,
        type: claimed.entity_type,
        entityId: claimed.entity_id,
        message:
          claimed.entity_type === 'PLAYER'
            ? `تم ربط ملف اللاعب (${name}) بحسابك بنجاح`
            : `تم ربط حساب ولي الأمر (${name}) بحسابك بنجاح`,
      };
    } catch (err) {
      const code = databaseFunctionErrorCode(err, [
        'CLAIM_INVALID',
        'CLAIM_ALREADY_LINKED',
        'CLAIM_REQUIRES_ACTIVE_ACCOUNT',
      ] as const);
      if (
        code === 'CLAIM_ALREADY_LINKED' ||
        /players_user_id_key|duplicate key/.test(String((err as Error)?.message))
      ) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'This profile is already linked to another account',
        });
      }
      if (code === 'CLAIM_REQUIRES_ACTIVE_ACCOUNT') {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: 'This account cannot claim profiles',
        });
      }
      if (code === 'CLAIM_INVALID') {
        throw new BadRequestException({
          code: ErrorCode.TOKEN_INVALID,
          message: 'رمز المطالبة غير صالح أو منتهي الصلاحية',
        });
      }
      throw err;
    }
  }

  /**
   * Retrieves player QR membership card data for the authenticated player.
   */
  async getMyPlayerQrCard(actorUserId: string): Promise<PlayerQrCardResponse> {
    return this.prisma.withPortalUserTransaction({ actorUserId }, async (tx) => {
      const player = await tx.player.findFirst({
        where: { userId: actorUserId },
        include: { tenant: { select: { id: true, name: true, slug: true } } },
      });

      if (!player) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'No player profile linked to your account',
        });
      }

      if (!player.qrCardCode) {
        const prefix = (player.tenant.slug || 'ACAD').toUpperCase().slice(0, 4);
        const membershipNumber =
          player.membershipNumber ||
          `${prefix}-${new Date().getFullYear()}-${player.id.slice(0, 6).toUpperCase()}`;
        const qrCardCode = crypto.randomBytes(16).toString('hex');
        const issuedAt = new Date();

        const updated = await tx.player.update({
          where: { id: player.id },
          data: {
            membershipNumber,
            qrCardCode,
            qrCardIssuedAt: issuedAt,
            qrCardRevokedAt: null,
          },
        });

        return {
          playerId: updated.id,
          playerName: `${updated.firstName} ${updated.lastName}`,
          academyName: player.tenant.name,
          membershipNumber: updated.membershipNumber!,
          photoUrl: updated.photoUrl,
          qrCardCode: updated.qrCardCode!,
          issuedAt: updated.qrCardIssuedAt!.toISOString(),
          isRevoked: false,
          revokedAt: null,
        };
      }

      return {
        playerId: player.id,
        playerName: `${player.firstName} ${player.lastName}`,
        academyName: player.tenant.name,
        membershipNumber:
          player.membershipNumber ||
          `MEM-${new Date().getFullYear()}-${player.id.slice(0, 6).toUpperCase()}`,
        photoUrl: player.photoUrl,
        qrCardCode: player.qrCardCode,
        issuedAt: player.qrCardIssuedAt
          ? player.qrCardIssuedAt.toISOString()
          : player.createdAt.toISOString(),
        isRevoked: Boolean(player.qrCardRevokedAt),
        revokedAt: player.qrCardRevokedAt ? player.qrCardRevokedAt.toISOString() : null,
      };
    });
  }

  /**
   * Join request from a PLAYER (for themself) or a GUARDIAN (for a child). Academy owners/coaches apply through
   * AuthService.register instead.
   *
   * Every request belongs to an account (K6, owner decision 2026-11-16):
   *  - signed in (`applicantUserId` set): the request is linked to that account. A player or guardian who already uses
   *    the portal keeps signing in; the new request shows as pending in the portal (GET /portal/my-join-requests).
   *  - not signed in: a new account is created for `contactEmail` with `password`, in the same transaction as the
   *    request (one fails, both roll back). The account is pending: login gating refuses sign-in until the academy
   *    reviews the request. An e-mail that already has an account must sign in first, so nobody can attach requests to
   *    someone else's account.
   *
   * submit_player_join_request (definer function) requires the academy to be ACTIVE, validates the input, refuses
   * requests that could never be approved (second player profile, duplicate pending request), caps pending requests per
   * academy and e-mail, and notifies the academy's managers in the same statement.
   */
  async submitPlayerJoinRequest(
    dto: CreatePlayerJoinRequest,
    applicantUserId?: string,
    ipAddress?: string,
  ): Promise<PlayerJoinRequestItem> {
    try {
      const created = applicantUserId
        ? await this.submitJoinRequestForSignedInUser(dto, applicantUserId)
        : await this.submitJoinRequestWithNewAccount(dto, ipAddress);
      return {
        id: created.request_id,
        tenantId: dto.tenantId,
        tenantName: created.tenant_name,
        applicantUserId: created.applicant_user_id,
        requesterType: created.requester_type,
        playerName: dto.playerName.trim(),
        contactEmail: dto.contactEmail.trim().toLowerCase(),
        contactPhone: dto.contactPhone?.trim() || null,
        dateOfBirth: dto.dateOfBirth ?? null,
        guardianName: dto.guardianName?.trim() || null,
        status: 'PENDING_REVIEW' as ApplicationStatus,
        reviewNotes: null,
        reviewedByUserId: null,
        reviewedAt: null,
        createdAt: new Date(created.created_at).toISOString(),
      };
    } catch (err) {
      throw this.mapJoinRequestError(err);
    }
  }

  /** Signed-in applicant: the request is linked to the current account (the transaction's actor). */
  private submitJoinRequestForSignedInUser(dto: CreatePlayerJoinRequest, applicantUserId: string) {
    return this.prisma.withAuthLookupTransaction({ actorUserId: applicantUserId }, (tx) =>
      this.callSubmitJoinRequest(tx, dto),
    );
  }

  /** Anonymous applicant: new pending account + request, atomically. */
  private async submitJoinRequestWithNewAccount(dto: CreatePlayerJoinRequest, ipAddress?: string) {
    if (!dto.password) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'A password is required to create the applicant account',
      });
    }

    // Account creation from a public form: at most JOIN_ACCOUNT_LIMIT new accounts per IP and hour.
    const { count } = await this.redisService.incrementRateLimit(
      `ratelimit:join-account:${rateLimitIpKey(ipAddress)}`,
      JOIN_ACCOUNT_WINDOW_SECONDS,
    );
    if (count > JOIN_ACCOUNT_LIMIT) {
      throw new HttpException(
        {
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          message: 'Too many join requests from this network. Please try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const email = dto.contactEmail.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new ConflictException({
        code: ErrorCode.EMAIL_ALREADY_EXISTS,
        message:
          'An account with this e-mail already exists. Please sign in first, then send the join request.',
      });
    }

    // Account name: the athlete for a PLAYER request, the guardian (the person asking) for a GUARDIAN request.
    const accountName =
      dto.requesterType === 'GUARDIAN' ? (dto.guardianName ?? dto.playerName) : dto.playerName;
    const passwordHash = await this.passwordService.hash(dto.password);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await insertApplicantAccount(tx, {
          email,
          passwordHash,
          name: accountName,
          phone: dto.contactPhone,
        });
        return this.callSubmitJoinRequest(tx, dto);
      });
    } catch (err) {
      if (isDuplicateEmailError(err)) {
        throw new ConflictException({
          code: ErrorCode.EMAIL_ALREADY_EXISTS,
          message:
            'An account with this e-mail already exists. Please sign in first, then send the join request.',
        });
      }
      throw err;
    }
  }

  /** Calls submit_player_join_request; the applicant is the transaction's actor (or none). */
  private async callSubmitJoinRequest(tx: TenantTransactionClient, dto: CreatePlayerJoinRequest) {
    const rows = await tx.$queryRaw<
      Array<{
        request_id: string;
        tenant_name: string;
        applicant_user_id: string | null;
        requester_type: JoinRequesterType;
        created_at: Date;
      }>
    >`SELECT request_id::text AS request_id, tenant_name, applicant_user_id::text AS applicant_user_id,
              requester_type, created_at
       FROM public.submit_player_join_request(
         ${dto.tenantId}::uuid, ${dto.playerName}, ${dto.contactEmail}, ${dto.contactPhone ?? null},
         ${dto.dateOfBirth ?? null}::date, ${dto.guardianName ?? null}, ${dto.requesterType}
       )`;
    return singleRow(rows);
  }

  /** Maps submit_player_join_request error codes to HTTP errors; anything else is rethrown unchanged. */
  private mapJoinRequestError(err: unknown): unknown {
    const code = databaseFunctionErrorCode(err, JOIN_REQUEST_ERRORS);
    switch (code) {
      case undefined:
        return err;
      case 'ACADEMY_NOT_AVAILABLE':
        return new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Academy not found' });
      case 'TOO_MANY_PENDING_REQUESTS':
        return new BadRequestException({
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          message: 'There are already several pending requests for this e-mail at this academy',
        });
      case 'APPLICANT_NOT_PERMITTED':
        return new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: 'This account cannot submit requests',
        });
      case 'PLAYER_PROFILE_EXISTS':
        return new ConflictException({
          code: ErrorCode.CONFLICT,
          message:
            'This account already has a player profile. To register a child, choose "I am the guardian".',
        });
      case 'DUPLICATE_PENDING_REQUEST':
        return new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'You already have a pending request for this player at this academy',
        });
      default:
        return new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: `Invalid request: ${code}`,
        });
    }
  }

  /**
   * The signed-in user's own join requests, newest first. RLS player_registration_requests_applicant shows only rows
   * whose applicant is the current actor, so no other applicant's request can appear.
   */
  async listMyJoinRequests(actorUserId: string): Promise<PlayerJoinRequestItem[]> {
    return this.prisma.withAuthLookupTransaction({ actorUserId }, async (tx) => {
      const requests = await tx.playerRegistrationRequest.findMany({
        where: { applicantUserId: actorUserId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      // Academy names through the public directory (the applicant cannot read tenants directly). An academy that is no
      // longer active is not listed there, so its name is left out.
      const academies = await tx.$queryRaw<Array<{ id: string; name: string }>>`
        SELECT id::text AS id, name FROM public.list_public_academies()`;
      const academyNames = new Map(academies.map((a) => [a.id, a.name]));
      return requests.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        tenantName: academyNames.get(r.tenantId),
        applicantUserId: r.applicantUserId,
        requesterType: r.requesterType,
        playerName: r.playerName,
        contactEmail: r.contactEmail,
        contactPhone: r.contactPhone,
        dateOfBirth: r.dateOfBirth ? r.dateOfBirth.toISOString().split('T')[0] : null,
        guardianName: r.guardianName,
        status: r.status as ApplicationStatus,
        reviewNotes: r.reviewNotes,
        reviewedByUserId: null,
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      }));
    });
  }

  /**
   * Active academies for the public join-request form: id, name and slug only (list_public_academies).
   */
  async listPublicAcademies(): Promise<Array<{ id: string; name: string; slug: string }>> {
    return this.prisma.$queryRaw<Array<{ id: string; name: string; slug: string }>>`
      SELECT id::text AS id, name, slug FROM public.list_public_academies()`;
  }
}
