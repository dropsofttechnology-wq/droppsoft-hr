/** @param {unknown} value */
export function escapeCsvCell(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/**
 * @param {{ $id?: string, student_number?: string, legal_name?: string }[]} students
 * @param {string} studentId
 */
export function feeLedgerStudentLabel(students, studentId) {
  const sn = students.find((s) => String(s.$id) === String(studentId))
  if (!sn) return studentId ? String(studentId) : ''
  return `${sn.student_number} — ${sn.legal_name}`
}

/**
 * @param {{ $id?: string, label?: string }[]} years
 * @param {string} yearId
 */
export function feeLedgerYearLabel(years, yearId) {
  if (!yearId) return ''
  const y = years.find((row) => String(row.$id) === String(yearId))
  return y?.label || String(yearId)
}

/**
 * @param {{ $id?: string, name?: string }[]} terms
 * @param {string} termId
 */
export function feeLedgerTermLabel(terms, termId) {
  if (!termId) return ''
  const t = terms.find((row) => String(row.$id) === String(termId))
  return t?.name || String(termId)
}

/**
 * @param {Record<string, unknown>[]} students
 */
export function buildFeeStudentsCsv(students) {
  const headers = ['student_number', 'legal_name', 'class_label', 'status']
  const lines = [headers.join(',')]
  for (const row of students) {
    lines.push(
      [
        escapeCsvCell(row.student_number),
        escapeCsvCell(row.legal_name),
        escapeCsvCell(row.class_label),
        escapeCsvCell(row.status)
      ].join(',')
    )
  }
  return lines.join('\r\n')
}

/**
 * @param {Record<string, unknown>[]} charges
 * @param {{ students: unknown[], years: unknown[], terms: unknown[] }} lookup
 */
export function buildFeeChargesCsv(charges, { students, years, terms }) {
  const headers = [
    'student',
    'description',
    'amount',
    'currency',
    'academic_year',
    'term',
    'due_date',
    'status'
  ]
  const lines = [headers.join(',')]
  for (const row of charges) {
    lines.push(
      [
        escapeCsvCell(feeLedgerStudentLabel(students, row.student_id)),
        escapeCsvCell(row.description),
        escapeCsvCell(row.amount),
        escapeCsvCell(row.currency),
        escapeCsvCell(feeLedgerYearLabel(years, row.academic_year_id)),
        escapeCsvCell(feeLedgerTermLabel(terms, row.term_id)),
        escapeCsvCell(row.due_date ? String(row.due_date).slice(0, 10) : ''),
        escapeCsvCell(row.status)
      ].join(',')
    )
  }
  return lines.join('\r\n')
}

/**
 * @param {Record<string, unknown>[]} payments
 * @param {{ students: unknown[] }} lookup
 */
export function buildFeePaymentsCsv(payments, { students }) {
  const headers = [
    'student',
    'amount',
    'currency',
    'paid_on',
    'payment_method',
    'reference',
    'receipt_number',
    'notes'
  ]
  const lines = [headers.join(',')]
  for (const row of payments) {
    lines.push(
      [
        escapeCsvCell(feeLedgerStudentLabel(students, row.student_id)),
        escapeCsvCell(row.amount),
        escapeCsvCell(row.currency),
        escapeCsvCell(row.paid_on ? String(row.paid_on).slice(0, 10) : ''),
        escapeCsvCell(row.payment_method),
        escapeCsvCell(row.reference),
        escapeCsvCell(row.receipt_number),
        escapeCsvCell(row.notes)
      ].join(',')
    )
  }
  return lines.join('\r\n')
}

/**
 * @param {Record<string, unknown>[]} rows
 */
export function buildAcademicYearsReportCsv(rows) {
  const headers = [
    'label',
    'start_date',
    'end_date',
    'active',
    'term_count',
    'charge_count',
    'charges_total',
    'open_charges_total',
    'payments_in_period_total'
  ]
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(
      [
        escapeCsvCell(row.label),
        escapeCsvCell(row.start_date ? String(row.start_date).slice(0, 10) : ''),
        escapeCsvCell(row.end_date ? String(row.end_date).slice(0, 10) : ''),
        escapeCsvCell(row.is_active ? 'yes' : 'no'),
        escapeCsvCell(row.term_count),
        escapeCsvCell(row.charge_count),
        escapeCsvCell(row.charges_total),
        escapeCsvCell(row.open_charges_total),
        escapeCsvCell(row.payments_in_period_total)
      ].join(',')
    )
  }
  return lines.join('\r\n')
}

/**
 * @param {Record<string, unknown>[]} rows
 */
export function buildAcademicTermsReportCsv(rows) {
  const headers = [
    'academic_year',
    'term_name',
    'start_date',
    'end_date',
    'charge_count',
    'charges_total',
    'open_charges_total',
    'payments_in_period_total'
  ]
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(
      [
        escapeCsvCell(row.academic_year_label),
        escapeCsvCell(row.name),
        escapeCsvCell(row.start_date ? String(row.start_date).slice(0, 10) : ''),
        escapeCsvCell(row.end_date ? String(row.end_date).slice(0, 10) : ''),
        escapeCsvCell(row.charge_count),
        escapeCsvCell(row.charges_total),
        escapeCsvCell(row.open_charges_total),
        escapeCsvCell(row.payments_in_period_total)
      ].join(',')
    )
  }
  return lines.join('\r\n')
}

/**
 * @param {string} filename
 * @param {string} csvBody
 */
export function downloadFeeLedgerCsv(filename, csvBody) {
  const blob = new Blob([csvBody], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
