import { useState, useEffect, useRef, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import { getEmployees, createEmployee, updateEmployee, deleteEmployee, bulkCreateEmployees } from '../services/employeeService'
import { getBanks } from '../services/bankService'
import { getLeaveRequests } from '../services/leaveService'
import { format, parseISO, isWithinInterval } from 'date-fns'
import { parseCSV, generateCSVTemplate, generateEmployeesExportCSV } from '../utils/csvParser'
import { compareEmployeeSortKey, sortEmployeesByEmployeeId } from '../utils/employeeSort.js'
import { logAudit } from '../services/auditService'
import { isLocalDataSource } from '../config/dataSource'
import EmployeeQRCode from '../components/EmployeeQRCode'
import ConfirmDialog from '../components/ConfirmDialog'
import './Employees.css'

const Employees = () => {
  const { currentCompany } = useCompany()
  const csvFileInputRef = useRef(null)
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [filters, setFilters] = useState({
    status: 'active',
    search: ''
  })
  const [formData, setFormData] = useState({
    user_id: '',
    role: 'employee',
    gender: '',
    name: '',
    employee_id: '',
    staff_no: '',
    id_number: '',
    kra_pin: '',
    nssf_number: '',
    shif_number: '',
    department: '',
    position: '',
    basic_salary: '',
    phone: '',
    email: '',
    bank_account: '',
    bank_name: '',
    bank_branch: '',
    contract_start_date: '',
    contract_end_date: '',
    status: 'active',
    annual_leave_entitlement_days: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showQRCode, setShowQRCode] = useState(false)
  const [selectedEmployeeForQR, setSelectedEmployeeForQR] = useState(null)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [parsedEmployees, setParsedEmployees] = useState([])
  const [importProgress, setImportProgress] = useState(null)
  const [importResults, setImportResults] = useState(null)
  const [importing, setImporting] = useState(false)
  const [banks, setBanks] = useState([])
  const [confirmDelete, setConfirmDelete] = useState({ open: false, employeeId: null })
  const [deleting, setDeleting] = useState(false)
  const [leaveInfoByEmployee, setLeaveInfoByEmployee] = useState(new Map())
  const { user } = useAuth()
  const isSuperAdmin = (user?.prefs?.role || '').toLowerCase() === 'super_admin'

  const parsedEmployeesSortedById = useMemo(
    () => sortEmployeesByEmployeeId(parsedEmployees),
    [parsedEmployees]
  )

  const clearCsvFileInput = () => {
    if (csvFileInputRef.current) csvFileInputRef.current.value = ''
  }

  const normalizeDate = (value) => {
    if (!value) return ''
    // Convert full ISO datetime (e.g. 2026-02-25T19:39:35.751+00:00) to yyyy-MM-dd
    if (typeof value === 'string' && value.length >= 10) {
      return value.substring(0, 10)
    }
    return value
  }

  useEffect(() => {
    if (currentCompany) {
      loadEmployees()
      loadBanks()
    }
  }, [currentCompany, filters])

  /** After the file input mounts, reset it so the same CSV can be chosen again on the next upload. */
  useEffect(() => {
    if (!showBulkImport) return
    clearCsvFileInput()
  }, [showBulkImport])

  const loadBanks = async () => {
    try {
      const data = await getBanks({ status: 'active' })
      setBanks(data)
    } catch (error) {
      console.error('Error loading banks:', error)
    }
  }

  const loadEmployees = async () => {
    if (!currentCompany) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const [data, leaveList] = await Promise.all([
        getEmployees(currentCompany.$id, filters),
        getLeaveRequests(currentCompany.$id, { status: 'approved' })
      ])
      setEmployees(data)

      const today = format(new Date(), 'yyyy-MM-dd')
      const todayDate = new Date(today)
      const byEmployee = new Map()
      leaveList.forEach(leave => {
        const start = parseISO(leave.start_date)
        const end = parseISO(leave.end_date)
        if (!isWithinInterval(todayDate, { start, end })) return
        const endDate = format(end, 'yyyy-MM-dd')
        const daysUntilEnd = Math.ceil((end - todayDate) / (1000 * 60 * 60 * 24))
        byEmployee.set(leave.employee_id, { end_date: endDate, daysUntilEnd, leave_type: leave.leave_type })
      })
      setLeaveInfoByEmployee(byEmployee)
    } catch (error) {
      setError('Failed to load employees')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!currentCompany) {
      setError('Please select a company first')
      return
    }

    try {
      const payload = { ...formData, company_id: currentCompany.$id }
      if (!isSuperAdmin) {
        delete payload.annual_leave_entitlement_days
      } else if (payload.annual_leave_entitlement_days === '' || payload.annual_leave_entitlement_days == null) {
        payload.annual_leave_entitlement_days = null
      } else {
        const n = Number(String(payload.annual_leave_entitlement_days).replace(/,/g, ''))
        payload.annual_leave_entitlement_days = Number.isFinite(n) ? n : null
      }
      if (editingEmployee) {
        await updateEmployee(editingEmployee.$id, payload)
        await logAudit(user?.$id, currentCompany?.$id, 'employee_updated', { entityType: 'employee', entityId: editingEmployee.$id })
        toast.success('Employee updated successfully')
      } else {
        const res = await createEmployee(payload)
        await logAudit(user?.$id, currentCompany?.$id, 'employee_created', { entityType: 'employee', entityId: res?.$id })
        toast.success('Employee created successfully')
      }
      
      await loadEmployees()
      handleCloseModal()
    } catch (error) {
      toast.error(error.message || 'Failed to save employee')
    }
  }

  const handleEdit = (employee) => {
    setEditingEmployee(employee)
    setFormData({
      user_id: employee.user_id || '',
      role: employee.role || 'employee',
      gender: employee.gender || '',
      name: employee.name || '',
      employee_id: employee.employee_id || '',
      staff_no: employee.staff_no || '',
      id_number: employee.id_number || '',
      kra_pin: employee.kra_pin || '',
      nssf_number: employee.nssf_number || '',
      shif_number: employee.shif_number || '',
      department: employee.department || '',
      position: employee.position || '',
      basic_salary: employee.basic_salary || '',
      phone: employee.phone || '',
      email: employee.email || '',
      bank_account: employee.bank_account || '',
      bank_name: employee.bank_name || '',
      bank_branch: employee.bank_branch || '',
      contract_start_date: normalizeDate(employee.contract_start_date),
      contract_end_date: normalizeDate(employee.contract_end_date),
      status: employee.status || 'active',
      annual_leave_entitlement_days:
        employee.annual_leave_entitlement_days != null && employee.annual_leave_entitlement_days !== ''
          ? String(employee.annual_leave_entitlement_days)
          : ''
    })
    setShowModal(true)
  }

  const handleDeleteClick = (employeeId) => {
    setConfirmDelete({ open: true, employeeId })
  }

  const handleDeleteConfirm = async () => {
    const { employeeId } = confirmDelete
    if (!employeeId) return
    try {
      setDeleting(true)
      await deleteEmployee(employeeId)
      await logAudit(user?.$id, currentCompany?.$id, 'employee_deleted', { entityType: 'employee', entityId: employeeId })
      setConfirmDelete({ open: false, employeeId: null })
      toast.success('Employee deleted successfully')
      await loadEmployees()
    } catch (error) {
      toast.error(error.message || 'Failed to delete employee')
    } finally {
      setDeleting(false)
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingEmployee(null)
    setFormData({
      user_id: '',
      role: 'employee',
      gender: '',
      name: '',
      employee_id: '',
      staff_no: '',
      id_number: '',
      kra_pin: '',
      nssf_number: '',
      shif_number: '',
      department: '',
      position: '',
      basic_salary: '',
      phone: '',
      email: '',
      bank_account: '',
      bank_name: '',
      bank_branch: '',
      contract_start_date: '',
      contract_end_date: '',
      status: 'active',
      annual_leave_entitlement_days: ''
    })
    setError('')
    setSuccess('')
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }

    setImportFile(file)
    setError('')
    setImportResults(null)
    setParsedEmployees([])

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const csvText = event.target.result
        const result = parseCSV(csvText)
        setParsedEmployees(result.employees)
        
        if (result.errors.length > 0) {
          setError(`Found ${result.errors.length} errors in CSV. Please fix them before importing.`)
          console.error('CSV parsing errors:', result.errors)
        } else {
          setSuccess(`Successfully parsed ${result.employees.length} employees`)
        }
      } catch (error) {
        setError('Failed to parse CSV: ' + error.message)
        console.error('CSV parsing error:', error)
      }
    }
    reader.onerror = () => {
      setError('Failed to read file')
    }
    reader.readAsText(file)
  }

  const handleBulkImport = async () => {
    if (!currentCompany) {
      setError('Please select a company first')
      return
    }

    if (parsedEmployees.length === 0) {
      setError('No employees to import. Please upload a valid CSV file.')
      return
    }

    setImporting(true)
    setError('')
    setSuccess('')
    setImportProgress({ processed: 0, total: parsedEmployees.length, success: 0, errors: 0 })

    try {
      const results = await bulkCreateEmployees(
        parsedEmployees,
        currentCompany.$id,
        (progress) => {
          setImportProgress(progress)
        }
      )

      setImportResults(results)
      setImporting(false)
      setImportFile(null)
      setParsedEmployees([])
      clearCsvFileInput()

      const nCreated = results.success.filter((r) => r.action === 'created').length
      const nUpdated = results.success.filter((r) => r.action === 'updated').length

      const cat = results.catalogSummary
      const catMsg =
        cat &&
        [
          cat.banksCreated ? `${cat.banksCreated} new bank(s) added to Banks.` : null,
          cat.departmentsCount
            ? `Department catalog updated (${cat.departmentsCount} unique in file).`
            : null,
          cat.bankBranchesCount
            ? `Bank branch catalog updated (${cat.bankBranchesCount} unique bank+branch in file).`
            : null,
          cat.rolesCount ? `Role hints catalog updated (${cat.rolesCount} unique in file).` : null,
          cat.warnings?.length ? `Catalog warnings: ${cat.warnings.join(' ')}` : null
        ]
          .filter(Boolean)
          .join(' ')

      if (results.errors.length === 0) {
        setSuccess(
          `Import finished: ${nCreated} added, ${nUpdated} updated (${results.success.length} rows).${catMsg ? ` ${catMsg}` : ''}`
        )
      } else {
        setError(
          `Processed ${results.success.length} rows (${nCreated} added, ${nUpdated} updated), but ${results.errors.length} failed. See below.${catMsg ? ` ${catMsg}` : ''}`
        )
      }

      // Reload employees list
      await loadEmployees()
    } catch (error) {
      setError('Bulk import failed: ' + error.message)
      setImporting(false)
    }
  }

  const handleDownloadTemplate = () => {
    const template = generateCSVTemplate()
    const blob = new Blob([template], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'employee_import_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const handleDownloadEmployeeList = () => {
    if (!currentCompany || !employees.length) {
      toast.error('No employees to export for the current filters.')
      return
    }
    const csv = '\uFEFF' + generateEmployeesExportCSV(employees)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const safeName = (currentCompany.name || 'company').replace(/[^\w\-]+/g, '_')
    const stamp = format(new Date(), 'yyyy-MM-dd')
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `employees_export_${safeName}_${stamp}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    toast.success(`Downloaded ${employees.length} employee row(s) (import-compatible CSV).`)
  }

  const handleCloseBulkImport = () => {
    setShowBulkImport(false)
    setImportFile(null)
    setParsedEmployees([])
    setImportProgress(null)
    setImportResults(null)
    setError('')
    setSuccess('')
    clearCsvFileInput()
  }

  if (!currentCompany) {
    return (
      <div className="employees-page">
        <div className="alert alert-warning">
          Please select a company first to manage employees.
        </div>
      </div>
    )
  }

  return (
    <div className="employees-page">
      <div className="page-header">
        <h1>Employees</h1>
        <div className="header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleDownloadEmployeeList}
            disabled={loading || employees.length === 0}
            title="Same columns as Bulk Import — edit and re-import if needed"
          >
            ⬇ Download list (CSV)
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setImportFile(null)
              setParsedEmployees([])
              setImportResults(null)
              setImportProgress(null)
              setError('')
              setSuccess('')
              clearCsvFileInput()
              setShowBulkImport(true)
            }}
          >
            📥 Bulk import / update
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              handleCloseModal()
              setShowModal(true)
            }}
          >
            + Add Employee
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      <div className="filters">
        <div className="filter-group">
          <label>Status:</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Search:</label>
          <input
            type="text"
            placeholder="Search by name, ID, or employee number..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading employees...</div>
      ) : employees.length === 0 ? (
        <div className="empty-state">
          <p>No employees found. Add your first employee to get started.</p>
        </div>
      ) : (
        <div className="employees-table-container">
          <table className="employees-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Employee ID</th>
                <th>Department</th>
                <th>Position</th>
                <th>Basic Salary</th>
                <th>Status</th>
                <th>Leave</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...employees]
                .sort(compareEmployeeSortKey)
                .map(employee => {
                  const leaveInfo = leaveInfoByEmployee.get(employee.$id)
                  const onLeave = !!leaveInfo
                  return (
                <tr key={employee.$id} className={onLeave ? 'employee-row-on-leave' : ''}>
                  <td>{employee.name}</td>
                  <td>{employee.employee_id || employee.staff_no || '-'}</td>
                  <td>{employee.department || '-'}</td>
                  <td>{employee.position || '-'}</td>
                  <td>KES {parseFloat(employee.basic_salary || 0).toLocaleString()}</td>
                  <td>
                    <span className={`badge badge-${employee.status}`}>
                      {employee.status}
                    </span>
                  </td>
                  <td>
                    {onLeave ? (
                      <span className="leave-countdown" title={`Leave ends ${leaveInfo.end_date}`}>
                        <span className="leave-countdown-dot" aria-hidden="true" />
                        {leaveInfo.daysUntilEnd <= 0
                          ? 'Returns today'
                          : leaveInfo.daysUntilEnd === 1
                            ? 'Returns tomorrow'
                            : `${leaveInfo.daysUntilEnd} days to return`}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn-link"
                        onClick={() => {
                          setSelectedEmployeeForQR(employee)
                          setShowQRCode(true)
                        }}
                      >
                        QR Code
                      </button>
                      <button
                        className="btn-link"
                        onClick={() => handleEdit(employee)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-link btn-danger-link"
                        onClick={() => handleDeleteClick(employee.$id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingEmployee ? 'Edit Employee' : 'Add Employee'}</h2>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="employee-form">
              <div className="form-section">
                <h3>Personal Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Gender</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                    >
                      <option value="">Select Gender</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="other">Other</option>
                    </select>
                    <p className="form-description">
                      Used to enforce leave rules (e.g., maternity vs paternity leave).
                    </p>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>ID Number</label>
                    <input
                      type="text"
                      name="id_number"
                      value={formData.id_number}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Employment Details</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Linked User ID</label>
                    <input
                      type="text"
                      name="user_id"
                      value={formData.user_id}
                      onChange={handleInputChange}
                      placeholder="Paste Appwrite User ID (optional)"
                    />
                    <p className="form-description">
                      Link this employee to an Appwrite user for login. User creates account on Login → Register; get their User ID from Appwrite Console (Auth → Users); paste it here and set Role below.
                    </p>
                  </div>
                  <div className="form-group">
                    <label>Role</label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                    <p className="form-description">
                      This role controls which menus and features the user can see.
                    </p>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Employee ID</label>
                    <input
                      type="text"
                      name="employee_id"
                      value={formData.employee_id}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Staff Number</label>
                    <input
                      type="text"
                      name="staff_no"
                      value={formData.staff_no}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Department</label>
                    <input
                      type="text"
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Position</label>
                    <input
                      type="text"
                      name="position"
                      value={formData.position}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Contract Start Date</label>
                    <input
                      type="date"
                      name="contract_start_date"
                      value={formData.contract_start_date}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Contract End Date</label>
                    <input
                      type="date"
                      name="contract_end_date"
                      value={formData.contract_end_date}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                {isSuperAdmin && isLocalDataSource() && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Annual leave (days per year)</label>
                      <input
                        type="number"
                        name="annual_leave_entitlement_days"
                        value={formData.annual_leave_entitlement_days}
                        onChange={handleInputChange}
                        min="0"
                        max="366"
                        step="0.5"
                        placeholder="Empty = use company default (Leave types)"
                      />
                      <p className="form-description">
                        Optional override for this employee’s annual leave pool. Super admin only. Clear to use the
                        company default from Leave types.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-section">
                <h3>Financial Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Basic Salary *</label>
                    <input
                      type="number"
                      name="basic_salary"
                      value={formData.basic_salary}
                      onChange={handleInputChange}
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="form-group">
                    <label>KRA PIN</label>
                    <input
                      type="text"
                      name="kra_pin"
                      value={formData.kra_pin}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>NSSF Number</label>
                    <input
                      type="text"
                      name="nssf_number"
                      value={formData.nssf_number}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>SHIF Number</label>
                    <input
                      type="text"
                      name="shif_number"
                      value={formData.shif_number}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Bank Details</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Bank Name</label>
                    <select
                      name="bank_name"
                      value={formData.bank_name}
                      onChange={handleInputChange}
                    >
                      <option value="">Select Bank</option>
                      {banks.map(bank => (
                        <option key={bank.$id} value={bank.bank_name}>
                          {bank.bank_name} {bank.bank_code ? `(${bank.bank_code})` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="form-description">
                      {banks.length === 0 && 'No banks found. Add banks in the Banks page first.'}
                    </p>
                  </div>
                  <div className="form-group">
                    <label>Bank Branch</label>
                    <input
                      type="text"
                      name="bank_branch"
                      value={formData.bank_branch}
                      onChange={handleInputChange}
                      placeholder="e.g., Upper Hill, Westlands"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Account Number</label>
                  <input
                    type="text"
                    name="bank_account"
                    value={formData.bank_account}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-section">
                <div className="form-group">
                  <label>Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingEmployee ? 'Update' : 'Create'} Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQRCode && selectedEmployeeForQR && (
        <EmployeeQRCode
          employee={selectedEmployeeForQR}
          companyLogoUrl={currentCompany?.logo_url}
          onClose={() => {
            setShowQRCode(false)
            setSelectedEmployeeForQR(null)
          }}
        />
      )}

      {showBulkImport && (
        <div className="modal-overlay" onClick={handleCloseBulkImport}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Bulk import or update</h2>
              <button className="modal-close" onClick={handleCloseBulkImport}>×</button>
            </div>

            <div className="modal-body">
              <div className="bulk-import-section">
                <h3>Step 1: Download Template</h3>
                <p>
                  Download the CSV template. Required: Name. Gender: Female, Male, or Other. On import, unique values from{' '}
                  <strong>Department</strong>, <strong>Bank Name</strong>, <strong>Bank Branch</strong> (paired), and{' '}
                  <strong>Role</strong> are merged into company catalogs and missing banks are added under Banks.
                </p>
                <button className="btn-secondary" onClick={handleDownloadTemplate}>
                  📥 Download Template
                </button>
              </div>

              <div className="bulk-import-section">
                <h3>Step 2: Upload CSV File</h3>
                <p>
                  Upload a CSV (same format as <strong>Download list</strong> or the template). Re-upload anytime to
                  refresh the list: rows whose <strong>Employee ID</strong> or <strong>Staff No.</strong> match an
                  existing person in this company are <strong>updated</strong>; others are <strong>added</strong>.
                  Include at least one of those two columns so updates match correctly.
                </p>
                <input
                  ref={csvFileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileSelect}
                  className="file-input"
                  disabled={importing}
                />
                {importFile && (
                  <div className="file-info">
                    <strong>Selected:</strong> {importFile.name}
                  </div>
                )}
              </div>

              {parsedEmployees.length > 0 && (
                <div className="bulk-import-section">
                  <h3>Step 3: Preview ({parsedEmployees.length} employees)</h3>
                  <div className="preview-table-container">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Employee ID</th>
                          <th>Gender</th>
                          <th>Department</th>
                          <th>Position</th>
                          <th>Basic Salary</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedEmployeesSortedById.slice(0, 10).map((emp, idx) => (
                          <tr key={idx}>
                            <td>{emp.name}</td>
                            <td>{emp.employee_id || '-'}</td>
                            <td>{emp.gender || '-'}</td>
                            <td>{emp.department || '-'}</td>
                            <td>{emp.position || '-'}</td>
                            <td>KES {parseFloat(emp.basic_salary || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedEmployees.length > 10 && (
                      <p className="preview-note">... and {parsedEmployees.length - 10} more employees</p>
                    )}
                  </div>
                </div>
              )}

              {importProgress && (
                <div className="bulk-import-section">
                  <h3>Import Progress</h3>
                  <div className="progress-bar-container">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${(importProgress.processed / importProgress.total) * 100}%` }}
                      />
                    </div>
                    <div className="progress-text">
                      {importProgress.processed} / {importProgress.total} employees
                      {' '}({importProgress.success} success, {importProgress.errors} errors)
                    </div>
                  </div>
                </div>
              )}

              {importResults && (
                <div className="bulk-import-section">
                  <h3>Import Results</h3>
                  <div className="import-results">
                    <div className="result-summary">
                      <div className="result-item success">
                        <strong>✓ Added:</strong>{' '}
                        {importResults.success.filter((r) => r.action === 'created').length}
                        {' · '}
                        <strong>Updated:</strong>{' '}
                        {importResults.success.filter((r) => r.action === 'updated').length}
                        {' '}
                        <span className="text-muted">({importResults.success.length} ok)</span>
                      </div>
                      <div className="result-item error">
                        <strong>✗ Errors:</strong> {importResults.errors.length}
                      </div>
                      <div className="result-item">
                        <strong>Total:</strong> {importResults.total}
                      </div>
                      {importResults.catalogSummary && (
                        <div className="result-item text-muted" style={{ marginTop: '0.5rem' }}>
                          <strong>Catalogs:</strong>{' '}
                          {importResults.catalogSummary.banksCreated
                            ? `${importResults.catalogSummary.banksCreated} bank(s) created. `
                            : ''}
                          Departments / bank–branch pairs / roles from file merged into Settings (
                          department_catalog, bank_branch_catalog, employee_role_catalog).
                          {importResults.catalogSummary.warnings?.length > 0 && (
                            <span className="error-text">
                              {' '}
                              {importResults.catalogSummary.warnings.join(' ')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {importResults.errors.length > 0 && (
                      <div className="error-details">
                        <h4>Errors:</h4>
                        <div className="error-list">
                          {importResults.errors.slice(0, 10).map((err, idx) => (
                            <div key={idx} className="error-item">
                              <strong>Row {err.row} ({err.name}):</strong> {err.error}
                            </div>
                          ))}
                          {importResults.errors.length > 10 && (
                            <p>... and {importResults.errors.length - 10} more errors</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={handleCloseBulkImport}
                disabled={importing}
              >
                {importResults ? 'Close' : 'Cancel'}
              </button>
              {parsedEmployees.length > 0 && !importResults && (
                <button
                  className="btn-primary"
                  onClick={handleBulkImport}
                  disabled={importing || parsedEmployees.length === 0}
                >
                  {importing ? 'Importing...' : `Import ${parsedEmployees.length} Employees`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete.open}
        title="Delete employee"
        message="Are you sure you want to delete this employee? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete({ open: false, employeeId: null })}
      />
    </div>
  )
}

export default Employees
