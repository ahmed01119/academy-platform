# SPORTEXUS — Complete Email System Audit, Architecture & Production Hardening

## 1. Executive Summary

As part of the production readiness and enterprise reliability hardening for SPORTEXUS (Multi-tenant Sports Academy SaaS), a comprehensive repository-wide audit and enhancement of the email delivery infrastructure was conducted.

Every core business lifecycle event that requires user notification now reliably dispatches localized (Arabic RTL / English LTR), sanitized, brand-aligned emails using a resilient dual-provider architecture (Resend REST API + Nodemailer SMTP Transport) with in-memory fallback, exponential backoff retries, and duplicate-suppressing idempotency.

---

## 2. Infrastructure & Delivery Layer Architecture

```
                                  ┌─────────────────────────────┐
                                  │      Application Event      │
                                  │ (Auth / Finance / Tenancy)  │
                                  └──────────────┬──────────────┘
                                                 │
                                                 ▼
                                  ┌─────────────────────────────┐
                                  │    EmailService (Global)    │
                                  │   - Idempotency Cache (60s) │
                                  │   - HTML Sanitization (XSS) │
                                  │   - Token & Secret Masking  │
                                  └──────────────┬──────────────┘
                                                 │
                   ┌─────────────────────────────┼─────────────────────────────┐
                   │                             │                             │
                   ▼                             ▼                             ▼
       ┌───────────────────────┐     ┌───────────────────────┐     ┌───────────────────────┐
       │     Resend API        │     │     Nodemailer SMTP   │     │    Dev / Mock Queue   │
       │ (RESEND_API_KEY set)  │     │    (SMTP_HOST set)    │     │  (Default/Test Mode)  │
       │  - HTTP REST POST     │     │  - Port 587/465 TLS   │     │  - In-memory ring-buf │
       │  - 3x Exponential     │     │  - 3x Exponential     │     │  - Zero network leak  │
       │    backoff retry      │     │    backoff retry      │     │  - Fast test suite    │
       └───────────────────────┘     └───────────────────────┘     └───────────────────────┘
```

### Key Engineering Features:
1. **Provider Abstraction & Multi-Provider Support:**
   - **Resend REST API:** Fast modern HTTPS email delivery without local port 25/587 outbound firewall restrictions.
   - **Standard SMTP (Nodemailer):** Direct compatibility with AWS SES, Mailgun, SendGrid, Postmark, Brevo, or private enterprise SMTP servers.
   - **Dev Mode / Test Queue:** Automatic fallback in dev/test with circular buffer storage (last 100 emails) and operational stats.
2. **Exponential Backoff Retry Engine:**
   - Automatically catches transient provider network errors (429 rate limit, 500/502/503/504 server errors, `ECONNRESET`, `ETIMEDOUT`).
   - Retries up to 3 times with exponential backoff (`200ms * (2.5 ^ attempt) + jitter`), ensuring high delivery reliability during transient outages.
3. **Idempotency Window (Duplicate Suppression):**
   - Hashes `recipient + subject + body_signature` into an in-memory cache with a 60-second sliding expiration window.
   - Rapid double-clicks or duplicate webhook deliveries automatically return `idempotentSkipped: true` without spamming the recipient's inbox.
   - Can be overridden when needed using `forceSend: true`.
4. **HTML Sanitization & Defense-in-Depth:**
   - Every dynamic input (user names, academy names, notes, branch names, monetary amounts) is passed through `escapeHtml(...)`.
   - Prevents stored XSS attacks via email clients.
5. **Zero Token / Secret Leaking:**
   - Verification links and password reset links with `?token=...` or `?key=...` have sensitive query parameters automatically masked in server logs (`token=***`).
   - Password hashes and raw credentials are never included in email templates or log output.
6. **Bilingual RTL / LTR Modern Aesthetic:**
   - Sportexus Dark & Blue brand styling (`#0b1120` canvas, `#0f172a` container, `#00D6FF` accents).
   - Arabic emails render with `dir="rtl"` and `Cairo, sans-serif` font typography.
   - English emails render with `dir="ltr"` and clean system sans-serif typography.
   - Includes hidden preheaders and responsive HTML layouts.

---

## 3. Audited & Implemented Email Workflows Matrix

| # | Domain | Workflow / Trigger | Recipient | Bilingual Template | Security & Resilience |
|---|--------|-------------------|-----------|--------------------|----------------------|
| 1 | **Auth** | Academy Application Submitted | Academy Applicant | `sendAcademyApplicationReceived` | Rate-limited submission, escaped name |
| 2 | **Auth** | Password Reset Requested | User Email | `sendPasswordReset` | Single-use expiring token (1 hour), neutral anti-enumeration response |
| 3 | **Auth** | Password Changed Security Alert | User Email | `sendPasswordChangedNotification` | Dispatches on `resetPassword` & `changePassword` with IP, timestamp & device alert |
| 4 | **Auth** | Email Verification Link | User Email | `sendEmailVerification` | Single-use expiring token, masked logs |
| 5 | **Platform** | Academy Approved & Activated | Academy Owner | `sendAcademyApproved` | Direct login & activation dashboard button |
| 6 | **Platform** | Academy Registration Rejected | Academy Applicant | `sendAcademyRejected` | Official notice with constructive review feedback notes |
| 7 | **Platform** | Academy Additional Info Requested | Academy Applicant | `sendAcademyMoreInfoRequested` | Official notice requesting specific missing documents |
| 8 | **Platform** | Platform Admin / Co-Owner Invite | Platform Invitee | `sendPlatformAdminInvite` | Role-specific invitation with setup action link |
| 9 | **Tenancy** | Academy Staff Membership Invite | Invited Staff Member | `sendStaffInvite` | Single-use 7-day token, role & branch scoped |
| 10 | **Players** | Player Registration & Enrollment | Primary Guardian | `sendPlayerEnrollmentWelcome` | Guardian welcome with player name, branch, sport & Portal link |
| 11 | **Finance** | Official Payment Receipt | Payer / Guardian | `sendPaymentReceipt` | Official receipt with receipt #, amount, currency, payment method & date |
| 12 | **Finance** | SaaS Subscription Expiration / Past-Due | Academy Owner | `sendSubscriptionAlert` | Plan name, expiry date & billing renewal URL |

---

## 4. Frontend UX & Cooldown Hardening

### Forgot Password Screen (`apps/web/src/app/forgot-password/page.tsx`):
- Added an observable 60-second cooldown timer once an email reset request is submitted.
- The submit button is automatically disabled during the cooldown and shows:
  - Arabic: `إعادة الإرسال بعد X ثانية`
  - English: `Resend available in Xs`
- Prevents accidental repeated clicks and avoids triggering backend Redis rate limit errors (`Too many password reset requests`).
- Generic anti-enumeration response: *"If this email is registered, you will receive a one-time code to reset your password."*

---

## 5. Configuration Guide & Environment Variables

Add the following configuration to `apps/api/.env` (and staging/production host environments):

```env
# =============================================================================
# SPORTEXUS EMAIL SYSTEM CONFIGURATION
# =============================================================================

# Provider selection: 'resend' | 'smtp' | 'dev'
MAIL_PROVIDER=resend

# Sender Identity
MAIL_FROM_EMAIL=no-reply@sportexus.com
MAIL_FROM_NAME="Sportexus Platform"

# Public Application URL (used for links in emails)
NEXT_PUBLIC_APP_URL=https://sportexus.com

# -----------------------------------------------------------------------------
# Option 1: Resend HTTP REST API (Recommended for Cloud / Zero-Config)
# -----------------------------------------------------------------------------
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx

# -----------------------------------------------------------------------------
# Option 2: Standard SMTP (AWS SES, Mailgun, SendGrid, Brevo, or Custom SMTP)
# -----------------------------------------------------------------------------
# SMTP_HOST=smtp.mailgun.org
# SMTP_PORT=587
# SMTP_USER=postmaster@sportexus.com
# SMTP_PASS=your_smtp_password
# SMTP_SECURE=false
# SMTP_FROM=no-reply@sportexus.com
```

---

## 6. Verification & Automated Test Evidence

- **Unit & Integration Suite (`apps/api/src/modules/email/email.service.test.ts`):**
  - 24 tests covering provider resolution, dev logger fallback, circular buffer limit, idempotency suppression, `forceSend`, Resend HTTP mock, exponential backoff retries, persistent error resilience, SMTP Nodemailer dispatch, all 12 bilingual templates, and observability statistics.
  - **Result:** 24 / 24 passed (100%).
- **Full Monorepo Suite:**
  - `@academy/api`: 217 tests passed.
  - `@academy/web`: 36 tests passed.
  - `@academy/shared`: 27 tests passed.
  - `@academy/database`: 6 tests passed.
  - **Total:** 286 / 286 automated tests passing across the entire repository.
