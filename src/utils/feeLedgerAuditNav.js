/** SQLite / audit `entity_type` values that belong to the school fee ledger. */
const ENTITY_TYPE_TO_TAB = Object.freeze({
  academic_years: 'years',
  academic_terms: 'terms',
  students: 'students',
  fee_charges: 'charges',
  fee_payments: 'payments'
})

const FEE_LEDGER_ENTITY_TYPE_KEYS = Object.freeze(Object.keys(ENTITY_TYPE_TO_TAB))

/**
 * @param {{ entity_type?: string, action?: string } | null | undefined} row
 * @returns {boolean}
 */
export function isFeeLedgerAuditRow(row) {
  const entityType = String(row?.entity_type || '').toLowerCase()
  if (FEE_LEDGER_ENTITY_TYPE_KEYS.includes(entityType)) return true
  const action = String(row?.action || '').toLowerCase()
  return (
    action.startsWith('fee_charge') ||
    action.startsWith('fee_payment') ||
    action.startsWith('fee_student') ||
    action.startsWith('academic_year') ||
    action.startsWith('academic_term')
  )
}

/**
 * Maps audit log rows to the fee ledger UI tab (`?tab=`) for deep links from Activity log.
 * @param {{ entity_type?: string, action?: string } | null | undefined} row
 * @returns {'years'|'terms'|'students'|'charges'|'payments'|null}
 */
export function feeLedgerTabFromAuditRow(row) {
  const entityType = String(row?.entity_type || '').toLowerCase()
  const fromEntity = ENTITY_TYPE_TO_TAB[entityType]
  if (fromEntity) return fromEntity
  const action = String(row?.action || '').toLowerCase()
  if (action.startsWith('academic_year')) return 'years'
  if (action.startsWith('academic_term')) return 'terms'
  if (action.startsWith('fee_charge')) return 'charges'
  if (action.startsWith('fee_payment')) return 'payments'
  if (action.startsWith('fee_student')) return 'students'
  return null
}

/**
 * Query string params for opening the fee ledger from an audit row (Activity log).
 * @param {{ entity_id?: string, entity_type?: string, action?: string } | null | undefined} row
 * @returns {URLSearchParams | null}
 */
export function feeLedgerOpenQueryFromAuditRow(row) {
  const id = String(row?.entity_id || '').trim()
  if (!id) return null
  const p = new URLSearchParams()
  p.set('highlight', id)
  const tab = feeLedgerTabFromAuditRow(row)
  if (tab) p.set('tab', tab)
  return p
}

function rowEntityId(x) {
  return String(x?.$id ?? x?.id ?? '')
}

/**
 * Human-readable summary for Activity log “Details” column (fee ledger audits).
 * @param {Record<string, unknown> | null} prev
 * @param {Record<string, unknown> | null} details
 */
export function feeLedgerAuditDetailSummary(prev, details) {
  const pick = (obj) => {
    if (!obj || typeof obj !== 'object') return ''
    const parts = [
      obj.legal_name,
      obj.student_number,
      obj.label,
      obj.name,
      obj.description,
      obj.amount != null && obj.amount !== '' ? String(obj.amount) : null,
      obj.receipt_number,
      obj.status
    ].filter(Boolean)
    return parts.join(' · ') || ''
  }
  const before = pick(prev)
  const after = pick(details)
  if (before && after && before !== after) return `${before} → ${after}`
  return after || before || '—'
}

/**
 * Resolves which fee ledger tab contains the entity id (year → term → student → charge → payment).
 * @param {string} wantId
 * @param {{ years?: unknown[], terms?: unknown[], students?: unknown[], charges?: unknown[], payments?: unknown[] }} collections
 * @returns {'years'|'terms'|'students'|'charges'|'payments'|null}
 */
export function resolveFeeLedgerEntityTab(wantId, collections) {
  const id = String(wantId || '').trim()
  if (!id) return null
  const { years = [], terms = [], students = [], charges = [], payments = [] } = collections || {}
  if (years.some((y) => rowEntityId(y) === id)) return 'years'
  if (terms.some((t) => rowEntityId(t) === id)) return 'terms'
  if (students.some((s) => rowEntityId(s) === id)) return 'students'
  if (charges.some((c) => rowEntityId(c) === id)) return 'charges'
  if (payments.some((p) => rowEntityId(p) === id)) return 'payments'
  return null
}
