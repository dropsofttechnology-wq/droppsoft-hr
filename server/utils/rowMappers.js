/**
 * Map SQLite rows to shapes similar to Appwrite documents (for gradual UI migration).
 */

export function mapCompanyRow(row) {
  if (!row) return null
  return {
    id: row.id,
    $id: row.id,
    name: row.name,
    registration_number: row.registration_number,
    tax_pin: row.tax_pin,
    address: row.address,
    phone: row.phone,
    email: row.email,
    logo_url: row.logo_url,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export function mapBankRow(row) {
  if (!row) return null
  return {
    id: row.id,
    $id: row.id,
    bank_name: row.name,
    bank_code: row.code || '',
    swift_code: row.swift_code || '',
    status: row.status || 'active',
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export function mapHolidayRow(row) {
  if (!row) return null
  const holidayName = row.name || ''
  return {
    id: row.id,
    $id: row.id,
    company_id: row.company_id,
    holiday_date: row.holiday_date,
    holiday_name: holidayName,
    name: holidayName,
    rate_type: row.rate_type || 'normal',
    rate: row.rate != null ? row.rate : 100,
    reporting_time: row.reporting_time || '',
    closing_time: row.closing_time || '',
    status: row.status || 'active',
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export function mapLeaveTypeRow(row) {
  if (!row) return null
  const leaveName = row.name || ''
  const ent =
    row.entitlement_days != null
      ? row.entitlement_days
      : row.days_allowed != null
        ? row.days_allowed
        : 0
  const codeUpper = (row.leave_code || '').toUpperCase()
  let payPct =
    row.pay_percentage != null && row.pay_percentage !== ''
      ? Math.max(0, Math.min(100, Number(row.pay_percentage)))
      : null
  if (payPct == null) {
    payPct = codeUpper === 'UNPAID' ? 0 : 100
  }
  return {
    id: row.id,
    $id: row.id,
    company_id: row.company_id,
    leave_code: codeUpper,
    leave_name: leaveName,
    description: row.description || '',
    entitlement_days: ent,
    days_allowed: row.days_allowed != null ? row.days_allowed : ent,
    is_statutory: !!row.is_statutory,
    pay_percentage: payPct,
    display_order: row.display_order != null ? row.display_order : 0,
    status: row.status || 'active',
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export function mapFaceDescriptorRow(row) {
  if (!row) return null
  return {
    id: row.id,
    $id: row.id,
    user_id: row.user_id,
    company_id: row.company_id,
    descriptor: row.descriptor,
    quality_score: row.quality_score,
    capture_method: row.capture_method,
    registered_at: row.registered_at,
    created_at: row.created_at
  }
}

export function mapEmployeeRow(row) {
  if (!row) return null
  return {
    id: row.id,
    $id: row.id,
    user_id: row.user_id,
    company_id: row.company_id,
    employee_id: row.employee_id,
    staff_no: row.staff_no,
    name: row.name,
    id_number: row.id_number,
    kra_pin: row.kra_pin,
    nssf_number: row.nssf_number,
    shif_number: row.shif_number,
    department: row.department,
    position: row.position,
    basic_salary: row.basic_salary,
    phone: row.phone,
    email: row.email,
    bank_account: row.bank_account,
    bank_name: row.bank_name,
    bank_branch: row.bank_branch,
    contract_start_date: row.contract_start_date,
    contract_end_date: row.contract_end_date,
    status: row.status,
    role: row.role,
    gender: row.gender,
    annual_leave_entitlement_days:
      row.annual_leave_entitlement_days != null && row.annual_leave_entitlement_days !== ''
        ? Number(row.annual_leave_entitlement_days)
        : null,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export function mapSalaryAdvanceRow(row) {
  if (!row) return null
  return {
    id: row.id,
    $id: row.id,
    company_id: row.company_id,
    employee_id: row.employee_id,
    amount: row.amount,
    reason: row.reason || '',
    repayment_period: row.repayment_period || '',
    for_period: row.for_period || '',
    application_date: row.application_date || '',
    installment_count:
      row.installment_count != null && row.installment_count !== '' ? Number(row.installment_count) : null,
    installment_plan: row.installment_plan || '',
    admin_form_notes: row.admin_form_notes || '',
    status: row.status || 'pending',
    requested_at: row.requested_at,
    requested_by: row.requested_by || '',
    approved_by: row.approved_by,
    approved_at: row.approved_at,
    approver_name: row.approver_name || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

function parseItemLines(raw) {
  if (!raw) return []
  try {
    const parsed = JSON.parse(String(raw))
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((line) => {
        const item_code = String(line?.item_code || '').trim()
        const qty = Number(line?.qty) || 0
        const unit_price = Number(line?.unit_price) || 0
        const total = Math.round(qty * unit_price * 100) / 100
        if (!item_code || qty <= 0 || unit_price < 0) return null
        return {
          item_code,
          qty: Math.round(qty * 1000) / 1000,
          unit_price: Math.round(unit_price * 100) / 100,
          total
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

export function mapLeaveRequestRow(row) {
  if (!row) return null
  return {
    id: row.id,
    $id: row.id,
    company_id: row.company_id,
    employee_id: row.employee_id,
    leave_type: row.leave_type,
    start_date: row.start_date,
    end_date: row.end_date,
    days_requested: row.days_requested,
    reason: row.reason || '',
    balance_deduction: row.balance_deduction || '',
    admin_form_notes: row.admin_form_notes || '',
    status: row.status || 'pending',
    created_by: row.created_by || '',
    approved_by: row.approved_by,
    approved_at: row.approved_at,
    approver_name: row.approver_name || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export function mapShoppingRow(row) {
  const base = mapSalaryAdvanceRow(row)
  return {
    ...base,
    item_lines: parseItemLines(row?.item_lines_json)
  }
}

export function mapExpenseCategoryRow(row) {
  if (!row) return null
  return {
    id: row.id,
    $id: row.id,
    company_id: row.company_id,
    name: row.name,
    code: row.code || '',
    parent_id: row.parent_id || '',
    is_active: row.is_active === 0 ? false : true,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export function mapExpenseSupplierRow(row) {
  if (!row) return null
  return {
    id: row.id,
    $id: row.id,
    company_id: row.company_id,
    name: row.name,
    tax_id: row.tax_id || '',
    phone: row.phone || '',
    email: row.email || '',
    notes: row.notes || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export function mapAcademicYearRow(row) {
  if (!row) return null
  return {
    id: row.id,
    $id: row.id,
    company_id: row.company_id,
    label: row.label,
    start_date: row.start_date,
    end_date: row.end_date,
    is_active: row.is_active != null ? !!row.is_active : true,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export function mapAcademicTermRow(row) {
  if (!row) return null
  return {
    id: row.id,
    $id: row.id,
    company_id: row.company_id,
    academic_year_id: row.academic_year_id,
    name: row.name,
    start_date: row.start_date,
    end_date: row.end_date,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export function mapStudentRow(row) {
  if (!row) return null
  return {
    id: row.id,
    $id: row.id,
    company_id: row.company_id,
    student_number: row.student_number,
    legal_name: row.legal_name,
    dob: row.dob || '',
    gender: row.gender || '',
    class_label: row.class_label || '',
    status: row.status || 'active',
    guardian_summary: row.guardian_summary || '',
    guardian_email: row.guardian_email || '',
    notes: row.notes || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export function mapFeeChargeRow(row) {
  if (!row) return null
  return {
    id: row.id,
    $id: row.id,
    company_id: row.company_id,
    student_id: row.student_id,
    academic_year_id: row.academic_year_id || '',
    term_id: row.term_id || '',
    description: row.description,
    amount: row.amount != null ? Number(row.amount) : 0,
    currency: row.currency || '',
    due_date: row.due_date || '',
    status: row.status || 'open',
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export function mapFeePaymentRow(row) {
  if (!row) return null
  return {
    id: row.id,
    $id: row.id,
    company_id: row.company_id,
    student_id: row.student_id,
    amount: row.amount != null ? Number(row.amount) : 0,
    currency: row.currency || '',
    paid_on: row.paid_on,
    payment_method: row.payment_method || '',
    reference: row.reference || '',
    receipt_number: row.receipt_number || '',
    notes: row.notes || '',
    recorded_by: row.recorded_by || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export function mapStudentDailyAttendanceRow(row) {
  if (!row) return null
  return {
    id: row.id,
    $id: row.id,
    company_id: row.company_id,
    attendance_date: row.attendance_date,
    student_id: row.student_id,
    class_id: row.class_id,
    status: row.status || 'absent',
    session_type: row.session_type || 'daily',
    marked_by: row.marked_by || '',
    remarks: row.remarks || '',
    created_at: row.created_at
  }
}

export function mapSchoolSubjectRow(row) {
  if (!row) return null
  return {
    id: row.id,
    $id: row.id,
    company_id: row.company_id,
    subject_name: row.subject_name,
    subject_code: row.subject_code || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export function mapSchoolSubjectStrandRow(row) {
  if (!row) return null
  return {
    id: row.id,
    $id: row.id,
    company_id: row.company_id,
    subject_id: row.subject_id,
    grade_level: row.grade_level,
    strand_name: row.strand_name,
    subject_name: row.subject_name || '',
    subject_code: row.subject_code || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export function mapOperationalExpenseRow(row) {
  if (!row) return null
  let attachment_ids = []
  try {
    const p = row.attachment_ids_json ? JSON.parse(String(row.attachment_ids_json)) : []
    attachment_ids = Array.isArray(p) ? p : []
  } catch {
    attachment_ids = []
  }
  return {
    id: row.id,
    $id: row.id,
    company_id: row.company_id,
    category_id: row.category_id,
    supplier_id: row.supplier_id || '',
    description: row.description,
    amount: row.amount != null ? Number(row.amount) : 0,
    currency: row.currency || '',
    tax_amount: row.tax_amount != null ? Number(row.tax_amount) : null,
    incurred_on: row.incurred_on,
    paid_on: row.paid_on || '',
    payment_method: row.payment_method || '',
    reference: row.reference || '',
    status: row.status || 'draft',
    linked_employee_id: row.linked_employee_id || '',
    attachment_ids,
    void_reason: row.void_reason || '',
    notes: row.notes || '',
    rejected_reason: row.rejected_reason || '',
    created_by: row.created_by || '',
    approved_by: row.approved_by || '',
    approved_at: row.approved_at || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

