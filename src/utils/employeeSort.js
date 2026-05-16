/**
 * Sort key: employee_id, then staff_no (matches payroll / company list PDF ordering).
 * Numeric staff numbers sort numerically when the whole token parses as an integer.
 */
export function compareEmployeeSortKey(a, b) {
  const sa = String(a?.employee_id || a?.staff_no || '').trim()
  const sb = String(b?.employee_id || b?.staff_no || '').trim()
  const numA = parseInt(sa, 10)
  const numB = parseInt(sb, 10)
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
    return numA - numB
  }
  return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' })
}

export function sortEmployeesByEmployeeId(employees) {
  if (!Array.isArray(employees)) return []
  return [...employees].sort(compareEmployeeSortKey)
}
