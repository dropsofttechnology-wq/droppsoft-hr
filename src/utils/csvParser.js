/**
 * CSV Parser Utility
 * Parses CSV files and converts them to employee data
 */

import { sortEmployeesByEmployeeId } from './employeeSort.js'

/** Excel (EU) often exports with `;`, US/UK with `,`. Tabs also occur. */
function sniffDelimiter(headerLine) {
  const commas = (headerLine.match(/,/g) || []).length
  const semis = (headerLine.match(/;/g) || []).length
  const tabs = (headerLine.match(/\t/g) || []).length
  if (tabs > commas && tabs >= semis) return '\t'
  if (semis > commas) return ';'
  return ','
}

function parseBasicSalaryCell(value) {
  if (value == null || value === '') return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value
  let s = String(value).trim()
  s = s.replace(/,/g, '')
  s = s.replace(/^\s*KES\s*/i, '')
  s = s.replace(/\s/g, '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export const parseCSV = (csvText) => {
  // Strip BOM (UTF-8 Byte Order Mark) that Excel/editors may add
  const cleanText = csvText.replace(/^\uFEFF/, '').trim()
  const lines = cleanText.split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row')
  }

  const delimiter = sniffDelimiter(lines[0])

  // Parse header - strip BOM from first cell and normalize
  const headers = parseCSVLine(lines[0], delimiter)
  const normalizedHeaders = headers.map(h =>
    h.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, '_')
  )

  // Map common column names to our field names
  const fieldMapping = {
    'name': 'name',
    'employee_name': 'name',
    'full_name': 'name',
    'fullname': 'name',
    'employeename': 'name',
    'employee_id': 'employee_id',
    'emp_id': 'employee_id',
    'id': 'employee_id',
    'staff_no': 'staff_no',
    'staff_number': 'staff_no',
    'employee_number': 'staff_no',
    'id_number': 'id_number',
    'national_id': 'id_number',
    'id_no': 'id_number',
    'kra_pin': 'kra_pin',
    'pin': 'kra_pin',
    'tax_pin': 'kra_pin',
    'nssf_number': 'nssf_number',
    'nssf': 'nssf_number',
    'nssf_no': 'nssf_number',
    'shif_number': 'shif_number',
    'shif': 'shif_number',
    'shif_no': 'shif_number',
    'nhif': 'shif_number',
    'department': 'department',
    'dept': 'department',
    'position': 'position',
    'job_title': 'position',
    'title': 'position',
    'basic_salary': 'basic_salary',
    'salary': 'basic_salary',
    'pay': 'basic_salary',
    'phone': 'phone',
    'phone_number': 'phone',
    'mobile': 'phone',
    'tel': 'phone',
    'email': 'email',
    'email_address': 'email',
    'bank_account': 'bank_account',
    'account_number': 'bank_account',
    'account': 'bank_account',
    'bank_name': 'bank_name',
    'bank': 'bank_name',
    'bank_branch': 'bank_branch',
    'branch': 'bank_branch',
    'contract_start_date': 'contract_start_date',
    'start_date': 'contract_start_date',
    'hire_date': 'contract_start_date',
    'contract_end_date': 'contract_end_date',
    'end_date': 'contract_end_date',
    'status': 'status',
    'gender': 'gender',
    'sex': 'gender',
    'role': 'role'
  }

  // Create mapping from CSV headers to our fields
  const headerMap = {}
  normalizedHeaders.forEach((header, index) => {
    const mappedField = fieldMapping[header]
    if (mappedField) {
      headerMap[mappedField] = index
    }
  })

  // Validate required fields (use 'in' - headerMap.name can be 0 when name is first column)
  if (!('name' in headerMap)) {
    const found = normalizedHeaders.join(', ') || '(none)'
    throw new Error(
      `CSV must contain a "name" column (or "employee_name", "full_name"). Found headers: ${found}`
    )
  }

  // Parse data rows
  const employees = []
  const errors = []

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i], delimiter)
      
      // Skip empty rows
      if (values.every(v => !v.trim())) {
        continue
      }

      const employee = {}

      // Map each field
      Object.keys(headerMap).forEach(field => {
        const index = headerMap[field]
        if (index < values.length) {
          let value = values[index].trim()
          
          // Convert numeric fields
          if (field === 'basic_salary') {
            value = parseFloat(value) || 0
          }
          
          employee[field] = value
        }
      })

      // Validate required fields
      if (!employee.name || !employee.name.trim()) {
        throw new Error('Name is required')
      }

      // Set defaults
      employee.status = employee.status || 'active'
      employee.basic_salary = employee.basic_salary || 0
      employee.role = employee.role || 'employee'
      // Normalize gender: Female, Male, Other
      if (employee.gender) {
        const g = String(employee.gender).trim().toLowerCase()
        if (g === 'f' || g === 'female') employee.gender = 'female'
        else if (g === 'm' || g === 'male') employee.gender = 'male'
        else if (g === 'o' || g === 'other') employee.gender = 'other'
      }

      employees.push(employee)
    } catch (error) {
      errors.push({
        row: i + 1,
        error: error.message,
        data: lines[i]
      })
    }
  }

  return {
    employees,
    errors,
    totalRows: lines.length - 1
  }
}

const parseCSVLine = (line, delimiter = ',') => {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"'
        i++ // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      // End of field
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  // Add last field
  result.push(current)

  return result
}

/** Same column order as bulk import — export uses this for re-import compatibility. */
export const EMPLOYEE_IMPORT_CSV_HEADERS = [
  'Name',
  'Employee ID',
  'Staff No',
  'ID Number',
  'Gender',
  'KRA PIN',
  'NSSF Number',
  'SHIF Number',
  'Department',
  'Position',
  'Basic Salary',
  'Phone',
  'Email',
  'Bank Name',
  'Bank Branch',
  'Bank Account',
  'Contract Start Date',
  'Contract End Date',
  'Role',
  'Status'
]

export const generateCSVTemplate = () => {
  const exampleRow = [
    'John Doe',
    'EMP001',
    'STF001',
    '12345678',
    'Male',
    'P123456789A',
    'NSSF123456',
    'SHIF123456',
    'IT',
    'Software Developer',
    '50000',
    '+254712345678',
    'john.doe@example.com',
    'Equity Bank',
    'Nairobi',
    '1234567890',
    '2024-01-01',
    '2025-12-31',
    'employee',
    'active'
  ]

  return [EMPLOYEE_IMPORT_CSV_HEADERS, exampleRow].map(row => row.join(',')).join('\n')
}

export function escapeCSVField(value) {
  if (value == null) return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function normalizeExportDate(value) {
  if (!value) return ''
  if (typeof value === 'string' && value.length >= 10) return value.substring(0, 10)
  return String(value)
}

function formatGenderForExport(g) {
  if (!g) return ''
  const s = String(g).trim().toLowerCase()
  if (s === 'male' || s === 'm') return 'Male'
  if (s === 'female' || s === 'f') return 'Female'
  if (s === 'other' || s === 'o') return 'Other'
  return String(g)
}

/**
 * CSV text matching the bulk-import template (same headers & column order).
 * @param {object[]} employees — documents from API
 */
export function generateEmployeesExportCSV(employees) {
  const sorted = sortEmployeesByEmployeeId(employees || [])
  const rows = sorted.map((emp) => [
    emp.name || '',
    emp.employee_id || '',
    emp.staff_no || '',
    emp.id_number || '',
    formatGenderForExport(emp.gender),
    emp.kra_pin || '',
    emp.nssf_number || '',
    emp.shif_number || '',
    emp.department || '',
    emp.position || '',
    emp.basic_salary != null && emp.basic_salary !== '' ? String(emp.basic_salary) : '',
    emp.phone || '',
    emp.email || '',
    emp.bank_name || '',
    emp.bank_branch || '',
    emp.bank_account || '',
    normalizeExportDate(emp.contract_start_date),
    normalizeExportDate(emp.contract_end_date),
    emp.role || 'employee',
    emp.status || 'active'
  ])
  return [EMPLOYEE_IMPORT_CSV_HEADERS, ...rows].map((row) => row.map(escapeCSVField).join(',')).join('\r\n')
}
