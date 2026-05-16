import { useState, useEffect } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { getLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType } from '../services/leaveService'
import './LeaveTypes.css'

// Default leave types copied from the original plugin configuration
// These will be created per-company when the admin chooses to seed defaults
const DEFAULT_LEAVE_TYPES = [
  {
    leave_code: 'ANNUAL',
    leave_name: 'Annual Leave',
    description:
      'Statutory annual leave. Entitlement: 21.00 days per year (1.75 days per month). Pay rule: 100% of basic pay for approved days.',
    entitlement_days: 21,
    is_statutory: true,
    display_order: 10
  },
  {
    leave_code: 'SICK',
    leave_name: 'Sick Leave',
    description:
      'Statutory sick leave. Entitlement: 14.00 days per year. Pay rule: first 7 days at 100% pay, next 7 days at 50% pay.',
    entitlement_days: 14,
    is_statutory: true,
    display_order: 20
  },
  {
    leave_code: 'MATERNITY',
    leave_name: 'Maternity Leave',
    description:
      'Statutory maternity leave. Entitlement: 90.00 days (lifetime). Pay rule: 90 days at 100% pay. Typically one full continuous period per birth.',
    entitlement_days: 90,
    is_statutory: true,
    display_order: 30
  },
  {
    leave_code: 'PATERNITY',
    leave_name: 'Paternity Leave',
    description:
      'Statutory paternity leave. Entitlement: 14.00 days (lifetime). Pay rule: 14 days at 100% pay.',
    entitlement_days: 14,
    is_statutory: true,
    display_order: 40
  },
  {
    leave_code: 'PRE_ADOPTIVE',
    leave_name: 'Pre-Adoptive Leave',
    description:
      'Statutory pre-adoptive leave. Entitlement: 30.00 days (lifetime). Pay rule: 30 days at 100% pay.',
    entitlement_days: 30,
    is_statutory: true,
    display_order: 50
  },
  {
    leave_code: 'COMPASSIONATE',
    leave_name: 'Compassionate Leave',
    description:
      'Company policy leave. Entitlement: 5.00 days per year. Pay rule: 5 days at 100% pay (for bereavement or similar events).',
    entitlement_days: 5,
    is_statutory: false,
    display_order: 60
  },
  {
    leave_code: 'STUDY',
    leave_name: 'Study Leave',
    description:
      'Company policy leave. Entitlement: 0.00 days per year by default. Pay rule: normally unpaid unless overridden by company policy for a specific employee.',
    entitlement_days: 0,
    is_statutory: false,
    display_order: 70
  },
  {
    leave_code: 'UNPAID',
    leave_name: 'Unpaid Leave',
    description:
      'Company policy / fallback leave. Entitlement: 0.00 days per year. Pay rule: 0% pay for days recorded under this leave type (fully unpaid).',
    entitlement_days: 0,
    is_statutory: false,
    display_order: 80,
    pay_percentage: 0
  }
]

const LeaveTypes = () => {
  const { currentCompany } = useCompany()
  const [leaveTypes, setLeaveTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingLeaveType, setEditingLeaveType] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    leave_code: '',
    leave_name: '',
    description: '',
    entitlement_days: '21',
    is_statutory: false,
    display_order: '0',
    status: 'active'
  })

  useEffect(() => {
    if (currentCompany) {
      loadLeaveTypes()
    }
  }, [currentCompany])

  const loadLeaveTypes = async () => {
    if (!currentCompany) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await getLeaveTypes(currentCompany.$id, false) // Get all including inactive
      setLeaveTypes(data)
    } catch (error) {
      setError('Failed to load leave types')
    } finally {
      setLoading(false)
    }
  }

  const handleSeedDefaults = async () => {
    if (!currentCompany) {
      setError('Please select a company first')
      return
    }

    setError('')
    setSuccess('')

    try {
      setLoading(true)

      // Determine which default codes already exist
      const existingCodes = new Set(
        (leaveTypes || []).map((lt) => (lt.leave_code || '').toUpperCase())
      )

      const toCreate = DEFAULT_LEAVE_TYPES.filter(
        (d) => !existingCodes.has(d.leave_code.toUpperCase())
      )

      if (toCreate.length === 0) {
        setSuccess('All default leave types already exist for this company.')
        return
      }

      // Create missing defaults one by one
      // (small number, so simple sequential awaits are fine)
      for (const def of toCreate) {
        // eslint-disable-next-line no-await-in-loop
        await createLeaveType({
          company_id: currentCompany.$id,
          leave_code: def.leave_code,
          leave_name: def.leave_name,
          description: def.description,
          entitlement_days: def.entitlement_days,
          is_statutory: def.is_statutory,
          display_order: def.display_order.toString(),
          status: 'active',
          pay_percentage: def.pay_percentage != null ? def.pay_percentage : 100
        })
      }

      await loadLeaveTypes()
      setSuccess(`Created ${toCreate.length} default leave type(s).`)
    } catch (error) {
      setError(error.message || 'Failed to create default leave types')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
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

    if (!formData.leave_code || !formData.leave_name) {
      setError('Leave code and name are required')
      return
    }

    try {
      const payPct = Math.max(0, Math.min(100, parseFloat(String(formData.pay_percentage)) || 100))
      if (editingLeaveType) {
        await updateLeaveType(editingLeaveType.$id, {
          ...formData,
          company_id: currentCompany.$id,
          pay_percentage: payPct
        })
        setSuccess('Leave type updated successfully')
      } else {
        await createLeaveType({
          ...formData,
          company_id: currentCompany.$id,
          pay_percentage: payPct
        })
        setSuccess('Leave type created successfully')
      }
      
      await loadLeaveTypes()
      handleCloseModal()
    } catch (error) {
      setError(error.message || 'Failed to save leave type')
    }
  }

  const handleEdit = (leaveType) => {
    setEditingLeaveType(leaveType)
    setFormData({
      leave_code: leaveType.leave_code,
      leave_name: leaveType.leave_name,
      description: leaveType.description || '',
      entitlement_days: leaveType.entitlement_days?.toString() || '21',
      is_statutory: leaveType.is_statutory || false,
      display_order: leaveType.display_order?.toString() || '0',
      status: leaveType.status || 'active',
      pay_percentage:
        leaveType.pay_percentage != null && leaveType.pay_percentage !== ''
          ? String(leaveType.pay_percentage)
          : '100'
    })
    setShowModal(true)
  }

  const handleDelete = async (leaveTypeId) => {
    if (!window.confirm('Are you sure you want to delete this leave type? This action cannot be undone.')) {
      return
    }

    try {
      await deleteLeaveType(leaveTypeId)
      setSuccess('Leave type deleted successfully')
      await loadLeaveTypes()
    } catch (error) {
      setError(error.message || 'Failed to delete leave type')
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingLeaveType(null)
    setFormData({
      leave_code: '',
      leave_name: '',
      description: '',
      entitlement_days: '21',
      is_statutory: false,
      display_order: '0',
      status: 'active',
      pay_percentage: '100'
    })
    setError('')
    setSuccess('')
  }

  if (!currentCompany) {
    return (
      <div className="leave-types-page">
        <div className="alert alert-warning">
          Please select a company first to manage leave types.
        </div>
      </div>
    )
  }

  return (
    <div className="leave-types-page">
      <div className="page-header">
        <h1>Leave Types Management</h1>
        <div className="page-header-actions">
          <button 
            className="btn-secondary"
            type="button"
            onClick={handleSeedDefaults}
            disabled={loading || !currentCompany}
          >
            Seed Default Leave Types
          </button>
          <button 
            className="btn-primary"
            type="button"
            onClick={() => setShowModal(true)}
          >
            + Add Leave Type
          </button>
        </div>
      </div>

      <p className="page-description">
        Configure leave types for your organization. Set entitlements, mark statutory leaves, and manage leave policies.
      </p>

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

      {loading ? (
        <div className="loading">Loading leave types...</div>
      ) : leaveTypes.length === 0 ? (
        <div className="empty-state">
          <p>No leave types found. Add your first leave type to get started.</p>
        </div>
      ) : (
        <div className="leave-types-table-container">
          <table className="leave-types-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Description</th>
                <th>Entitlement (Days)</th>
                <th>Pay %</th>
                <th>Statutory</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaveTypes.map(leaveType => (
                <tr key={leaveType.$id}>
                  <td><strong>{leaveType.leave_code}</strong></td>
                  <td>{leaveType.leave_name}</td>
                  <td className="description-cell">
                    {leaveType.description || '-'}
                  </td>
                  <td>{leaveType.entitlement_days || 0}</td>
                  <td title="Salary paid during leave; remainder deducted at (Basic+HSE)÷30 per day in payroll">
                    {leaveType.pay_percentage != null ? `${leaveType.pay_percentage}%` : '100%'}
                  </td>
                  <td>
                    {leaveType.is_statutory ? (
                      <span className="badge badge-statutory">Yes</span>
                    ) : (
                      <span className="text-muted">No</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-${leaveType.status}`}>
                      {leaveType.status}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn-link"
                        onClick={() => handleEdit(leaveType)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-link btn-danger-link"
                        onClick={() => handleDelete(leaveType.$id)}
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingLeaveType ? 'Edit Leave Type' : 'Add Leave Type'}</h2>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="leave-type-form">
              <div className="form-group">
                <label>Leave Code <span className="required">*</span></label>
                <input
                  type="text"
                  name="leave_code"
                  value={formData.leave_code}
                  onChange={handleInputChange}
                  placeholder="e.g., ANNUAL, SICK, MATERNITY"
                  required
                  disabled={!!editingLeaveType}
                  style={{ textTransform: 'uppercase' }}
                />
                <p className="form-description">
                  Unique code (e.g., ANNUAL, SICK, MATERNITY). Cannot be changed after creation.
                </p>
              </div>

              <div className="form-group">
                <label>Leave Name <span className="required">*</span></label>
                <input
                  type="text"
                  name="leave_name"
                  value={formData.leave_name}
                  onChange={handleInputChange}
                  placeholder="e.g., Annual Leave, Sick Leave"
                  required
                />
                <p className="form-description">Display name for this leave type.</p>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Description of this leave type and its rules..."
                />
                <p className="form-description">Description of this leave type and its rules.</p>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Entitlement (Days)</label>
                  <input
                    type="number"
                    name="entitlement_days"
                    value={formData.entitlement_days}
                    onChange={handleInputChange}
                    min="0"
                    step="0.5"
                    placeholder="21"
                  />
                  <p className="form-description">Number of days employees are entitled to per year.</p>
                </div>

                <div className="form-group">
                  <label>Display Order</label>
                  <input
                    type="number"
                    name="display_order"
                    value={formData.display_order}
                    onChange={handleInputChange}
                    min="0"
                    placeholder="0"
                  />
                  <p className="form-description">Order in which this leave type appears in lists.</p>
                </div>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    name="is_statutory"
                    checked={formData.is_statutory}
                    onChange={handleInputChange}
                  />
                  Statutory Leave (Kenyan Employment Act)
                </label>
                <p className="form-description">Check if this is a statutory leave type required by Kenyan law.</p>
              </div>

              <div className="form-group">
                <label>Pay % of salary (during approved leave)</label>
                <input
                  type="number"
                  name="pay_percentage"
                  value={formData.pay_percentage}
                  onChange={handleInputChange}
                  min="0"
                  max="100"
                  step="1"
                />
                <p className="form-description">
                  100 = fully paid leave (no deduction). 0 = unpaid: payroll deducts (Basic + HSE) ÷ 30 per calendar day in the month for approved leave. Values between 0 and 100 deduct the remainder proportionally.
                </p>
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <p className="form-description">Inactive leave types will not be available for new requests.</p>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseModal}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingLeaveType ? 'Update' : 'Create'} Leave Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeaveTypes
