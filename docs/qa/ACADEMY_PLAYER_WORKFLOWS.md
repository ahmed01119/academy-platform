# Sportexus Academy & Player Workflow Specification (Phase 2)

## 1. Unified Academy Registration & Approval Architecture

### 1.1 Context & Problem Resolved
Previously, Sportexus had ambiguous onboarding entry points:
1. A quick "Demo Request" modal on the homepage that lacked direct tenant linkage.
2. An unrestricted registration endpoint `/register` that immediately granted active workspace access without platform administrator oversight.

This allowed unverified academies to consume infrastructure resources and bypass security screening.

### 1.2 Canonical Unified Flow
The canonical onboarding architecture now adheres to strict platform gating:
1. **Single Entry Point (`/register`):**
   - Homepage CTAs and links route exclusively to `/register`.
   - Collects verified academy details: `academyName`, `sport` (`FOOTBALL`, `BASKETBALL`, `SWIMMING`, `TENNIS`, `MARTIAL_ARTS`), `city`, `ownerName`, `email`, `phone`, and secure `password` (Argon2id).
2. **Deterministic Status Machine:**
   - On registration submit, `POST /auth/register` creates the user record and an associated `AcademyApplication` with `status: PENDING_REVIEW`.
   - **No session cookies are issued** upon registration to prevent unauthorized workspace access prior to vetting.
   - The user is transitioned immediately to an animated, bilingual confirmation screen explaining that the application is under review.
3. **Platform Notification & Email Dispatch:**
   - Platform super-admins receive an actionable in-app notification (`ACADEMY_APPLICATION_SUBMITTED`).
   - The applicant receives a transactional confirmation email (`sendAcademyApplicationReceived`) confirming their reference and estimated review timeline.
4. **Platform Review & Tenant Provisioning:**
   - Platform super-admins review applications in `/platform` under the Applications tab.
   - **Approval (`POST /platform/applications/:id/approve`):**
     - Provisions the dedicated `Tenant` and initial branch (`الفرع الرئيسي`).
     - Associates the applicant as `ACADEMY_ADMIN` with active membership.
     - Automatically sends `sendAcademyApproved` email containing the direct login URL.
   - **Rejection (`POST /platform/applications/:id/reject`):**
     - Updates application status to `REJECTED` with review notes.
     - Dispatches `sendAcademyRejected` email with the specific reason.

---

## 2. Security & Anti-Leakage Controls
1. **Elimination of Debug Tokens:**
   - `debugToken` has been completely stripped from all public API responses (`POST /auth/forgot-password`, `POST /auth/resend-verification`, `POST /auth/register`).
   - Verification and password-reset tokens are dispatched solely via verified transactional email (`EmailService`).
2. **Neutral Security Responses:**
   - Password reset and email resend endpoints return identical generic success messages regardless of whether the email exists in the database, preventing user enumeration attacks.
3. **Multi-Tenant Isolation:**
   - Unapproved applicants cannot authenticate or access tenant endpoints; `JwtStrategy` validates membership status and denies access without active tenant association.
