import * as crypto from 'crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  ErrorCode,
  type DecideGuardianLinkRequest,
  type GuardianLinkRequestView,
  type RequestGuardianLinkRequest,
} from '@academy/shared';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppConfigService } from '../../config/app-config.service';

/** How long the approval link in the child's e-mail works. */
export const GUARDIAN_LINK_TTL_DAYS = 7;
/** Link requests per guardian account and hour. */
export const GUARDIAN_LINK_REQUESTS_PER_HOUR = 5;
const TOKEN_VERSION = 'g1';

/** The last 10 digits of a phone number ("01001234567", "+20 100 123 4567" → "1001234567"), or null. */
export function phoneTail(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

interface LinkTarget {
  guardianId: string;
  requesterUserId: string;
}

/**
 * Links a guardian's account to a child who has a player account (owner decision 2026-11-24), with two proofs:
 *  1. the academy's record: the phone the guardian types must match a guardian the academy registered for the player;
 *  2. the child's consent: the child approves from an e-mail sent to their own sign-in address.
 * The approval link signs the guardian record and the requesting account: `g1.<guardianId>.<userId>.<exp>.<HMAC>`.
 * It stops working once the record is linked. The academy's managers are notified of every link (database function).
 *
 * Children without an account keep the academy-issued link code (PortalService.redeemClaimToken).
 */
@Injectable()
export class GuardianLinkService {
  private readonly logger = new Logger(GuardianLinkService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {}

  /**
   * Sends an approval e-mail to the child for every matching guardian record. The answer is the same whether or not
   * anything matched, so the form cannot be used to find out who has an account or which phone an academy holds.
   */
  async requestLink(
    requesterUserId: string,
    dto: RequestGuardianLinkRequest,
  ): Promise<{ success: true }> {
    const limit = await this.redis.incrementRateLimit(
      `ratelimit:guardian-link:${requesterUserId}`,
      60 * 60,
    );
    if (limit.count > GUARDIAN_LINK_REQUESTS_PER_HOUR) {
      throw new HttpException(
        {
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          message: 'Too many link requests. Please try again later.',
          details: { retryAfterSeconds: limit.remainingTime },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const tail = phoneTail(dto.phone);
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterUserId },
      select: { name: true, email: true },
    });
    if (!tail || !requester || requester.email.toLowerCase() === dto.childEmail) {
      return { success: true };
    }

    const candidates = await this.prisma.$queryRaw<
      Array<{
        guardian_id: string;
        tenant_name: string;
        player_first_name: string;
        child_email: string;
      }>
    >`SELECT guardian_id::text AS guardian_id, tenant_name, player_first_name, child_email
      FROM public.find_guardian_link_candidates(${dto.childEmail}, ${tail})`;

    if (candidates.length > 0) {
      // Sent in the background: the answer must not wait for (or reveal) a match.
      void this.sendApprovalEmails(candidates, requesterUserId, requester.name);
    }
    return { success: true };
  }

  private async sendApprovalEmails(
    candidates: Array<{
      guardian_id: string;
      tenant_name: string;
      player_first_name: string;
      child_email: string;
    }>,
    requesterUserId: string,
    requesterName: string,
  ): Promise<void> {
    const view = await Promise.all(
      candidates.map((c) => this.loadView({ guardianId: c.guardian_id, requesterUserId })),
    ).catch(() => []);
    for (const [i, candidate] of candidates.entries()) {
      const details = view[i];
      if (!details) continue;
      const approvalUrl = `${this.appUrl()}/guardian-link?token=${encodeURIComponent(
        this.createToken(candidate.guardian_id, requesterUserId),
      )}`;
      try {
        await this.email.sendGuardianLinkRequest({
          to: candidate.child_email,
          playerFirstName: candidate.player_first_name,
          requesterName,
          guardianName: details.guardianName,
          academyName: candidate.tenant_name,
          approvalUrl,
          expiresInDays: GUARDIAN_LINK_TTL_DAYS,
        });
      } catch (err) {
        this.logger.warn(`Could not send a guardian link e-mail: ${(err as Error)?.message}`);
      }
    }
  }

  /** What the child sees. 400 TOKEN_INVALID / TOKEN_EXPIRED when the link is not or no longer usable. */
  async getRequest(token: string): Promise<GuardianLinkRequestView> {
    const view = await this.loadView(this.parseToken(token));
    if (!view) throw this.linkUsed();
    return view;
  }

  /** The child's answer. Approving links the guardian record to the requesting account. */
  async decide(dto: DecideGuardianLinkRequest): Promise<{ linked: boolean }> {
    const target = this.parseToken(dto.token);
    const view = await this.loadView(target);
    if (!view) throw this.linkUsed();

    if (dto.decision === 'DECLINE') {
      await this.notifyRequester(
        target.requesterUserId,
        'Guardian link declined',
        `${view.playerFirstName} did not approve the link to your account (${view.academyName}).`,
      );
      return { linked: false };
    }

    const rows = await this.prisma.$queryRaw<Array<{ player_id: string }>>`
      SELECT player_id::text AS player_id
      FROM public.approve_guardian_link(${target.guardianId}::uuid, ${target.requesterUserId}::uuid)`;
    if (!rows[0]) throw this.linkUsed();

    await this.notifyRequester(
      target.requesterUserId,
      'Guardian link approved',
      `${view.playerFirstName} approved the link. You can now follow them in your guardian portal (${view.academyName}).`,
    );
    return { linked: true };
  }

  createToken(guardianId: string, requesterUserId: string, now = Date.now()): string {
    const expiresAt = now + GUARDIAN_LINK_TTL_DAYS * 24 * 60 * 60 * 1000;
    const payload = `${TOKEN_VERSION}.${guardianId}.${requesterUserId}.${expiresAt}`;
    return `${payload}.${this.sign(payload)}`;
  }

  parseToken(token: string, now = Date.now()): LinkTarget {
    const parts = (token ?? '').trim().split('.');
    const [version, guardianId, requesterUserId, expiresMs, signature] = parts;
    const uuid = /^[0-9a-f-]{36}$/i;
    const invalid = new BadRequestException({
      code: ErrorCode.TOKEN_INVALID,
      message: 'This link is not valid.',
    });
    if (
      parts.length !== 5 ||
      version !== TOKEN_VERSION ||
      !uuid.test(guardianId ?? '') ||
      !uuid.test(requesterUserId ?? '') ||
      !/^\d+$/.test(expiresMs ?? '') ||
      !signature
    ) {
      throw invalid;
    }
    const payload = `${version}.${guardianId}.${requesterUserId}.${expiresMs}`;
    if (!this.safeEqual(signature, this.sign(payload))) throw invalid;
    if (Number(expiresMs) < now) {
      throw new BadRequestException({
        code: ErrorCode.TOKEN_EXPIRED,
        message: 'This link has expired.',
      });
    }
    return { guardianId: guardianId as string, requesterUserId: requesterUserId as string };
  }

  private async loadView(target: LinkTarget): Promise<GuardianLinkRequestView | null> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        tenant_name: string;
        player_first_name: string;
        guardian_first_name: string;
        guardian_last_name: string;
        requester_name: string;
      }>
    >`SELECT * FROM public.guardian_link_request_view(
        ${target.guardianId}::uuid, ${target.requesterUserId}::uuid
      )`;
    const row = rows[0];
    if (!row) return null;
    return {
      academyName: row.tenant_name,
      playerFirstName: row.player_first_name,
      guardianName: `${row.guardian_first_name} ${row.guardian_last_name}`.trim(),
      requesterName: row.requester_name,
    };
  }

  private async notifyRequester(userId: string, title: string, body: string): Promise<void> {
    try {
      await this.notifications.createNotification({
        userId,
        senderUserId: userId,
        type: 'SYSTEM',
        title,
        body,
        href: '/guardian',
      });
    } catch (err) {
      this.logger.warn(`Could not notify the guardian: ${(err as Error)?.message}`);
    }
  }

  private linkUsed(): BadRequestException {
    return new BadRequestException({
      code: ErrorCode.TOKEN_EXPIRED,
      message: 'This request was already answered or is no longer possible.',
    });
  }

  private appUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  private sign(payload: string): string {
    return crypto
      .createHmac('sha256', `guardian-link|${this.config.jwtSecret}`)
      .update(payload)
      .digest('base64url');
  }

  private safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  }
}
