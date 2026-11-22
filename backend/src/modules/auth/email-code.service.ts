import * as crypto from 'crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ErrorCode,
  type EmailCodeProofResponse,
  type SendEmailCodeResponse,
} from '@academy/shared';
import type { TenantTransactionClient } from '@academy/database';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import { AppConfigService } from '../../config/app-config.service';
import { rateLimitIpKey } from '../../common/client-ip';
import { checkEmailDomain, type DnsResolver, type EmailDomainStatus } from './email-domain';

/** How long a code is valid. */
export const EMAIL_CODE_TTL_SECONDS = 10 * 60;
/** Wrong guesses allowed per code; then the code is discarded and a new one must be requested. */
export const EMAIL_CODE_MAX_ATTEMPTS = 5;
/** Minimum time between two codes for one address. */
export const EMAIL_CODE_RESEND_SECONDS = 60;
/** Codes per address and window, and per network and window. */
const EMAIL_CODE_SENDS_PER_ADDRESS = 5;
const EMAIL_CODE_SENDS_PER_IP = 20;
const EMAIL_CODE_SEND_WINDOW_SECONDS = 60 * 60;
/** How long a confirmed address stays usable for submitting the form. */
export const EMAIL_PROOF_TTL_SECONDS = 30 * 60;

const PROOF_VERSION = 'v1';

/**
 * Confirms that an applicant owns an e-mail address before an account is created for it (academy application, join
 * request): the address gets a 6-digit code, the applicant types it, and the API returns a signed proof that the form
 * sends back. Nothing is written to the database until the form is submitted with a valid proof.
 *
 * Codes are kept hashed in Redis (10 minutes, 5 attempts). The proof is an HMAC over the address and its expiry, so it
 * cannot be forged or reused for another address.
 */
@Injectable()
export class EmailCodeService {
  private readonly logger = new Logger(EmailCodeService.name);
  /** DNS resolver for the domain check; replaced in tests. */
  dnsResolver?: DnsResolver;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(EmailService) private readonly emailService: EmailService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {}

  /** Sends a new code to `email` (already normalised by the request schema). */
  async sendCode(email: string, ipAddress?: string): Promise<SendEmailCodeResponse> {
    const id = this.addressId(email);

    const ipLimit = await this.redis.incrementRateLimit(
      `ratelimit:email-code-ip:${rateLimitIpKey(ipAddress)}`,
      EMAIL_CODE_SEND_WINDOW_SECONDS,
    );
    if (ipLimit.count > EMAIL_CODE_SENDS_PER_IP) {
      throw this.tooManyRequests(ipLimit.remainingTime);
    }
    const cooldown = await this.redis.incrementRateLimit(
      `ratelimit:email-code-cooldown:${id}`,
      EMAIL_CODE_RESEND_SECONDS,
    );
    if (cooldown.count > 1) {
      throw this.tooManyRequests(cooldown.remainingTime);
    }
    const addressLimit = await this.redis.incrementRateLimit(
      `ratelimit:email-code-send:${id}`,
      EMAIL_CODE_SEND_WINDOW_SECONDS,
    );
    if (addressLimit.count > EMAIL_CODE_SENDS_PER_ADDRESS) {
      throw this.tooManyRequests(addressLimit.remainingTime);
    }

    await this.assertDomainAcceptsMail(email, 'email');

    // The sign-up would be refused anyway (the register and join endpoints already answer this); saying it now spares
    // the applicant a code they cannot use.
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new ConflictException({
        code: ErrorCode.EMAIL_ALREADY_EXISTS,
        message: 'An account with this e-mail already exists. Please sign in instead.',
      });
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.redis.setValue(this.codeKey(id), this.hash(code), EMAIL_CODE_TTL_SECONDS);
    await this.redis.resetRateLimit(this.attemptsKey(id));

    const result = await this.emailService.sendEmailConfirmationCode({
      to: email,
      code,
      expiresInMinutes: EMAIL_CODE_TTL_SECONDS / 60,
    });
    if (result.status === 'FAILED') {
      await this.redis.deleteValue(this.codeKey(id));
      // Let the applicant try again straight away: the failure was ours.
      await this.redis.resetRateLimit(`ratelimit:email-code-cooldown:${id}`);
      throw new ServiceUnavailableException({
        code: ErrorCode.EMAIL_DELIVERY_FAILED,
        message: 'The verification e-mail could not be sent. Please try again in a moment.',
      });
    }
    if (result.status === 'DEV_LOGGED' && this.config.nodeEnv !== 'production') {
      // MAIL_PROVIDER=dev sends nothing: show the code in the local server log so sign-ups can be tested.
      this.logger.log(`[DEV] E-mail verification code for ${email}: ${code}`);
    }

    return {
      message: 'A verification code was sent to this e-mail address.',
      expiresInSeconds: EMAIL_CODE_TTL_SECONDS,
    };
  }

  /** Checks a code; on success returns the proof to send with the form. */
  async verifyCode(email: string, code: string): Promise<EmailCodeProofResponse> {
    const id = this.addressId(email);
    const stored = await this.redis.getValue(this.codeKey(id));
    if (!stored) {
      throw new BadRequestException({
        code: ErrorCode.TOKEN_EXPIRED,
        message: 'The code has expired or was not requested. Please ask for a new code.',
      });
    }

    const attempts = await this.redis.incrementRateLimit(
      this.attemptsKey(id),
      EMAIL_CODE_TTL_SECONDS,
    );
    if (attempts.count > EMAIL_CODE_MAX_ATTEMPTS) {
      await this.redis.deleteValue(this.codeKey(id));
      throw new HttpException(
        {
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          message: 'Too many wrong codes. Please ask for a new code.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!this.safeEqual(stored, this.hash(code))) {
      throw new BadRequestException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'The code is not correct.',
      });
    }

    await this.redis.deleteValue(this.codeKey(id));
    await this.redis.resetRateLimit(this.attemptsKey(id));

    const expiresAt = Date.now() + EMAIL_PROOF_TTL_SECONDS * 1000;
    return {
      proof: `${PROOF_VERSION}.${expiresAt}.${this.sign(email, expiresAt)}`,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  /** Refuses the form unless `proof` confirms `email` and has not expired. */
  assertProof(email: string, proof: string | undefined | null): void {
    if (!this.isValidProof(email, proof)) {
      throw new BadRequestException({
        code: ErrorCode.EMAIL_NOT_VERIFIED,
        message: 'Please confirm your e-mail address with the code we sent you.',
      });
    }
  }

  isValidProof(email: string, proof: string | undefined | null): boolean {
    const [version, expiry, signature, ...rest] = (proof ?? '').split('.');
    if (version !== PROOF_VERSION || !expiry || !signature || rest.length > 0) return false;
    const expiresAt = Number(expiry);
    if (!Number.isSafeInteger(expiresAt) || expiresAt < Date.now()) return false;
    return this.safeEqual(signature, this.sign(email.trim().toLowerCase(), expiresAt));
  }

  /**
   * Refuses an address whose domain cannot receive mail (DNS outages let it through, see checkEmailDomain).
   * `field` names the form field in the error, for the client to highlight.
   */
  async assertDomainAcceptsMail(email: string, field: string): Promise<void> {
    const status: EmailDomainStatus = await checkEmailDomain(email, this.dnsResolver);
    if (status === 'no-mail') {
      throw new BadRequestException({
        code: ErrorCode.EMAIL_DOMAIN_INVALID,
        message: 'This e-mail address cannot receive mail. Please check the part after the @.',
        details: { field },
      });
    }
  }

  /**
   * Marks the new account's e-mail as confirmed, inside the transaction that created it. Uses the existing definer
   * functions (the runtime role may not write `is_email_verified` directly): a one-off token is issued and redeemed.
   */
  async markVerifiedInTx(tx: TenantTransactionClient, email: string): Promise<void> {
    const tokenHash = this.hash(crypto.randomBytes(32).toString('hex'));
    const expiresAt = new Date(Date.now() + 60 * 1000);
    await tx.$queryRaw`SELECT public.request_email_verification(${email}, ${tokenHash}, ${expiresAt})::text`;
    await tx.$queryRaw`SELECT public.verify_user_email(${tokenHash})::text`;
  }

  private tooManyRequests(remainingSeconds: number): HttpException {
    return new HttpException(
      {
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: `Please wait ${Math.max(1, remainingSeconds)} seconds before asking for another code.`,
        details: { retryAfterSeconds: Math.max(1, remainingSeconds) },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /** Redis keys use a hash of the address, never the address itself. */
  private addressId(email: string): string {
    return this.hash(`email-code|${email.trim().toLowerCase()}`).slice(0, 40);
  }

  private codeKey(id: string): string {
    return `email-code:${id}`;
  }

  private attemptsKey(id: string): string {
    return `ratelimit:email-code-attempts:${id}`;
  }

  private hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private sign(email: string, expiresAt: number): string {
    return crypto
      .createHmac('sha256', `email-proof|${this.config.jwtSecret}`)
      .update(`${PROOF_VERSION}|${email}|${expiresAt}`)
      .digest('base64url');
  }

  private safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  }
}
