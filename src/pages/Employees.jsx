import { useState, useEffect } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { getEmployees, createEmployee, updateEmployee, deleteEmployee } from '../services/employeeService'
import EmployeeQRCode from '../components/EmployeeQRCode'
import './Employees.css'

const Employees = () => {
  const { currentCompany } = useCompany()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [filters, setFilters] = useState({
    status: 'active',
    search: ''
  })
  const [formData, setFormData] = useState({
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
    status: 'active'
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showQRCode, setShowQRCode] = useState(false)
  const [selectedEmployeeForQR, setSelectedEmployeeForQR] = useState(null)

  useEffect(() => {
    if (currentCompany) {
      loadEmployees()
    }
  }, [currentCompany, filters])

  const loadEmployees = async () => {
    if (!currentCompany) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await getEmployees(currentCompany.$id, filters)
      setEmployees(data)
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
      if (editingEmployee) {
        await updateEmployee(editingEmployee.$id, {
          ...formData,
          company_id: currentCompany.$id
        })
        setSuccess('Employee updated successfully')
      } else {
        await createEmployee({
          ...formData,
          company_id: currentCompany.$id
        })
        setSuccess('Employee created successfully')
      }
      
      await loadEmployees()
      handleCloseModal()
    } catch (error) {
      setError(error.message || 'Failed to save employee')
    }
  }

  const handleEdit = (employee) => {
    setEditingEmployee(employee)
    setFormData({
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
      contract_start_date: employee.contract_start_date || '',
      contract_end_date: employee.contract_end_date || '',
      status: employee.status || 'active'
    })
    setShowModal(true)
  }

  const handleDelete = async (employeeId) => {
    if (!window.confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
      return
    }

    try {
      await deleteEmployee(employeeId)
      setSuccess('Employee deleted successfully')
      await loadEmployees()
    } catch (error) {
      setError(error.message || 'Failed to delete employee')
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingEmployee(null)
    setFormData({
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
      status: 'active'
    })
    setError('')
    setSuccess('')
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
        <button 
          className="btn-primary"
          onClick={() => setShowModal(true)}
        >
          + Add Employee
        </button>
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(employee => (
                <tr key={employee.$id}>
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
                        onClick={() => handleDelete(employee.$id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
                    <input
                      type="text"
                      name="bank_name"
                      value={formData.bank_name}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Bank Branch</label>
                    <input
                      type="text"
                      name="bank_branch"
                      value={formData.bank_branch}
                      onChange={handleInputChange}
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
          onClose={() => {
            setShowQRCode(false)
            setSelectedEmployeeForQR(null)
          }}
        />
      )}
    </div>
  )
}

export default Employees
