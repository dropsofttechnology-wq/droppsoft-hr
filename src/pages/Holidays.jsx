import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useCompany } from '../contexts/CompanyContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { getHolidays, createHoliday, updateHoliday, deleteHoliday } from '../services/holidayService'
import { format, parseISO, startOfYear, endOfYear } from 'date-fns'
import './Holidays.css'

const Holidays = () => {
  const { currentCompany } = useCompany()
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [formData, setFormData] = useState({
    holiday_date: '',
    holiday_name: '',
    rate_type: 'normal', // 'normal' = 100% of day-pay (Basic+HSE/30), 'custom' = use rate % of day-pay
    rate: '100',
    reporting_time: '',
    closing_time: '',
    status: 'active'
  })

  useEffect(() => {
    if (currentCompany) {
      loadHolidays()
    }
  }, [currentCompany, selectedYear])

  const loadHolidays = async () => {
    if (!currentCompany) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await getHolidays(currentCompany.$id, { year: selectedYear })
      setHolidays(data)
    } catch (error) {
      setError('Failed to load holidays')
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

  const parseCustomPercent = (raw) => {
    const t = String(raw ?? '')
      .trim()
      .replace(/,/g, '.')
    if (t === '') return NaN
    return Number(t)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!currentCompany) {
      setError('Please select a company first')
      return
    }

    if (!formData.holiday_date || !formData.holiday_name) {
      setError('Holiday date and name are required')
      return
    }

    let ratePayload = formData.rate_type === 'normal' ? 100 : parseCustomPercent(formData.rate)
    if (formData.rate_type === 'custom') {
      if (!Number.isFinite(ratePayload) || ratePayload < 0) {
        setError('Enter a valid percentage (any number of decimal places).')
        return
      }
    }

    try {
      if (editingHoliday) {
        await updateHoliday(editingHoliday.$id, {
          ...formData,
          rate: ratePayload,
          company_id: currentCompany.$id
        })
        setSuccess('Holiday updated successfully')
      } else {
        await createHoliday({
          ...formData,
          rate: ratePayload,
          company_id: currentCompany.$id
        })
        setSuccess('Holiday created successfully')
      }
      
      await loadHolidays()
      handleCloseModal()
    } catch (error) {
      setError(error.message || 'Failed to save holiday')
    }
  }

  const handleEdit = (holiday) => {
    setEditingHoliday(holiday)
    setFormData({
      holiday_date: holiday.holiday_date,
      holiday_name: holiday.holiday_name,
      rate_type: holiday.rate_type || 'normal',
      rate: holiday.rate != null ? String(holiday.rate) : '100',
      reporting_time: holiday.reporting_time || '',
      closing_time: holiday.closing_time || '',
      status: holiday.status || 'active'
    })
    setShowModal(true)
  }

  const handleDelete = (holidayId) => setConfirmDelete(holidayId)

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return
    try {
      setDeleting(true)
      await deleteHoliday(confirmDelete)
      setConfirmDelete(null)
      toast.success('Holiday deleted successfully')
      await loadHolidays()
    } catch (error) {
      toast.error(error.message || 'Failed to delete holiday')
    } finally {
      setDeleting(false)
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingHoliday(null)
    setFormData({
      holiday_date: '',
      holiday_name: '',
      rate_type: 'normal',
      rate: '100',
      reporting_time: '',
      closing_time: '',
      status: 'active'
    })
    setError('')
    setSuccess('')
  }

  const years = []
  const currentYear = new Date().getFullYear()
  for (let y = currentYear - 2; y <= currentYear + 2; y++) {
    years.push(y)
  }

  if (!currentCompany) {
    return (
      <div className="holidays-page">
        <div className="alert alert-warning">
          Please select a company first to manage holidays.
        </div>
      </div>
    )
  }

  return (
    <div className="holidays-page">
      <div className="page-header">
        <h1>Holiday Management</h1>
        <button 
          className="btn-primary"
          onClick={() => setShowModal(true)}
        >
          + Add Holiday
        </button>
      </div>

      <p className="page-description">
        Manage holidays and set holiday pay rates. Employees who work on holidays will receive holiday pay based on the rate set for each holiday.
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

      <div className="filters">
        <div className="filter-group">
          <label>Filter by Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading holidays...</div>
      ) : holidays.length === 0 ? (
        <div className="empty-state">
          <p>No holidays found for {selectedYear}. Add your first holiday to get started.</p>
        </div>
      ) : (
        <div className="holidays-table-container">
          <table className="holidays-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Holiday Name</th>
                <th>Rate (%)</th>
                <th>Reporting Time</th>
                <th>Closing Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map(holiday => (
                <tr key={holiday.$id}>
                  <td>{format(parseISO(holiday.holiday_date), 'dd MMM yyyy')}</td>
                  <td><strong>{holiday.holiday_name}</strong></td>
                  <td>
                  {holiday.rate_type === 'custom'
                    ? `${holiday.rate != null ? String(holiday.rate) : '—'}%`
                    : 'Normal (100%)'}
                </td>
                  <td>{holiday.reporting_time || '-'}</td>
                  <td>{holiday.closing_time || '-'}</td>
                  <td>
                    <span className={`badge badge-${holiday.status}`}>
                      {holiday.status}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn-link"
                        onClick={() => handleEdit(holiday)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-link btn-danger-link"
                        onClick={() => handleDelete(holiday.$id)}
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
              <h2>{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</h2>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="holiday-form">
              <div className="form-group">
                <label>Holiday Date <span className="required">*</span></label>
                <input
                  type="date"
                  name="holiday_date"
                  value={formData.holiday_date}
                  onChange={handleInputChange}
                  required
                />
                <p className="form-description">Select the date of the holiday</p>
              </div>

              <div className="form-group">
                <label>Holiday Name <span className="required">*</span></label>
                <input
                  type="text"
                  name="holiday_name"
                  value={formData.holiday_name}
                  onChange={handleInputChange}
                  placeholder="e.g., Christmas Day, New Year's Day"
                  required
                />
                <p className="form-description">Enter the name of the holiday</p>
              </div>

              <div className="form-group">
                <label>Holiday pay rate</label>
                <div className="form-options" style={{ marginBottom: 8 }}>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="rate_type"
                      value="normal"
                      checked={formData.rate_type === 'normal'}
                      onChange={handleInputChange}
                    />
                    <span>Normal daily rate (100%)</span>
                  </label>
                  <p className="form-description" style={{ marginLeft: 24, marginTop: 4 }}>
                    Use 1 day’s pay = (Basic + HSE) ÷ 30 per holiday day worked
                  </p>
                  <label className="radio-label" style={{ display: 'block', marginTop: 12 }}>
                    <input
                      type="radio"
                      name="rate_type"
                      value="custom"
                      checked={formData.rate_type === 'custom'}
                      onChange={handleInputChange}
                    />
                    <span>Custom % of daily rate</span>
                  </label>
                </div>
                {formData.rate_type === 'custom' && (
                  <>
                    <input
                      type="text"
                      name="rate"
                      value={formData.rate}
                      onChange={handleInputChange}
                      inputMode="decimal"
                      placeholder="e.g. 150 or 137.5625"
                      autoComplete="off"
                      style={{ maxWidth: 220 }}
                    />
                    <p className="form-description">
                      Percentage of one day’s pay — any precision (e.g. 150 or 137.5625).
                    </p>
                  </>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Reporting Time</label>
                  <input
                    type="time"
                    name="reporting_time"
                    value={formData.reporting_time}
                    onChange={handleInputChange}
                  />
                  <p className="form-description">Expected clock-in time (optional)</p>
                </div>

                <div className="form-group">
                  <label>Closing Time</label>
                  <input
                    type="time"
                    name="closing_time"
                    value={formData.closing_time}
                    onChange={handleInputChange}
                  />
                  <p className="form-description">Expected clock-out time (optional)</p>
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
                <p className="form-description">Inactive holidays will not be included in payroll calculations</p>
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
                  {editingHoliday ? 'Update' : 'Create'} Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete holiday"
        message="Are you sure you want to delete this holiday?"
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

export default Holidays
