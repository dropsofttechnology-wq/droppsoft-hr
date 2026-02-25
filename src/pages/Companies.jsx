import { useState, useEffect } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { getCompanies, createCompany, updateCompany, deleteCompany } from '../services/companyService'
import './Companies.css'

const Companies = () => {
  const { companies, currentCompany, selectCompany, loadCompanies } = useCompany()
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCompany, setEditingCompany] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    registration_number: '',
    tax_pin: '',
    address: '',
    phone: '',
    email: '',
    status: 'active'
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadCompaniesData()
  }, [])

  const loadCompaniesData = async () => {
    try {
      await loadCompanies()
    } catch (error) {
      setError('Failed to load companies')
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

    try {
      if (editingCompany) {
        await updateCompany(editingCompany.$id, formData)
        setSuccess('Company updated successfully')
      } else {
        await createCompany(formData)
        setSuccess('Company created successfully')
      }
      
      await loadCompanies()
      handleCloseModal()
    } catch (error) {
      setError(error.message || 'Failed to save company')
    }
  }

  const handleEdit = (company) => {
    setEditingCompany(company)
    setFormData({
      name: company.name || '',
      registration_number: company.registration_number || '',
      tax_pin: company.tax_pin || '',
      address: company.address || '',
      phone: company.phone || '',
      email: company.email || '',
      status: company.status || 'active'
    })
    setShowModal(true)
  }

  const handleDelete = async (companyId) => {
    if (!window.confirm('Are you sure you want to delete this company? This action cannot be undone.')) {
      return
    }

    try {
      await deleteCompany(companyId)
      setSuccess('Company deleted successfully')
      await loadCompanies()
      
      // If deleted company was current, clear selection
      if (currentCompany?.$id === companyId) {
        selectCompany(null)
        localStorage.removeItem('currentCompanyId')
      }
    } catch (error) {
      setError(error.message || 'Failed to delete company')
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingCompany(null)
    setFormData({
      name: '',
      registration_number: '',
      tax_pin: '',
      address: '',
      phone: '',
      email: '',
      status: 'active'
    })
    setError('')
    setSuccess('')
  }

  const handleSelectCompany = (company) => {
    selectCompany(company)
    setSuccess(`Switched to ${company.name}`)
    setTimeout(() => setSuccess(''), 3000)
  }

  if (loading) {
    return <div className="loading">Loading companies...</div>
  }

  return (
    <div className="companies-page">
      <div className="page-header">
        <h1>Companies</h1>
        <button 
          className="btn-primary"
          onClick={() => setShowModal(true)}
        >
          + Create Company
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

      {currentCompany && (
        <div className="current-company-badge">
          <strong>Current Company:</strong> {currentCompany.name}
        </div>
      )}

      <div className="companies-grid">
        {companies.length === 0 ? (
          <div className="empty-state">
            <p>No companies found. Create your first company to get started.</p>
          </div>
        ) : (
          companies.map(company => (
            <div 
              key={company.$id} 
              className={`company-card ${currentCompany?.$id === company.$id ? 'active' : ''}`}
            >
              <div className="company-card-header">
                <h3>{company.name}</h3>
                {company.status === 'active' ? (
                  <span className="badge badge-success">Active</span>
                ) : (
                  <span className="badge badge-inactive">Inactive</span>
                )}
              </div>

              <div className="company-card-body">
                {company.registration_number && (
                  <div className="company-info">
                    <strong>Registration:</strong> {company.registration_number}
                  </div>
                )}
                {company.tax_pin && (
                  <div className="company-info">
                    <strong>Tax PIN:</strong> {company.tax_pin}
                  </div>
                )}
                {company.email && (
                  <div className="company-info">
                    <strong>Email:</strong> {company.email}
                  </div>
                )}
                {company.phone && (
                  <div className="company-info">
                    <strong>Phone:</strong> {company.phone}
                  </div>
                )}
              </div>

              <div className="company-card-actions">
                {currentCompany?.$id !== company.$id && (
                  <button
                    className="btn-secondary"
                    onClick={() => handleSelectCompany(company)}
                  >
                    Select
                  </button>
                )}
                <button
                  className="btn-secondary"
                  onClick={() => handleEdit(company)}
                >
                  Edit
                </button>
                <button
                  className="btn-danger"
                  onClick={() => handleDelete(company.$id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCompany ? 'Edit Company' : 'Create Company'}</h2>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="company-form">
              <div className="form-group">
                <label>Company Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter company name"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Registration Number</label>
                  <input
                    type="text"
                    name="registration_number"
                    value={formData.registration_number}
                    onChange={handleInputChange}
                    placeholder="Company registration number"
                  />
                </div>

                <div className="form-group">
                  <label>Tax PIN</label>
                  <input
                    type="text"
                    name="tax_pin"
                    value={formData.tax_pin}
                    onChange={handleInputChange}
                    placeholder="KRA Tax PIN"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Address</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Company address"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="Phone number"
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Email address"
                  />
                </div>
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
                <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingCompany ? 'Update' : 'Create'} Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Companies
