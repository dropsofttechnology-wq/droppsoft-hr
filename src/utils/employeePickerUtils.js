import { sortEmployeesByEmployeeId } from './employeeSort.js'

/**
 * Case-insensitive match on name, employee_id, staff_no, department, position.
 */
export function employeeMatchesQuery(emp, rawQuery) {
  const q = String(rawQuery || '').trim().toLowerCase()
  if (!q) return true
  const name = String(emp?.name || '').toLowerCase()
  const eid = String(emp?.employee_id || '').toLowerCase()
  const staff = String(emp?.staff_no || '').toLowerCase()
  const dept = String(emp?.department || '').toLowerCase()
  const pos = String(emp?.position || '').toLowerCase()
  return (
    name.includes(q) ||
    eid.includes(q) ||
    staff.includes(q) ||
    dept.includes(q) ||
    pos.includes(q)
  )
}

/**
 * Filter employees by query; always include `ensureId` if set so the current selection stays visible.
 */
export function filterEmployeesByQuery(employees, rawQuery, ensureId) {
  const list = Array.isArray(employees) ? employees : []
  const q = String(rawQuery || '').trim()
  if (!q) return sortEmployeesByEmployeeId(list)
  const filtered = list.filter((e) => employeeMatchesQuery(e, q))
  if (ensureId) {
    const sel = list.find((e) => e.$id === ensureId)
    if (sel && !filtered.some((e) => e.$id === ensureId)) {
      return [sel, ...sortEmployeesByEmployeeId(filtered)]
    }
  }
  return sortEmployeesByEmployeeId(filtered)
}
