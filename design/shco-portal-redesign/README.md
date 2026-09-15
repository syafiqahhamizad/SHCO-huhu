# Handoff: SHCO Portal Redesign — Dashboards, Accounting, Matter Workspace

## Overview
This bundle covers the redesigned dashboard suite (My/Partner/Firm-Wide/Accounting & Compliance), the Accounting module (Dashboard, Unbilled Items, Time Billing, Staff Claims, Client Trust, Office Account, Receipts & Payments), the Quotations & Billing pipeline (Quotations → Proforma → Invoices → Receipts with an editable document preview), and the Matter Workspace (per-case-file view) for Syafiqah Hamizad & Co's practice management portal (portal.shcolaw.com).

## About the Design Files
The file in this bundle (`SHCO Redesign Mockups.dc.html`) is a **design reference built as a static HTML prototype** — it demonstrates intended layout, copy, color, and interaction, but it is NOT production code and holds no real data or backend logic (buttons like "Save Activity", "Generate Invoice", "Save Memo" are visual only — they do not persist anything). The task is to **recreate these designs inside the existing portal codebase** (the app already running at portal.shcolaw.com, built on the stack in the attached `SHCO-huhu-main` folder — Firebase + Vite/TypeScript), using its existing component patterns, routing, and data layer. Do not copy the HTML/inline-styles directly into the app; rebuild each screen as proper components wired to real data.

## Fidelity
**High-fidelity for visual system** (colors, typography, spacing, card/table patterns are final and consistent throughout) but **low-fidelity for data** — all numbers, names, and table rows are placeholder/sample data. Treat layout, color, and component structure as final; treat every number and record as illustrative only.

## Design tokens
- **Colors**: Navy `#16223A` (primary dark), Blue `#3D6B9C` (links/refs/mono text), Green `#2F6F4E` (positive/collected), Brown/Gold `#8A6D3B` (billed/warning), Red `#B23A2E` (overdue/negative), Purple `#6B3D8C` (hearings/tertiary), Slate `#5B6478` (secondary text), Border `#DDE3EB`, Card bg `#fff`, Page bg `#F6F8FA` (approx), soft tint backgrounds: `#E6EFE9` (green tint), `#E7EEF6` (blue tint), `#FBF2E9`/`#FBEDE9` (gold/red tint).
- **Typography**: Headings in `'Source Serif 4', serif` (700 weight); body/UI in the system sans stack; monospace (`ui-monospace, monospace`) for matter references, invoice numbers, and reference codes.
- **Radius**: 8–12px on cards/buttons, 20px (pill) on status badges.
- **Spacing scale**: 6/8/10/12/14/16/18/20px used throughout gaps and padding.
- **Tab control** (`.rd-tab` / `.rd-tab.active`): pill-style tab buttons, navy fill when active.
- Global reset: `* { box-sizing: border-box }` is required — several inputs rely on it.

## Screens / Views

### 1. Dashboards (My / Partner / Firm-Wide / Accounting & Compliance)
Tab-switched views sharing one shell (top KPI stat-card row + edit-mode toggle).
- **My Dashboard**: personal KPI cards (active matters, billed, collected, files brought, collection rate), productivity-rate gauge + weekly streak strip (aligned beside Matter to-do/My hearings), progress-to-target panel (editable target inputs via "✎ Edit targets" toggle), My referrals summary, deadlines/hearings lists, recently accessed matters.
- **Partner Dashboard**: all-partners comparison — per-partner table (Billed/Collected/Files brought/Referrals converted, each with a target progress bar), Revenue/Collection-by-partner donuts + tables, Top 5 Debtors/Matters, Referral Sources panel (donut + top-referrer/top-source callouts + per-source table), Month/Year period toggle.
- **Firm-Wide Dashboard**: top stat-card row (active matters, deadlines, hearings, open tasks, unbilled time, clients, dormant files, deadlines overdue), Practice-area donut, File status donut, Firm workload bars, Hearings/Deadlines lists side by side, New Open Matters bar chart (per-month counts), Referral Sources — firm-wide, Unbilled items — firm-wide, Dormant files risk-watch card.
- **Accounting & Compliance tab bar** (see Accounting module below) lives under Dashboards → Accounting.

### 2. Accounting module (6 tabs, shared shell with Month/Year period toggle)
- **Dashboard**: 5 KPI cards (Trust balance, Unbilled activities, Unbilled disbursements, Collected this month, Aged >90 days), Billed-vs-Unbilled donut, Aging bar chart, Fees-vs-Target monthly bars, "Needs attention" callout.
- **Unbilled Items**: firm-wide filterable list (Client/Matter/Due days/Type filters), Activities/Disbursement/Total summary row, transaction table, Show Write-Off / Create / Generate Invoice actions.
- **Time Billing**: recent time entries table + Quick Timer widget (Matter/Type/Description fields, Start/Submit).
- **Staff Claims**: summary cards (Pending/Approved-unpaid/Paid), claims table with status badges, full Disbursement Voucher preview (claimed by, matter, itemized expenses, requisition/checked/approved/received signature chain).
- **Client Trust**: 3 summary cards, SAR 1990 ledger table.
- **Office Account**: 3 summary cards, Chart-of-Accounts summary table.
- **Receipts & Payments**: side-by-side Receipt Voucher / Payment Voucher forms.

### 3. Quotations & Billing
4 tabs (Quotations / Proforma Invoices / Invoices / Receipts), each a status-coded table with a "View" action. Viewing any row opens a shared **editable document preview panel**: a `contentEditable` letterhead document (firm header, bill-to, itemized table, total, amount-in-words) with Export Word / Export PDF / Close actions. Row actions ("Create Proforma →", "Convert to Invoice →", "Send to client") deep-link into this same preview, pre-set to the next document type.

### 4. Matter Workspace (per-case-file)
Opened by clicking a matter reference in the Case Registry. Header: matter ref badge, title, client/practice-area/PIC/status fields, Google Drive folder link, Unbilled fees/disbursement/Debtor balance summary strip, Print Label/Edit actions. Tabs: **Activities** (billable time; Units×Rate→Amount columns; "+ Add Activity" inline form), **Disbursements** ("+ Add Disbursement" inline form), **Unbilled Items** (read-only roll-up + Generate Invoice), **Invoices** (View→document preview), **Trust Ledger** (🔒 Partners/Accounts-only badge), **Debtor Ledger** (🔒 same), **Case Status** (Kanban board ⇄ Table Matrix toggle; Table Matrix has an editable "Current status" textarea, Next-action input, Send WhatsApp/Send Email buttons — mirrors the firm-wide Case Status matrix, same underlying data), **Service Log** ("+ Log Service" form: Direction/Method/Date/Document/Party fields + drag-and-drop acknowledgment upload + Notes; logging an entry also appends a zero-charge row to Activities tagged "Auto — Service Log"), **Memo** ("+ Create Memo" form: Type/Date/Description, table of Notes/Status/Court Minutes/File Location entries).

### 5. Case Registry (firm-wide matter list)
Status summary strip (Active/Dormant/On hold/Closed/Total counts), status + PIC filters, matter table with clickable matter-reference cells (→ opens Matter Workspace).

## Interactions & Behavior
- Tab switching is pure client-state (no navigation/reload) everywhere — Dashboards, Accounting, Billing, Matter Workspace tabs, Case Status Kanban/Table toggle.
- All "+ Add/Log/Create" buttons toggle an inline form open/closed in place (no modal/dialog pattern used) — recreate with your app's existing form/dialog pattern instead if that's more consistent with the rest of the app.
- Document preview (`contentEditable`) is a placeholder for the intended UX ("edit and export identically"); real implementation should back this with a proper document/template engine, not raw contentEditable.
- Drag-and-drop upload zone (Service Log acknowledgment) is a static visual only — no file handling implemented.

## State Management (as currently faked in the prototype — replace with real data)
- `dashTab`, `accTab`, `billingTab`, `matterTab`, `casesView`, `caseStatusView`: simple enum strings driving which tab content shows.
- `editMode`, `editTargets`, `partnerView`, `period`: view-mode toggles.
- `docOpen` / `docId`: which document is shown in the Billing preview panel.
- `createMemoOpen`, `logServiceOpen`, `addActivityOpen`, `addDisbOpen`: inline-form visibility toggles.
- `targets` object (billed/collected/files/referrals): user-editable personal targets — needs a real per-user targets table.
- None of this is persisted; a real build needs matters, activities, disbursements, invoices, vouchers, memos, service-log entries, and case-status/tasks as proper backend-backed entities (see suggested data model below).

## Suggested data model (for the connected system — see prior chat discussion)
- One `matter_transactions` table for both Activities and Disbursements (typed: fee/disbursement), each row: matter_id, date, user, description, units, rate, amount, invoiced (bool).
- **Unbilled Items** = live query on `matter_transactions where invoiced = false`.
- **Generate Invoice** creates an `invoices` record from selected unbilled rows, flips them to `invoiced = true`, and posts the total to `debtor_ledger`.
- **Receipt Voucher** posts a credit to `debtor_ledger` (and to `trust_ledger` if it's a trust deposit).
- **Service Log** entries with a fee attached should auto-create a `matter_transactions` row (amount = 0, tag = "service_log").
- `case_status_tasks` is one table; the per-matter Case Status tab and the firm-wide Case Status Kanban/Table Matrix are both views over the same table (filtered vs. unfiltered by matter).
- `memos` (type: Notes/Status/Court Minutes/File Location) — matter-scoped only, no firm-wide view needed.

## Assets
No external image assets — all icons are emoji/Unicode glyphs (📁 📎 ✓ etc.) and CSS-drawn shapes (donut charts via `conic-gradient`, bar charts via flex/height divs). No SVG or raster assets to migrate.

## Files
- `SHCO Redesign Mockups.dc.html` — the full design prototype (all screens described above live in this one file, gated by state).
