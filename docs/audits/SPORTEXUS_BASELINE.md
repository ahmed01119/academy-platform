# SPORTEXUS — Baseline Audit, Architecture & Performance Report
**Audit Date:** 2026-10-28  
**Auditor:** Sportexus Principal Engineering Team  
**Status:** Completed Phase 0 Baseline  

---

## 1. Executive Summary

Sportexus is a full-stack multi-tenant sports academy management SaaS designed for multi-branch academies, coaches, players, guardians, and platform administrators.

This baseline audit evaluates the running system, architecture, database persistence, authentication state, current performance, existing defects, and backup/restore capabilities before executing Phases 1 through 12.

---

## 2. Environment & Service Inventory

| Component | Technology | Listening Port | Running Mode | Status |
|---|---|---|---|---|
| **Database** | PostgreSQL 18.4 (Embedded Cluster) | `5432` | Persistent (`packages/database/data/db`) | **ONLINE** |
| **Backend API** | NestJS 11 + Prisma ORM 6.19.3 | `3001` | Node.js v24 (`nest start --watch`) | **ONLINE** |
| **Frontend Web** | Next.js 15.5.28 (React 19) | `3000` | Node.js v24 (`next dev`) | **ONLINE** |
| **Edge Tunnel** | Cloudflare Quick Tunnel (cloudflared) | Edge | HTTP/2 Quic Proxy to `:3000` | **ONLINE (Ephemeral)** |

### Build Discrepancy Note
- The running frontend and backend are currently running in **development watch mode** (`next dev` and `nest start --watch`), NOT pre-compiled production bundles.
- In development mode, Next.js JIT compiles each route on first visit, resulting in high memory usage (~2.9 GB for the Node process) and initial cold load times up to 3.8s. Production compilation will eliminate JIT compilation overhead.

---

## 3. Database & Data Protection Audit

### 3.1 Persistence & Data Location
- **Database Engine:** Embedded PostgreSQL 18.4 running on port 5432.
- **Physical Data Path:** `D:\project academy A & M\packages\database\data\db`
- **Cluster State:** Initialized, persistent cluster with WAL redo protection.
- **Database Name:** `academy`

### 3.2 Inventory of Persisted Records (902 Records Total)
```
Model                           Count
-------------------------------------
user                            34
tenant                          19
tenantMembership                20
tenantSport                     11
tenantSubscription              14
branch                          21
trainingGroup                   3
trainingSchedule                6
groupCoach                      2
groupMember                     8
player                          10
guardian                        8
playerEnrollment                13
playerSubscriptionPlan          1
playerSubscription              5
academyFinancialTransaction     12
sessionCashierClosing           2
attendanceSession               12
attendanceRecord                26
attendanceCorrection            0
attendanceEvent                 31
attendanceIdempotency           27
evaluationTemplate              2
playerEvaluation                5
appNotification                 48
auditLog                        367
academyApplication              20
playerRegistrationRequest       7
saaSPlan                        4
refreshToken                    164
-------------------------------------
Total Live Records              902
```

### 3.3 Backup & Restoration Verification
- **Verified Backup File:** `backups/sportexus_backup_2026-10-28T00-57-09-057Z.json`
- **Restoration Test Procedure:** Created an isolated PostgreSQL schema (`test_restore_isolated`), pushed schema definitions, and executed dependency-ordered upsert restoration.
- **Restoration Result:** **902 / 902 records restored (100% success rate)**.
- **Isolated Schema:** Verified and safely dropped after integrity validation.

---

## 4. Route & Architecture Mapping

### 4.1 Web Routes (Next.js App Router)
| Route | Purpose | Access Control |
|---|---|---|
| `/` | Public Landing Page | Public |
| `/login` | Authentication Portal | Public (Redirects if logged in) |
| `/register` | Academy Registration Form (Password-based) | Public |
| `/forgot-password` | Password Recovery Request | Public |
| `/reset-password` | Single-use Token Password Reset | Public |
| `/account` | User Profile & Password Change | Authenticated (Any Role) |
| `/dashboard` | Academy Staff Dashboard | Academy Staff (Owner, Manager, Staff) |
| `/platform` | Super Admin Platform Governance | Platform Super Admin Only |
| `/coach` | Coach Training & Evaluation Workspace | Coach Role |
| `/player` | Player Portal (Schedule, QR Card, Evals) | Player Role |
| `/guardian` | Guardian Portal (Dependent Tracking) | Guardian Role |
| `/branches` | Multi-branch Academy Management | Academy Owner / Manager |
| `/groups` | Groups & Squads Management | Academy Owner / Manager / Coach |
| `/players` | Player Directory & Join Requests | Academy Staff |
| `/attendance/sessions/[id]`| Session Attendance Marking | Staff / Authorized |
| `/attendance/scanner` | QR Code Scanning Station | Staff / Authorized |
| `/attendance/reports` | Attendance Analytics & Reports | Academy Owner / Manager |
| `/finance` | Financial Dashboard, Subscriptions & Cashier | Academy Owner / Manager / Accountant |
| `/evaluations` | Skills & Performance Evaluations | Coach / Academy Staff |
| `/settings` | Academy Configuration & Roles | Academy Owner |
| `/offline` | Offline PWA Fallback Shell | PWA Offline |

### 4.2 API Endpoint Inventory (NestJS Controller Modules)
- **Auth Module (`/v1/auth`)**: `register`, `login`, `refresh`, `logout`, `forgot-password`, `reset-password`, `verify-email`, `resend-verification`, `me`, `change-password`, `profile`.
- **Tenancy Module (`/v1/tenants`)**: `my-memberships`, `switch`, `invitations`, `invitations/accept`, `memberships/:id/revoke`, `memberships/:id/coach-delegation`, `staff`, `branches`, `profile`.
- **Branches Module (`/v1/branches`)**: List, get, create, update branches.
- **Groups Module (`/v1/groups`)**: Create group, list, update, add/remove coaches, add/remove player members, create/delete schedules.
- **Players Module (`/v1/players`)**: List roster, registration requests, join requests, review request, player details, QR card management, create player, update player.
- **Attendance Module (`/v1/attendance`)**: Create session, list, get session, close, QR check-in, player QR scan, offline sync, session events, bulk records, corrections, reports.
- **Evaluations Module (`/v1/evaluations`)**: Templates, submit evaluation, player evaluations, rankings.
- **Finance Module (`/v1/finance`)**: Academy subscription, player plans, player subscriptions, collect payment, reverse transaction, session cashier, expenses (submit, approve, reject), close session, financial dashboard.
- **Platform Module (`/v1/platform`)**: Platform metrics, academy management, subscription override, super admin invitations, co-owner management, user security policies, SaaS plans, announcements, audit logs, storage maintenance.
- **Notifications Module (`/v1/notifications`)**: List user notifications, unread count, mark single read, mark all read.
- **Portal Module (`/v1/portal`)**: Player profile, player QR card, guardian portal, claim player profile, submit join request, list academies.
- **Health Module (`/v1/health`)**: Liveness (`/`), readiness (`/ready`).

---

## 5. Identified Architectural & Operational Defects

### 5.1 Defect 1: Two Competing Academy Registration Flows
- **Finding:**
  1. `apps/web/src/app/page.tsx` has a "Request Trial Demo" form invoking `/v1/platform/applications/public` without passwords (creates `AcademyApplication` in `PENDING_REVIEW`).
  2. `apps/web/src/app/register/page.tsx` has a full password form invoking `/v1/auth/register`, which immediately provisions a tenant and owner user.
- **Required Resolution (Phase 2):** Unify into a single password-based registration flow with approval gating, transactional email activation, and proper multi-lingual copy.

### 5.2 Defect 2: Missing Real Email Delivery Provider
- **Finding:** Currently `apps/api` contains no SMTP, SendGrid, Resend, or SES client. Tokens were previously exposed via `debugToken` in responses.
- **Required Resolution (Phase 2 & 3):** Implement an abstracted email provider service with single-use hashed verification/reset tokens and eliminate all debug tokens from responses.

### 5.3 Defect 3: Auth State Machine & Hydration Race Conditions
- **Finding:** After login/register, React context updates asynchronously. Routing previously relied on stale React state or caused intermittent blank screens.
- **Required Resolution (Phase 1):** Implement a deterministic, explicit authentication state machine (`initializing`, `authenticated`, `unauthenticated`, `refreshing`, `signing_out`, `error`).

### 5.4 Defect 4: Coach Attendance Permission Leakage
- **Finding:** Under the current role definition, coaches can initiate sessions and mark attendance. Requirement 5.1 explicitly mandates coaches have NO attendance marking permissions.
- **Required Resolution (Phase 5):** Strip attendance recording permissions from coaches at both API guard and UI levels, while preserving training and evaluation capabilities.

### 5.5 Defect 5: Ephemeral Cloudflare Quick Tunnel
- **Finding:** Free quick tunnels on `trycloudflare.com` terminate when the laptop sleeps, network renews, or idle timeout occurs.
- **Required Resolution (Phase 11):** Formulate persistent free hosting feasibility without requiring credit cards.

---

## 6. Baseline Performance Benchmarks

Measured on local development environment (Node.js v24.14.1, PostgreSQL 18.4, Windows x64):

| Metric / Endpoint | Iterations | p50 Latency | p95 Latency | Mean Latency | Target (Production) |
|---|---|---|---|---|---|
| **API Health Check** (`GET /v1/health/ready`) | 5 | 3.9 ms | 109.2 ms | 25.0 ms | < 50 ms |
| **API Owner Login** (`POST /v1/auth/login`) | 5 | 5.0 ms | 8.5 ms | 5.7 ms | < 300 ms |
| **API User Profile** (`GET /v1/auth/me`) | 5 | 2.2 ms | 2.4 ms | 2.2 ms | < 50 ms |
| **Web Landing Page** (`GET /`) | 5 | 306.5 ms | 3,858.2 ms | 1,122.9 ms | < 500 ms (Warm) |
| **Web Login Page** (`GET /login`) | 5 | 175.1 ms | 291.4 ms | 182.0 ms | < 250 ms (Warm) |
| **Web Register Page** (`GET /register`) | 5 | 170.6 ms | 190.9 ms | 165.7 ms | < 250 ms (Warm) |

---

## 7. Test Suite Status
- **@academy/shared:** 27 / 27 passing (100%)
- **@academy/web:** 34 / 34 passing (100%)
- **@academy/api:** 183 / 183 passing (100%)
- **Total Existing Tests:** **244 / 244 passing (100%)**

---

## 8. Rollback & Disaster Recovery Protocol
1. **Database Restore:** Run `node scripts/db-restore.js backups/sportexus_backup_2026-10-28T00-57-09-057Z.json` to restore the exact 902 records.
2. **Git Checkpoint:** Working branch is `feat/production-live-deployment-pwa` at baseline commit.
