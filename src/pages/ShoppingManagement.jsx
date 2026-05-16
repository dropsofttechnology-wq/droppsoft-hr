import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useLocation } from 'react-router-dom'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import {
  getShoppingRequests,
  approveShoppingRequest,
  deleteShoppingRequest,
  updateShoppingRequest,
  deactivateShoppingRequest
} from '../services/shoppingService'
import { getEmployees } from '../services/employeeService'
import { isLocalDataSource } from '../config/dataSource'
import { addMonths, format, parseISO } from 'date-fns'
import ConfirmDialog from '../components/ConfirmDialog'
import { openPrintableForm, buildSalaryAdvancePrintHtml } from '../utils/printRequestForms'
import {
  installmentPlanMatchesTotal,
  parseInstallmentPlan,
  splitMoneyIntoInstallments
} from '../utils/moneySplit'
import { hasPermission } from '../utils/permissions'
import './ShoppingManagement.css'

function parseInstallmentsHint(text) {
  const m = String(text || '').match(/(\d+)/)
  return m ? Math.min(60, Math.max(1, parseInt(m[1], 10))) : 1
}

function periodAt(startYYYYMM, index) {
  return format(addMonths(parseISO(`${startYYYYMM}-01`), index), 'yyyy-MM')
}

const ShoppingManagement = () => {
  const { currentCompany } = useCompany()
  const { user } = useAuth()
  const location = useLocation()
  const canApproveShopping = hasPermission(user, 'salary_shopping_approval')
  const canManageShopping = hasPermission(user, 'salary_shopping_management')
  const isSuperAdmin = (user?.prefs?.role || '').toLowerCase() === 'super_admin'
  const [rows, setRows] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('pending')
  const [period, setPeriod] = useState('')
  const [confirmReject, setConfirmReject] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState(null)
  const [approveModal, setApproveModal] = useState(null)
  const [approveLoading, setApproveLoading] = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [formNotesModal, setFormNotesModal] = useState(null)
  const [savingFormNotes, setSavingFormNotes] = useState(false)
  const [requestSearch, setRequestSearch] = useState('')
  const [highlightedRequestId, setHighlightedRequestId] = useState('')
  const [lastJumpToastId, setLastJumpToastId] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const requestId = String(params.get('request_id') || '').trim()
    const statusParam = String(params.get('status') || '').trim().toLowerCase()
    const periodParam = String(params.get('period') || '').trim()
    if (requestId) {
      setRequestSearch(requestId)
      setHighlightedRequestId(requestId)
      window.setTimeout(() => setHighlightedRequestId(''), 5000)
    }
    if (['all', 'pending', 'approved', 'rejected', 'voided'].includes(statusParam)) {
      setStatus(statusParam)
    }
    if (/^\d{4}-\d{2}$/.test(periodParam)) {
      setPeriod(periodParam)
    }
  }, [location.search])

  useEffect(() => {
    if (currentCompany && isLocalDataSource()) {
      load()
      loadEmployees()
    }
  }, [currentCompany, status])

  const loadEmployees = async () => {
    if (!currentCompany) return
    try {
      const data = await getEmployees(currentCompany.$id, { status: 'active' })
      setEmployees(data)
    } catch (e) {
      console.error(e)
    }
  }

  const load = async () => {
    if (!currentCompany) return
    try {
      setLoading(true)
      const data = await getShoppingRequests(currentCompany.$id, {
        status: status === 'all' ? undefined : status
      })
      setRows(data)
    } catch (e) {
      toast.error(e.message || 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }

  const empName = (id) => employees.find((e) => e.$id === id)?.name || 'â€”'
  const empDetails = (id) => employees.find((e) => e.$id === id)
  const filteredRows = useMemo(() => {
    const q = requestSearch.trim().toLowerCase()
    return rows.filter((r) => {
      const periodMatch =
        !period ||
        String(r.application_date || '').slice(0, 7) === period ||
        String(r.for_period || '').slice(0, 7) === period
      if (!periodMatch) return false
      if (!q) return true
      const employee = String(empName(r.employee_id) || '').toLowerCase()
      return (
        String(r.$id || '').toLowerCase().includes(q) ||
        String(r.reason || '').toLowerCase().includes(q) ||
        String(r.status || '').toLowerCase().includes(q) ||
        employee.includes(q)
      )
    })
  }, [rows, requestSearch, period])

  useEffect(() => {
    if (!highlightedRequestId) return
    const rowEl = document.getElementById(`shopping-row-${highlightedRequestId}`)
    if (!rowEl) return
    window.setTimeout(() => {
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      if (lastJumpToastId !== highlightedRequestId) {
        toast.success(`Jumped to shopping request ${highlightedRequestId}`)
        setLastJumpToastId(highlightedRequestId)
      }
    }, 120)
  }, [highlightedRequestId, filteredRows, lastJumpToastId])
  const isBlockedByMakerChecker = (row) => {
    const me = String(user?.$id || '')
    if (!me) return false
    const requestedBy = String(row?.requested_by || '')
    if (requestedBy) return requestedBy === me
    const empUserId = String(empDetails(row?.employee_id)?.user_id || '')
    return !!empUserId && empUserId === me
  }

  const openApproveModal = (r) => {
    setApproveModal({
      id: r.$id,
      row: r,
      for_period: r.for_period || '',
      application_date: r.application_date || '',
      installment_count:
        r.installment_count != null && r.installment_count !== ''
          ? String(r.installment_count)
          : '',
      installment_plan: r.installment_plan || ''
    })
  }

  const editInstallmentPreview = useMemo(() => {
    if (!editModal?.row) return { n: 1, slices: [], start: '' }
    const r = editModal.row
    const raw = editModal.installment_count
    let n = parseInt(String(raw || ''), 10)
    if (!Number.isFinite(n) || n < 1) {
      if (r.installment_count != null && Number(r.installment_count) >= 1) {
        n = Math.min(60, Number(r.installment_count))
      } else {
        n = parseInstallmentsHint(r.repayment_period)
      }
    } else {
      n = Math.min(60, Math.max(1, n))
    }
    const amt = Number(editModal.amount) || Number(r.amount) || 0
    const customPlan = parseInstallmentPlan(editModal.installment_plan)
    const slices = customPlan.length ? customPlan : splitMoneyIntoInstallments(amt, n)
    let start = editModal.for_period?.trim() || r.for_period || ''
    if (!start && editModal.application_date) {
      start = String(editModal.application_date).slice(0, 7)
    }
    if (!start && r.application_date) {
      start = String(r.application_date).slice(0, 7)
    }
    if (!start) start = format(new Date(), 'yyyy-MM')
    return {
      n: slices.length || n,
      slices,
      start,
      hasCustomPlan: customPlan.length > 0,
      customPlanTotalValid: customPlan.length ? installmentPlanMatchesTotal(customPlan, amt) : true
    }
  }, [editModal])

  const installmentPreview = useMemo(() => {
    if (!approveModal?.row) return { n: 1, slices: [], start: '' }
    const r = approveModal.row
    const raw = approveModal.installment_count
    let n = parseInt(String(raw || ''), 10)
    if (!Number.isFinite(n) || n < 1) {
      if (r.installment_count != null && Number(r.installment_count) >= 1) {
        n = Math.min(60, Number(r.installment_count))
      } else {
        n = parseInstallmentsHint(r.repayment_period)
      }
    } else {
      n = Math.min(60, Math.max(1, n))
    }
    const amt = Number(r.amount) || 0
    const customPlan = parseInstallmentPlan(approveModal.installment_plan)
    const slices = customPlan.length ? customPlan : splitMoneyIntoInstallments(amt, n)
    let start = approveModal.for_period?.trim() || r.for_period || ''
    if (!start && approveModal.application_date) {
      start = String(approveModal.application_date).slice(0, 7)
    }
    if (!start && r.application_date) {
      start = String(r.application_date).slice(0, 7)
    }
    if (!start) start = format(new Date(), 'yyyy-MM')
    return {
      n: slices.length || n,
      slices,
      start,
      hasCustomPlan: customPlan.length > 0,
      customPlanTotalValid: customPlan.length ? installmentPlanMatchesTotal(customPlan, amt) : true
    }
  }, [approveModal])

  const doApproveConfirm = async () => {
    if (!approveModal) return
    if (installmentPreview.hasCustomPlan && !installmentPreview.customPlanTotalValid) {
      toast.error('Custom installment amounts must add up exactly to the advance total.')
      return
    }
    setApproveLoading(true)
    try {
      const opts = {}
      if (approveModal.for_period?.trim()) opts.for_period = approveModal.for_period.trim().slice(0, 7)
      if (approveModal.application_date?.trim()) opts.application_date = approveModal.application_date.trim().slice(0, 10)
      if (approveModal.installment_count?.trim()) opts.installment_count = approveModal.installment_count.trim()
      if (approveModal.installment_plan != null) opts.installment_plan = String(approveModal.installment_plan).trim()
      await approveShoppingRequest(approveModal.id, 'approved', opts)
      toast.success('Approved â€” advance split posted to payroll deductions for each month.')
      setApproveModal(null)
      await load()
    } catch (e) {
      toast.error(e.message || 'Failed')
    } finally {
      setApproveLoading(false)
    }
  }

  const doReject = async (id) => {
    try {
      await approveShoppingRequest(id, 'rejected')
      toast.success('Rejected')
      setConfirmReject(null)
      await load()
    } catch (e) {
      toast.error(e.message || 'Failed')
    }
  }

  const openEditModal = (r) => {
    setEditModal({
      id: r.$id,
      row: r,
      amount: String(r.amount ?? ''),
      for_period: r.for_period || '',
      application_date: r.application_date || '',
      installment_count:
        r.installment_count != null && r.installment_count !== '' ? String(r.installment_count) : '',
      installment_plan: r.installment_plan || '',
      reason: r.reason || '',
      repayment_period: r.repayment_period || '',
      admin_form_notes: r.admin_form_notes || ''
    })
  }

  const saveFormNotesModal = async () => {
    if (!formNotesModal || !currentCompany) return
    setSavingFormNotes(true)
    try {
      await updateShoppingRequest(formNotesModal.id, { admin_form_notes: formNotesModal.text })
      toast.success('Print form notes saved')
      setFormNotesModal(null)
      await load()
    } catch (e) {
      toast.error(e.message || 'Failed to save notes')
    } finally {
      setSavingFormNotes(false)
    }
  }

  const saveEditModal = async () => {
    if (!editModal) return
    const amt = Number.parseFloat(String(editModal.amount).replace(/,/g, ''))
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (editInstallmentPreview.hasCustomPlan && !editInstallmentPreview.customPlanTotalValid) {
      toast.error('Custom installment amounts must add up exactly to the advance total.')
      return
    }
    setEditSaving(true)
    try {
      await updateShoppingRequest(editModal.id, {
        amount: amt,
        for_period: editModal.for_period?.trim() || undefined,
        application_date: editModal.application_date?.trim() || undefined,
        installment_count: editModal.installment_count?.trim() || undefined,
        installment_plan: editModal.installment_plan != null ? editModal.installment_plan.trim() : undefined,
        reason: editModal.reason,
        repayment_period: editModal.repayment_period,
        admin_form_notes: editModal.admin_form_notes ?? ''
      })
      toast.success(
        editModal.row.status === 'approved'
          ? 'Advance updated. Payroll deductions were adjusted when amount or instalment schedule changed.'
          : 'Request updated.'
      )
      setEditModal(null)
      await load()
    } catch (e) {
      toast.error(e.message || 'Failed')
    } finally {
      setEditSaving(false)
    }
  }

  const doDelete = async (id) => {
    try {
      await deleteShoppingRequest(id)
      toast.success('Deleted')
      setConfirmDelete(null)
      await load()
    } catch (e) {
      toast.error(e.message || 'Failed')
    }
  }

  const doDeactivate = async (id) => {
    try {
      await deactivateShoppingRequest(id)
      toast.success('Advance deactivated; payroll deductions were reversed.')
      setConfirmDeactivate(null)
      await load()
    } catch (e) {
      toast.error(e.message || 'Failed')
    }
  }

  const printForm = (req) => {
    const emp = empDetails(req.employee_id)
    const approvedLabel = req.approved_at
      ? format(parseISO(req.approved_at), 'dd MMM yyyy HH:mm')
      : 'â€”'
    openPrintableForm(
      req.status === 'pending' ? 'Shopping request' : 'Shopping approval',
      buildSalaryAdvancePrintHtml({
        documentLabel: 'Shopping deduction',
        companyName: currentCompany?.name,
        employeeName: empName(req.employee_id),
        staffNo: emp?.employee_id || emp?.staff_no,
        department: emp?.department,
        amount: req.amount,
        itemLines: req.item_lines || [],
        reason: req.reason,
        repaymentPeriod: req.repayment_period,
        forPeriod: req.for_period,
        applicationDate: req.application_date,
        installmentCount: req.installment_count,
        approvedAt: approvedLabel,
        approverName: req.approver_name,
        systemStatus: req.status,
        requestRef: req.$id,
        adminFormNotes: req.admin_form_notes
      }),
      { logoUrl: currentCompany?.logo_url }
    )
  }

  if (!isLocalDataSource()) {
    return (
      <div className="sar-mgmt-page">
        <div className="alert alert-warning">
          Shopping management is only available in the desktop (local SQLite) app.
        </div>
      </div>
    )
  }

  if (!currentCompany) {
    return (
      <div className="sar-mgmt-page">
        <div className="alert alert-warning">Please select a company first.</div>
      </div>
    )
  }

  return (
    <div className="sar-mgmt-page">
      <div className="page-header">
        <h1>Shoppings</h1>
        <p className="page-description">
          Approve requests to post advance deductions to payroll by month (same logic as payslips and reports). Set the
          first payroll month and instalment count before approving â€” e.g. an advance dated 15 March deducts from March
          payroll for the first slice, then following months for the rest.
        </p>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label>
          Status:{' '}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="voided">Voided</option>
          </select>
          </label>
        </div>
        <div className="filter-group">
          <label>
            Period:{' '}
            <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </label>
        </div>
        <div className="filter-group">
          <label>
          Search:{' '}
          <input
            type="search"
            value={requestSearch}
            onChange={(e) => setRequestSearch(e.target.value)}
            placeholder="Request ID / employee / reason"
          />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loadingâ€¦</div>
      ) : rows.length === 0 ? (
        <p className="empty-hint">No requests found.</p>
      ) : filteredRows.length === 0 ? (
        <p className="empty-hint">No rows match your search.</p>
      ) : (
        <div className="sar-table-wrap">
          <table className="sar-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>First month</th>
                <th>Applied</th>
                <th>Inst.</th>
                <th>Amount (KES)</th>
                <th>Purpose</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr
                  key={r.$id}
                  id={`shopping-row-${r.$id}`}
                  className={String(r.$id) === String(highlightedRequestId) ? 'row-highlight' : ''}
                >
                  <td>
                    <strong>{empName(r.employee_id)}</strong>
                  </td>
                  <td>{r.for_period || 'â€”'}</td>
                  <td>{r.application_date || 'â€”'}</td>
                  <td>{r.installment_count != null ? r.installment_count : 'â€”'}</td>
                  <td className="text-right">
                    {Number(r.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td>
                    <div className="cell-clip" title={r.reason}>
                      {r.reason || 'â€”'}
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${r.status}`}>{r.status}</span>
                  </td>
                  <td>
                    {r.status === 'pending' ? (
                      <div className="table-actions">
                        {!canManageShopping && (
                          <button type="button" className="action-btn action-btn-edit" onClick={() => openEditModal(r)}>
                            Edit
                          </button>
                        )}
                        {!canManageShopping && (
                          <button
                            type="button"
                            className="action-btn action-btn-notes"
                            onClick={() =>
                              setFormNotesModal({
                                id: r.$id,
                                text: r.admin_form_notes || ''
                              })
                            }
                          >
                            Form notes
                          </button>
                        )}
                        {canApproveShopping && (
                          <>
                            <button
                              type="button"
                              className="action-btn action-btn-approve"
                              onClick={() => openApproveModal(r)}
                              disabled={isBlockedByMakerChecker(r)}
                              title={
                                isBlockedByMakerChecker(r)
                                  ? 'Maker-checker: another user must approve this request.'
                                  : ''
                              }
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="action-btn action-btn-reject"
                              onClick={() => setConfirmReject(r.$id)}
                              disabled={isBlockedByMakerChecker(r)}
                              title={
                                isBlockedByMakerChecker(r)
                                  ? 'Maker-checker: another user must approve/reject this request.'
                                  : ''
                              }
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button type="button" className="action-btn action-btn-print" onClick={() => printForm(r)}>
                          Print form
                        </button>
                        {!canManageShopping && (
                          <button type="button" className="action-btn action-btn-delete" onClick={() => setConfirmDelete(r.$id)}>
                            Delete
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="table-actions">
                        {!canManageShopping && (r.status === 'approved' || r.status === 'rejected') && (
                          <button type="button" className="action-btn action-btn-edit" onClick={() => openEditModal(r)}>
                            Edit
                          </button>
                        )}
                        {!canManageShopping && (r.status === 'approved' || r.status === 'rejected') && (
                          <button
                            type="button"
                            className="action-btn action-btn-notes"
                            onClick={() =>
                              setFormNotesModal({
                                id: r.$id,
                                text: r.admin_form_notes || ''
                              })
                            }
                          >
                            Form notes
                          </button>
                        )}
                        {r.status === 'approved' && (
                          <>
                            <button type="button" className="action-btn action-btn-print" onClick={() => printForm(r)}>
                              Print form
                            </button>
                            {isSuperAdmin && (
                              <button
                                type="button"
                                className="action-btn action-btn-deactivate"
                                onClick={() => setConfirmDeactivate(r.$id)}
                              >
                                Deactivate
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editModal ? (
        <div
          className="sar-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => !editSaving && setEditModal(null)}
        >
          <div className="sar-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="sar-modal-title">
              {editModal.row.status === 'approved' ? 'Edit approved shopping' : 'Edit shopping request'}
            </h2>
            <p className="sar-modal-lead">
              {editModal.row.status === 'approved'
                ? 'Changing amount, first payroll month, application date, or instalment count updates posted payroll deductions (reversed and reapplied). Reason and repayment text can be updated without changing deductions.'
                : 'Update the request before approval.'}
            </p>
            <div className="sar-modal-fields">
              <label>
                Amount (KES)
                <input
                  type="text"
                  inputMode="decimal"
                  value={editModal.amount}
                  onChange={(e) => setEditModal((m) => ({ ...m, amount: e.target.value }))}
                />
              </label>
              <label>
                First payroll month
                <input
                  type="month"
                  max={format(new Date(), 'yyyy-MM')}
                  value={editModal.for_period}
                  onChange={(e) => setEditModal((m) => ({ ...m, for_period: e.target.value }))}
                />
              </label>
              <label>
                Date of application
                <input
                  type="date"
                  value={editModal.application_date}
                  onChange={(e) => setEditModal((m) => ({ ...m, application_date: e.target.value }))}
                />
              </label>
              <label>
                Number of monthly instalments
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={editModal.installment_count}
                  placeholder="e.g. 3"
                  onChange={(e) => setEditModal((m) => ({ ...m, installment_count: e.target.value }))}
                />
              </label>
              <label>
                Custom installment amounts
                <textarea
                  rows={2}
                  value={editModal.installment_plan}
                  placeholder="10000, 5000, 5000, 5000, 5000"
                  onChange={(e) => setEditModal((m) => ({ ...m, installment_plan: e.target.value }))}
                />
              </label>
              <label>
                Purpose / reason
                <textarea
                  rows={2}
                  value={editModal.reason}
                  onChange={(e) => setEditModal((m) => ({ ...m, reason: e.target.value }))}
                />
              </label>
              <label>
                Repayment wording
                <input
                  type="text"
                  value={editModal.repayment_period}
                  onChange={(e) => setEditModal((m) => ({ ...m, repayment_period: e.target.value }))}
                />
              </label>
              <label>
                Administrator notes (shown on printed shopping form)
                <textarea
                  rows={3}
                  value={editModal.admin_form_notes ?? ''}
                  onChange={(e) => setEditModal((m) => ({ ...m, admin_form_notes: e.target.value }))}
                  placeholder="Optional â€” appears on the printable form"
                />
              </label>
            </div>
            {editModal.row.status === 'approved' && (
              <div className="sar-modal-preview">
                <strong>Preview (after save)</strong>
                <p className="sar-modal-preview-meta">
                  Starting <code>{editInstallmentPreview.start}</code> â€” {editInstallmentPreview.n} month(s), total KES{' '}
                  {Number(editModal.amount || editModal.row.amount || 0).toLocaleString(undefined, {
                    maximumFractionDigits: 2
                  })}
                </p>
                {editInstallmentPreview.hasCustomPlan && !editInstallmentPreview.customPlanTotalValid && (
                  <p className="sar-modal-warning">Custom installment amounts must add up exactly to the advance total.</p>
                )}
                <ul className="sar-modal-slice-list">
                  {editInstallmentPreview.slices.map((slice, i) => (
                    <li key={i}>
                      <span className="sar-modal-period">{periodAt(editInstallmentPreview.start, i)}</span>
                      <span className="sar-modal-slice-amt">
                        KES {slice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="sar-modal-actions">
              <button type="button" className="btn-secondary" disabled={editSaving} onClick={() => setEditModal(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={editSaving} onClick={saveEditModal}>
                {editSaving ? 'Savingâ€¦' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {formNotesModal ? (
        <div
          className="sar-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => !savingFormNotes && setFormNotesModal(null)}
        >
          <div className="sar-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="sar-modal-title">Administrator notes (printed form)</h2>
            <p className="sar-modal-lead">
              These notes appear on the printable shopping form for this request (not the employee&apos;s purpose /
              reason).
            </p>
            <textarea
              rows={6}
              className="sar-form-notes-textarea"
              value={formNotesModal.text}
              onChange={(e) => setFormNotesModal((m) => ({ ...m, text: e.target.value }))}
              placeholder="e.g. Internal reference, filing instructions, conditionsâ€¦"
            />
            <div className="sar-modal-actions">
              <button type="button" className="btn-secondary" disabled={savingFormNotes} onClick={() => setFormNotesModal(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={savingFormNotes} onClick={saveFormNotesModal}>
                {savingFormNotes ? 'Savingâ€¦' : 'Save notes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {approveModal ? (
        <div className="sar-modal-overlay" role="dialog" aria-modal="true" onClick={() => !approveLoading && setApproveModal(null)}>
          <div className="sar-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="sar-modal-title">Approve shopping</h2>
            <p className="sar-modal-lead">
              Confirm how the advance is split across payroll months. Amounts are added to each month&apos;s{' '}
              <strong>advance deduction</strong> (net pay) â€” same data payroll and reports use.
            </p>
            <div className="sar-modal-fields">
              <label>
                First payroll month (first instalment)
                <input
                  type="month"
                  max={format(new Date(), 'yyyy-MM')}
                  value={approveModal.for_period}
                  onChange={(e) => setApproveModal((m) => ({ ...m, for_period: e.target.value }))}
                />
              </label>
              <label>
                Date of application
                <input
                  type="date"
                  value={approveModal.application_date}
                  onChange={(e) => setApproveModal((m) => ({ ...m, application_date: e.target.value }))}
                />
              </label>
              <label>
                Number of monthly instalments
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={approveModal.installment_count}
                  placeholder="e.g. 3"
                  onChange={(e) => setApproveModal((m) => ({ ...m, installment_count: e.target.value }))}
                />
              </label>
              <label>
                Custom installment amounts
                <textarea
                  rows={2}
                  value={approveModal.installment_plan}
                  placeholder="10000, 5000, 5000, 5000, 5000"
                  onChange={(e) => setApproveModal((m) => ({ ...m, installment_plan: e.target.value }))}
                />
              </label>
            </div>
            <div className="sar-modal-preview">
              <strong>Preview</strong>
              <p className="sar-modal-preview-meta">
                Starting <code>{installmentPreview.start}</code> â€” {installmentPreview.n} month(s), total KES{' '}
                {Number(approveModal.row.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
              {installmentPreview.hasCustomPlan && !installmentPreview.customPlanTotalValid && (
                <p className="sar-modal-warning">Custom installment amounts must add up exactly to the advance total.</p>
              )}
              <ul className="sar-modal-slice-list">
                {installmentPreview.slices.map((slice, i) => (
                  <li key={i}>
                    <span className="sar-modal-period">{periodAt(installmentPreview.start, i)}</span>
                    <span className="sar-modal-slice-amt">
                      KES{' '}
                      {slice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="sar-modal-actions">
              <button type="button" className="btn-secondary" disabled={approveLoading} onClick={() => setApproveModal(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={approveLoading} onClick={doApproveConfirm}>
                {approveLoading ? 'Postingâ€¦' : 'Approve & post to payroll'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!confirmReject}
        title="Reject request"
        message="Reject this shopping request?"
        confirmLabel="Reject"
        danger
        onConfirm={() => confirmReject && doReject(confirmReject)}
        onCancel={() => setConfirmReject(null)}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete request"
        message="Delete this pending request?"
        confirmLabel="Delete"
        danger
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
      <ConfirmDialog
        open={!!confirmDeactivate}
        title="Deactivate shopping"
        message="Reverse posted payroll deductions for this advance and mark it voided? Super admin only."
        confirmLabel="Deactivate"
        danger
        onConfirm={() => confirmDeactivate && doDeactivate(confirmDeactivate)}
        onCancel={() => setConfirmDeactivate(null)}
      />
    </div>
  )
}

export default ShoppingManagement







