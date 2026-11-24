import * as crypto from 'crypto';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import {
  ErrorCode,
  type AcademyApplicationReplyView,
  type SubmitAcademyApplicationReplyRequest,
} from '@academy/shared';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppConfigService } from '../../config/app-config.service';

/** How long the reply link in a "more details" e-mail works. */
export const APPLICATION_REPLY_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const TOKEN_VERSION = 'r1';

interface ReplyTarget {
  applicationId: string;
  reviewedAt: Date;
}

interface ReplyRow {
  academy_name: string;
  sport: string;
  city: string | null;
  contact_phone: string | null;
  review_notes: string | null;
  applicant_user_id: string;
}

/**
 * The applicant's answer to a "more details" request on an academy application (owner request 2026-11-24).
 *
 * The e-mail carries a signed link: `r1.<applicationId>.<reviewedAtMs>.<expiresAtMs>.<HMAC>`. The application id and
 * the time of the request (reviewed_at) are signed, so the link works only for that request: once answered (status goes
 * back to PENDING_REVIEW) or when the platform makes a newer request, it stops working. The applicant cannot sign in
 * yet, so the database work goes through two narrow definer functions (migration 20261124090000).
 */
@Injectable()
export class ApplicationReplyService {
  private readonly logger = new Logger(ApplicationReplyService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {}

  /** The link token for the request made at `reviewedAt`. */
  createToken(applicationId: string, reviewedAt: Date, now = Date.now()): string {
    const expiresAt = now + APPLICATION_REPLY_TTL_MS;
    const payload = `${TOKEN_VERSION}.${applicationId}.${reviewedAt.getTime()}.${expiresAt}`;
    return `${payload}.${this.sign(payload)}`;
  }

  /** What the reply page shows. 400 TOKEN_INVALID / TOKEN_EXPIRED when the link is not (or no longer) usable. */
  async getView(token: string): Promise<AcademyApplicationReplyView> {
    const row = await this.loadOpenRequest(this.parseToken(token));
    return {
      academyName: row.academy_name,
      sport: row.sport,
      city: row.city,
      contactPhone: row.contact_phone,
      reviewNotes: row.review_notes,
    };
  }

  /** Stores the answer, returns the application to review and notifies the platform admins. */
  async submit(dto: SubmitAcademyApplicationReplyRequest): Promise<{ success: true }> {
    const target = this.parseToken(dto.token);
    const request = await this.loadOpenRequest(target);

    const rows = await this.prisma.$queryRaw<Array<{ ok: boolean }>>`
      SELECT public.submit_academy_application_reply(
        ${target.applicationId}::uuid, ${target.reviewedAt}::timestamptz, ${dto.reply},
        ${dto.city ?? null}, ${dto.contactPhone ?? null}
      ) AS ok`;
    if (!rows[0]?.ok) throw this.linkUsed();

    await this.notifyPlatformAdmins(request);
    return { success: true };
  }

  private async loadOpenRequest(target: ReplyTarget): Promise<ReplyRow> {
    const rows = await this.prisma.$queryRaw<ReplyRow[]>`
      SELECT * FROM public.academy_application_for_reply(
        ${target.applicationId}::uuid, ${target.reviewedAt}::timestamptz
      )`;
    const row = rows[0];
    if (!row) throw this.linkUsed();
    return row;
  }

  private async notifyPlatformAdmins(request: ReplyRow): Promise<void> {
    try {
      const admins = await this.prisma.user.findMany({
        where: {
          OR: [{ isPlatformSuperAdmin: true }, { isPlatformOwner: true }],
          isSuspended: false,
        },
        select: { id: true },
      });
      for (const admin of admins) {
        await this.notifications.createNotification({
          userId: admin.id,
          senderUserId: request.applicant_user_id,
          type: 'ACADEMY_APPLICATION',
          title: 'Academy applicant replied',
          body: `"${request.academy_name}" answered the requested details and is waiting for review again.`,
          href: '/platform?tab=applications',
        });
      }
    } catch (err) {
      // The reply is stored; a failed notification must not undo it.
      this.logger.warn(`Could not notify platform admins of a reply: ${(err as Error)?.message}`);
    }
  }

  /** Splits and checks a token. Throws 400 TOKEN_INVALID (forged, malformed) or TOKEN_EXPIRED. */
  parseToken(token: string, now = Date.now()): ReplyTarget {
    const parts = (token ?? '').trim().split('.');
    const [version, applicationId, reviewedMs, expiresMs, signature] = parts;
    const invalid = new BadRequestException({
      code: ErrorCode.TOKEN_INVALID,
      message: 'This reply link is not valid.',
    });
    if (
      parts.length !== 5 ||
      version !== TOKEN_VERSION ||
      !applicationId ||
      !/^[0-9a-f-]{36}$/i.test(applicationId) ||
      !/^\d+$/.test(reviewedMs ?? '') ||
      !/^\d+$/.test(expiresMs ?? '') ||
      !signature
    ) {
      throw invalid;
    }
    const payload = `${version}.${applicationId}.${reviewedMs}.${expiresMs}`;
    if (!this.safeEqual(signature, this.sign(payload))) throw invalid;
    if (Number(expiresMs) < now) {
      throw new BadRequestException({
        code: ErrorCode.TOKEN_EXPIRED,
        message: 'This reply link has expired. Please contact the Sportexus team.',
      });
    }
    return { applicationId, reviewedAt: new Date(Number(reviewedMs)) };
  }

  private linkUsed(): BadRequestException {
    return new BadRequestException({
      code: ErrorCode.TOKEN_EXPIRED,
      message:
        'This request was already answered, or a newer request replaced it. Use the link in the latest e-mail.',
    });
  }

  private sign(payload: string): string {
    return crypto
      .createHmac('sha256', `application-reply|${this.config.jwtSecret}`)
      .update(payload)
      .digest('base64url');
  }

  private safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  }
}
