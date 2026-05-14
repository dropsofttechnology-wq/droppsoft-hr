# Dropsoft School Management ↔ Dropsoft HR — Integration Blueprint

## Goal

Run **one school** as a single operating unit where:

- **Dropsoft HR** manages **teaching and non-teaching staff** the same way as any employer: attendance, leave, payroll, payslips, statutory deductions, and (optionally) advances.
- **Dropsoft School (SMS)** manages **learners**: admissions, classes, guardians, health notes, **fee schedules**, **balances**, and **official receipts** when fees are paid.

The two products stay **loosely coupled** but **easy to connect** for schools: shared identity for the institution, shared staff records for payroll, and clear APIs so student money never pollutes payroll tables.

## Industry fit (Kenya / similar markets)

| Concern | HR (staff) | School (students) |
|--------|------------|---------------------|
| Payroll & PAYE | Teachers on payroll | N/A (students are not employees) |
| Attendance | Clock / face / manual for staff | Optional class register (different rules & UI) |
| Fees & VAT / levies | N/A | Invoices, waivers, receipts, period statements |
| Medical / safeguarding | Occupational health only | Student medical flags, emergency contacts |
| Reporting | HR + payroll compliance | Class lists, fee aging, receipt books |

**Rule of thumb:** anything that looks like **employment** lives in HR. Anything that looks like **enrolment + fees** lives in School.

## Recommended integration model (same as ERP blueprint)

- Prefer **API-to-API** (or **shared local API** with namespaced routes) — not raw cross-writes into each other’s core tables from random screens.
- **School module** owns: `students`, `guardians`, `classes`, `enrolments`, `fee_charges`, `fee_payments`, `receipts`, `academic_years`, `terms`.
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
                                           └──────────────────────┘
```

**Concrete link fields (minimal):**

| School side | HR side | Purpose |
|-------------|---------|---------|
| `staff_member.hr_employee_id` | `employees.id` | Payroll & attendance for that teacher |
| `school.company_id` | `companies.id` | One licence / one admin boundary |
| `fee_payment.recorded_by_user_id` | auth user | Audit who receipted cash |
| (optional) `student.guardian_employee_id` | `employees.id` | If a parent is also staff (rare; optional) |

## Student data you listed (SMS schema sketch)

Store in **School** only (not in HR employee tables):

- **Identity:** student number, legal name, DOB → **age** derived, gender (if needed).
- **Guardians:** mother/father/carer names, phones, email, relationship, priority contact.
- **Academic:** class, stream, academic year, roll status (active, transferred, graduated).
- **Medical:** free-text or structured flags (allergy, chronic condition, emergency med); **strict access control** and consent flags.
- **Fees:** opening balance, term charges, discounts, **amount due**, currency; never mix with payroll `net_pay`.

**Receipting:** each `fee_payment` row gets a **receipt_number** (unique per school per year), `paid_at`, `method` (cash / M-Pesa / bank), `amount`, `allocated_to_charges[]`, PDF or thermal template.

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

### Phase 2 — Read-only cross-links in UI

- From School: “View in HR” for a staff member (opens employee profile).
- From HR: banner “This employee is linked to School staff record …” (optional).

### Phase 3 — Operational hooks

- **Receipt posted** → optional GL export or cashbook line (future ERP).
- **New term** → bulk fee charge generation from class templates.
- **Staff exit** → deactivate HR employee + revoke school system roles same day.

### Phase 4 — Deeper automation (optional)

- Parent portal payments → webhook → School payment → receipt email/SMS.
- Payroll **deduction** for staff loans vs school cooperative (if you add that product later).

## API boundary (suggested)

Keep namespaces clear under one server or split hosts:

- `/api/hr/...` — existing HR routes (employees, attendance, payroll, …).
- `/api/school/...` — students, classes, fees, receipts.

**Cross-service calls** only through small use-cases, e.g.:

- `GET /api/hr/employees?company_id=&role=teaching` — School picks class teacher from HR list.
- `GET /api/school/students/:id/summary` — HR dashboard widget “dependants” only if product policy allows.

Use **idempotency keys** on fee payments and receipt generation (double-submit safe).

## Security & compliance

- **Students are minors:** restrict medical fields to roles (nurse, head teacher); audit log all views/edits.
- **Fees:** receipt numbering must be **gapless or explainable** for audits; void/reissue flows with reason codes.
- **HR payroll:** unchanged statutory rules; do not merge student fee income into PAYE base.

## Summary

1. **HR = staff payroll + staff attendance** (teachers as employees).  
2. **School = students + guardians + classes + fees + receipts.**  
3. **Connect** with `company_id` + `hr_employee_id` on staff, and **APIs** instead of shared payroll tables.  
4. Roll out in **phases** so schools can go live with HR first, then fees, then tighter UI linking.

This document is the contract for engineering: when you implement Dropsoft School in this repo (or a sibling repo), align table names and routes to this boundary so both systems stay **fast to deploy and safe to extend** for the education industry.
