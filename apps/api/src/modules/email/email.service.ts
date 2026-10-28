import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SentEmailRecord {
  to: string;
  subject: string;
  html: string;
  text: string;
  sentAt: Date;
  actionUrl?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly sentEmailsQueue: SentEmailRecord[] = [];
  private readonly maxQueueLength = 100;

  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly resendApiKey?: string;
  private readonly appPublicUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.fromEmail = this.configService.get<string>('MAIL_FROM_EMAIL') || 'no-reply@sportexus.com';
    this.fromName = this.configService.get<string>('MAIL_FROM_NAME') || 'Sportexus Platform';
    this.resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    this.appPublicUrl =
      this.configService.get<string>('NEXT_PUBLIC_APP_URL') ||
      this.configService.get<string>('APP_PUBLIC_URL') ||
      'http://localhost:3000';
  }

  /**
   * Dispatches an email via configured provider with detailed status tracking.
   */
  async sendEmailDetailed(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
    actionUrl?: string;
  }): Promise<{ delivered: boolean; status: 'SENT' | 'DEV_LOGGED' | 'FAILED'; error?: string }> {
    const record: SentEmailRecord = {
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      sentAt: new Date(),
      actionUrl: options.actionUrl,
    };

    this.sentEmailsQueue.unshift(record);
    if (this.sentEmailsQueue.length > this.maxQueueLength) {
      this.sentEmailsQueue.pop();
    }

    if (this.resendApiKey && !this.resendApiKey.includes('placeholder')) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${this.fromName} <${this.fromEmail}>`,
            to: [options.to],
            subject: options.subject,
            html: options.html,
            text: options.text,
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          this.logger.error(`Resend API dispatch failed (${res.status}): ${errBody}`);
          return {
            delivered: false,
            status: 'FAILED',
            error: `Resend error (${res.status}): ${errBody}`,
          };
        }

        this.logger.log(`Email dispatched via Resend to ${options.to} [${options.subject}]`);
        return { delivered: true, status: 'SENT' };
      } catch (err: unknown) {
        const msg = (err as Error)?.message || 'Network error';
        this.logger.error(`Resend API network error: ${msg}`);
        return { delivered: false, status: 'FAILED', error: msg };
      }
    }

    // In-memory development / test logging
    this.logger.log(
      `[DEV EMAIL DISPATCHED] To: ${options.to} | Subject: "${options.subject}" | Link: ${options.actionUrl ?? 'N/A'}`,
    );
    return { delivered: true, status: 'DEV_LOGGED' };
  }

  /**
   * Dispatches an email via configured provider (Resend API or Dev Logger).
   */
  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
    actionUrl?: string;
  }): Promise<boolean> {
    const result = await this.sendEmailDetailed(options);
    return result.delivered;
  }

  /**
   * Retrieves recorded emails in development/test.
   */
  getSentEmails(): readonly SentEmailRecord[] {
    return this.sentEmailsQueue;
  }

  /**
   * Clears email records queue.
   */
  clearSentEmails(): void {
    this.sentEmailsQueue.length = 0;
  }

  /**
   * Sends academy registration received acknowledgment.
   */
  async sendAcademyApplicationReceived(
    to: string,
    ownerName: string,
    academyName: string,
    locale: 'ar' | 'en' = 'ar',
  ): Promise<boolean> {
    const isAr = locale === 'ar';
    const subject = isAr
      ? `تم استلام طلب تسجيل أكاديمية: ${academyName} — سبورتكسس`
      : `Application Received: ${academyName} — Sportexus`;

    const html = this.renderBaseTemplate({
      locale,
      preheader: isAr
        ? `طلب تسجيل أكاديميتك قيد المراجعة حالياً.`
        : `Your academy registration is currently under review.`,
      title: isAr ? 'تم استلام طلبك بنجاح' : 'Registration Application Received',
      greeting: isAr ? `مرحباً ${ownerName}،` : `Hello ${ownerName},`,
      bodyHtml: isAr
        ? `<p>شكراً لاهتمامك بالانضمام إلى منصة <strong>سبورتكسس (Sportexus)</strong>.</p>
           <p>تم استلام طلب تسجيل أكاديمية <strong>"${academyName}"</strong> بنجاح، ويقوم فريق إدارة المنصة بمراجعة البيانات المدخلة.</p>
           <p>سيصلك إشعار بالبريد الإلكتروني فور اعتماد الأكاديمية لبدء إدارة الفروع والمشتركين والاشتراكات.</p>`
        : `<p>Thank you for choosing <strong>Sportexus</strong>.</p>
           <p>We have successfully received the registration request for <strong>"${academyName}"</strong>. Our platform administrators are reviewing your submission.</p>
           <p>You will receive an activation email as soon as your academy is approved.</p>`,
    });

    const text = isAr
      ? `مرحباً ${ownerName}، تم استلام طلب تسجيل أكاديمية "${academyName}" بنجاح وهو قيد المراجعة.`
      : `Hello ${ownerName}, your registration application for "${academyName}" has been received and is under review.`;

    return this.sendEmail({ to, subject, html, text });
  }

  /**
   * Sends approval notification with platform activation link.
   */
  async sendAcademyApproved(
    to: string,
    ownerName: string,
    academyName: string,
    activationUrl: string,
    locale: 'ar' | 'en' = 'ar',
  ): Promise<boolean> {
    const isAr = locale === 'ar';
    const subject = isAr
      ? `تهانينا! تم اعتماد أكاديمية "${academyName}" على سبورتكسس`
      : `Congratulations! ${academyName} is Approved on Sportexus`;

    const html = this.renderBaseTemplate({
      locale,
      preheader: isAr ? `أكاديميتك جاهزة الآن للعمل.` : `Your academy is now ready for use.`,
      title: isAr ? 'تم اعتماد وتفعيل الأكاديمية' : 'Academy Approved & Activated',
      greeting: isAr ? `أهلاً ${ownerName}،` : `Hello ${ownerName},`,
      bodyHtml: isAr
        ? `<p>يسرنا إبلاغك بأنه تمت الموافقة على طلب تسجيل أكاديمية <strong>"${academyName}"</strong> وتفعيل مساحة العمل الخاصة بك على منصة سبورتكسس.</p>
           <p>يمكنك الآن تسجيل الدخول والبدء في إعداد الفروع، إضافة المدربين واللاعبين، وإدارة الحصص التدريبية والاشتراكات.</p>`
        : `<p>We are delighted to inform you that your application for <strong>"${academyName}"</strong> has been approved and your workspace is now active.</p>
           <p>You can now sign in and begin configuring your branches, coaches, players, schedules, and finances.</p>`,
      actionButton: {
        label: isAr ? 'الدخول إلى لوحة التحكم' : 'Open Academy Dashboard',
        url: activationUrl,
      },
    });

    const text = isAr
      ? `تهانينا ${ownerName}! تم اعتماد أكاديمية "${academyName}". رابط لوحة التحكم: ${activationUrl}`
      : `Congratulations ${ownerName}! ${academyName} is approved. Access your dashboard here: ${activationUrl}`;

    return this.sendEmail({ to, subject, html, text, actionUrl: activationUrl });
  }

  /**
   * Sends password reset link.
   */
  async sendPasswordReset(
    to: string,
    name: string,
    resetUrl: string,
    locale: 'ar' | 'en' = 'ar',
  ): Promise<boolean> {
    const isAr = locale === 'ar';
    const subject = isAr
      ? `إعادة تعيين كلمة المرور — سبورتكسس`
      : `Password Reset Request — Sportexus`;

    const html = this.renderBaseTemplate({
      locale,
      preheader: isAr ? `رابط إعادة تعيين كلمة المرور.` : `Your password reset link.`,
      title: isAr ? 'طلب إعادة تعيين كلمة المرور' : 'Password Reset Request',
      greeting: isAr ? `مرحباً ${name}،` : `Hello ${name},`,
      bodyHtml: isAr
        ? `<p>تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك على منصة سبورتكسس.</p>
           <p>انقر على الزر أدناه لاختيار كلمة مرور جديدة. هذا الرابط صالح لمدة <strong>ساعة واحدة فقط</strong>.</p>
           <p style="color: #94a3b8; font-size: 13px;">إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة بأمان وستظل كلمة مرورك الحالية دون تغيير.</p>`
        : `<p>We received a request to reset the password for your Sportexus account.</p>
           <p>Click the button below to choose a new password. This link is valid for <strong>1 hour only</strong>.</p>
           <p style="color: #94a3b8; font-size: 13px;">If you did not request this, you can safely ignore this email.</p>`,
      actionButton: {
        label: isAr ? 'تعيين كلمة المرور الجديدة' : 'Reset My Password',
        url: resetUrl,
      },
    });

    const text = isAr
      ? `مرحباً ${name}، رابط إعادة تعيين كلمة المرور: ${resetUrl}`
      : `Hello ${name}, your password reset link: ${resetUrl}`;

    return this.sendEmail({ to, subject, html, text, actionUrl: resetUrl });
  }

  /**
   * Sends email verification link.
   */
  async sendEmailVerification(
    to: string,
    name: string,
    verifyUrl: string,
    locale: 'ar' | 'en' = 'ar',
  ): Promise<boolean> {
    const isAr = locale === 'ar';
    const subject = isAr
      ? `تأكيد البريد الإلكتروني — سبورتكسس`
      : `Verify Your Email — Sportexus`;

    const html = this.renderBaseTemplate({
      locale,
      preheader: isAr ? `يرجى تأكيد بريدك الإلكتروني.` : `Please verify your email address.`,
      title: isAr ? 'تأكيد البريد الإلكتروني' : 'Verify Your Email Address',
      greeting: isAr ? `مرحباً ${name}،` : `Hello ${name},`,
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

    return this.sendEmail({ to, subject, html, text, actionUrl: verifyUrl });
  }

  /**
   * Sends platform co-owner or super admin invitation with activation link.
   */
  async sendPlatformAdminInvite(
    to: string,
    name: string,
    role: 'PLATFORM_OWNER' | 'PLATFORM_CO_OWNER' | 'SUPER_ADMIN',
    actionUrl: string,
    isNewUser: boolean,
    locale: 'ar' | 'en' = 'ar',
  ): Promise<boolean> {
    const isAr = locale === 'ar';
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
      greeting: isAr ? `مرحباً ${name}،` : `Hello ${name},`,
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
          ? (isAr ? 'تفعيل الحساب وتعيين كلمة المرور' : 'Activate Account & Set Password')
          : (isAr ? 'الانتقال إلى لوحة المنصة' : 'Open Platform Dashboard'),
        url: actionUrl,
      },
    });

    const text = isAr
      ? `مرحباً ${name}، تم منحك صلاحيات ${roleTitleAr} على سبورتكسس. الرابط: ${actionUrl}`
      : `Hello ${name}, you have been invited as ${roleTitleEn} on Sportexus. Link: ${actionUrl}`;

    return this.sendEmail({ to, subject, html, text, actionUrl });
  }

  /**
   * Sends an academy employee / staff member invitation email with single-use activation link.
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
  }): Promise<{ delivered: boolean; status: 'SENT' | 'DEV_LOGGED' | 'FAILED'; error?: string }> {
    const locale = options.locale || 'ar';
    const isAr = locale === 'ar';
    const displayName = options.recipientName || (isAr ? 'عزيزنا العضو' : 'Valued Colleague');

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

    const branchTextAr = options.branchName ? ` في فرع: <strong>${options.branchName}</strong>` : '';
    const branchTextEn = options.branchName ? ` at branch: <strong>${options.branchName}</strong>` : '';

    const inviterTextAr = options.invitedByName
      ? `بناءً على دعوة مرسلة من قِبل: <strong>${options.invitedByName}</strong>.`
      : '';
    const inviterTextEn = options.invitedByName
      ? `Invited by: <strong>${options.invitedByName}</strong>.`
      : '';

    const html = this.renderBaseTemplate({
      locale,
      preheader: isAr
        ? `تمت دعوتك للانضمام إلى فريق عمل أكاديمية ${options.academyName}.`
        : `You have been invited to join the staff of ${options.academyName}.`,
      title: isAr ? 'دعوة للانضمام إلى فريق العمل' : 'Staff Membership Invitation',
      greeting: isAr ? `مرحباً ${displayName}،` : `Hello ${displayName},`,
      bodyHtml: isAr
        ? `<p>يسرنا إبلاغك بأنه تمت دعوتك للانضمام إلى فريق عمل أكاديمية <strong>"${options.academyName}"</strong> بصلاحية <strong>${roleLabel}</strong>${branchTextAr}.</p>
           ${inviterTextAr ? `<p>${inviterTextAr}</p>` : ''}
           <p>انقر على الزر أدناه لتفعيل حسابك واختيار كلمة مرور آمنة. يرجى العلم بأن هذا الرابط صالح للاستخدام مرة واحدة فقط ولمدة <strong>7 أيام</strong>.</p>`
        : `<p>You have been invited to join the staff of <strong>"${options.academyName}"</strong> as <strong>${roleLabel}</strong>${branchTextEn}.</p>
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
   * Renders the branded, responsive HTML email shell.
   */
  private renderBaseTemplate(options: {
    locale: 'ar' | 'en';
    preheader: string;
    title: string;
    greeting: string;
    bodyHtml: string;
    actionButton?: { label: string; url: string };
  }): string {
    const isAr = options.locale === 'ar';
    const dir = isAr ? 'rtl' : 'ltr';
    const fontFamily = isAr
      ? "Cairo, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    return `<!DOCTYPE html>
<html lang="${options.locale}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b1120;
      color: #e2e8f0;
      font-family: ${fontFamily};
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0b1120;
      padding: 32px 12px;
      box-sizing: border-box;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    }
    .header {
      padding: 32px 28px 24px;
      text-align: center;
      background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
      border-bottom: 1px solid #1e293b;
    }
    .brand-pill {
      display: inline-block;
      padding: 6px 14px;
      background: rgba(10, 59, 255, 0.15);
      border: 1px solid rgba(0, 214, 255, 0.3);
      border-radius: 9999px;
      color: #00D6FF;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    .title {
      margin: 8px 0 0;
      color: #ffffff;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.3px;
    }
    .content {
      padding: 28px;
      font-size: 15px;
      line-height: 1.7;
      color: #cbd5e1;
    }
    .greeting {
      font-size: 16px;
      font-weight: 700;
      color: #f8fafc;
      margin-bottom: 16px;
    }
    .button-wrap {
      text-align: center;
      margin: 32px 0 24px;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #0A3BFF 0%, #00D6FF 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 32px;
      border-radius: 10px;
      box-shadow: 0 8px 20px rgba(10, 59, 255, 0.35);
    }
    .footer {
      padding: 20px 28px;
      background: #090e17;
      border-top: 1px solid #1e293b;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
    }
    .footer a {
      color: #00D6FF;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${options.preheader}
  </div>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="brand-pill">SPORTEXUS</div>
        <h1 class="title">${options.title}</h1>
      </div>
      <div class="content">
        <div class="greeting">${options.greeting}</div>
        ${options.bodyHtml}
        ${
          options.actionButton
            ? `<div class="button-wrap">
                 <a href="${options.actionButton.url}" class="btn" target="_blank">${options.actionButton.label}</a>
               </div>`
            : ''
        }
      </div>
      <div class="footer">
        <p>SPORTEXUS — ${isAr ? 'منصة واحدة. لكل أكاديمية.' : 'One Platform. Every Academy.'}</p>
        <p><a href="${this.appPublicUrl}">sportexus.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }
}
