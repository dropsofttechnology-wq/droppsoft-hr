import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useLocation } from 'react-router-dom'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import {
  getLeaveRequests,
  getLeaveTypes,
  approveLeaveRequest,
  rejectLeaveRequest,
  deactivateLeaveRequest,
  deleteLeaveRequest,
  deleteDuplicateApprovedLeave,
  updateLeaveRequest
} from '../services/leaveService'
import { getEmployees } from '../services/employeeService'
import EmployeePicker from '../components/EmployeePicker'
import { logAudit } from '../services/auditService'
import ConfirmDialog from '../components/ConfirmDialog'
import { addDays, format, parseISO } from 'date-fns'
import {
  BALANCE_DEDUCTION,
  getDefaultBalanceDeduction,
  normalizeBalanceDeductionInput
} from '../utils/leaveBalanceDeduction'
import { isLocalDataSource } from '../config/dataSource'
import { openPrintableForm, buildLeaveApprovalPrintHtml } from '../utils/printRequestForms'
import { hasPermission } from '../utils/permissions'
import './LeaveManagement.css'

const LeaveManagement = () => {
  const { currentCompany } = useCompany()
  const { user } = useAuth()
  const location = useLocation()
  const canApproveLeave = hasPermission(user, 'leave_request_approval')
  const canManageLeave = hasPermission(user, 'leave_request_management')
  const canDeactivateLeave = hasPermission(user, 'leave_request_deactivate')
  const [leaveRequests, setLeaveRequests] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: 'pending',
    period: ''
  })
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [confirmApprove, setConfirmApprove] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmDeactivateLeave, setConfirmDeactivateLeave] = useState(null)
  const [confirmDedup, setConfirmDedup] = useState(false)
  const [deduping, setDeduping] = useState(false)
  const [selectedToDelete, setSelectedToDelete] = useState(new Set())
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false)
  const [tableSearch, setTableSearch] = useState('')
  const [leaveTypes, setLeaveTypes] = useState([])
  const [editModal, setEditModal] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [formNotesModal, setFormNotesModal] = useState(null)
  const [savingFormNotes, setSavingFormNotes] = useState(false)
  const [highlightedRequestId, setHighlightedRequestId] = useState('')
  const [lastJumpToastId, setLastJumpToastId] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const requestId = String(params.get('request_id') || '').trim()
    const statusParam = String(params.get('status') || '').trim().toLowerCase()
    if (requestId) {
      setTableSearch(requestId)
      setHighlightedRequestId(requestId)
      window.setTimeout(() => setHighlightedRequestId(''), 5000)
    }
    if (['all', 'pending', 'approved', 'rejected', 'inactive'].includes(statusParam)) {
      setFilters((prev) => ({ ...prev, status: statusParam }))
    }
  }, [location.search])

  useEffect(() => {
    if (currentCompany) {
      loadLeaveRequests()
      loadEmployees()
      loadLeaveTypes()
    }
  }, [currentCompany, filters])

  const loadLeaveRequests = async () => {
    if (!currentCompany) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const filterParams = {
        status: filters.status !== 'all' ? filters.status : undefined,
        start_date: filters.period ? `${filters.period}-01` : undefined,
        end_date: filters.period ? `${filters.period}-31` : undefined
      }
      
      const data = await getLeaveRequests(currentCompany.$id, filterParams)
      setLeaveRequests(data)
      setSelectedToDelete(new Set())

      // Calculate stats
      const pending = data.filter(r => r.status === 'pending').length
      const approved = data.filter(r => r.status === 'approved').length
      const rejected = data.filter(r => r.status === 'rejected').length
      setStats({ pending, approved, rejected })
    } catch (error) {
      setError('Failed to load leave requests')
    } finally {
      setLoading(false)
    }
  }

  const loadEmployees = async () => {
    if (!currentCompany) return

    try {
      const data = await getEmployees(currentCompany.$id, { status: 'active' })
      setEmployees(data)
    } catch (error) {
      console.error('Error loading employees:', error)
    }
  }

  const getEmployeeName = (employeeId) => {
    const employee = employees.find(emp => emp.$id === employeeId)
    return employee ? employee.name : 'Unknown Employee'
  }

  const getEmployeeDetails = (employeeId) => {
    const employee = employees.find(emp => emp.$id === employeeId)
    return employee || null
  }

  const filteredRequests = useMemo(() => {
    const q = tableSearch.trim().toLowerCase()
    if (!q) return leaveRequests
    return leaveRequests.filter((r) => {
      const employee = employees.find((emp) => emp.$id === r.employee_id)
      const name = (employee?.name || 'Unknown Employee').toLowerCase()
      const lt = String(r.leave_type || '').toLowerCase()
      const reason = String(r.reason || '').toLowerCase()
      return name.includes(q) || lt.includes(q) || reason.includes(q)
    })
  }, [leaveRequests, tableSearch, employees])

  useEffect(() => {
    if (!highlightedRequestId) return
    const rowEl = document.getElementById(`leave-row-${highlightedRequestId}`)
    if (!rowEl) return
    window.setTimeout(() => {
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      if (lastJumpToastId !== highlightedRequestId) {
        toast.success(`Jumped to leave request ${highlightedRequestId}`)
        setLastJumpToastId(highlightedRequestId)
      }
    }, 120)
  }, [highlightedRequestId, filteredRequests, lastJumpToastId])

  const loadLeaveTypes = async () => {
    if (!currentCompany) return
    try {
      const data = await getLeaveTypes(currentCompany.$id, true)
      setLeaveTypes(data)
    } catch (e) {
      console.error('Error loading leave types:', e)
    }
  }

  const openEditModal = (request) => {
    const lt = String(request.leave_type || '').toUpperCase()
    setEditModal({
      id: request.$id,
      employee_id: request.employee_id,
      leave_type: lt,
      balance_deduction: normalizeBalanceDeductionInput(request.balance_deduction, lt),
      start_date: String(request.start_date || '').slice(0, 10),
      end_date: String(request.end_date || '').slice(0, 10),
      reason: request.reason || '',
      admin_form_notes: request.admin_form_notes || ''
    })
  }

  const saveFormNotesModal = async () => {
    if (!formNotesModal || !currentCompany) return
    setSavingFormNotes(true)
    try {
      await updateLeaveRequest(formNotesModal.id, { admin_form_notes: formNotesModal.text })
      toast.success('Print form notes saved')
      setFormNotesModal(null)
      await loadLeaveRequests()
    } catch (e) {
      toast.error(e.message || 'Failed to save notes')
    } finally {
      setSavingFormNotes(false)
    }
  }

  const saveEditModal = async () => {
    if (!editModal || !currentCompany) return
    setSavingEdit(true)
    try {
      const lt = String(editModal.leave_type || '').toUpperCase()
      await updateLeaveRequest(editModal.id, {
        employee_id: editModal.employee_id,
        leave_type: lt,
        balance_deduction: normalizeBalanceDeductionInput(editModal.balance_deduction, lt),
        start_date: editModal.start_date,
        end_date: editModal.end_date,
        reason: editModal.reason,
        admin_form_notes: editModal.admin_form_notes ?? ''
      })
      await logAudit(user?.$id, currentCompany?.$id, 'leave_request_update', {
        entityType: 'leave_request',
        entityId: editModal.id
      })
      toast.success('Leave record updated')
      setEditModal(null)
      await loadLeaveRequests()
    } catch (e) {
      toast.error(e.message || 'Failed to update')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleApprove = (leaveRequestId) => setConfirmApprove(leaveRequestId)

  const handleApproveConfirm = async () => {
    if (!confirmApprove) return
    try {
      setError('')
      await approveLeaveRequest(confirmApprove, user.$id)
      await logAudit(user?.$id, currentCompany?.$id, 'leave_approved', { entityType: 'leave_request', entityId: confirmApprove })
      setConfirmApprove(null)
      toast.success('Leave request approved successfully')
      await loadLeaveRequests()
    } catch (error) {
      toast.error(error.message || 'Failed to approve leave request')
    }
  }

  const handleReject = async () => {
    if (!selectedRequest) return

    try {
      setError('')
      await rejectLeaveRequest(selectedRequest.$id, user.$id, rejectionReason)
      await logAudit(user?.$id, currentCompany?.$id, 'leave_rejected', { entityType: 'leave_request', entityId: selectedRequest.$id, details: rejectionReason })
      setShowRejectModal(false)
      setSelectedRequest(null)
      setRejectionReason('')
      toast.success('Leave request rejected successfully')
      await loadLeaveRequests()
    } catch (error) {
      toast.error(error.message || 'Failed to reject leave request')
    }
  }

  const handleDelete = (leaveRequestId) => setConfirmDelete(leaveRequestId)

  const handleDeactivateLeaveConfirm = async () => {
    if (!confirmDeactivateLeave) return
    try {
      await deactivateLeaveRequest(confirmDeactivateLeave)
      await logAudit(user?.$id, currentCompany?.$id, 'leave_request_deactivate', {
        entityType: 'leave_request',
        entityId: confirmDeactivateLeave
      })
      setConfirmDeactivateLeave(null)
      toast.success('Leave deactivated (no longer treated as approved for payroll or overlaps).')
      await loadLeaveRequests()
    } catch (error) {
      toast.error(error.message || 'Failed to deactivate')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return
    try {
      await deleteLeaveRequest(confirmDelete)
      await logAudit(user?.$id, currentCompany?.$id, 'leave_request_deleted', { entityType: 'leave_request', entityId: confirmDelete })
      setConfirmDelete(null)
      toast.success('Leave request deleted successfully')
      await loadLeaveRequests()
    } catch (error) {
      toast.error(error.message || 'Failed to delete leave request')
    }
  }

  const toggleSelectToDelete = (id) => {
    setSelectedToDelete(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllToDelete = () => {
    const ids = filteredRequests.map((r) => r.$id)
    const allVisible = ids.length > 0 && ids.every((id) => selectedToDelete.has(id))
    if (allVisible) {
      setSelectedToDelete((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      })
    } else {
      setSelectedToDelete((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.add(id))
        return next
      })
    }
  }

  const handleDeleteSelectedConfirm = async () => {
    setConfirmDeleteSelected(false)
    const ids = [...selectedToDelete]
    if (!ids.length) return
    try {
      for (const id of ids) {
        await deleteLeaveRequest(id)
        await logAudit(user?.$id, currentCompany?.$id, 'leave_request_deleted', { entityType: 'leave_request', entityId: id })
      }
      setSelectedToDelete(new Set())
      toast.success(`Deleted ${ids.length} leave request(s).`)
      await loadLeaveRequests()
    } catch (err) {
      toast.error(err.message || 'Failed to delete selected')
    }
  }

  const handleDeleteDuplicates = async () => {
    if (!currentCompany) return
    setConfirmDedup(false)
    setDeduping(true)
    try {
      const { deleted } = await deleteDuplicateApprovedLeave(currentCompany.$id)
      toast.success(deleted === 0 ? 'No duplicate approved leave found.' : `Removed ${deleted} duplicate approved leave record(s).`)
      await loadLeaveRequests()
    } catch (err) {
      toast.error(err.message || 'Failed to remove duplicates')
    } finally {
      setDeduping(false)
    }
  }

  const openRejectModal = (request) => {
    setSelectedRequest(request)
    setRejectionReason('')
    setShowRejectModal(true)
  }

  const printLeaveForm = (request) => {
    const emp = getEmployeeDetails(request.employee_id)
    const approvedLabel = request.approved_at
      ? format(parseISO(request.approved_at), 'dd MMM yyyy HH:mm')
      : '—'
    const startLabel = format(parseISO(request.start_date), 'dd MMM yyyy')
    const endLabel = format(parseISO(request.end_date), 'dd MMM yyyy')
    const returnLabel = format(addDays(parseISO(request.end_date), 1), 'dd MMM yyyy')
    openPrintableForm(
      request.status === 'pending' ? 'Leave request' : 'Leave approval',
      buildLeaveApprovalPrintHtml({
        companyName: currentCompany?.name,
        employeeName: getEmployeeName(request.employee_id),
        staffNo: emp?.employee_id || emp?.staff_no,
        department: emp?.department,
        leaveType: request.leave_type,
        leaveTypeCode: request.leave_type,
        startDate: startLabel,
        endDate: endLabel,
        returnToWorkDate: returnLabel,
        daysRequested: request.days_requested,
        reason: request.reason,
        approvedAt: approvedLabel,
        approverName: request.approver_name,
        systemStatus: request.status,
        requestRef: request.$id,
        adminFormNotes: request.admin_form_notes
      }),
      { logoUrl: currentCompany?.logo_url }
    )
  }

  if (!currentCompany) {
    return (
      <div className="leave-management-page">
        <div className="alert alert-warning">
          Please select a company first to manage leave requests.
        </div>
      </div>
    )
  }

  return (
    <div className="leave-management-page">
      <div className="page-header">
        <h1>Leave Management</h1>
        <p className="page-description">Review and approve employee leave requests</p>
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

      {/* Statistics Cards */}
      <div className="leave-stats">
        <div className="stat-card stat-pending">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <h3>Pending</h3>
            <p className="stat-value">{stats.pending}</p>
          </div>
        </div>
        <div className="stat-card stat-approved">
          <div className="stat-icon">✓</div>
          <div className="stat-content">
            <h3>Approved</h3>
            <p className="stat-value">{stats.approved}</p>
          </div>
        </div>
        <div className="stat-card stat-rejected">
          <div className="stat-icon">✕</div>
          <div className="stat-content">
            <h3>Rejected</h3>
            <p className="stat-value">{stats.rejected}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="filter-group">
          <label>Status:</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Period:</label>
          <input
            type="month"
            value={filters.period}
            onChange={(e) => setFilters(prev => ({ ...prev, period: e.target.value }))}
          />
        </div>
        <div className="filter-group">
          <label>Search table:</label>
          <input
            type="search"
            placeholder="Employee, leave type, reason…"
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
          />
        </div>
        {!canManageLeave && (
          <div className="filter-group">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirmDedup(true)}
              disabled={deduping}
            >
              {deduping ? 'Removing…' : 'Delete duplicate approved leave'}
            </button>
          </div>
        )}
        {!canManageLeave && selectedToDelete.size > 0 && (
          <div className="filter-group">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setConfirmDeleteSelected(true)}
            >
              Delete selected ({selectedToDelete.size})
            </button>
          </div>
        )}
      </div>

      {!canManageLeave && (
        <ConfirmDialog
          open={confirmDeleteSelected}
          title="Delete selected leave"
          message={`Delete ${selectedToDelete.size} selected leave request(s)? This cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={handleDeleteSelectedConfirm}
          onCancel={() => setConfirmDeleteSelected(false)}
        />
      )}
      {!canManageLeave && (
        <ConfirmDialog
          open={confirmDedup}
          title="Delete duplicate approved leave"
          message="This will find approved leave with the same employee, start date and end date, keep the oldest record and delete the rest. Continue?"
          confirmLabel="Delete duplicates"
          cancelLabel="Cancel"
          onConfirm={handleDeleteDuplicates}
          onCancel={() => setConfirmDedup(false)}
        />
      )}

      {loading ? (
        <div className="loading">Loading leave requests...</div>
      ) : leaveRequests.length === 0 ? (
        <div className="empty-state">
          <p>No leave requests found.</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="empty-state">
          <p>No rows match your search. Clear the search box to see all loaded requests.</p>
        </div>
      ) : (
        <div className="leave-requests-table-container">
          <table className="leave-requests-table">
            <thead>
              <tr>
                {!canManageLeave && (
                  <th className="th-checkbox">
                    <input
                      type="checkbox"
                      checked={
                        filteredRequests.length > 0 &&
                        filteredRequests.every((r) => selectedToDelete.has(r.$id))
                      }
                      onChange={toggleSelectAllToDelete}
                      title="Select all visible rows"
                    />
                  </th>
                )}
                <th>Employee</th>
                <th>Leave Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Balance / pay</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(request => {
                const employee = getEmployeeDetails(request.employee_id)
                const isMaker = String(request.created_by || '') === String(user?.$id || '')
                return (
                  <tr
                    key={request.$id}
                    id={`leave-row-${request.$id}`}
                    className={String(request.$id) === String(highlightedRequestId) ? 'row-highlight' : ''}
                  >
                    {!canManageLeave && (
                      <td className="td-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedToDelete.has(request.$id)}
                          onChange={() => toggleSelectToDelete(request.$id)}
                          title="Select to delete"
                        />
                      </td>
                    )}
                    <td>
                      <strong>{getEmployeeName(request.employee_id)}</strong>
                      {employee && (
                        <div className="employee-meta">
                          {employee.department && <span>{employee.department}</span>}
                          {employee.position && <span> • {employee.position}</span>}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="leave-type-badge">
                        {request.leave_type}
                      </span>
                    </td>
                    <td>{format(parseISO(request.start_date), 'dd MMM yyyy')}</td>
                    <td>{format(parseISO(request.end_date), 'dd MMM yyyy')}</td>
                    <td><strong>{request.days_requested}</strong></td>
                    <td>
                      <div className="reason-preview" title={request.reason}>
                        {request.reason ? (request.reason.length > 50 ? request.reason.substring(0, 50) + '...' : request.reason) : '-'}
                      </div>
                    </td>
                    <td className="deduction-cell">
                      {['ANNUAL', 'UNPAID'].includes(String(request.leave_type || '').toUpperCase())
                        ? normalizeBalanceDeductionInput(request.balance_deduction, request.leave_type) ===
                          BALANCE_DEDUCTION.ANNUAL_BALANCE
                          ? 'Annual balance'
                          : 'Salary'
                        : '—'}
                    </td>
                    <td>
                      <span className={`badge badge-${request.status}`}>
                        {request.status}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        {!canManageLeave && request.status !== 'inactive' && (
                          <button
                            type="button"
                            className="action-btn action-btn-edit"
                            onClick={() => openEditModal(request)}
                          >
                            Edit
                          </button>
                        )}
                        {!canManageLeave && request.status !== 'inactive' && (
                          <button
                            type="button"
                            className="action-btn action-btn-notes"
                            onClick={() =>
                              setFormNotesModal({
                                id: request.$id,
                                text: request.admin_form_notes || ''
                              })
                            }
                          >
                            Form notes
                          </button>
                        )}
                        {request.status === 'pending' && canApproveLeave && (
                          <>
                            <button
                              className="action-btn action-btn-approve"
                              disabled={isMaker}
                              title={isMaker ? 'Maker-checker: you cannot approve your own request' : ''}
                              onClick={() => handleApprove(request.$id)}
                            >
                              Approve
                            </button>
                            <button
                              className="action-btn action-btn-reject"
                              disabled={isMaker}
                              title={isMaker ? 'Maker-checker: you cannot reject your own request' : ''}
                              onClick={() => openRejectModal(request)}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="action-btn action-btn-print"
                          onClick={() => printLeaveForm(request)}
                        >
                          Print form
                        </button>
                        {request.status === 'approved' && canDeactivateLeave && isLocalDataSource() && (
                          <button
                            type="button"
                            className="action-btn action-btn-deactivate"
                            onClick={() => setConfirmDeactivateLeave(request.$id)}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmApprove}
        title="Approve leave request"
        message="Are you sure you want to approve this leave request?"
        confirmLabel="Approve"
        cancelLabel="Cancel"
        onConfirm={handleApproveConfirm}
        onCancel={() => setConfirmApprove(null)}
      />
      <ConfirmDialog
        open={!!confirmDeactivateLeave}
        title="Deactivate approved leave"
        message="Mark this approved leave as inactive? It will no longer count for payroll or block overlapping requests."
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        danger
        onConfirm={handleDeactivateLeaveConfirm}
        onCancel={() => setConfirmDeactivateLeave(null)}
      />
      {!canManageLeave && (
        <ConfirmDialog
          open={!!confirmDelete}
          title="Delete leave request"
          message="Are you sure you want to delete this leave request? This cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          danger
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reject Leave Request</h2>
              <button className="modal-close" onClick={() => setShowRejectModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <p>Are you sure you want to reject this leave request?</p>
              <div className="request-details">
                <p><strong>Employee:</strong> {getEmployeeName(selectedRequest.employee_id)}</p>
                <p><strong>Leave Type:</strong> {selectedRequest.leave_type}</p>
                <p><strong>Period:</strong> {format(parseISO(selectedRequest.start_date), 'dd MMM yyyy')} - {format(parseISO(selectedRequest.end_date), 'dd MMM yyyy')}</p>
                <p><strong>Days:</strong> {selectedRequest.days_requested}</p>
              </div>

              <div className="form-group">
                <label>Rejection Reason (Optional)</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows="3"
                  placeholder="Enter reason for rejection..."
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowRejectModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={handleReject}
              >
                Reject Leave Request
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="modal-overlay" onClick={() => !savingEdit && setEditModal(null)}>
          <div className="modal-content modal-content-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit leave</h2>
              <button type="button" className="modal-close" onClick={() => setEditModal(null)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="form-hint muted">
                You can correct approved or pending leave. Overlaps with other pending or approved leave for the same employee are blocked.
              </p>
              <div className="form-group">
                <label>Employee</label>
                <EmployeePicker
                  employees={employees}
                  value={editModal.employee_id}
                  onChange={(e) => setEditModal((m) => ({ ...m, employee_id: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Leave type</label>
                {leaveTypes.length > 0 ? (
                  <select
                    value={editModal.leave_type}
                    onChange={(e) => {
                      const v = e.target.value
                      setEditModal((m) => ({
                        ...m,
                        leave_type: v,
                        balance_deduction: getDefaultBalanceDeduction(v)
                      }))
                    }}
                  >
                    <option value="">Select type</option>
                    {leaveTypes.map((lt) => {
                      const code = (lt.leave_code || '').toUpperCase()
                      const name = lt.leave_name || code
                      return (
                        <option key={lt.$id || lt.id || code} value={code}>
                          {code} — {name}
                        </option>
                      )
                    })}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={editModal.leave_type}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase()
                      setEditModal((m) => ({
                        ...m,
                        leave_type: v,
                        balance_deduction: getDefaultBalanceDeduction(v)
                      }))
                    }}
                    placeholder="Leave type code (e.g. ANNUAL)"
                  />
                )}
              </div>
              {['ANNUAL', 'UNPAID'].includes(String(editModal.leave_type || '').toUpperCase()) && (
                <div className="form-group">
                  <label>Annual balance vs salary</label>
                  <select
                    value={editModal.balance_deduction}
                    onChange={(e) => setEditModal((m) => ({ ...m, balance_deduction: e.target.value }))}
                  >
                    <option value={BALANCE_DEDUCTION.ANNUAL_BALANCE}>Deduct from annual leave balance</option>
                    <option value={BALANCE_DEDUCTION.SALARY}>Deduct from salary (no annual days)</option>
                  </select>
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>Start date</label>
                  <input
                    type="date"
                    value={editModal.start_date}
                    onChange={(e) => setEditModal((m) => ({ ...m, start_date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>End date</label>
                  <input
                    type="date"
                    value={editModal.end_date}
                    onChange={(e) => setEditModal((m) => ({ ...m, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Reason</label>
                <textarea
                  rows={3}
                  value={editModal.reason}
                  onChange={(e) => setEditModal((m) => ({ ...m, reason: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Administrator notes (shown on printed leave form)</label>
                <textarea
                  rows={3}
                  value={editModal.admin_form_notes ?? ''}
                  onChange={(e) => setEditModal((m) => ({ ...m, admin_form_notes: e.target.value }))}
                  placeholder="Optional — appears in the print preview/PDF-style form for signatures"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" disabled={savingEdit} onClick={() => setEditModal(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={savingEdit} onClick={saveEditModal}>
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {formNotesModal && (
        <div className="modal-overlay" onClick={() => !savingFormNotes && setFormNotesModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Administrator notes (printed form)</h2>
              <button type="button" className="modal-close" onClick={() => setFormNotesModal(null)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="form-hint muted">
                These notes are shown on the printable leave form for this request (not the employee&apos;s leave reason).
              </p>
              <textarea
                rows={6}
                className="form-textarea-full"
                value={formNotesModal.text}
                onChange={(e) => setFormNotesModal((m) => ({ ...m, text: e.target.value }))}
                placeholder="e.g. Internal reference, filing instructions, conditions…"
              />
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                disabled={savingFormNotes}
                onClick={() => setFormNotesModal(null)}
              >
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={savingFormNotes} onClick={saveFormNotesModal}>
                {savingFormNotes ? 'Saving…' : 'Save notes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeaveManagement
