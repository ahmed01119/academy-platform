# SPORTEXUS — Actionable Notifications & Data Sync Verification

## 1. Executive Summary

Phase 6 audits and strengthens the notification lifecycle and live data consistency. Notifications now route deterministically to specific contextual tabs via deep-linking query parameters, unread badge counters update dynamically, and toast error notifications are deduplicated and capped to eliminate mobile screen clutter.

---

## 2. Structured Actionable Deep-Links

Every notification payload includes a specific actionable `href` targeting the appropriate section:

| Trigger / Workflow | Target Audience | Target Deep Link | Action Upon Arrival |
|---|---|---|---|
| **New Academy Application** | Platform Super Admins / Owners | `/platform?tab=applications` | Immediately switches to Applications tab for instant review/approval |
| **New Player Join Request** | Academy Managers & Owners | `/players?tab=applications` | Directly focuses on Player Join Applications review table |
| **Player Application Decision** | Applicant Player / Guardian | `/player` | Direct access to player portal schedule and membership card |
| **Academy Approval** | Provisioned Academy Owner | `/dashboard` | Direct access to newly initialized academy dashboard |
| **Co-Owner / Admin Invite** | Invited User | `/platform` or `/dashboard` | Role-specific workspace home |

---

## 3. Real-Time Unread Badge Synchronization

- **Continuous Polling & Reactive Event Dispatch:**
  * Base poll interval: 30 seconds.
  * Real-time custom event: `window.addEventListener('refresh-notifications', fetchCount)`. Any mutating action (e.g. marking read, submitting applications, or receiving pushes) can dispatch `window.dispatchEvent(new CustomEvent('refresh-notifications'))` to trigger immediate zero-latency badge reconciliation.
- **Single-Click Mark-as-Read:**
  * Clicking an individual notification item marks it read in the database, decrements the badge count optimistically, closes the dropdown, and executes smooth client navigation via `router.push(item.href)`.
  * "تحديد الكل كمقروء" (Mark All Read) updates the batch in PostgreSQL and resets `unreadCount` to 0.

---

## 4. Elimination of Redundant Mobile Error Bubbles

- **Deduplication:** `ToastContext` checks active toasts. If a toast with the identical `message` and `type` is already being displayed, redundant subsequent calls are dropped instead of stacking duplicate bubbles.
- **Viewport Capping:** Total concurrent visible toasts are strictly capped at 3 (`updated.slice(updated.length - 3)`).
- **Responsive Mobile Layout:** Toast container uses `start-1/2 -translate-x-1/2 sm:start-auto sm:translate-x-0 sm:end-4 w-[calc(100vw-2rem)] sm:w-full sm:max-w-sm` to maintain centered margins on mobile viewports without overflowing edges or blocking interactions.

---

## 5. Verification Status
- **@academy/web:** 35 / 35 tests passing, 0 TypeScript errors.
- **@academy/api:** 187 / 187 tests passing, 0 TypeScript errors.
- **@academy/shared:** 27 / 27 tests passing, 0 TypeScript errors.
