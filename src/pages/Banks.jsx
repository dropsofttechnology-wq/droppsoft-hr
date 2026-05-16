import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getBanks, createBank, updateBank, deleteBank } from '../services/bankService'
import ConfirmDialog from '../components/ConfirmDialog'
import './Banks.css'

const emptyForm = {
  bank_name: '',
  bank_code: '',
  swift_code: '',
  status: 'active'
}

const Banks = () => {
  const [banks, setBanks] = useState([])
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadBanks()
  }, [])

  const loadBanks = async () => {
    try {
      setLoading(true)
      const data = await getBanks()
      setBanks(data)
    } catch (e) {
      setError('Failed to load banks')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.bank_name) {
      setError('Bank name is required')
      return
    }

    try {
      if (editing) {
        await updateBank(editing.$id, formData)
        toast.success('Bank updated successfully')
      } else {
        await createBank(formData)
        toast.success('Bank created successfully')
      }

      setFormData(emptyForm)
      setEditing(null)
      await loadBanks()
    } catch (e) {
      toast.error(e.message || 'Failed to save bank')
    }
  }

  const handleEdit = (bank) => {
    setEditing(bank)
    setFormData({
      bank_name: bank.bank_name || '',
      bank_code: bank.bank_code || '',
      swift_code: bank.swift_code || '',
      status: bank.status || 'active'
    })
  }

  const handleDelete = (bank) => setConfirmDelete(bank)

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return
    try {
      setDeleting(true)
      await deleteBank(confirmDelete.$id)
      setConfirmDelete(null)
      toast.success('Bank deleted successfully')
      await loadBanks()
    } catch (e) {
      toast.error(e.message || 'Failed to delete bank')
    } finally {
      setDeleting(false)
    }
  }

  const handleCancelEdit = () => {
    setEditing(null)
    setFormData(emptyForm)
  }

  return (
    <div className="banks-page">
      <div className="page-header">
        <h1>Bank Management</h1>
      </div>

      <p className="page-description">
        Manage the banks that employees are paid through. Banks defined here can
        be used for payroll and reporting.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="banks-layout">
        <div className="banks-form-card">
          <h2>{editing ? 'Edit Bank' : 'Add New Bank'}</h2>
          <form onSubmit={handleSubmit} className="banks-form">
            <div className="form-group">
              <label>
                Bank Name <span className="required">*</span>
              </label>
              <input
                type="text"
                name="bank_name"
                value={formData.bank_name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Bank Code</label>
              <input
                type="text"
                name="bank_code"
                value={formData.bank_code}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>SWIFT Code</label>
              <input
                type="text"
                name="swift_code"
                value={formData.swift_code}
                onChange={handleInputChange}
              />
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
            </div>
            <div className="form-actions">
              {editing && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              )}
              <button type="submit" className="btn-primary">
                {editing ? 'Update Bank' : 'Add Bank'}
              </button>
            </div>
          </form>
        </div>

        <div className="banks-list-card">
          <h2>Banks List</h2>
          {loading ? (
            <div className="loading">Loading banks...</div>
          ) : banks.length === 0 ? (
            <p className="empty-state">
              No banks found. Add your first bank using the form.
            </p>
          ) : (
            <div className="banks-table-container">
              <table className="banks-table">
                <thead>
                  <tr>
                    <th>Bank Name</th>
                    <th>Bank Code</th>
                    <th>SWIFT Code</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {banks.map((bank) => (
                    <tr key={bank.$id}>
                      <td>
                        <strong>{bank.bank_name}</strong>
                      </td>
                      <td>{bank.bank_code || '-'}</td>
                      <td>{bank.swift_code || '-'}</td>
                      <td>
                        <span className={`badge badge-${bank.status}`}>
                          {bank.status}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => handleEdit(bank)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-link btn-danger-link"
                            onClick={() => handleDelete(bank)}
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
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete bank"
        message={confirmDelete ? `Delete bank "${confirmDelete.bank_name}"?` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}

export default Banks

