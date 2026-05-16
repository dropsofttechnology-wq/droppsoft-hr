import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useCompany } from '../contexts/CompanyContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { getCompanies, createCompany, updateCompany, deleteCompany } from '../services/companyService'
import { uploadCompanyLogo, getFileIdFromUrl, deleteCompanyLogo } from '../services/storageService'
import { getCompanySettings, saveCompanySettingsBulk } from '../utils/settingsHelper'
import { dispatchCompanySettingsUpdated } from '../utils/companySettingsEvents'
import './Companies.css'

const PDF_SETTING_KEYS = [
  'pdf_letterhead_logo_enabled',
  'pdf_watermark_opacity',
  'pdf_payslip_watermark_opacity'
]

const defaultPdfAppearance = () => ({
  pdf_letterhead_logo_enabled: true,
  pdf_watermark_opacity: '0.52',
  pdf_payslip_watermark_opacity: ''
})

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
    status: 'active',
    logo_url: ''
  })
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [pdfAppearance, setPdfAppearance] = useState(defaultPdfAppearance)

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

  const handlePdfAppearanceChange = (e) => {
    const { name, value, type, checked } = e.target
    setPdfAppearance((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Logo file size must be less than 5MB')
        return
      }
      setLogoFile(file)
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      let companyData = { ...formData }
      
      // Upload logo if a new file was selected
      if (logoFile) {
        setUploadingLogo(true)
        try {
          // If editing and has existing logo, delete old one
          if (editingCompany?.logo_url) {
            const oldFileId = getFileIdFromUrl(editingCompany.logo_url)
            if (oldFileId) {
              await deleteCompanyLogo(oldFileId)
            }
          }
          
          // Upload new logo (optional - will be null if bucket doesn't exist)
          const companyId = editingCompany?.$id || 'temp'
          const logoUrl = await uploadCompanyLogo(logoFile, companyId)
          if (logoUrl) {
            companyData.logo_url = logoUrl
          } else {
            // Logo upload failed (bucket not found) - continue without logo
            // Show user-friendly message
            setSuccess('Company saved successfully. Note: Logo upload skipped - storage bucket not configured. See CREATE_STORAGE_BUCKET_STEP_BY_STEP.md for setup instructions.')
            // Don't set logo_url, keep existing or empty
            if (!editingCompany?.logo_url) {
              companyData.logo_url = ''
            }
          }
        } catch (logoError) {
          // Logo upload is optional - continue without logo
          console.warn('Logo upload failed:', logoError.message)
          if (!editingCompany?.logo_url) {
            companyData.logo_url = ''
          }
        } finally {
          setUploadingLogo(false)
        }
      }
      
      if (editingCompany) {
        await updateCompany(editingCompany.$id, companyData)
        await saveCompanySettingsBulk(editingCompany.$id, {
          pdf_letterhead_logo_enabled: pdfAppearance.pdf_letterhead_logo_enabled,
          pdf_watermark_opacity: pdfAppearance.pdf_watermark_opacity,
          pdf_payslip_watermark_opacity: String(pdfAppearance.pdf_payslip_watermark_opacity || '').trim()
        })
        dispatchCompanySettingsUpdated(editingCompany.$id)
        setSuccess('Company updated successfully')
      } else {
        const newCompany = await createCompany(companyData)
        // If logo was uploaded with temp ID, re-upload with actual company ID
        if (logoFile && companyData.logo_url) {
          try {
            const actualLogoUrl = await uploadCompanyLogo(logoFile, newCompany.$id)
            if (actualLogoUrl) {
              await updateCompany(newCompany.$id, { logo_url: actualLogoUrl })
            }
          } catch (err) {
            console.warn('Failed to update logo with company ID:', err)
          }
        }
        setSuccess('Company created successfully' + (logoFile && !companyData.logo_url ? ' (Logo upload skipped - storage bucket not configured)' : ''))
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
      status: company.status || 'active',
      logo_url: company.logo_url || ''
    })
    setLogoFile(null)
    setLogoPreview(company.logo_url || null)
    setPdfAppearance(defaultPdfAppearance())
    setShowModal(true)
    getCompanySettings(company.$id, PDF_SETTING_KEYS)
      .then((loaded) => {
        const lh =
          loaded.pdf_letterhead_logo_enabled === false || loaded.pdf_letterhead_logo_enabled === 'false'
            ? false
            : true
        setPdfAppearance({
          pdf_letterhead_logo_enabled: lh,
          pdf_watermark_opacity:
            loaded.pdf_watermark_opacity != null && String(loaded.pdf_watermark_opacity).trim() !== ''
              ? String(loaded.pdf_watermark_opacity)
              : '0.52',
          pdf_payslip_watermark_opacity:
            loaded.pdf_payslip_watermark_opacity != null &&
            String(loaded.pdf_payslip_watermark_opacity).trim() !== ''
              ? String(loaded.pdf_payslip_watermark_opacity)
              : ''
        })
      })
      .catch(() => {
        /* keep defaults */
      })
  }

  const handleDelete = (companyId) => setConfirmDelete(companyId)

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return
    try {
      setDeleting(true)
      await deleteCompany(confirmDelete)
      if (currentCompany?.$id === confirmDelete) {
        selectCompany(null)
        localStorage.removeItem('currentCompanyId')
      }
      setConfirmDelete(null)
      toast.success('Company deleted successfully')
      await loadCompanies()
    } catch (error) {
      toast.error(error.message || 'Failed to delete company')
    } finally {
      setDeleting(false)
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
      status: 'active',
      logo_url: ''
    })
    setLogoFile(null)
    setLogoPreview(null)
    setPdfAppearance(defaultPdfAppearance())
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
          onClick={() => {
            setEditingCompany(null)
            setFormData({
              name: '',
              registration_number: '',
              tax_pin: '',
              address: '',
              phone: '',
              email: '',
              status: 'active',
              logo_url: ''
            })
            setLogoFile(null)
            setLogoPreview(null)
            setPdfAppearance(defaultPdfAppearance())
            setShowModal(true)
          }}
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
                <label>Company Logo</label>
                <div className="logo-upload-section">
                  {logoPreview && (
                    <div className="logo-preview">
                      <img src={logoPreview} alt="Logo preview" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    disabled={uploadingLogo}
                    className="logo-input"
                  />
                  <small>Recommended: PNG or JPG, max 5MB, square format works best</small>
                </div>
              </div>

              <div className={`companies-pdf-section ${!editingCompany ? 'companies-pdf-section-disabled' : ''}`}>
                <h3 className="companies-pdf-title">PDF watermark &amp; letterhead</h3>
                <p className="companies-pdf-hint">
                  A diagonal watermark is shown on every PDF export for this company. Adjust strength below; use higher
                  values on payslips so the stamp stays readable on small grids.
                  {!editingCompany && (
                    <strong> Save the company first, then edit it to configure these options.</strong>
                  )}
                </p>
                <fieldset className="companies-pdf-fieldset" disabled={!editingCompany}>
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        name="pdf_letterhead_logo_enabled"
                        checked={pdfAppearance.pdf_letterhead_logo_enabled}
                        onChange={handlePdfAppearanceChange}
                      />
                      Show company logo in PDF letterhead
                    </label>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Watermark strength — reports &amp; payroll list (0.15–1.25)</label>
                      <input
                        type="number"
                        name="pdf_watermark_opacity"
                        value={pdfAppearance.pdf_watermark_opacity}
                        onChange={handlePdfAppearanceChange}
                        min="0.15"
                        max="1.25"
                        step="0.01"
                      />
                    </div>
                    <div className="form-group">
                      <label>Payslip watermark strength (0.15–1.25)</label>
                      <input
                        type="number"
                        name="pdf_payslip_watermark_opacity"
                        value={pdfAppearance.pdf_payslip_watermark_opacity}
                        onChange={handlePdfAppearanceChange}
                        min="0.15"
                        max="1.25"
                        step="0.01"
                        placeholder="Auto"
                      />
                    </div>
                  </div>
                  <small className="companies-pdf-footnote">
                    Leave payslip strength empty for automatic visibility based on the general strength (recommended).
                    Try <strong>0.85–1.05</strong> if individual payslips still look faint.
                  </small>
                </fieldset>
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
                <button type="submit" className="btn-primary" disabled={uploadingLogo}>
                  {uploadingLogo ? 'Uploading...' : (editingCompany ? 'Update' : 'Create')} Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete company"
        message="Are you sure you want to delete this company? This action cannot be undone."
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

export default Companies
