# Project Overview — Sportexus (Academy Platform)

> Derived from the implementation on branch `frontend-architecture-uiux-audit` (2026-11-14).
> Where code and older docs disagree, this document describes **the code** and the conflict is
> recorded in [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md).

## 1. Purpose

Sportexus is a **multi-tenant SaaS for managing sports academies** of any sport (`SportCode`: football, swimming,
tennis, padel, basketball, volleyball, handball, martial arts, gymnastics, athletics, squash, other; since 2026-11-21). A single platform hosts many independent
academies ("tenants"). Each academy runs its day-to-day operations on the platform: branches,
players and guardians, training groups and schedules, attendance, coach evaluations, player
fees and session cash handling.

The product is built for the Egyptian / Arabic-speaking market first:

- Default locale **Arabic (RTL)**, English (LTR) fully supported (`packages/shared/src/constants/locales.ts`).
- Tenant defaults: currency `EGP`, timezone `Africa/Cairo`, branch country `EG`.
- Many API error messages are bilingual (Arabic + English in one string).

## 2. Problem it solves

Academies typically run on paper, WhatsApp and spreadsheets. The platform replaces that with:

- A single source of truth for players, guardians, enrollments and group membership per branch.
- Fast, fraud-resistant attendance (QR player cards, session QR codes, offline-capable scanner).
- A finance ledger for player fees with partial payments, reversals (never deletions), coach
  session expenses with an approval workflow, and per-session cashier closing.
- Coach performance evaluations visible to players/guardians through self-service portals.
- A platform-operator console to approve new academies, manage SaaS plans/subscriptions,
  users, audit logs and storage.

## 3. Target users

| Layer    | User                                                       | How they get access                                                        |
| -------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| Platform | **Platform Owner** (`users.is_platform_owner`)             | Provisioned out-of-band (`scripts/create-superadmin.js`)                   |
| Platform | **Platform Super Admin** (`users.is_platform_super_admin`) | Invited by a Platform Owner                                                |
| Academy  | **OWNER**                                                  | Self-registers an academy → approved by platform staff                     |
| Academy  | **MANAGER** (admin, no money), **COACH** (own groups only) | Invited by academy staff with `staff.manage` (owner decision 2026-11-24)   |
| End user | **Player**                                                 | Account linked to a `Player` record (join request approval or claim token) |
| End user | **Guardian** (parent)                                      | Account linked to a `Guardian` record via claim token                      |

What each role can do, in plain language: [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md).

One user account can hold memberships in several academies and switch between them.

## 4. Main features (as implemented)

1. **Academy onboarding** — public registration creates a user + `AcademyApplication`
   (`PENDING_REVIEW`); platform staff approve/reject/request info; approval provisions the
   tenant, a main branch (`MAIN`), the OWNER membership and a SaaS subscription.
2. **Authentication** — email/password (Argon2id), 15-min JWT access token + rotating refresh
   token (httpOnly cookies, reuse detection), 6-digit OTP password reset, email verification,
   rate limiting via Redis.
3. **Staff & tenancy** — invitations (7-day tokens), accept invite, revoke membership, coach
   delegation flag (`canReviewApplications`), tenant switching, academy profile/settings.
4. **Branches** — CRUD with capacity and branch manager; safe archive with deletion-impact report.
5. **Players & guardians** — create/update with sensitive-data permission gates (medical notes,
   national ID), QR membership card (issue/rotate/revoke), deletion impact + safe archive.
6. **Player join requests** — public form per academy, sent by the player or by a guardian for a child; the applicant's
   account stays pending until staff (or a delegated coach) review; approval auto-creates Player, Guardian, Enrollment
   and Group membership and links the applicant's account (player or guardian portal).
7. **Enrollments** — enroll a player into a branch, transfer between branches (capacity-checked).
8. **Training groups** — capacity, coaches (head coach), members, weekly schedules.
9. **Attendance** — sessions per branch/group, manual/bulk marking with optimistic
   concurrency + idempotency, session QR check-in, player-card QR scanning with lateness
   computation, offline batch sync, append-only corrections & event stream, reports.
10. **Evaluations** — templates, four-axis scoring (technical/tactical/physical/behavioral),
    development profile, rankings, published vs. private coach notes.
11. **Finance** — player subscription plans, player subscriptions with balances, payment
    collection with receipts, reversals, session expenses with approve/reject (separation of
    duties), session cashier summary/closing, finance dashboard.
12. **Portals** — player portal (profile, sessions, attendance summary, published evaluations,
    own QR card) and guardian portal (linked children).
13. **Notifications & email** — in-app notifications with deep links and unread counts;
    transactional email via Resend, SMTP (Nodemailer) or a dev in-memory logger.
14. **Platform console** — metrics, academies (status, subscription, archive/delete),
    users (revoke sessions, suspend, force reset), SaaS plans, announcements, audit logs,
    security events, academy applications, super-admin governance, storage maintenance.
15. **PWA / offline** — service worker app shell, IndexedDB offline queue for attendance scans
    and evaluation drafts, version-checked update flow.

## 5. Out of scope / not present

- Online payment gateway (payment methods are recorded, not processed).
- SaaS invoice generation workflow (`saas_invoices` table exists; no API writes it — see status doc).
- Sport-specific features (e.g. swimming lap times); mobile native apps (a Flutter client is mentioned only in
  `docs/architecture/open-requirements.md`).
- Background job queue (README mentions BullMQ "later"; not installed).

## 6. Related documents

- [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) — components, data flow, database
- [BUSINESS_LOGIC.md](BUSINESS_LOGIC.md) — roles, permissions, rules, workflows
- [TECHNOLOGY_STACK.md](TECHNOLOGY_STACK.md) — languages, frameworks, versions, tooling
- [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) — state, known bugs, open questions
- Historical/topic docs remain under `docs/adr`, `docs/architecture`, `docs/security`, `docs/qa`, etc.
