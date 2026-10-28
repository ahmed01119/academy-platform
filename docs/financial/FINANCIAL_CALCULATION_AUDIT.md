# SPORTEXUS — Financial Calculation Audit & Reporting Specification

## 1. Executive Summary

Phase 7 formalizes financial metric calculations, ledger integrity, and print-ready reporting across the platform. All revenue, expense, and outstanding balance metrics are derived directly from immutable financial transaction ledgers with strict decimal precision and separation of duties.

---

## 2. Core Financial Calculation Formulas

All calculations execute within tenant-isolated transactions in `FinanceService.getDashboardMetrics`:

### 2.1 Monthly Revenue (MRR / Collected Revenue)
$$\text{Monthly Revenue} = \sum_{t \in T_{\text{month}}} t.\text{amount} \quad \text{where } t.\text{type} \in \{\text{MEMBERSHIP\_FEE}, \text{REGISTRATION\_FEE}\} \land t.\text{status} = \text{COMPLETED}$$
- **Time Horizon:** $t.\text{createdAt} \ge \text{startOfMonth}$ where $\text{startOfMonth} = \text{Date}(Y, M, 1, 0, 0, 0)$.
- **Integrity Guarantee:** Only completed, non-reversed payments are included. If a payment was reversed via `reverseTransaction`, its status is updated to `REVERSED` and excluded from gross collections.

### 2.2 Today's Collections
$$\text{Today Collections} = \sum_{t \in T_{\text{today}}} t.\text{amount} \quad \text{where } t.\text{type} \in \{\text{MEMBERSHIP\_FEE}, \text{REGISTRATION\_FEE}\} \land t.\text{status} = \text{COMPLETED}$$
- **Time Horizon:** $t.\text{createdAt} \ge \text{startOfDay}$ where $\text{startOfDay} = \text{Date}(Y, M, D, 0, 0, 0)$.

### 2.3 Session Field Collections
$$\text{Session Collections} = \sum_{t \in T_{\text{completed}}} t.\text{amount} \quad \text{where } t.\text{sessionId} \ne \text{null}$$
- Reflects all on-site collections performed during coaching/training sessions via mobile cashiering or scanner fee collection.

### 2.4 Total Operational Expenses
$$\text{Total Expenses} = \sum_{t \in T_{\text{completed}}} t.\text{amount} \quad \text{where } t.\text{type} = \text{SESSION\_EXPENSE}$$
- **Separation of Duties:** Expenses submitted by coaches remain `PENDING` and are **not** deducted until formally approved by an academy Manager or Owner via `POST /finance/expenses/:id/approve`.

### 2.5 Net Cash Movement
$$\text{Net Cash Movement} = \text{Monthly Revenue} - \text{Total Expenses}$$

### 2.6 Outstanding Player Balances & Overdue Counts
$$\text{Outstanding Balances} = \sum_{s \in S} s.\text{outstandingBalance}$$
$$\text{Overdue Subscriptions Count} = \left| \{ s \in S \mid s.\text{status} \in \{\text{OVERDUE}, \text{PARTIAL}\} \} \right|$$

---

## 3. Print-Ready PDF & CSV Export Architecture

### 3.1 Official PDF Export
- **Trigger:** Accessible via the "طباعة تقرير مالي (PDF)" button (`#btn-print-finance-report`) in `/finance`.
- **Print Optimization (`@media print`):**
  * Displays an official header containing the Academy Name, report generation date, and timestamp.
  * Hides UI controls, navigation sidebars, and action buttons using `print:hidden`.
  * Forces high-contrast black/white styling for clean laser printer or PDF output.

### 3.2 CSV Statement Export
- **Trigger:** Accessible via "تصدير كشف الحساب" (`handleExportCsv`).
- Generates a UTF-8 BOM-encoded CSV statement formatted for direct import into Microsoft Excel and accounting software.
- Includes Receipt Number, Date, Player Name, Branch, Transaction Type, Amount (SAR), Payment Method, Status, and Notes.

---

## 4. Test & Verification Status
- **@academy/api:** 187 / 187 tests passing.
- **@academy/web:** 35 / 35 tests passing.
- **Type Safety:** 0 errors across `@academy/shared`, `@academy/web`, and `@academy/api`.
