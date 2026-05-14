# Dropsoft School Management ↔ Dropsoft HR — Integration Blueprint

## Goal

Run **one school** as a single operating unit where:

- **Dropsoft HR** manages **teaching and non-teaching staff** the same way as any employer: attendance, leave, payroll, payslips, statutory deductions, and (optionally) advances.
- **Dropsoft School (SMS)** manages **learners**: admissions, classes, guardians, health notes, **fee schedules**, **balances**, and **official receipts** when fees are paid.
- The same **School** product captures **all operational expenses** the school incurs (utilities, supplies, repairs, transport, exams, licences, etc.) so leadership has **one operational view**: money in (fees) vs money out (expenses), without mixing either stream into HR payroll tables.

The two products stay **loosely coupled** but **easy to connect** for schools: shared identity for the institution, shared staff records for payroll, and clear APIs so student money never pollutes payroll tables.

## Industry fit (Kenya / similar markets)

| Concern | HR (staff) | School (students) |
|--------|------------|---------------------|
| Payroll & PAYE | Teachers on payroll | N/A (students are not employees) |
| Attendance | Clock / face / manual for staff | Optional class register (different rules & UI) |
| Fees & VAT / levies | N/A | Invoices, waivers, receipts, period statements |
| Medical / safeguarding | Occupational health only | Student medical flags, emergency contacts |
| Reporting | HR + payroll compliance | Class lists, fee aging, receipt books |
| **Operational spend** | Staff reimbursements / salary-related only (if modelled in HR) | **All school running costs**: vendors, petty cash, capex, events, utilities |

**Rule of thumb:** anything that looks like **employment** lives in HR. Anything that looks like **enrolment + fees** lives in School. Anything that is **the school spending money to operate** (not paying an employee their salary) lives in **School expenses** — or in **ERP** later if you post journals there; see below.

## Recommended integration model (same as ERP blueprint)

- Prefer **API-to-API** (or **shared local API** with namespaced routes) — not raw cross-writes into each other’s core tables from random screens.
- **School module** owns: `students`, `guardians`, `classes`, `enrolments`, `fee_charges`, `fee_payments`, `receipts`, `academic_years`, `terms`, and **`operational_expenses`** (plus categories, suppliers, attachments, approvals).
- **HR** owns: `employees` (staff), `attendance` (staff), `leave`, `payroll_runs`, `payslips`, statutory exports.
- Add a thin **School–HR link layer**:
  - `institution_id` / `company_id` — one school maps to one HR **company**.
  - `staff_employee_id` — every teacher/non-teacher who is paid appears as an **employee** in HR (existing model).
  - Optional `external_ref` on both sides for sync tools.

This matches how Dropsoft already thinks about **multi-company** and **employees**: treat the school as a **company** in HR; treat students as **never** being employees.

## How the systems connect (easy mental model)

```
                    ┌─────────────────────────┐
                    │   Institution (school)  │
                    │   company_id / school_id │
                    └───────────┬─────────────┘
                                │
           ┌────────────────────┴────────────────────┐
           ▼                                         ▼
┌──────────────────────┐                 ┌──────────────────────┐
│   Dropsoft HR        │                 │   Dropsoft School    │
│   Staff only         │                 │   Students + fees    │
│   • Employees        │                 │   • Students         │
│   • Staff attendance │  same people    │   • Guardians       │
│   • Payroll          │◄───────────────►│   • Classes         │
│   • Payslips         │  link by id      │   • Fee ledger      │
└──────────────────────┘                 │   • Receipts        │
                                           │   • **Expenses**    │
                                           └──────────────────────┘
```

**Concrete link fields (minimal):**

| School side | HR side | Purpose |
|-------------|---------|---------|
| `staff_member.hr_employee_id` | `employees.id` | Payroll & attendance for that teacher |
| `school.company_id` | `companies.id` | One licence / one admin boundary |
| `fee_payment.recorded_by_user_id` | auth user | Audit who receipted cash |
| `expense.recorded_by_user_id` | auth user | Audit who captured or approved spend |
| (optional) `student.guardian_employee_id` | `employees.id` | If a parent is also staff (rare; optional) |

## Student data you listed (SMS schema sketch)

Store in **School** only (not in HR employee tables):

- **Identity:** student number, legal name, DOB → **age** derived, gender (if needed).
- **Guardians:** mother/father/carer names, phones, email, relationship, priority contact.
- **Academic:** class, stream, academic year, roll status (active, transferred, graduated).
- **Medical:** free-text or structured flags (allergy, chronic condition, emergency med); **strict access control** and consent flags.
- **Fees:** opening balance, term charges, discounts, **amount due**, currency; never mix with payroll `net_pay`.

**Receipting:** each `fee_payment` row gets a **receipt_number** (unique per school per year), `paid_at`, `method` (cash / M-Pesa / bank), `amount`, `allocated_to_charges[]`, PDF or thermal template.

## Operational expenses (school running costs)

Schools need a **single ledger of all money the institution spends** in the course of operations — separate from **fee income** (parents) and separate from **payroll** (staff salaries in HR).

### Ownership

- **School module** owns operational expenses end-to-end: capture, categorisation, approvals, attachments, and reports.
- **HR** may later hold **staff reimbursement claims** tied to payroll; avoid duplicating the same invoice in both places. Prefer: **School expense** = supplier / utility / petty cash; **HR** = net pay, statutory, and (optional) salary advance only. If a teacher buys chalk and claims it back, model either as a **school expense** line (recommended for audit trail under school) with `linked_employee_id`, or as an HR-only reimbursement workflow — pick one per product policy.

### Typical expense categories (configurable per school)

Examples: **Utilities** (power, water, internet), **Teaching supplies**, **Repairs & maintenance**, **Transport / trips**, **Exams & registration fees**, **Insurance & licences**, **Catering / events**, **Professional services**, **Bank charges**, **Assets / capex** (with depreciation flag for future ERP), **Misc / petty cash**.

### Schema sketch (add to School)

- **`expense_categories`**: `id`, `school_id`, `name`, `code`, `parent_id` (optional hierarchy), `is_active`.
- **`suppliers`** (optional): `id`, `school_id`, `name`, `tax_id`, `phone`, `email`, `payment_defaults`.
- **`operational_expenses`**:
  - `id`, `school_id`, `academic_year_id` (optional), `term_id` (optional)
  - `category_id`, `supplier_id` (nullable)
  - `description`, `amount`, `currency`, `tax_amount` (optional)
  - `incurred_on` (date), `paid_on` (nullable if accrued first)
  - `payment_method` (cash, M-Pesa, bank, cheque, card, other)
  - `reference` (e.g. ETR / invoice / PO number)
  - `status` (`draft`, `submitted`, `approved`, `paid`, `rejected`, `void`)
  - `created_by`, `approved_by`, `approved_at`, `notes`
  - `linked_employee_id` → HR employee when spend is staff-initiated (optional)
  - `attachment_ids` or file URLs for scanned invoices / photos of receipts
- **`expense_budget_lines`** (optional later): per category per term for variance reporting.

### Controls (industry expectations)

- **Maker–checker:** e.g. bursar enters, head approves above threshold.
- **Threshold rules** by role (configurable).
- **Immutable audit:** void with reason, never hard-delete approved rows.
- **Period lock:** align with fee period close so reports for a term are frozen.

### Reporting

- **Cash view:** fees collected vs expenses paid (by week / term).
- **Category burn:** top spend drivers vs budget (when budgets exist).
- **Export:** CSV / PDF for board or sponsor; future **ERP** posting same pattern as fee receipts.

## Teacher attendance & payroll (HR only)

- Teachers exist as **employees** with `employment_type = teaching` (or job title / department = “Academic”).
- **Staff attendance** continues to use existing HR attendance flows (terminal, manual, face where licenced).
- **Do not** post student “class attendance” into HR attendance tables without a separate `attendance_type` — otherwise payroll and statutory reports become wrong.

If you need **lesson register** (was the child present?), implement as **School.attendance_sessions** and optionally push **aggregates** to HR only for analytics, not as payroll clock events.

## Integration phases (practical rollout)

### Phase 1 — Same deployment, same company

- Create school as HR **company** (or map existing company).
- Import / register teachers as **employees**; run payroll as today.
- Stand up School DB tables + UI; `company_id` on every student row.
- Include **expense** tables (`expense_categories`, `operational_expenses`) early so spend is captured from day one; approvals and budgets can follow in a later slice.

### Phase 2 — Read-only cross-links in UI

- From School: “View in HR” for a staff member (opens employee profile).
- From HR: banner “This employee is linked to School staff record …” (optional).

### Phase 3 — Operational hooks

- **Receipt posted** → optional GL export or cashbook line (future ERP).
- **Expense approved/paid** → optional GL export or cashbook line (future ERP); keep idempotent posting keys.
- **New term** → bulk fee charge generation from class templates.
- **Staff exit** → deactivate HR employee + revoke school system roles same day.

### Phase 4 — Deeper automation (optional)

- Parent portal payments → webhook → School payment → receipt email/SMS.
- Payroll **deduction** for staff loans vs school cooperative (if you add that product later).

## API boundary (suggested)

Keep namespaces clear under one server or split hosts:

- `/api/hr/...` — existing HR routes (employees, attendance, payroll, …).
- `/api/school/...` — students, classes, fees, receipts, **expenses**, suppliers, categories.

**Cross-service calls** only through small use-cases, e.g.:

- `GET /api/hr/employees?company_id=&role=teaching` — School picks class teacher from HR list.
- `GET /api/school/students/:id/summary` — HR dashboard widget “dependants” only if product policy allows.

Use **idempotency keys** on fee payments, receipt generation, and **expense payment / ERP sync events** (double-submit safe).

## Security & compliance

- **Students are minors:** restrict medical fields to roles (nurse, head teacher); audit log all views/edits.
- **Fees:** receipt numbering must be **gapless or explainable** for audits; void/reissue flows with reason codes.
- **Expenses:** same discipline — approved amounts, attachment retention policy, and separation of duties for approvals.
- **HR payroll:** unchanged statutory rules; do not merge student fee income or **operational vendor spend** into PAYE base.

## Summary

1. **HR = staff payroll + staff attendance** (teachers as employees).  
2. **School = students + guardians + classes + fees + receipts + operational expenses (full school spend).**  
3. **Connect** with `company_id` + `hr_employee_id` on staff, and **APIs** instead of shared payroll tables.  
4. Roll out in **phases** so schools can go live with HR first, then fees, then expenses and tighter UI linking.

This document is the contract for engineering: when you implement Dropsoft School in this repo (or a sibling repo), align table names and routes to this boundary so both systems stay **fast to deploy and safe to extend** for the education industry.
