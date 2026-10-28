# SPORTEXUS — Platform Metrics, Subscription Limits & Global Search Verification

## 1. Executive Summary

Phase 8 audits and enhances the SaaS Platform Super Admin dashboard, automated subscription limit monitoring, and the universal RBAC-aware Command Palette search. Real-time metric aggregations replace estimated figures, visual capacity utilization meters alert administrators before academies exceed plan boundaries, and global search routes are verified and protected.

---

## 2. Platform Overview Metrics & Aggregations

Platform metrics in `PlatformService.getOverviewMetrics` run directly against PostgreSQL with zero mock figures:

- **Tenants & Academies:**
  * Total Academies: `tx.tenant.count()`
  * Active Academies: `tx.tenant.count({ where: { status: 'ACTIVE' } })`
  * Suspended Academies: `tx.tenant.count({ where: { status: 'SUSPENDED' } })`
  * Provisioning Academies: `tx.tenant.count({ where: { status: 'PROVISIONING' } })`
- **User Ecosystem:**
  * Total Registered Players: `tx.player.count()`
  * Total System Users: `tx.user.count()`
  * Total Active Coaches: `tx.tenantMembership.count({ where: { role: 'COACH', status: 'ACTIVE' } })`
  * Total Guardians: `tx.guardian.count()`
- **Operational Metrics:**
  * Completed Sessions: `tx.attendanceSession.count({ where: { status: 'CLOSED' } })`
  * Branches: `tx.branch.count()`
- **SaaS Recurring Revenue (MRR):**
  * Computed from active tenant subscriptions: $\text{MRR} = \sum (\text{negotiatedPrice} \lor \text{priceMonthly})$

---

## 3. Subscription Capacity Monitoring & Threshold Warnings

Each academy in the platform directory displays capacity utilization against their subscribed SaaS plan:

| Utilization Threshold | Visual Treatment | Operational Impact |
|---|---|---|
| **< 80% Capacity** | Emerald progress bar with count (e.g. `45 / 100 (45%)`) | Normal operation |
| **80% - 99% Capacity** | Amber progress bar with warning badge (e.g. `85% تنبيه`) | Warning state; owner encouraged to upgrade tier |
| **$\ge$ 100% Capacity** | Rose progress bar with full badge (e.g. `مكتمل (100%)`) | Plan limit reached; blocks creation of new players without upgrade |

---

## 4. Universal Command Palette & Global Search (`Ctrl+K`)

- **Shortcut & Trigger:** Global key listener on `Ctrl+K` and `Cmd+K` toggles the palette from any view in the platform.
- **RBAC-Aware Navigation:**
  * Super Admin items (e.g. Platform Control Center `/platform`) appear only for users with `isPlatformSuperAdmin` or `isPlatformOwner`.
  * Regular staff receive links strictly corresponding to their permissions (Dashboard, Players, Sessions, Scanner, Groups, Evaluations, Finance, Branches, Settings).
  * Direct deep-link to camera scanner corrected to `/attendance/scanner` with an alias redirect at `/scanner`.
- **Live Debounced Player Search:**
  * Queries `api.players.list` with a 250ms debounce when `query.length >= 2`.
  * Results display player full name and current branch with instant navigation to `/players/:id`.
  * Preserves user recent searches in `localStorage` (`academy_recent_searches`).

---

## 5. Verification Status
- **@academy/web:** 35 / 35 tests passing, 0 TypeScript errors.
- **@academy/api:** 187 / 187 tests passing, 0 TypeScript errors.
- **@academy/shared:** 27 / 27 tests passing, 0 TypeScript errors.
