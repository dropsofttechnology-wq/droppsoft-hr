/**
 * Before bulk employee import: ensure Banks records exist and merge company settings catalogs
 * from CSV columns (Department, Bank Name, Bank Branch, Role) — same headers as EMPLOYEE.csv / template.
 */

import { getBanks, createBank } from './bankService'
import { getCompanySetting, saveCompanySettingsBulk } from '../utils/settingsHelper'

export const SETTING_DEPARTMENT_CATALOG = 'department_catalog'
export const SETTING_BANK_BRANCH_CATALOG = 'bank_branch_catalog'
export const SETTING_EMPLOYEE_ROLE_CATALOG = 'employee_role_catalog'

function norm(s) {
  return String(s ?? '').trim()
}

function parseJsonArray(raw, fallback = []) {
  try {
    const v = JSON.parse(raw || '[]')
    return Array.isArray(v) ? v : fallback
  } catch {
    return fallback
  }
}

function mergeDepartmentCatalog(existingRaw, namesFromCsv) {
  const map = new Map()
  for (const x of parseJsonArray(existingRaw)) {
    const s = norm(x)
    if (!s) continue
    const lo = s.toLowerCase()
    if (!map.has(lo)) map.set(lo, s)
  }
  for (const s of namesFromCsv) {
    const lo = s.toLowerCase()
    if (!map.has(lo)) map.set(lo, s)
  }
  return [...map.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  )
}

function mergeRoleCatalog(existingRaw, rolesFromCsv) {
  const set = new Set(parseJsonArray(existingRaw).map((x) => norm(x).toLowerCase()).filter(Boolean))
  for (const r of rolesFromCsv) {
    const lo = r.toLowerCase()
    if (lo) set.add(lo)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

function mergeBankBranchCatalog(existingRaw, pairs) {
  const map = new Map()
  for (const x of parseJsonArray(existingRaw)) {
    const bank = norm(x?.bank)
    const branch = norm(x?.branch)
    if (!bank || !branch) continue
    map.set(`${bank.toLowerCase()}|${branch.toLowerCase()}`, { bank, branch })
  }
  for (const p of pairs) {
    const k = `${p.bank.toLowerCase()}|${p.branch.toLowerCase()}`
    if (!map.has(k)) map.set(k, p)
  }
  return [...map.values()].sort(
    (a, b) =>
      a.bank.localeCompare(b.bank, undefined, { sensitivity: 'base' }) ||
      a.branch.localeCompare(b.branch, undefined, { sensitivity: 'base' })
  )
}

/**
 * @param {string} companyId
 * @param {object[]} rows Parsed CSV rows (department, bank_name, bank_branch, role, …)
 * @returns {Promise<{ banksCreated: number, departmentsCount: number, bankBranchesCount: number, rolesCount: number, warnings: string[] }>}
 */
export async function ensureBulkImportCatalogFromRows(companyId, rows) {
  const warnings = []
  const deptNames = new Map()
  const roleNames = new Set()
  const bankNames = new Set()
  const branchPairs = new Map()

  for (const raw of rows || []) {
    const d = norm(raw?.department)
    if (d && !deptNames.has(d.toLowerCase())) deptNames.set(d.toLowerCase(), d)

    const r = norm(raw?.role)
    if (r) roleNames.add(r)

    const bn = norm(raw?.bank_name)
    const br = norm(raw?.bank_branch)
    if (bn) bankNames.add(bn)
    if (bn && br) {
      branchPairs.set(`${bn.toLowerCase()}|${br.toLowerCase()}`, { bank: bn, branch: br })
    }
  }

  let banksCreated = 0
  try {
    const banks = await getBanks({ status: 'all' })
    const have = new Set(
      banks.map((b) => norm(b.bank_name || b.name).toLowerCase()).filter(Boolean)
    )
    for (const name of bankNames) {
      if (have.has(name.toLowerCase())) continue
      try {
        await createBank({
          bank_name: name,
          bank_code: '',
          swift_code: '',
          status: 'active'
        })
        have.add(name.toLowerCase())
        banksCreated += 1
      } catch (e) {
        warnings.push(`Bank "${name}": ${e.message || 'create failed'}`)
      }
    }
  } catch (e) {
    warnings.push(`Banks list/create: ${e.message || String(e)}`)
  }

  try {
    const prevDept = await getCompanySetting(companyId, SETTING_DEPARTMENT_CATALOG, '[]')
    const mergedDept = mergeDepartmentCatalog(prevDept, [...deptNames.values()])
    const prevRoles = await getCompanySetting(companyId, SETTING_EMPLOYEE_ROLE_CATALOG, '[]')
    const mergedRoles = mergeRoleCatalog(prevRoles, [...roleNames])
    const prevBranches = await getCompanySetting(companyId, SETTING_BANK_BRANCH_CATALOG, '[]')
    const mergedBranches = mergeBankBranchCatalog(prevBranches, [...branchPairs.values()])
    await saveCompanySettingsBulk(companyId, {
      [SETTING_DEPARTMENT_CATALOG]: JSON.stringify(mergedDept),
      [SETTING_EMPLOYEE_ROLE_CATALOG]: JSON.stringify(mergedRoles),
      [SETTING_BANK_BRANCH_CATALOG]: JSON.stringify(mergedBranches)
    })
  } catch (e) {
    warnings.push(`Settings catalogs: ${e.message || String(e)}`)
  }

  return {
    banksCreated,
    departmentsCount: deptNames.size,
    bankBranchesCount: branchPairs.size,
    rolesCount: roleNames.size,
    warnings
  }
}
