import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SentEmailRecord {
  to: string;
  subject: string;
  html: string;
  text: string;
  sentAt: Date;
  actionUrl?: string;
  provider: 'resend' | 'smtp' | 'dev';
  status: 'SENT' | 'DEV_LOGGED' | 'FAILED';
  messageId?: string;
  error?: string;
  attempts?: number;
  idempotentSkipped?: boolean;
}

export interface SendEmailResult {
  delivered: boolean;
  status: 'SENT' | 'DEV_LOGGED' | 'FAILED';
  provider: 'resend' | 'smtp' | 'dev';
  messageId?: string;
  error?: string;
  sentAt: Date;
  idempotentSkipped?: boolean;
}

export interface EmailSystemStatus {
  activeProvider: 'resend' | 'smtp' | 'dev';
  fromEmail: string;
  fromName: string;
  resendConfigured: boolean;
  smtpConfigured: boolean;
  queueLength: number;
  totalDispatched: number;
  totalFailed: number;
  uptimeSeconds: number;
}

/**
 * Escapes unsafe characters for HTML email templates to prevent XSS.
 */
export function escapeHtml(unsafe: unknown): string {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Dark colours of the e-mail shell and of the light colours used inside e-mail bodies, applied when the reader's
 * device is in dark mode (`renderBaseTemplate`). Body elements are matched by the light colour in their inline style,
 * so every existing e-mail follows without per-e-mail changes.
 */
export const EMAIL_DARK_MODE_CSS = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
  .sx-page { background:#0b1220 !important; }
  .sx-card { background:#111827 !important; border-color:#1f2937 !important; }
  .sx-strong { color:#f1f5f9 !important; }
  .sx-text { color:#cbd5e1 !important; }
  .sx-text strong { color:#f1f5f9 !important; }
  .sx-foot { background:#0f172a !important; border-color:#1f2937 !important; color:#94a3b8 !important; }
  .sx-foot a { color:#60a5fa !important; }
  .sx-text [style*="#f8fafc"], .sx-text [style*="#f1f5f9"] { background:#1e293b !important; border-color:#334155 !important; }
  .sx-text [style*="#e2e8f0"] { border-color:#334155 !important; }
  .sx-text [style*="#eff6ff"], .sx-text [style*="rgba(10, 59, 255"] { background:#172554 !important; border-color:#1e40af !important; color:#bfdbfe !important; }
  .sx-text [style*="#f0fdf4"] { background:#052e16 !important; border-color:#166534 !important; color:#bbf7d0 !important; }
  .sx-text [style*="#fffbeb"], .sx-text [style*="rgba(245, 158, 11"] { background:#451a03 !important; border-color:#92400e !important; color:#fde68a !important; }
  .sx-text [style*="#fef2f2"], .sx-text [style*="rgba(239, 68, 68"] { background:#450a0a !important; border-color:#991b1b !important; color:#fecaca !important; }
  .sx-text [style*="color: #0F172A"], .sx-text [style*="color:#0F172A"], .sx-text [style*="color: #334155"] { color:#f1f5f9 !important; }
  .sx-text [style*="color: #64748b"], .sx-text [style*="color:#64748b"] { color:#94a3b8 !important; }
  .sx-text [style*="color: #15803d"], .sx-text [style*="color: #15803D"], .sx-text [style*="color:#16A34A"] { color:#4ade80 !important; }
  .sx-text [style*="color: #0A3BFF"], .sx-text [style*="color:#0A3BFF"] { color:#60a5fa !important; }
  .sx-text [style*="color: #b91c1c"], .sx-text [style*="color: #dc2626"], .sx-text [style*="color: #ef4444"] { color:#fca5a5 !important; }
  .sx-text [style*="color: #b45309"] { color:#fcd34d !important; }
  .sx-text a[style*="color:#ffffff"] { color:#ffffff !important; }
}
`;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly sentEmailsQueue: SentEmailRecord[] = [];
  private readonly maxQueueLength = 100;

  // Idempotency tracking (keyed by recipient:subject:hash)
  private readonly idempotencyCache = new Map<
    string,
    { timestamp: number; result: SendEmailResult }
  >();
  private readonly idempotencyWindowMs = 60 * 1000; // 60 seconds

  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly resendApiKey?: string;
  private readonly appPublicUrl: string;
  /** Language of every e-mail the platform sends (MAIL_LOCALE: 'en' default, or 'ar'). */
  private readonly emailLocale: 'ar' | 'en';

  private readonly smtpHost?: string;
  private readonly smtpPort: number;
  private readonly smtpUser?: string;
  private readonly smtpPass?: string;
  private readonly smtpSecure: boolean;

  private readonly configuredProvider: 'resend' | 'smtp' | 'dev';
  private smtpTransporter: Transporter | null = null;
  private readonly initializedAt = Date.now();
  private totalDispatched = 0;
  private totalFailed = 0;

  constructor(private readonly configService: ConfigService) {
    this.fromEmail =
      this.configService.get<string>('MAIL_FROM_EMAIL') ||
      this.configService.get<string>('SMTP_FROM') ||
      'no-reply@sportexus.com';
    this.fromName = this.configService.get<string>('MAIL_FROM_NAME') || 'Sportexus Platform';
    this.resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    this.appPublicUrl =
      this.configService.get<string>('NEXT_PUBLIC_APP_URL') ||
      this.configService.get<string>('APP_PUBLIC_URL') ||
      'http://localhost:3000';

    this.emailLocale =
      this.configService.get<string>('MAIL_LOCALE')?.trim().toLowerCase() === 'ar' ? 'ar' : 'en';

    this.smtpHost = this.configService.get<string>('SMTP_HOST');
    this.smtpPort = Number(this.configService.get<string | number>('SMTP_PORT')) || 587;
    this.smtpUser = this.configService.get<string>('SMTP_USER');
    this.smtpPass = this.configService.get<string>('SMTP_PASS');
    const rawSecure = this.configService.get<string | boolean>('SMTP_SECURE');
    this.smtpSecure = rawSecure === true || rawSecure === 'true' || this.smtpPort === 465;

    // Determine provider
    const explicitProvider = this.configService.get<string>('MAIL_PROVIDER')?.toLowerCase();
    if (
      explicitProvider === 'resend' ||
      explicitProvider === 'smtp' ||
      explicitProvider === 'dev'
    ) {
      this.configuredProvider = explicitProvider;
    } else if (this.resendApiKey && !this.resendApiKey.includes('placeholder')) {
      this.configuredProvider = 'resend';
    } else if (this.smtpHost && this.smtpHost.trim() !== '') {
      this.configuredProvider = 'smtp';
    } else {
      this.configuredProvider = 'dev';
    }

    if (this.configuredProvider === 'smtp') {
      this.initSmtpTransporter();
    }

    this.logger.log(
      `EmailService initialized using [${this.configuredProvider.toUpperCase()}] provider. From: ${this.fromName} <${this.fromEmail}>`,
    );
  }

  /**
   * Initializes Nodemailer SMTP transporter.
   */
  private initSmtpTransporter(): void {
    if (!this.smtpHost) return;
    try {
      this.smtpTransporter = nodemailer.createTransport({
        host: this.smtpHost,
        port: this.smtpPort,
        secure: this.smtpSecure,
        auth:
          this.smtpUser && this.smtpPass
            ? {
                user: this.smtpUser,
                pass: this.smtpPass,
              }
            : undefined,
        connectionTimeout: 10000,
        greetingTimeout: 8000,
        socketTimeout: 15000,
      });
      this.logger.log(`SMTP transporter created for host: ${this.smtpHost}:${this.smtpPort}`);
    } catch (err) {
      this.logger.error(`Failed to initialize SMTP transporter: ${(err as Error)?.message}`);
      this.smtpTransporter = null;
    }
  }

  /**
   * Masks sensitive credentials/tokens in URL strings for secure logging.
   */
  private maskSensitiveUrl(url?: string): string | undefined {
    if (!url) return undefined;
    // Covers query strings and URL fragments (reset links carry their token after `#`, K1).
    return url.replace(/([?&#](token|code|otp|key|secret)=)[^&#]+/gi, '$1***');
  }

  /**
   * Generates a stable idempotency key for an email request.
   */
  private generateIdempotencyKey(to: string, subject: string, textSnippet: string): string {
    const raw = `${to.trim().toLowerCase()}:${subject.trim()}:${textSnippet.slice(0, 60)}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `email:${to.trim().toLowerCase()}:${Math.abs(hash)}`;
  }

  /**
   * Core dispatch method with exponential backoff retry and idempotency checking.
   */
  async sendEmailDetailed(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
    actionUrl?: string;
    idempotencyKey?: string;
    forceSend?: boolean;
  }): Promise<SendEmailResult> {
    const normalizedTo = options.to.trim().toLowerCase();
    const idemKey =
      options.idempotencyKey ||
      this.generateIdempotencyKey(normalizedTo, options.subject, options.text);

    // 1. Idempotency Check
    if (!options.forceSend) {
      const cached = this.idempotencyCache.get(idemKey);
      if (cached && Date.now() - cached.timestamp < this.idempotencyWindowMs) {
        this.logger.debug(
          `Idempotent email send suppressed for ${normalizedTo} [${options.subject}]. Cache hit within ${this.idempotencyWindowMs / 1000}s.`,
        );
        return {
          ...cached.result,
          idempotentSkipped: true,
        };
      }
    }

    let attempts = 0;
    const maxRetries = 3;
    let lastError: string | undefined;
    let messageId: string | undefined;
    let delivered = false;
    let status: 'SENT' | 'DEV_LOGGED' | 'FAILED' = 'FAILED';

    const provider = this.configuredProvider;

    // Retry loop with exponential backoff for transient failures
    while (attempts < maxRetries && !delivered) {
      attempts++;
      try {
        if (provider === 'resend' && this.resendApiKey) {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `${this.fromName} <${this.fromEmail}>`,
              to: [normalizedTo],
              subject: options.subject,
              html: options.html,
              text: options.text,
            }),
          });

          if (!res.ok) {
            const errBody = await res.text();
            if (
              res.status === 403 &&
              errBody.includes('domain is not verified') &&
              !this.fromEmail.includes('onboarding@resend.dev')
            ) {
              this.logger.warn(
                `Sender <${this.fromEmail}> is not verified on Resend; retrying via fallback <onboarding@resend.dev>`,
              );
              const fallbackRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${this.resendApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: `${this.fromName} <onboarding@resend.dev>`,
                  to: [normalizedTo],
                  subject: options.subject,
                  html: options.html,
                  text: options.text,
                }),
              });
              if (fallbackRes.ok) {
                const fbData = (await fallbackRes.json()) as { id?: string };
                messageId = fbData?.id;
                delivered = true;
                status = 'SENT';
                break;
              }
            }
            throw new Error(`Resend API error (${res.status}): ${errBody}`);
          }

          const data = (await res.json()) as { id?: string };
          messageId = data?.id;
          delivered = true;
          status = 'SENT';
        } else if (provider === 'smtp' && this.smtpTransporter) {
          const info = await this.smtpTransporter.sendMail({
            from: `"${this.fromName}" <${this.fromEmail}>`,
            to: normalizedTo,
            subject: options.subject,
            html: options.html,
            text: options.text,
          });

          messageId = info?.messageId;
          delivered = true;
          status = 'SENT';
        } else {
          // Dev / In-Memory Mock logger
          delivered = true;
          status = 'DEV_LOGGED';
          messageId = `dev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        }
      } catch (err: unknown) {
        lastError = (err as Error)?.message || 'Unknown network error';
        this.logger.warn(
          `Email delivery attempt ${attempts}/${maxRetries} failed for ${normalizedTo} via ${provider}: ${lastError}`,
        );

        if (attempts < maxRetries) {
          const backoffDelay = 200 * Math.pow(2.5, attempts - 1) + Math.random() * 50;
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        }
      }
    }

    const now = new Date();
    if (delivered) {
      this.totalDispatched++;
      if (status === 'DEV_LOGGED') {
        this.logger.log(
          `[DEV EMAIL DISPATCHED] To: ${normalizedTo} | Subject: "${options.subject}" | Provider: DEV | Link: ${this.maskSensitiveUrl(options.actionUrl) ?? 'N/A'}`,
        );
      } else {
        this.logger.log(
          `Email dispatched via ${provider.toUpperCase()} to ${normalizedTo} [${options.subject}] (id: ${messageId}) in ${attempts} attempt(s)`,
        );
      }
    } else {
      this.totalFailed++;
      this.logger.error(
        `Email delivery completely failed after ${attempts} attempt(s) to ${normalizedTo} [${options.subject}]: ${lastError}`,
      );
    }

    const record: SentEmailRecord = {
      to: normalizedTo,
      subject: options.subject,
      html: options.html,
      text: options.text,
      sentAt: now,
      actionUrl: options.actionUrl,
      provider,
      status,
      messageId,
      error: lastError,
      attempts,
    };

    // Keep circular buffer of recent emails
    this.sentEmailsQueue.unshift(record);
    if (this.sentEmailsQueue.length > this.maxQueueLength) {
      this.sentEmailsQueue.pop();
    }

    const result: SendEmailResult = {
      delivered,
      status,
      provider,
      messageId,
      error: lastError,
      sentAt: now,
    };

    // Cache result for idempotency window
    if (delivered) {
      this.idempotencyCache.set(idemKey, { timestamp: Date.now(), result });
      // Evict old cache entries
      if (this.idempotencyCache.size > 200) {
        const threshold = Date.now() - this.idempotencyWindowMs;
        for (const [key, value] of this.idempotencyCache.entries()) {
          if (value.timestamp < threshold) {
            this.idempotencyCache.delete(key);
          }
        }
      }
    }

    return result;
  }

  /**
   * Backwards-compatible dispatch returning a simple boolean flag.
   */
  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
    actionUrl?: string;
  }): Promise<boolean> {
    const res = await this.sendEmailDetailed(options);
    return res.delivered;
  }

  /**
   * Returns recent recorded emails for inspections/tests.
   */
  getSentEmails(): readonly SentEmailRecord[] {
    return this.sentEmailsQueue;
  }

  /**
   * Clears in-memory sent emails queue and idempotency cache (for tests).
   */
  clearSentEmails(): void {
    this.sentEmailsQueue.length = 0;
    this.idempotencyCache.clear();
  }

  /**
   * Retrieves operational health and statistics for the email subsystem.
   */
  getEmailStatus(): EmailSystemStatus {
    return {
      activeProvider: this.configuredProvider,
      fromEmail: this.fromEmail,
      fromName: this.fromName,
      resendConfigured: Boolean(this.resendApiKey && !this.resendApiKey.includes('placeholder')),
      smtpConfigured: Boolean(this.smtpHost && this.smtpHost.trim() !== ''),
      queueLength: this.sentEmailsQueue.length,
      totalDispatched: this.totalDispatched,
      totalFailed: this.totalFailed,
      uptimeSeconds: Math.floor((Date.now() - this.initializedAt) / 1000),
    };
  }

  // =========================================================================
  // BILINGUAL TEMPLATES (RTL/LTR, ESCAPED, DARK SPORTEXUS AESTHETIC)
  // =========================================================================

  /**
   * 1. Academy Application Received acknowledgment.
   */
  async sendAcademyApplicationReceived(
    to: string,
    ownerName: string,
    academyName: string,
    requestedLocale?: 'ar' | 'en',
  ): Promise<SendEmailResult> {
    // The platform's e-mail language (MAIL_LOCALE) unless a caller asks for a specific one.
    const locale = requestedLocale ?? this.emailLocale;
    const isAr = locale === 'ar';
    const safeOwner = escapeHtml(ownerName);
    const safeAcademy = escapeHtml(academyName);

    const subject = isAr
      ? `تم استلام طلب تسجيل أكاديمية: ${academyName} — سبورتكسس`
      : `Application Received: ${academyName} — Sportexus`;

    const html = this.renderBaseTemplate({
      locale,
      preheader: isAr
        ? `طلب تسجيل أكاديميتك قيد المراجعة حالياً.`
        : `Your academy registration is currently under review.`,
      title: isAr ? 'تم استلام طلبك بنجاح' : 'Registration Application Received',
      greeting: isAr ? `مرحباً ${safeOwner}،` : `Hello ${safeOwner},`,
      bodyHtml: isAr
        ? `<p>شكراً لاهتمامك بالانضمام إلى منصة <strong>سبورتكسس (Sportexus)</strong>.</p>
           <p>تم استلام طلب تسجيل أكاديمية <strong>"${safeAcademy}"</strong> بنجاح، ويقوم فريق إدارة المنصة بمراجعة البيانات المدخلة.</p>
           <p>سيصلك إشعار بالبريد الإلكتروني فور اعتماد الأكاديمية لبدء إدارة الفروع والمشتركين والاشتراكات.</p>`
        : `<p>Thank you for choosing <strong>Sportexus</strong>.</p>
           <p>We have successfully received the registration request for <strong>"${safeAcademy}"</strong>. Our platform administrators are reviewing your submission.</p>
           <p>You will receive an activation email as soon as your academy is approved.</p>`,
    });

    const text = isAr
      ? `مرحباً ${ownerName}، تم استلام طلب تسجيل أكاديمية "${academyName}" بنجاح وهو قيد المراجعة.`
      : `Hello ${ownerName}, your registration application for "${academyName}" has been received and is under review.`;

    return this.sendEmailDetailed({ to, subject, html, text });
  }

  /**
   * 2. Academy Approved notification with platform activation link.
   */
  async sendAcademyApproved(
    to: string,
    ownerName: string,
    academyName: string,
    activationUrl: string,
    requestedLocale?: 'ar' | 'en',
    /** The reviewer's notes, shown to the owner when given. */
    notes?: string | null,
  ): Promise<SendEmailResult> {
    // The platform's e-mail language (MAIL_LOCALE) unless a caller asks for a specific one.
    const locale = requestedLocale ?? this.emailLocale;
    const isAr = locale === 'ar';
    const safeOwner = escapeHtml(ownerName);
    const safeAcademy = escapeHtml(academyName);
    const safeNotes = notes?.trim() ? escapeHtml(notes.trim()) : '';
    const notesHtml = safeNotes
      ? this.calloutHtml('info', isAr ? 'ملاحظات المراجعة' : 'Review notes', safeNotes)
      : '';

    const subject = isAr
      ? `تهانينا! تم اعتماد أكاديمية "${academyName}" على سبورتكسس`
      : `Congratulations! ${academyName} is Approved on Sportexus`;

    const html = this.renderBaseTemplate({
      locale,
      preheader: isAr ? `أكاديميتك جاهزة الآن للعمل.` : `Your academy is now ready for use.`,
      title: isAr ? 'تم اعتماد وتفعيل الأكاديمية' : 'Academy Approved & Activated',
      greeting: isAr ? `أهلاً ${safeOwner}،` : `Hello ${safeOwner},`,
      bodyHtml: isAr
        ? `<p>يسرنا إبلاغك بأنه تمت الموافقة على طلب تسجيل أكاديمية <strong>"${safeAcademy}"</strong> وتفعيل مساحة العمل الخاصة بك على منصة سبورتكسس.</p>
           ${notesHtml}
           <p>يمكنك الآن تسجيل الدخول والبدء في إعداد الفروع، إضافة المدربين واللاعبين، وإدارة الحصص التدريبية والاشتراكات.</p>`
        : `<p>We are delighted to inform you that your application for <strong>"${safeAcademy}"</strong> has been approved and your workspace is now active.</p>
           ${notesHtml}
           <p>You can now sign in and begin configuring your branches, coaches, players, schedules, and finances.</p>`,
      actionButton: {
        label: isAr ? 'الدخول إلى لوحة التحكم' : 'Open Academy Dashboard',
        url: activationUrl,
      },
    });

    const notesText = notes?.trim()
      ? isAr
        ? ` ملاحظات المراجعة: ${notes.trim()}`
        : ` Review notes: ${notes.trim()}`
      : '';
    const text = isAr
      ? `تهانينا ${ownerName}! تم اعتماد أكاديمية "${academyName}".${notesText} رابط لوحة التحكم: ${activationUrl}`
      : `Congratulations ${ownerName}! ${academyName} is approved.${notesText} Access your dashboard here: ${activationUrl}`;

    return this.sendEmailDetailed({ to, subject, html, text, actionUrl: activationUrl });
  }

  /**
   * 3. Academy Rejected notification with constructive review notes.
   */
  async sendAcademyRejected(
    to: string,
    ownerName: string,
    academyName: string,
    reason?: string,
    requestedLocale?: 'ar' | 'en',
  ): Promise<SendEmailResult> {
    // The platform's e-mail language (MAIL_LOCALE) unless a caller asks for a specific one.
    const locale = requestedLocale ?? this.emailLocale;
    const isAr = locale === 'ar';
    const safeOwner = escapeHtml(ownerName);
    const safeAcademy = escapeHtml(academyName);
    const safeReason = escapeHtml(
      reason ||
        (isAr ? 'لم يستوفِ الشروط المعتمدة لدى المنصة' : 'Requirements criteria not fully met'),
    );

    const subject = isAr
      ? `تحديث بخصوص طلب تسجيل أكاديمية "${academyName}" — سبورتكسس`
      : `Update on Academy Application: ${academyName} — Sportexus`;

    const html = this.renderBaseTemplate({
      locale,
      preheader: isAr
        ? `تحديث بخصوص طلب تسجيل أكاديميتك.`
        : `Update regarding your academy application.`,
      title: isAr ? 'تحديث بشأن طلب التسجيل' : 'Application Decision Update',
      greeting: isAr ? `مرحباً ${safeOwner}،` : `Hello ${safeOwner},`,
      bodyHtml: isAr
        ? `<p>نشكرك على اهتمامك بمنصة <strong>سبورتكسس</strong>.</p>
           <p>نأسف لإبلاغك بأنه تعذر قبول طلب تسجيل أكاديمية <strong>"${safeAcademy}"</strong> في الوقت الحالي.</p>
           <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 14px; margin: 16px 0; color: #b91c1c;">
             <strong>ملاحظات المراجعة:</strong><br/>
             ${safeReason}
           </div>
           <p>يمكنك التواصل مع فريق الدعم الفني لمزيد من الاستفسارات أو إعادة التقديم بعد استيفاء المتطلبات.</p>`
        : `<p>Thank you for your interest in <strong>Sportexus</strong>.</p>
           <p>We regret to inform you that we are unable to approve the application for <strong>"${safeAcademy}"</strong> at this time.</p>
           <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 14px; margin: 16px 0; color: #b91c1c;">
             <strong>Review Notes:</strong><br/>
             ${safeReason}
           </div>
           <p>You may contact our support team for clarifications or submit an updated application once requirements are met.</p>`,
    });

    const text = isAr
      ? `مرحباً ${ownerName}، نأسف لإبلاغك بتعذر قبول طلب تسجيل أكاديمية "${academyName}". ملاحظات: ${reason || 'لم يستوفِ الشروط'}.`
      : `Hello ${ownerName}, your application for "${academyName}" was not approved. Notes: ${reason || 'Criteria not met'}.`;

    return this.sendEmailDetailed({ to, subject, html, text });
  }

  /**
   * 4. Academy More Info Requested notification.
   */
  async sendAcademyMoreInfoRequested(
    to: string,
    ownerName: string,
    academyName: string,
    notes?: string,
    requestedLocale?: 'ar' | 'en',
    /** The signed link to the reply page; without it the e-mail asks to contact the team. */
    replyUrl?: string,
  ): Promise<SendEmailResult> {
    // The platform's e-mail language (MAIL_LOCALE) unless a caller asks for a specific one.
    const locale = requestedLocale ?? this.emailLocale;
    const isAr = locale === 'ar';
    const safeOwner = escapeHtml(ownerName);
    const safeAcademy = escapeHtml(academyName);
    const safeNotes = escapeHtml(
      notes ||
        (isAr ? 'يرجى تقديم بيانات إضافية لاستكمال المراجعة' : 'Additional documentation required'),
    );

    const subject = isAr
      ? `مطلوب معلومات إضافية لطلب تسجيل أكاديمية "${academyName}" — سبورتكسس`
      : `Additional Information Required: ${academyName} — Sportexus`;

    const html = this.renderBaseTemplate({
      locale,
      preheader: isAr
        ? `مطلوب بيانات إضافية لاستكمال الطلب.`
        : `Additional details required for your application.`,
      title: isAr ? 'مطلوب معلومات إضافية' : 'Information Required',
      greeting: isAr ? `مرحباً ${safeOwner}،` : `Hello ${safeOwner},`,
      bodyHtml: isAr
        ? `<p>يقوم فريق مراجعة منصة <strong>سبورتكسس</strong> بدراسة طلب تسجيل أكاديمية <strong>"${safeAcademy}"</strong>.</p>
           <p>نرجو التكرم بتزويدنا بالمعلومات الإضافية التالية لاستكمال إجراءات الاعتماد:</p>
           <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 14px; margin: 16px 0; color: #b45309;">
             <strong>المطلوب:</strong><br/>
             ${safeNotes}
           </div>
           <p>${
             replyUrl
               ? 'اضغط الزر بالأسفل لكتابة ردك وتحديث بيانات الطلب؛ سيعود الطلب للمراجعة فور إرساله.'
               : 'يرجى التواصل مع فريق الدعم لتحديث ملفك.'
           }</p>`
        : `<p>Our platform review team is currently evaluating the application for <strong>"${safeAcademy}"</strong>.</p>
           <p>Please provide the following additional information to complete your verification:</p>
           <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 14px; margin: 16px 0; color: #b45309;">
             <strong>Required Details:</strong><br/>
             ${safeNotes}
           </div>
           <p>${
             replyUrl
               ? 'Press the button below to write your answer and update the application; it goes back to review as soon as you send it.'
               : 'Please reach out to our team with the requested details.'
           }</p>`,
      actionButton: replyUrl
        ? { label: isAr ? 'الرد على الطلب' : 'Answer the request', url: replyUrl }
        : undefined,
    });

    const text = isAr
      ? `مرحباً ${ownerName}، مطلوب معلومات إضافية لطلب تسجيل "${academyName}": ${notes || ''}`
      : `Hello ${ownerName}, additional information is required for "${academyName}": ${notes || ''}`;
    const textWithLink = replyUrl
      ? `${text}
${isAr ? 'للرد:' : 'Answer here:'} ${replyUrl}`
      : text;

    return this.sendEmailDetailed({ to, subject, html, text: textWithLink, actionUrl: replyUrl });
  }

  /**
   * 5. Password Reset Link with single-use expiring token.
   */
  async sendPasswordReset(
    to: string,
    name: string,
    resetUrl: string,
    requestedLocale?: 'ar' | 'en',
    otpCode?: string,
  ): Promise<SendEmailResult> {
    // The platform's e-mail language (MAIL_LOCALE) unless a caller asks for a specific one.
    const locale = requestedLocale ?? this.emailLocale;
    const isAr = locale === 'ar';
    const safeName = escapeHtml(name);
    const safeOtp = otpCode ? escapeHtml(otpCode) : null;

    const subject = isAr
      ? `رمز إعادة تعيين كلمة المرور — سبورتكسس`
      : `Password Reset Verification Code — Sportexus`;

    const otpHtml = safeOtp
      ? `<div style="background: rgba(10, 59, 255, 0.08); border: 2px dashed #0A3BFF; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
           <div style="font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; font-weight: 600;">
             ${isAr ? 'رمز التحقق لمرة واحدة (OTP)' : 'One-Time Verification Code (OTP)'}
           </div>
           <div style="font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #0A3BFF; font-family: monospace;">
             ${safeOtp}
           </div>
           <div style="font-size: 13px; color: #ef4444; margin-top: 8px; font-weight: 600;">
             ${isAr ? 'ينتهي هذا الرمز خلال 5 دقائق' : 'This code expires in 5 minutes'}
           </div>
         </div>`
      : '';

    const html = this.renderBaseTemplate({
      locale,
      preheader: isAr ? `رمز إعادة تعيين كلمة المرور الخاص بك.` : `Your password reset code.`,
      title: isAr ? 'طلب إعادة تعيين كلمة المرور' : 'Password Reset Request',
      greeting: isAr ? `مرحباً ${safeName}،` : `Hello ${safeName},`,
      bodyHtml: isAr
        ? `<p>تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك على منصة سبورتكسس.</p>
           ${otpHtml}
           <p>استخدم رمز التحقق أعلاه أو انقر على الزر أدناه لإعادة تعيين كلمة المرور. الرمز صالح لمدة <strong>5 دقائق فقط</strong>.</p>
           <p style="color: #64748b; font-size: 13px;">إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة بأمان وستظل كلمة مرورك الحالية دون تغيير.</p>`
        : `<p>We received a request to reset the password for your Sportexus account.</p>
           ${otpHtml}
           <p>Use the verification code above or click the button below to reset your password. This code is valid for <strong>5 minutes only</strong>.</p>
           <p style="color: #64748b; font-size: 13px;">If you did not request this, you can safely ignore this email.</p>`,
      actionButton: {
        label: isAr ? 'تعيين كلمة المرور الجديدة' : 'Reset My Password',
        url: resetUrl,
      },
    });

    const text = isAr
      ? `مرحباً ${name}، رمز إعادة تعيين كلمة المرور هو: ${otpCode || 'راجع الرابط'} (صالح لمدة 5 دقائق). الرابط: ${resetUrl}`
      : `Hello ${name}, your password reset code is: ${otpCode || 'see link'} (expires in 5 minutes). Link: ${resetUrl}`;

    return this.sendEmailDetailed({ to, subject, html, text, actionUrl: resetUrl });
  }

  /**
   * 6. Password Changed Security Notification.
   */
  async sendPasswordChangedNotification(
    to: string,
    name: string,
    details?: {
      ipAddress?: string;
      userAgent?: string;
      changedAt?: Date;
    },
    requestedLocale?: 'ar' | 'en',
  ): Promise<SendEmailResult> {
    // The platform's e-mail language (MAIL_LOCALE) unless a caller asks for a specific one.
    const locale = requestedLocale ?? this.emailLocale;
    const isAr = locale === 'ar';
    const safeName = escapeHtml(name);
    const dateFormatted = (details?.changedAt || new Date()).toLocaleString(
      isAr ? 'ar-SA' : 'en-US',
      { timeZone: 'UTC' },
    );
    const safeIp = escapeHtml(details?.ipAddress || (isAr ? 'غير محدد' : 'Unknown'));

    const subject = isAr
      ? `تنبيه أمان: تم تغيير كلمة مرور حسابك — سبورتكسس`
      : `Security Alert: Your Password Was Changed — Sportexus`;

    const html = this.renderBaseTemplate({
      locale,
      preheader: isAr
        ? `تم تغيير كلمة المرور الخاصة بحسابك بنجاح.`
        : `Your account password has been updated.`,
      title: isAr ? 'تنبيه أمان الحساب' : 'Security Notification',
      greeting: isAr ? `مرحباً ${safeName}،` : `Hello ${safeName},`,
      bodyHtml: isAr
        ? `<p>نود إبلاغك بأنه قد تم <strong>تغيير كلمة المرور</strong> لحسابك على منصة سبورتكسس بنجاح.</p>
           <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0; font-size: 13px; color: #64748b;">
             <div><strong>التاريخ والتوقيت:</strong> ${dateFormatted} UTC</div>
             <div><strong>عنوان IP:</strong> ${safeIp}</div>
           </div>
           <p style="color: #dc2626; font-size: 13px;">إذا لم تقم بتغيير كلمة المرور بنفسك، يرجى التوجه فوراً لإعادة تعيينها والتواصل مع إدارة المنصة لتأمين حسابك.</p>`
        : `<p>This is a confirmation that the password for your Sportexus account has been <strong>successfully changed</strong>.</p>
           <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0; font-size: 13px; color: #64748b;">
             <div><strong>Date & Time:</strong> ${dateFormatted} UTC</div>
             <div><strong>IP Address:</strong> ${safeIp}</div>
           </div>
           <p style="color: #dc2626; font-size: 13px;">If you did not perform this change, please reset your password immediately and contact support.</p>`,
    });

    const text = isAr
      ? `مرحباً ${name}، تم تغيير كلمة المرور لحسابك في ${dateFormatted} UTC من IP ${safeIp}. إذا لم تكن أنت، يرجى استعادة حسابك فوراً.`
      : `Hello ${name}, your Sportexus password was changed at ${dateFormatted} UTC from IP ${safeIp}. If this was not you, please secure your account immediately.`;

    return this.sendEmailDetailed({ to, subject, html, text });
  }

  /**
   * 7. Email Verification Link with single-use token.
   */
  async sendEmailVerification(
    to: string,
    name: string,
    verifyUrl: string,
    requestedLocale?: 'ar' | 'en',
  ): Promise<SendEmailResult> {
    // The platform's e-mail language (MAIL_LOCALE) unless a caller asks for a specific one.
    const locale = requestedLocale ?? this.emailLocale;
    const isAr = locale === 'ar';
    const safeName = escapeHtml(name);

    const subject = isAr ? `تأكيد البريد الإلكتروني — سبورتكسس` : `Verify Your Email — Sportexus`;

    const html = this.renderBaseTemplate({
      locale,
      preheader: isAr ? `يرجى تأكيد بريدك الإلكتروني.` : `Please verify your email address.`,
      title: isAr ? 'تأكيد البريد الإلكتروني' : 'Verify Your Email Address',
      greeting: isAr ? `مرحباً ${safeName}،` : `Hello ${safeName},`,
      bodyHtml: isAr
        ? `<p>شكراً لإنشاء حساب على منصة سبورتكسس.</p>
           <p>يرجى النقر على الزر أدناه لتأكيد صحة بريدك الإلكتروني وتفعيل حسابك بالكامل.</p>`
        : `<p>Thank you for creating an account on Sportexus.</p>
           <p>Please click the button below to verify your email address and activate your account.</p>`,
      actionButton: {
        label: isAr ? 'تأكيد البريد الإلكتروني' : 'Verify Email Address',
        url: verifyUrl,
      },
    });

    const text = isAr
      ? `مرحباً ${name}، لتأكيد بريدك الإلكتروني: ${verifyUrl}`
      : `Hello ${name}, verify your email: ${verifyUrl}`;

    return this.sendEmailDetailed({ to, subject, html, text, actionUrl: verifyUrl });
  }

  /**
   * 7b. One-time code that confirms an e-mail address before an account is created (academy application, join
   * request). Sent with `forceSend`: asking for a new code must always deliver it.
   */
  async sendEmailConfirmationCode(options: {
    to: string;
    code: string;
    expiresInMinutes: number;
    locale?: 'ar' | 'en';
  }): Promise<SendEmailResult> {
    const locale = options.locale ?? this.emailLocale;
    const isAr = locale === 'ar';
    const safeCode = escapeHtml(options.code);
    const minutes = options.expiresInMinutes;

    // The code stays out of the subject: subjects are written to the server logs.
    const subject = isAr
      ? `رمز تأكيد البريد الإلكتروني — Sportexus`
      : `Your Sportexus verification code`;

    const codeHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
        <tr><td align="center" style="background: #f0fdf4; border: 2px dashed #16A34A; border-radius: 12px; padding: 20px;">
          <div style="font-size: 12px; color: #64748b; letter-spacing: 1px; margin-bottom: 8px; font-weight: 600;">
            ${isAr ? 'رمز التأكيد' : 'VERIFICATION CODE'}
          </div>
          <div dir="ltr" style="font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #15803D; font-family: monospace;">${safeCode}</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 8px;">
            ${isAr ? `صالح لمدة ${minutes} دقائق` : `Valid for ${minutes} minutes`}
          </div>
        </td></tr>
      </table>`;

    const html = this.renderBaseTemplate({
      locale,
      preheader: isAr ? `رمز التأكيد: ${safeCode}` : `Your code: ${safeCode}`,
      title: isAr ? 'تأكيد البريد الإلكتروني' : 'Confirm your email address',
      greeting: isAr ? 'مرحباً،' : 'Hello,',
      bodyHtml: isAr
        ? `<p>اكتب هذا الرمز في النموذج على منصة Sportexus لتأكيد أن هذا البريد الإلكتروني ملكك.</p>
           ${codeHtml}
           <p style="color: #64748b; font-size: 13px;">لا تشارك هذا الرمز مع أي شخص. إذا لم تطلبه، تجاهل هذه الرسالة؛ لن يُنشأ أي حساب بدون الرمز.</p>`
        : `<p>Enter this code in the form on Sportexus to confirm that this email address is yours.</p>
           ${codeHtml}
           <p style="color: #64748b; font-size: 13px;">Do not share this code with anyone. If you did not ask for it, ignore this email; no account is created without the code.</p>`,
    });

    const text = isAr
      ? `رمز تأكيد البريد الإلكتروني على Sportexus: ${options.code} (صالح لمدة ${minutes} دقائق). لا تشاركه مع أحد.`
      : `Your Sportexus verification code: ${options.code} (valid for ${minutes} minutes). Do not share it with anyone.`;

    return this.sendEmailDetailed({ to: options.to, subject, html, text, forceSend: true });
  }

  /**
   * 8. Platform Co-Owner or Super Admin invitation.
   */
  async sendPlatformAdminInvite(
    to: string,
    name: string,
    role: 'PLATFORM_OWNER' | 'PLATFORM_CO_OWNER' | 'SUPER_ADMIN',
    actionUrl: string,
    isNewUser: boolean,
    requestedLocale?: 'ar' | 'en',
  ): Promise<SendEmailResult> {
    // The platform's e-mail language (MAIL_LOCALE) unless a caller asks for a specific one.
    const locale = requestedLocale ?? this.emailLocale;
    const isAr = locale === 'ar';
    const safeName = escapeHtml(name);

    const roleTitleAr =
      role === 'PLATFORM_CO_OWNER'
        ? 'مالك مشارك للمنصة (Platform Co-Owner)'
        : role === 'PLATFORM_OWNER'
          ? 'مالك المنصة (Platform Owner)'
          : 'مشرف عام للمنصة (Platform Super Admin)';

    const roleTitleEn =
      role === 'PLATFORM_CO_OWNER'
        ? 'Platform Co-Owner'
        : role === 'PLATFORM_OWNER'
          ? 'Platform Owner'
          : 'Platform Super Administrator';

    const subject = isAr
      ? `دعوة للانضمام كـ ${roleTitleAr} — سبورتكسس`
      : `Invitation: ${roleTitleEn} Privileges — Sportexus`;

    const html = this.renderBaseTemplate({
      locale,
      preheader: isAr
        ? `تمت دعوتك بصلاحية ${roleTitleAr}.`
        : `You have been granted ${roleTitleEn} privileges.`,
      title: isAr ? 'دعوة لإدارة منصة سبورتكسس' : 'Sportexus Platform Management Invitation',
      greeting: isAr ? `مرحباً ${safeName}،` : `Hello ${safeName},`,
      bodyHtml: isAr
        ? `<p>يسرنا إبلاغك بأنه قد تم منحك صلاحيات <strong>${roleTitleAr}</strong> لإدارة وتشغيل منصة سبورتكسس الرياضية.</p>
           <p>${
             isNewUser
               ? 'يرجى النقر على الرابط أدناه لتفعيل حسابك واختيار كلمة مرور آمنة للوصول إلى لوحة الإدارة.'
               : 'يمكنك الآن الدخول إلى لوحة التحكم الإدارية وإدارة الأكاديميات والاشتراكات عبر الرابط أدناه.'
           }</p>`
        : `<p>You have been invited with <strong>${roleTitleEn}</strong> privileges to manage the Sportexus platform.</p>
           <p>${
             isNewUser
               ? 'Please click the button below to activate your account and choose a secure password.'
               : 'You can now access the administrative control center using the link below.'
           }</p>`,
      actionButton: {
        label: isNewUser
          ? isAr
            ? 'تفعيل الحساب وتعيين كلمة المرور'
            : 'Activate Account & Set Password'
          : isAr
            ? 'الانتقال إلى لوحة المنصة'
            : 'Open Platform Dashboard',
        url: actionUrl,
      },
    });

    const text = isAr
      ? `مرحباً ${name}، تم منحك صلاحيات ${roleTitleAr} على سبورتكسس. الرابط: ${actionUrl}`
      : `Hello ${name}, you have been invited as ${roleTitleEn} on Sportexus. Link: ${actionUrl}`;

    return this.sendEmailDetailed({ to, subject, html, text, actionUrl });
  }

  /**
   * 9. Academy Staff Member Invitation.
   */
  async sendStaffInvite(options: {
    to: string;
    recipientName?: string;
    academyName: string;
    role: string;
    activationUrl: string;
    invitedByName?: string;
    branchName?: string;
    locale?: 'ar' | 'en';
  }): Promise<SendEmailResult> {
    const locale = options.locale ?? this.emailLocale;
    const isAr = locale === 'ar';
    const displayName = options.recipientName || (isAr ? 'عزيزنا العضو' : 'Valued Colleague');
    const safeDisplayName = escapeHtml(displayName);
    const safeAcademy = escapeHtml(options.academyName);
    const safeBranch = options.branchName ? escapeHtml(options.branchName) : undefined;
    const safeInviter = options.invitedByName ? escapeHtml(options.invitedByName) : undefined;

    const roleNameArMap: Record<string, string> = {
      COACH: 'مدرب رياضي (Coach)',
      MANAGER: 'مدير تنفيذي للأكاديمية (Manager)',
      BRANCH_MANAGER: 'مدير فرع (Branch Manager)',
      RECEPTIONIST: 'مسؤول استقبال وحضور (Receptionist)',
      ACCOUNTANT: 'محاسب مالي (Accountant)',
      VIEWER: 'مراقب (Viewer)',
    };

    const roleNameEnMap: Record<string, string> = {
      COACH: 'Coach',
      MANAGER: 'Academy Manager',
      BRANCH_MANAGER: 'Branch Manager',
      RECEPTIONIST: 'Receptionist & Attendance Officer',
      ACCOUNTANT: 'Accountant',
      VIEWER: 'Viewer',
    };

    const roleLabel = isAr
      ? roleNameArMap[options.role] || options.role
      : roleNameEnMap[options.role] || options.role;

    const subject = isAr
      ? `دعوة للانضمام إلى فريق عمل أكاديمية "${options.academyName}" — سبورتكسس`
      : `Invitation to join ${options.academyName} staff — Sportexus`;

    const branchTextAr = safeBranch ? ` في فرع: <strong>${safeBranch}</strong>` : '';
    const branchTextEn = safeBranch ? ` at branch: <strong>${safeBranch}</strong>` : '';

    const inviterTextAr = safeInviter
      ? `بناءً على دعوة مرسلة من قِبل: <strong>${safeInviter}</strong>.`
      : '';
    const inviterTextEn = safeInviter ? `Invited by: <strong>${safeInviter}</strong>.` : '';

    const html = this.renderBaseTemplate({
      locale,
      preheader: isAr
        ? `تمت دعوتك للانضمام إلى فريق عمل أكاديمية ${options.academyName}.`
        : `You have been invited to join the staff of ${options.academyName}.`,
      title: isAr ? 'دعوة للانضمام إلى فريق العمل' : 'Staff Membership Invitation',
      greeting: isAr ? `مرحباً ${safeDisplayName}،` : `Hello ${safeDisplayName},`,
      bodyHtml: isAr
        ? `<p>يسرنا إبلاغك بأنه تمت دعوتك للانضمام إلى فريق عمل أكاديمية <strong>"${safeAcademy}"</strong> بصلاحية <strong>${roleLabel}</strong>${branchTextAr}.</p>
           ${inviterTextAr ? `<p>${inviterTextAr}</p>` : ''}
           <p>انقر على الزر أدناه لتفعيل حسابك واختيار كلمة مرور آمنة. يرجى العلم بأن هذا الرابط صالح للاستخدام مرة واحدة فقط ولمدة <strong>7 أيام</strong>.</p>`
        : `<p>You have been invited to join the staff of <strong>"${safeAcademy}"</strong> as <strong>${roleLabel}</strong>${branchTextEn}.</p>
           ${inviterTextEn ? `<p>${inviterTextEn}</p>` : ''}
           <p>Click the button below to accept your invitation and activate your account. This single-use link is valid for <strong>7 days</strong>.</p>`,
      actionButton: {
        label: isAr ? 'قبول الدعوة وتفعيل الحساب' : 'Accept Invitation & Activate',
        url: options.activationUrl,
      },
    });

    const text = isAr
      ? `مرحباً ${displayName}، تمت دعوتك للانضمام كـ ${roleLabel} في أكاديمية ${options.academyName}. رابط التفعيل: ${options.activationUrl}`
      : `Hello ${displayName}, you are invited as ${roleLabel} at ${options.academyName}. Activation link: ${options.activationUrl}`;

    return this.sendEmailDetailed({
      to: options.to,
      subject,
      html,
      text,
      actionUrl: options.activationUrl,
    });
  }

  /**
   * 10. Player Enrollment & Guardian Welcome Email.
   */
  async sendPlayerEnrollmentWelcome(options: {
    to: string;
    guardianName: string;
    playerName: string;
    academyName: string;
    branchName: string;
    sport: string;
    locale?: 'ar' | 'en';
  }): Promise<SendEmailResult> {
    const locale = options.locale ?? this.emailLocale;
    const isAr = locale === 'ar';
    const safeGuardian = escapeHtml(options.guardianName);
    const safePlayer = escapeHtml(options.playerName);
    const safeAcademy = escapeHtml(options.academyName);
    const safeBranch = escapeHtml(options.branchName);
    const safeSport = escapeHtml(options.sport);

    const subject = isAr
      ? `مرحباً بك في ${options.academyName} — تم تسجيل اللاعب ${options.playerName}`
      : `Welcome to ${options.academyName} — Player ${options.playerName} Enrolled`;

    const portalUrl = `${this.appPublicUrl}/portal`;

    const html = this.renderBaseTemplate({
      locale,
      preheader: isAr
        ? `تم تسجيل ${options.playerName} في أكاديمية ${options.academyName} بنجاح.`
        : `Player ${options.playerName} has been registered at ${options.academyName}.`,
      title: isAr ? 'مرحباً بكم في الأكاديمية' : 'Welcome to the Academy',
      greeting: isAr ? `مرحباً ${safeGuardian}،` : `Hello ${safeGuardian},`,
      bodyHtml: isAr
        ? `<p>يسعدنا إبلاغك بأنه قد تم تسجيل اللاعب <strong>${safePlayer}</strong> بنجاح في <strong>"${safeAcademy}"</strong>.</p>
           <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0; font-size: 14px; line-height: 1.8;">
             <div><strong>الفرع:</strong> ${safeBranch}</div>
             <div><strong>الرياضة:</strong> ${safeSport}</div>
           </div>
           <p>يمكنك الآن متابعة حضور وغياب اللاعب، جداول الحصص التدريبية، والاشتراكات المالية عبر بوابة ولي الأمر واللاعبين.</p>`
        : `<p>We are excited to welcome you! Player <strong>${safePlayer}</strong> has been successfully enrolled in <strong>"${safeAcademy}"</strong>.</p>
           <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0; font-size: 14px; line-height: 1.8;">
             <div><strong>Branch:</strong> ${safeBranch}</div>
             <div><strong>Sport:</strong> ${safeSport}</div>
           </div>
           <p>You can track attendance, training schedules, and subscription invoices via the Sportexus Portal.</p>`,
      actionButton: {
        label: isAr ? 'الدخول إلى بوابة اللاعبين' : 'Open Player Portal',
        url: portalUrl,
      },
    });

    const text = isAr
      ? `مرحباً ${options.guardianName}، تم تسجيل ${options.playerName} في ${options.academyName} (فرع ${options.branchName}). البوابة: ${portalUrl}`
      : `Hello ${options.guardianName}, ${options.playerName} is registered at ${options.academyName} (${options.branchName}). Portal: ${portalUrl}`;

    return this.sendEmailDetailed({ to: options.to, subject, html, text, actionUrl: portalUrl });
  }

  /**
   * 11. Payment Receipt Confirmation Email.
   */
  async sendPaymentReceipt(options: {
    to: string;
    recipientName: string;
    academyName: string;
    receiptNumber: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    description?: string;
    date?: Date;
    locale?: 'ar' | 'en';
  }): Promise<SendEmailResult> {
    const locale = options.locale ?? this.emailLocale;
    const isAr = locale === 'ar';
    const safeRecipient = escapeHtml(options.recipientName);
    const safeAcademy = escapeHtml(options.academyName);
    const safeReceipt = escapeHtml(options.receiptNumber);
    const safeMethod = escapeHtml(options.paymentMethod);
    const safeDesc = escapeHtml(
      options.description || (isAr ? 'سداد اشتراك تدريبي' : 'Subscription payment'),
    );
    const safeCurrency = escapeHtml(options.currency || 'EGP');
    const safeAmount = Number(options.amount).toFixed(2);
    const paymentDate = (options.date || new Date()).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const subject = isAr
      ? `إيصال استلام دفعة #${options.receiptNumber} — ${options.academyName}`
      : `Payment Receipt #${options.receiptNumber} — ${options.academyName}`;

    const html = this.renderBaseTemplate({
      locale,
      preheader: isAr
        ? `إيصال سداد بمبلغ ${safeAmount} ${safeCurrency}.`
        : `Payment receipt for ${safeAmount} ${safeCurrency}.`,
      title: isAr ? 'إيصال سداد إلكتروني' : 'Official Payment Receipt',
      greeting: isAr ? `مرحباً ${safeRecipient}،` : `Hello ${safeRecipient},`,
      bodyHtml: isAr
        ? `<p>تم استلام دفعتك المالية بنجاح لصالح <strong>"${safeAcademy}"</strong>. فيما يلي تفاصيل المعاملة:</p>
           <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0; font-size: 14px; line-height: 1.9;">
             <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 8px;">
               <span style="color: #64748b;">رقم الإيصال:</span>
               <strong style="color: #0A3BFF;">${safeReceipt}</strong>
             </div>
             <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 8px;">
               <span style="color: #64748b;">المبلغ المدفوع:</span>
               <strong style="color: #15803d; font-size: 16px;">${safeAmount} ${safeCurrency}</strong>
             </div>
             <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 8px;">
               <span style="color: #64748b;">طريقة الدفع:</span>
               <span>${safeMethod}</span>
             </div>
             <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 8px;">
               <span style="color: #64748b;">التاريخ:</span>
               <span>${paymentDate}</span>
             </div>
             <div style="display: flex; justify-content: space-between;">
               <span style="color: #64748b;">الوصف:</span>
               <span>${safeDesc}</span>
             </div>
           </div>
           <p style="color: #64748b; font-size: 13px;">هذا الإيصال تم إنشاؤه آلياً وهو سند رسمي لعملية الدفع.</p>`
        : `<p>Your payment has been successfully received by <strong>"${safeAcademy}"</strong>. Transaction summary:</p>
           <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0; font-size: 14px; line-height: 1.9;">
             <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 8px;">
               <span style="color: #64748b;">Receipt #:</span>
               <strong style="color: #0A3BFF;">${safeReceipt}</strong>
             </div>
             <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 8px;">
               <span style="color: #64748b;">Amount Paid:</span>
               <strong style="color: #15803d; font-size: 16px;">${safeAmount} ${safeCurrency}</strong>
             </div>
             <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 8px;">
               <span style="color: #64748b;">Payment Method:</span>
               <span>${safeMethod}</span>
             </div>
             <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 8px;">
               <span style="color: #64748b;">Date:</span>
               <span>${paymentDate}</span>
             </div>
             <div style="display: flex; justify-content: space-between;">
               <span style="color: #64748b;">Description:</span>
               <span>${safeDesc}</span>
             </div>
           </div>
           <p style="color: #64748b; font-size: 13px;">This electronic receipt serves as an official confirmation of payment.</p>`,
    });

    const text = isAr
      ? `مرحباً ${options.recipientName}، تم استلام دفعة بمبلغ ${safeAmount} ${options.currency} لصالح ${options.academyName}. رقم الإيصال: ${options.receiptNumber}`
      : `Hello ${options.recipientName}, payment received for ${safeAmount} ${options.currency} at ${options.academyName}. Receipt #: ${options.receiptNumber}`;

    return this.sendEmailDetailed({ to: options.to, subject, html, text });
  }

  /**
   * 12. SaaS Subscription Renewal or Past-Due Alert.
   */
  async sendSubscriptionAlert(options: {
    to: string;
    ownerName: string;
    academyName: string;
    planName: string;
    expiresAt: Date;
    renewalUrl: string;
    status: 'EXPIRING_SOON' | 'EXPIRED' | 'PAST_DUE';
    locale?: 'ar' | 'en';
  }): Promise<SendEmailResult> {
    const locale = options.locale ?? this.emailLocale;
    const isAr = locale === 'ar';
    const safeOwner = escapeHtml(options.ownerName);
    const safeAcademy = escapeHtml(options.academyName);
    const safePlan = escapeHtml(options.planName);
    const expiryDate = options.expiresAt.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const subject = isAr
      ? options.status === 'EXPIRED'
        ? `تنبيه انتهاء اشتراك باقة "${options.planName}" — ${options.academyName}`
        : `تذكير بتجديد اشتراك باقة "${options.planName}" — ${options.academyName}`
      : options.status === 'EXPIRED'
        ? `Subscription Expired: ${options.planName} — ${options.academyName}`
        : `Subscription Renewal Reminder: ${options.planName} — ${options.academyName}`;

    const html = this.renderBaseTemplate({
      locale,
      preheader: isAr
        ? `تنبيه خاص باشتراك أكاديميتك على منصة سبورتكسس.`
        : `Important update regarding your Sportexus academy subscription.`,
      title: isAr ? 'تنبيه اشتراك الأكاديمية' : 'Academy Subscription Notice',
      greeting: isAr ? `مرحباً ${safeOwner}،` : `Hello ${safeOwner},`,
      bodyHtml: isAr
        ? `<p>نود إحاطتك علماً بحالة اشتراك باقة <strong>"${safePlan}"</strong> لأكاديمية <strong>"${safeAcademy}"</strong>.</p>
           <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 14px; margin: 16px 0; color: #b45309;">
             <strong>تاريخ الانتهاء:</strong> ${expiryDate}<br/>
             <strong>الحالة:</strong> ${options.status === 'EXPIRED' ? 'منتهي الصلاحية' : 'يقترب موعد التجديد'}
           </div>
           <p>لضمان استمرار عمل مساحة الأكاديمية دون انقطاع وتفادي تعليق وصول المدربين والمشتركين، يرجى تجديد الاشتراك عبر الرابط أدناه.</p>`
        : `<p>This notice concerns your <strong>"${safePlan}"</strong> subscription for <strong>"${safeAcademy}"</strong>.</p>
           <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 14px; margin: 16px 0; color: #b45309;">
             <strong>Expiration Date:</strong> ${expiryDate}<br/>
             <strong>Status:</strong> ${options.status === 'EXPIRED' ? 'Expired' : 'Expiring Soon'}
           </div>
           <p>To avoid service interruptions or account feature restrictions, please renew your subscription below.</p>`,
      actionButton: {
        label: isAr ? 'تجديد الاشتراك الآن' : 'Renew Subscription',
        url: options.renewalUrl,
      },
    });

    const text = isAr
      ? `مرحباً ${options.ownerName}، اشتراك باقة "${options.planName}" لأكاديمية "${options.academyName}" ${options.status === 'EXPIRED' ? 'انتهى' : 'ينتهي في'} ${expiryDate}. رابط التجديد: ${options.renewalUrl}`
      : `Hello ${options.ownerName}, your ${options.planName} subscription for ${options.academyName} expires on ${expiryDate}. Renew: ${options.renewalUrl}`;

    return this.sendEmailDetailed({
      to: options.to,
      subject,
      html,
      text,
      actionUrl: options.renewalUrl,
    });
  }

  /**
   * Join request received: sent to the applicant (player or guardian) right after the request is submitted.
   */
  async sendJoinRequestReceived(options: {
    to: string;
    applicantName: string;
    playerName: string;
    academyName: string;
    requesterType: 'PLAYER' | 'GUARDIAN';
    locale?: 'ar' | 'en';
  }): Promise<SendEmailResult> {
    const isAr = (options.locale ?? this.emailLocale) === 'ar';
    const name = escapeHtml(options.applicantName || options.playerName);
    const player = escapeHtml(options.playerName);
    const academy = escapeHtml(options.academyName);
    const forChild = options.requesterType === 'GUARDIAN';
    const subject = isAr
      ? `تم استلام طلب الانضمام إلى ${options.academyName} — سبورتكسس`
      : `Join request received: ${options.academyName} — Sportexus`;
    const html = this.renderBaseTemplate({
      locale: isAr ? 'ar' : 'en',
      preheader: isAr
        ? 'طلبك قيد المراجعة لدى الأكاديمية.'
        : 'Your request is being reviewed by the academy.',
      title: isAr ? 'تم استلام طلبك' : 'Request received',
      greeting: isAr ? `مرحباً ${name}،` : `Hello ${name},`,
      bodyHtml: isAr
        ? `<p>تم استلام طلب انضمام ${forChild ? `<strong>${player}</strong>` : 'حضرتك'} إلى أكاديمية <strong>${academy}</strong> بنجاح.</p>
           ${this.calloutHtml('info', 'الحالة', 'قيد المراجعة لدى إدارة الأكاديمية')}
           <p>سيصلك بريد إلكتروني فور اتخاذ قرار بشأن الطلب. لا يمكن تسجيل الدخول بالحساب الجديد قبل الموافقة.</p>`
        : `<p>Your request to join <strong>${academy}</strong>${forChild ? ` for <strong>${player}</strong>` : ''} was received.</p>
           ${this.calloutHtml('info', 'Status', 'Under review by the academy')}
           <p>You will get an email as soon as the academy decides. A new account can sign in only after approval.</p>`,
    });
    const text = isAr
      ? `تم استلام طلب الانضمام إلى ${options.academyName}${forChild ? ` لـ ${options.playerName}` : ''}، وهو قيد المراجعة.`
      : `Your request to join ${options.academyName}${forChild ? ` for ${options.playerName}` : ''} was received and is under review.`;
    return this.sendEmailDetailed({ to: options.to, subject, html, text });
  }

  /**
   * Join request decision: approved, rejected or more information needed, sent to the applicant.
   */
  async sendJoinRequestDecision(options: {
    to: string;
    applicantName?: string | null;
    playerName: string;
    academyName: string;
    status: 'APPROVED' | 'REJECTED' | 'MORE_INFO_REQUESTED';
    requesterType: 'PLAYER' | 'GUARDIAN';
    notes?: string | null;
    locale?: 'ar' | 'en';
  }): Promise<SendEmailResult> {
    const isAr = (options.locale ?? this.emailLocale) === 'ar';
    const name = escapeHtml(options.applicantName || options.playerName);
    const player = escapeHtml(options.playerName);
    const academy = escapeHtml(options.academyName);
    const notes = options.notes ? escapeHtml(options.notes) : '';
    const forChild = options.requesterType === 'GUARDIAN';
    const who = isAr
      ? forChild
        ? `لـ <strong>${player}</strong> `
        : ''
      : forChild
        ? ` for <strong>${player}</strong>`
        : '';
    const loginUrl = `${this.appPublicUrl.replace(/\/+$/, '')}/login`;
    let subject: string;
    let title: string;
    let bodyHtml: string;
    let text: string;
    let actionButton: { label: string; url: string } | undefined;
    if (options.status === 'APPROVED') {
      subject = isAr
        ? `تمت الموافقة على طلب الانضمام — ${options.academyName}`
        : `Join request approved — ${options.academyName}`;
      title = isAr ? 'تمت الموافقة على طلبك 🎉' : 'Your request is approved 🎉';
      bodyHtml = isAr
        ? `<p>يسعدنا إبلاغك بأن أكاديمية <strong>${academy}</strong> وافقت على طلب الانضمام ${who}.</p>
           ${this.calloutHtml('success', 'الحالة', 'تمت الموافقة')}
           <p>يمكنك الآن تسجيل الدخول بالبريد وكلمة المرور اللذين أنشأتهما مع الطلب، ومتابعة ${forChild ? 'ابنك/ابنتك' : 'تدريبك'} من بوابة ${forChild ? 'ولي الأمر' : 'اللاعب'}.</p>
           ${notes ? this.calloutHtml('info', 'ملاحظات الأكاديمية', notes) : ''}`
        : `<p><strong>${academy}</strong> approved your join request${who}.</p>
           ${this.calloutHtml('success', 'Status', 'Approved')}
           <p>You can now sign in with the email and password you created with the request.</p>
           ${notes ? this.calloutHtml('info', 'Notes from the academy', notes) : ''}`;
      actionButton = { label: isAr ? 'تسجيل الدخول' : 'Sign in', url: loginUrl };
      text = isAr
        ? `وافقت أكاديمية ${options.academyName} على طلب الانضمام. سجّل الدخول: ${loginUrl}`
        : `${options.academyName} approved your join request. Sign in: ${loginUrl}`;
    } else if (options.status === 'REJECTED') {
      subject = isAr
        ? `تحديث بخصوص طلب الانضمام — ${options.academyName}`
        : `Update on your join request — ${options.academyName}`;
      title = isAr ? 'لم تتم الموافقة على الطلب' : 'Request not approved';
      bodyHtml = isAr
        ? `<p>نأسف لإبلاغك بأن أكاديمية <strong>${academy}</strong> لم توافق على طلب الانضمام ${who}.</p>
           ${this.calloutHtml('danger', 'السبب', notes || 'لم تذكر الأكاديمية سبباً.')}
           <p>للاستفسار يمكنك التواصل مع إدارة الأكاديمية مباشرة.</p>`
        : `<p>We are sorry: <strong>${academy}</strong> did not approve your join request${who}.</p>
           ${this.calloutHtml('danger', 'Reason', notes || 'No reason was given.')}
           <p>For questions, please contact the academy directly.</p>`;
      text = isAr
        ? `لم توافق أكاديمية ${options.academyName} على طلب الانضمام.${options.notes ? ` السبب: ${options.notes}` : ''}`
        : `${options.academyName} did not approve your join request.${options.notes ? ` Reason: ${options.notes}` : ''}`;
    } else {
      subject = isAr
        ? `مطلوب معلومات إضافية لطلب الانضمام — ${options.academyName}`
        : `More information needed — ${options.academyName}`;
      title = isAr ? 'مطلوب معلومات إضافية' : 'More information needed';
      bodyHtml = isAr
        ? `<p>تحتاج أكاديمية <strong>${academy}</strong> إلى معلومات إضافية لاستكمال طلب الانضمام ${who}.</p>
           ${this.calloutHtml('warning', 'المطلوب', notes || 'يرجى التواصل مع الأكاديمية.')}
           <p>يرجى التواصل مع إدارة الأكاديمية لاستكمال الطلب.</p>`
        : `<p><strong>${academy}</strong> needs more information to complete your join request${who}.</p>
           ${this.calloutHtml('warning', 'Needed', notes || 'Please contact the academy.')}
           <p>Please contact the academy to complete the request.</p>`;
      text = isAr
        ? `تحتاج أكاديمية ${options.academyName} إلى معلومات إضافية لطلب الانضمام.${options.notes ? ` المطلوب: ${options.notes}` : ''}`
        : `${options.academyName} needs more information for your join request.${options.notes ? ` Needed: ${options.notes}` : ''}`;
    }
    const html = this.renderBaseTemplate({
      locale: isAr ? 'ar' : 'en',
      preheader: title,
      title,
      greeting: isAr ? `مرحباً ${name}،` : `Hello ${name},`,
      bodyHtml,
      actionButton,
    });
    return this.sendEmailDetailed({
      to: options.to,
      subject,
      html,
      text,
      actionUrl: actionButton?.url,
    });
  }

  /** A coloured note box in the platform's status colours (values must already be escaped). */
  private calloutHtml(
    kind: 'info' | 'success' | 'warning' | 'danger',
    label: string,
    value: string,
  ): string {
    const palette = {
      info: { bg: '#eff6ff', border: '#bfdbfe', fg: '#1e40af' },
      success: { bg: '#f0fdf4', border: '#bbf7d0', fg: '#15803d' },
      warning: { bg: '#fffbeb', border: '#fde68a', fg: '#b45309' },
      danger: { bg: '#fef2f2', border: '#fecaca', fg: '#b91c1c' },
    }[kind];
    return `<div style="background:${palette.bg};border:1px solid ${palette.border};border-radius:12px;padding:12px 16px;margin:16px 0;color:${palette.fg};"><strong>${label}:</strong> ${value}</div>`;
  }

  /**
   * Renders the branded HTML email shell. It follows the platform's look (white cards on a light grey page, the
   * Sportexus wordmark with "exus" in the logo green, the blue-to-cyan brand gradient) and uses inline styles and
   * tables, because most mail clients (Gmail, Outlook) drop <style> blocks and modern CSS layout.
   *
   * Dark mode: the e-mail follows the reader's device theme where the mail app supports it (Apple Mail, iOS Mail,
   * Outlook for Mac/iOS/Android, Thunderbird): `EMAIL_DARK_MODE_CSS` recolours the shell and the known light colours
   * of the bodies. Clients that ignore it (Gmail on the web) show the light version; Gmail's apps apply their own
   * dark colours.
   */
  renderBaseTemplate(options: {
    locale: 'ar' | 'en';
    preheader: string;
    title: string;
    greeting: string;
    bodyHtml: string;
    actionButton?: { label: string; url: string };
  }): string {
    const isAr = options.locale === 'ar';
    const dir = isAr ? 'rtl' : 'ltr';
    const align = isAr ? 'right' : 'left';
    const font = isAr
      ? "Cairo, Tahoma, 'Segoe UI', Arial, sans-serif"
      : "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif";
    const button = options.actionButton
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto 8px;">
           <tr><td align="center" bgcolor="#0A3BFF" style="border-radius:12px;background:#0A3BFF;background-image:linear-gradient(135deg,#0A3BFF 0%,#00C4FF 100%);">
             <a href="${escapeHtml(options.actionButton.url)}" target="_blank" style="display:inline-block;padding:14px 34px;font-family:${font};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${escapeHtml(options.actionButton.label)}</a>
           </td></tr>
         </table>`
      : '';

    return `<!DOCTYPE html>
<html lang="${options.locale}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(options.title)}</title>
  <style>${EMAIL_DARK_MODE_CSS}</style>
</head>
<body class="sx-page" style="margin:0;padding:0;background:#f1f5f9;font-family:${font};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f1f5f9;">${escapeHtml(options.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="sx-page" style="background:#f1f5f9;">
    <tr><td align="center" style="padding:32px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}" class="sx-card" style="max-width:580px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
        <tr><td style="height:6px;line-height:6px;font-size:0;background:#0A3BFF;background-image:linear-gradient(90deg,#0A3BFF 0%,#00C4FF 60%,#22C55E 100%);">&nbsp;</td></tr>
        <tr><td align="center" style="padding:28px 28px 8px;">
          <div dir="ltr" style="font-family:'Segoe UI',Arial,sans-serif;font-size:28px;font-weight:800;letter-spacing:-0.5px;line-height:1;">
            <span class="sx-strong" style="color:#0F172A;">Sport</span><span style="color:#16A34A;">exus</span>
          </div>
          <div dir="ltr" style="font-family:'Segoe UI',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:3px;color:#64748b;margin-top:6px;">ACADEMY PLATFORM</div>
        </td></tr>
        <tr><td align="center" style="padding:16px 28px 4px;">
          <h1 class="sx-strong" style="margin:0;font-family:${font};font-size:22px;font-weight:800;color:#0F172A;">${escapeHtml(options.title)}</h1>
        </td></tr>
        <tr><td dir="${dir}" class="sx-text" style="padding:20px 32px 28px;text-align:${align};font-family:${font};font-size:15px;line-height:1.8;color:#334155;">
          <div class="sx-strong" style="font-size:16px;font-weight:700;color:#0F172A;margin-bottom:12px;">${options.greeting}</div>
          ${options.bodyHtml}
          ${button}
        </td></tr>
        <tr><td align="center" class="sx-foot" style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-family:${font};font-size:12px;line-height:1.7;color:#64748b;">
          <div class="sx-strong" style="font-weight:700;color:#0F172A;">Sportexus — ${isAr ? 'منصة واحدة لكل أكاديمية' : 'One Platform. Every Academy.'}</div>
          <div>${isAr ? 'هذه رسالة آلية من منصة سبورتكسس، يُرجى عدم الرد عليها.' : 'This is an automated message from Sportexus; please do not reply.'}</div>
          <div style="margin-top:6px;"><a href="${escapeHtml(this.appPublicUrl)}" style="color:#0A3BFF;text-decoration:none;font-weight:700;">${escapeHtml(this.appPublicUrl.replace(/^https?:\/\//, ''))}</a></div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }
}
