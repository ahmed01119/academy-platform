import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type ConfigService } from '@nestjs/config';
import { EmailService, escapeHtml } from './email.service';

const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'smtp-msg-777' });

vi.mock('nodemailer', () => {
  return {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
    })),
  };
});

describe('EmailService', () => {
  let emailService: EmailService;
  let configService: ConfigService;

  const mockConfigValues: Record<string, string | number | boolean> = {
    MAIL_FROM_EMAIL: 'support@sportexus.com',
    MAIL_FROM_NAME: 'Sportexus Test',
    NEXT_PUBLIC_APP_URL: 'https://sportexus.com',
  };

  beforeEach(() => {
    mockSendMail.mockClear();
    configService = {
      get: vi.fn((key: string) => mockConfigValues[key]),
    } as unknown as ConfigService;
  });

  describe('HTML Sanitization (XSS Prevention)', () => {
    it('escapes dangerous HTML special characters', () => {
      const malicious = '<script>alert("xss")</script>&"\'';
      const safe = escapeHtml(malicious);
      expect(safe).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&amp;&quot;&#039;');
      expect(safe).not.toContain('<script>');
    });

    it('handles null, undefined, numbers, and empty strings safely', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
      expect(escapeHtml('')).toBe('');
      expect(escapeHtml(12345)).toBe('12345');
    });
  });

  describe('Provider Resolution & Dev Logger Mode', () => {
    it('defaults to dev provider when no third-party keys are supplied', () => {
      emailService = new EmailService(configService);
      const status = emailService.getEmailStatus();

      expect(status.activeProvider).toBe('dev');
      expect(status.resendConfigured).toBe(false);
      expect(status.smtpConfigured).toBe(false);
      expect(status.fromEmail).toBe('support@sportexus.com');
      expect(status.fromName).toBe('Sportexus Test');
    });

    it('logs email and stores it in the in-memory queue in dev mode', async () => {
      emailService = new EmailService(configService);

      const result = await emailService.sendEmailDetailed({
        to: 'coach@example.com',
        subject: 'Test Subject',
        html: '<p>Test Body</p>',
        text: 'Test Body',
      });

      expect(result.delivered).toBe(true);
      expect(result.status).toBe('DEV_LOGGED');
      expect(result.provider).toBe('dev');
      expect(result.messageId).toBeDefined();

      const sent = emailService.getSentEmails();
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe('coach@example.com');
      expect(sent[0].subject).toBe('Test Subject');
    });

    it('honors max queue length circular buffer', async () => {
      emailService = new EmailService(configService);

      for (let i = 0; i < 110; i++) {
        await emailService.sendEmailDetailed({
          to: `user${i}@example.com`,
          subject: `Subject ${i}`,
          html: `<p>Message ${i}</p>`,
          text: `Message ${i}`,
          forceSend: true,
        });
      }

      const queue = emailService.getSentEmails();
      expect(queue.length).toBe(100);
      expect(queue[0].to).toBe('user109@example.com');
    });
  });

  describe('Idempotency & Duplicate Suppression', () => {
    it('suppresses immediate duplicate sends to the same recipient within idempotency window', async () => {
      emailService = new EmailService(configService);

      const firstResult = await emailService.sendEmailDetailed({
        to: 'user@academy.com',
        subject: 'Payment Confirmation',
        html: '<p>Thank you for your payment.</p>',
        text: 'Thank you for your payment.',
      });

      expect(firstResult.delivered).toBe(true);
      expect(firstResult.idempotentSkipped).toBeUndefined();

      // Second identical call
      const secondResult = await emailService.sendEmailDetailed({
        to: 'user@academy.com',
        subject: 'Payment Confirmation',
        html: '<p>Thank you for your payment.</p>',
        text: 'Thank you for your payment.',
      });

      expect(secondResult.delivered).toBe(true);
      expect(secondResult.idempotentSkipped).toBe(true);

      // Only one email should have been counted as dispatched
      expect(emailService.getEmailStatus().totalDispatched).toBe(1);
    });

    it('allows bypassing idempotency cache with forceSend flag', async () => {
      emailService = new EmailService(configService);

      await emailService.sendEmailDetailed({
        to: 'user@academy.com',
        subject: 'Forced Send',
        html: '<p>First</p>',
        text: 'First',
      });

      const secondResult = await emailService.sendEmailDetailed({
        to: 'user@academy.com',
        subject: 'Forced Send',
        html: '<p>First</p>',
        text: 'First',
        forceSend: true,
      });

      expect(secondResult.idempotentSkipped).toBeUndefined();
      expect(emailService.getEmailStatus().totalDispatched).toBe(2);
    });
  });

  describe('Resend Provider Integration', () => {
    it('selects resend when RESEND_API_KEY is configured and handles API dispatch', async () => {
      const resendConfig: Record<string, string> = {
        ...mockConfigValues,
        RESEND_API_KEY: 're_valid_test_key_12345',
      };
      const customConfig = {
        get: vi.fn((key: string) => resendConfig[key]),
      } as unknown as ConfigService;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'resend-msg-999' }),
      } as Response);

      emailService = new EmailService(customConfig);
      expect(emailService.getEmailStatus().activeProvider).toBe('resend');

      const result = await emailService.sendEmailDetailed({
        to: 'guardian@sportexus.com',
        subject: 'Welcome to Academy',
        html: '<p>Hello!</p>',
        text: 'Hello!',
      });

      expect(result.delivered).toBe(true);
      expect(result.status).toBe('SENT');
      expect(result.provider).toBe('resend');
      expect(result.messageId).toBe('resend-msg-999');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer re_valid_test_key_12345',
          }),
        }),
      );
    });

    it('retries transient network failures with exponential backoff', async () => {
      const resendConfig: Record<string, string> = {
        ...mockConfigValues,
        RESEND_API_KEY: 're_valid_test_key_12345',
      };
      const customConfig = {
        get: vi.fn((key: string) => resendConfig[key]),
      } as unknown as ConfigService;

      // Fail first attempt with 500, succeed on second attempt
      let attempts = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          return {
            ok: false,
            status: 500,
            text: async () => 'Internal Server Error',
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({ id: 'recovered-msg-123' }),
        } as Response;
      });

      emailService = new EmailService(customConfig);

      const result = await emailService.sendEmailDetailed({
        to: 'retry@sportexus.com',
        subject: 'Retry Test',
        html: '<p>Retry</p>',
        text: 'Retry',
      });

      expect(result.delivered).toBe(true);
      expect(result.messageId).toBe('recovered-msg-123');
      expect(attempts).toBe(2);
    });

    it('handles persistent provider failures gracefully without crashing', async () => {
      const resendConfig: Record<string, string> = {
        ...mockConfigValues,
        RESEND_API_KEY: 're_valid_test_key_12345',
      };
      const customConfig = {
        get: vi.fn((key: string) => resendConfig[key]),
      } as unknown as ConfigService;

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Forbidden: Invalid API Key',
      } as Response);

      emailService = new EmailService(customConfig);

      const result = await emailService.sendEmailDetailed({
        to: 'fail@sportexus.com',
        subject: 'Fail Test',
        html: '<p>Fail</p>',
        text: 'Fail',
      });

      expect(result.delivered).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('Forbidden');
      expect(emailService.getEmailStatus().totalFailed).toBe(1);
    });
  });

  describe('SMTP Provider Integration', () => {
    it('creates nodemailer transport and dispatches via SMTP when configured', async () => {
      const smtpConfig: Record<string, string | number> = {
        ...mockConfigValues,
        SMTP_HOST: 'smtp.mailgun.org',
        SMTP_PORT: 587,
        SMTP_USER: 'postmaster@sportexus.com',
        SMTP_PASS: 'secret_pass_123',
      };
      const customConfig = {
        get: vi.fn((key: string) => smtpConfig[key]),
      } as unknown as ConfigService;

      emailService = new EmailService(customConfig);
      expect(emailService.getEmailStatus().activeProvider).toBe('smtp');

      const result = await emailService.sendEmailDetailed({
        to: 'smtp-user@sportexus.com',
        subject: 'SMTP Dispatch Test',
        html: '<p>Via SMTP</p>',
        text: 'Via SMTP',
      });

      expect(result.delivered).toBe(true);
      expect(result.status).toBe('SENT');
      expect(result.provider).toBe('smtp');
      expect(result.messageId).toBe('smtp-msg-777');
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'smtp-user@sportexus.com',
          subject: 'SMTP Dispatch Test',
        }),
      );
    });
  });

  describe('Bilingual Templates (Arabic / English)', () => {
    beforeEach(() => {
      emailService = new EmailService(configService);
    });

    it('1. sendAcademyApplicationReceived renders properly in Arabic and English', async () => {
      await emailService.sendAcademyApplicationReceived(
        'owner@academy.com',
        'الكابتن أحمد',
        'أكاديمية النجوم',
        'ar',
      );
      let sent = emailService.getSentEmails();
      expect(sent[0].subject).toContain('أكاديمية النجوم');
      expect(sent[0].html).toContain('dir="rtl"');
      expect(sent[0].html).toContain('أكاديمية النجوم');

      await emailService.sendAcademyApplicationReceived(
        'owner@academy.com',
        'Coach Ahmed',
        'Stars Academy',
        'en',
      );
      sent = emailService.getSentEmails();
      expect(sent[0].subject).toContain('Stars Academy');
      expect(sent[0].html).toContain('dir="ltr"');
      expect(sent[0].html).toContain('Application Received');
    });

    it('2. sendAcademyApproved renders activation URL and dashboard button', async () => {
      await emailService.sendAcademyApproved(
        'owner@academy.com',
        'أحمد',
        'أكاديمية الفرسان',
        'https://sportexus.com/dashboard',
        'ar',
      );
      const sent = emailService.getSentEmails();
      expect(sent[0].subject).toContain('تهانينا!');
      expect(sent[0].html).toContain('https://sportexus.com/dashboard');
      expect(sent[0].html).toContain('الدخول إلى لوحة التحكم');
    });

    it('3. sendAcademyRejected renders constructive review feedback', async () => {
      await emailService.sendAcademyRejected(
        'applicant@example.com',
        'سعيد',
        'أكاديمية المستقبل',
        'يرجى إرفاق السجل التجاري ورخصة الاتحاد',
        'ar',
      );
      const sent = emailService.getSentEmails();
      expect(sent[0].subject).toContain('تحديث بخصوص طلب تسجيل أكاديمية');
      expect(sent[0].html).toContain('يرجى إرفاق السجل التجاري ورخصة الاتحاد');
    });

    it('4. sendAcademyMoreInfoRequested renders clarification request', async () => {
      await emailService.sendAcademyMoreInfoRequested(
        'applicant@example.com',
        'سعيد',
        'أكاديمية المستقبل',
        'يرجى توضيح بيانات الفروع والملاعب',
        'ar',
      );
      const sent = emailService.getSentEmails();
      expect(sent[0].subject).toContain('مطلوب معلومات إضافية');
      expect(sent[0].html).toContain('يرجى توضيح بيانات الفروع والملاعب');
    });

    it('5. sendPasswordReset renders 1-hour expiration notice and action link', async () => {
      await emailService.sendPasswordReset(
        'user@example.com',
        'خالد',
        'https://sportexus.com/reset-password?token=secret123',
        'ar',
      );
      const sent = emailService.getSentEmails();
      expect(sent[0].subject).toContain('إعادة تعيين كلمة المرور');
      expect(sent[0].html).toContain('ساعة واحدة فقط');
      expect(sent[0].html).toContain('https://sportexus.com/reset-password?token=secret123');
    });

    it('6. sendPasswordChangedNotification delivers security alert with IP & timestamp', async () => {
      await emailService.sendPasswordChangedNotification(
        'user@example.com',
        'خالد',
        {
          ipAddress: '197.35.12.88',
          userAgent: 'Mozilla/5.0 Chrome',
          changedAt: new Date('2026-10-29T05:00:00Z'),
        },
        'ar',
      );
      const sent = emailService.getSentEmails();
      expect(sent[0].subject).toContain('تنبيه أمان: تم تغيير كلمة مرور حسابك');
      expect(sent[0].html).toContain('197.35.12.88');
      expect(sent[0].html).toContain('تنبيه أمان الحساب');
    });

    it('7. sendEmailVerification renders activation link', async () => {
      await emailService.sendEmailVerification(
        'user@example.com',
        'طارق',
        'https://sportexus.com/verify?token=verify999',
        'ar',
      );
      const sent = emailService.getSentEmails();
      expect(sent[0].subject).toContain('تأكيد البريد الإلكتروني');
      expect(sent[0].html).toContain('https://sportexus.com/verify?token=verify999');
    });

    it('8. sendPlatformAdminInvite renders correct platform roles', async () => {
      await emailService.sendPlatformAdminInvite(
        'super@sportexus.com',
        'عمر',
        'PLATFORM_CO_OWNER',
        'https://sportexus.com/platform/activate',
        true,
        'ar',
      );
      const sent = emailService.getSentEmails();
      expect(sent[0].subject).toContain('مالك مشارك للمنصة');
      expect(sent[0].html).toContain('تفعيل الحساب وتعيين كلمة المرور');
    });

    it('9. sendStaffInvite renders role and branch information', async () => {
      await emailService.sendStaffInvite({
        to: 'coach@academy.com',
        recipientName: 'كابتن محمود',
        academyName: 'أكاديمية الأبطال',
        role: 'COACH',
        activationUrl: 'https://sportexus.com/staff/activate?token=invite777',
        branchName: 'فرع المروج',
        invitedByName: 'المدير التنفيذي',
        locale: 'ar',
      });
      const sent = emailService.getSentEmails();
      expect(sent[0].subject).toContain('دعوة للانضمام إلى فريق عمل');
      expect(sent[0].html).toContain('فرع المروج');
      expect(sent[0].html).toContain('مدرب رياضي (Coach)');
      expect(sent[0].html).toContain('7 أيام');
    });

    it('10. sendPlayerEnrollmentWelcome renders player and branch enrollment details', async () => {
      await emailService.sendPlayerEnrollmentWelcome({
        to: 'guardian@gmail.com',
        guardianName: 'أبو فهد',
        playerName: 'فهد العتيبي',
        academyName: 'أكاديمية النخبة',
        branchName: 'فرع الروضة',
        sport: 'FOOTBALL',
        locale: 'ar',
      });
      const sent = emailService.getSentEmails();
      expect(sent[0].subject).toContain('فهد العتيبي');
      expect(sent[0].html).toContain('فرع الروضة');
      expect(sent[0].html).toContain('FOOTBALL');
      expect(sent[0].html).toContain('بوابة ولي الأمر');
    });

    it('11. sendPaymentReceipt renders formal financial receipt', async () => {
      await emailService.sendPaymentReceipt({
        to: 'parent@gmail.com',
        recipientName: 'أم ياسين',
        academyName: 'أكاديمية السباحة الذهبية',
        receiptNumber: 'REC-2026-4481',
        amount: 850,
        currency: 'SAR',
        paymentMethod: 'CREDIT_CARD',
        description: 'اشتراك تدريب شهري',
        date: new Date('2026-10-29'),
        locale: 'ar',
      });
      const sent = emailService.getSentEmails();
      expect(sent[0].subject).toContain('REC-2026-4481');
      expect(sent[0].html).toContain('850.00 SAR');
      expect(sent[0].html).toContain('CREDIT_CARD');
      expect(sent[0].html).toContain('إيصال سداد إلكتروني');
    });

    it('12. sendSubscriptionAlert renders subscription expiration or past-due warning', async () => {
      await emailService.sendSubscriptionAlert({
        to: 'owner@academy.com',
        ownerName: 'عبدالرحمن',
        academyName: 'أكاديمية الجيل',
        planName: 'الباقة المتقدمة (Pro)',
        expiresAt: new Date('2026-11-15'),
        renewalUrl: 'https://sportexus.com/dashboard/billing',
        status: 'EXPIRING_SOON',
        locale: 'ar',
      });
      const sent = emailService.getSentEmails();
      expect(sent[0].subject).toContain('تذكير بتجديد اشتراك باقة');
      expect(sent[0].html).toContain('الباقة المتقدمة (Pro)');
      expect(sent[0].html).toContain('تجديد الاشتراك الآن');
    });
  });

  describe('Observability & Operational Status', () => {
    it('returns system status and clears emails when requested', async () => {
      emailService = new EmailService(configService);
      await emailService.sendEmailDetailed({
        to: 'test@example.com',
        subject: 'Status Check',
        html: '<p>Body</p>',
        text: 'Body',
      });

      const status = emailService.getEmailStatus();
      expect(status.queueLength).toBe(1);
      expect(status.totalDispatched).toBe(1);
      expect(status.totalFailed).toBe(0);
      expect(status.uptimeSeconds).toBeGreaterThanOrEqual(0);

      emailService.clearSentEmails();
      expect(emailService.getSentEmails()).toHaveLength(0);
    });
  });
});
