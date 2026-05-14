import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import { hasPermission } from '../utils/permissions'
import { isLocalDataSource } from '../config/dataSource'
import { getEmployees } from '../services/employeeService'
import {
  getExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  getExpenseSuppliers,
  createExpenseSupplier,
  updateExpenseSupplier,
  deleteExpenseSupplier,
  getOperationalExpenses,
  createOperationalExpense,
  updateOperationalExpense,
  deleteOperationalExpense,
  approveOperationalExpense,
  rejectOperationalExpense,
  markOperationalExpensePaid,
  voidOperationalExpense
} from '../services/schoolOperationalExpensesService'
import ConfirmDialog from '../components/ConfirmDialog'
import './OperationalExpenses.css'

const PAYMENT_METHODS = [
  { value: '', label: '—' },
  { value: 'cash', label: 'Cash' },
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'bank', label: 'Bank' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' }
]

/** Starter list aligned with school ops blueprint; skips names already present. */
const SUGGESTED_EXPENSE_CATEGORIES = [
  { name: 'Utilities', code: 'UTIL' },
  { name: 'Teaching supplies', code: 'SUPPLY' },
  { name: 'Repairs & maintenance', code: 'MAINT' },
  { name: 'Transport & trips', code: 'TRANS' },
  { name: 'Exams & registrations', code: 'EXAM' },
  { name: 'Insurance & licences', code: 'INS' },
  { name: 'Catering & events', code: 'EVENT' },
  { name: 'Professional services', code: 'PROF' },
  { name: 'Bank charges', code: 'BANK' },
  { name: 'Assets / capex', code: 'CAPEX' },
  { name: 'Petty cash & misc', code: 'MISC' }
]

function escapeCsvCell(value) {
  const t = String(value ?? '')
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

const emptyExpense = {
  category_id: '',
  supplier_id: '',
  description: '',
  amount: '',
  currency: '',
  tax_amount: '',
  incurred_on: format(new Date(), 'yyyy-MM-dd'),
  payment_method: '',
  reference: '',
  linked_employee_id: '',
  notes: ''
}

const OperationalExpenses = () => {
  const { currentCompany } = useCompany()
  const { user } = useAuth()
  const canEdit = hasPermission(user, 'operational_expenses')
  const canApprove = hasPermission(user, 'operational_expenses_approval')

  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [expenses, setExpenses] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  const [catForm, setCatForm] = useState({ name: '', code: '' })
  const [editingCat, setEditingCat] = useState(null)

  const [supForm, setSupForm] = useState({ name: '', tax_id: '', phone: '', email: '', notes: '' })
  const [editingSup, setEditingSup] = useState(null)

  const [expenseForm, setExpenseForm] = useState(emptyExpense)
  const [editingExpense, setEditingExpense] = useState(null)

  const [confirmDelCat, setConfirmDelCat] = useState(null)
  const [confirmDelSup, setConfirmDelSup] = useState(null)
  const [confirmDelExp, setConfirmDelExp] = useState(null)

  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [voidModal, setVoidModal] = useState(null)
  const [voidReason, setVoidReason] = useState('')
  const [paidModal, setPaidModal] = useState(null)
  const [paidOn, setPaidOn] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [paidMethod, setPaidMethod] = useState('')
  const [seedingCategories, setSeedingCategories] = useState(false)

  const companyId = currentCompany?.$id

  const loadAll = async () => {
    if (!companyId || !isLocalDataSource()) return
    try {
      setLoading(true)
      const [c, s, e] = await Promise.all([
        getExpenseCategories(companyId),
        getExpenseSuppliers(companyId),
        getOperationalExpenses(companyId, {
          status: statusFilter === 'all' ? undefined : statusFilter
        })
      ])
      setCategories(c)
      setSuppliers(s)
      setExpenses(e)
    } catch (err) {
      toast.error(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [companyId, statusFilter])

  useEffect(() => {
    if (!companyId || !isLocalDataSource()) return
    ;(async () => {
      try {
        const em = await getEmployees(companyId, { status: 'active' })
        setEmployees(em || [])
      } catch {
        setEmployees([])
      }
    })()
  }, [companyId])

  const categoryName = (id) => categories.find((c) => c.$id === id)?.name || '—'
  const supplierName = (id) => (!id ? '—' : suppliers.find((s) => s.$id === id)?.name || '—')
  const employeeName = (id) => (!id ? '—' : employees.find((e) => e.$id === id)?.name || '—')

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [categories]
  )

  const handleSeedSuggestedCategories = async () => {
    if (!companyId) return
    const existing = new Set(
      categories.map((c) => String(c.name || '').trim().toLowerCase()).filter(Boolean)
    )
    const toAdd = SUGGESTED_EXPENSE_CATEGORIES.filter(
      (row) => !existing.has(String(row.name).trim().toLowerCase())
    )
    if (!toAdd.length) {
      toast.success('All suggested categories are already present')
      return
    }
    try {
      setSeedingCategories(true)
      let added = 0
      for (const row of toAdd) {
        await createExpenseCategory(companyId, { name: row.name, code: row.code })
        added += 1
      }
      toast.success(`Added ${added} categor${added === 1 ? 'y' : 'ies'}`)
      await loadAll()
    } catch (err) {
      toast.error(err.message || 'Could not add categories')
    } finally {
      setSeedingCategories(false)
    }
  }

  const handleExportCsv = () => {
    if (!expenses.length) {
      toast.error('No rows to export for the current filter')
      return
    }
    const headers = [
      'incurred_on',
      'description',
      'category',
      'supplier',
      'staff',
      'amount',
      'currency',
      'tax_amount',
      'status',
      'paid_on',
      'payment_method',
      'reference',
      'notes',
      'rejected_reason',
      'void_reason'
    ]
    const lines = [headers.join(',')]
    for (const row of expenses) {
      lines.push(
        [
          escapeCsvCell(String(row.incurred_on || '').slice(0, 10)),
          escapeCsvCell(row.description),
          escapeCsvCell(categoryName(row.category_id)),
          escapeCsvCell(supplierName(row.supplier_id)),
          escapeCsvCell(employeeName(row.linked_employee_id)),
          escapeCsvCell(row.amount),
          escapeCsvCell(row.currency),
          escapeCsvCell(row.tax_amount != null ? row.tax_amount : ''),
          escapeCsvCell(row.status),
          escapeCsvCell(row.paid_on ? String(row.paid_on).slice(0, 10) : ''),
          escapeCsvCell(row.payment_method),
          escapeCsvCell(row.reference),
          escapeCsvCell(row.notes),
          escapeCsvCell(row.rejected_reason),
          escapeCsvCell(row.void_reason)
        ].join(',')
      )
    }
    const stamp = format(new Date(), 'yyyy-MM-dd')
    const fname = `operational-expenses-${String(statusFilter)}-${stamp}.csv`
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fname
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('CSV downloaded')
  }

  const handleSaveCategory = async (e) => {
    e.preventDefault()
    if (!companyId) return
    const name = catForm.name.trim()
    if (!name) {
      toast.error('Category name is required')
      return
    }
    try {
      if (editingCat) {
        await updateExpenseCategory(editingCat.$id, { name, code: catForm.code.trim() })
        toast.success('Category updated')
      } else {
        await createExpenseCategory(companyId, { name, code: catForm.code.trim() })
        toast.success('Category added')
      }
      setCatForm({ name: '', code: '' })
      setEditingCat(null)
      await loadAll()
    } catch (err) {
      toast.error(err.message || 'Save failed')
    }
  }

  const handleSaveSupplier = async (e) => {
    e.preventDefault()
    if (!companyId) return
    const name = supForm.name.trim()
    if (!name) {
      toast.error('Supplier name is required')
      return
    }
    try {
      if (editingSup) {
        await updateExpenseSupplier(editingSup.$id, { ...supForm, name })
        toast.success('Supplier updated')
      } else {
        await createExpenseSupplier(companyId, {
          name,
          tax_id: supForm.tax_id.trim(),
          phone: supForm.phone.trim(),
          email: supForm.email.trim(),
          notes: supForm.notes.trim()
        })
        toast.success('Supplier added')
      }
      setSupForm({ name: '', tax_id: '', phone: '', email: '', notes: '' })
      setEditingSup(null)
      await loadAll()
    } catch (err) {
      toast.error(err.message || 'Save failed')
    }
  }

  const handleSaveExpense = async (e) => {
    e.preventDefault()
    if (!companyId) return
    if (!expenseForm.category_id) {
      toast.error('Select a category')
      return
    }
    const description = expenseForm.description.trim()
    if (!description) {
      toast.error('Description is required')
      return
    }
    const amount = Number(expenseForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    const payload = {
      category_id: expenseForm.category_id,
      supplier_id: expenseForm.supplier_id || undefined,
      description,
      amount,
      currency: expenseForm.currency.trim(),
      tax_amount: expenseForm.tax_amount === '' ? undefined : Number(expenseForm.tax_amount),
      incurred_on: expenseForm.incurred_on,
      payment_method: expenseForm.payment_method || undefined,
      reference: expenseForm.reference.trim() || undefined,
      linked_employee_id: expenseForm.linked_employee_id || undefined,
      notes: expenseForm.notes.trim() || undefined
    }
    try {
      if (editingExpense) {
        await updateOperationalExpense(editingExpense.$id, payload)
        toast.success('Expense updated')
      } else {
        await createOperationalExpense(companyId, payload)
        toast.success('Expense saved as draft')
      }
      setExpenseForm(emptyExpense)
      setEditingExpense(null)
      await loadAll()
    } catch (err) {
      toast.error(err.message || 'Save failed')
    }
  }

  const startEditExpense = (row) => {
    if (String(row.status) !== 'draft') return
    setEditingExpense(row)
    setExpenseForm({
      category_id: row.category_id || '',
      supplier_id: row.supplier_id || '',
      description: row.description || '',
      amount: String(row.amount ?? ''),
      currency: row.currency || '',
      tax_amount: row.tax_amount != null ? String(row.tax_amount) : '',
      incurred_on: String(row.incurred_on || '').slice(0, 10),
      payment_method: row.payment_method || '',
      reference: row.reference || '',
      linked_employee_id: row.linked_employee_id || '',
      notes: row.notes || ''
    })
  }

  if (!isLocalDataSource()) {
    return (
      <div className="operational-expenses-page">
        <div className="page-header">
          <h1>Operational expenses</h1>
        </div>
        <p className="page-description">
          Recording school running costs is available when using the <strong>local desktop / SQLite API</strong>.
          Connect the app to your LAN server or use the desktop build, then open this page again.
        </p>
      </div>
    )
  }

  if (!currentCompany) {
    return (
      <div className="operational-expenses-page">
        <div className="page-header">
          <h1>Operational expenses</h1>
        </div>
        <p className="page-description">Select a company in the header to manage expenses.</p>
      </div>
    )
  }

  return (
    <div className="operational-expenses-page">
      <div className="page-header">
        <h1>Operational expenses</h1>
      </div>
      <p className="page-description">
        Capture <strong>school running costs</strong> (utilities, supplies, repairs, vendors) per company. Drafts
        can be edited or deleted; approvers confirm, mark paid, or void. This is separate from payroll and from
        employee shopping deductions.
      </p>

      {canEdit && (
        <section className="op-ex-card" aria-labelledby="cat-heading">
          <div className="op-ex-section-head">
            <h2 id="cat-heading">Categories</h2>
            <button
              type="button"
              className="btn-secondary op-ex-seed-btn"
              disabled={seedingCategories}
              onClick={handleSeedSuggestedCategories}
            >
              {seedingCategories ? 'Adding…' : 'Add suggested categories'}
            </button>
          </div>
          <form className="op-ex-inline-form" onSubmit={handleSaveCategory}>
            <input
              placeholder="Name"
              value={catForm.name}
              onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              placeholder="Code (optional)"
              value={catForm.code}
              onChange={(e) => setCatForm((p) => ({ ...p, code: e.target.value }))}
            />
            <button type="submit">{editingCat ? 'Update' : 'Add'}</button>
            {editingCat && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditingCat(null)
                  setCatForm({ name: '', code: '' })
                }}
              >
                Cancel
              </button>
            )}
          </form>
          <ul className="op-ex-mini-list">
            {sortedCategories.map((c) => (
              <li key={c.$id}>
                <span>{c.name}</span>
                {c.code ? <span className="muted"> ({c.code})</span> : null}
                {!c.is_active ? <span className="muted"> inactive</span> : null}
                <span className="op-ex-actions">
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => {
                      setEditingCat(c)
                      setCatForm({ name: c.name || '', code: c.code || '' })
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" className="linkish" onClick={() => setConfirmDelCat(c)}>
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canEdit && (
        <section className="op-ex-card" aria-labelledby="sup-heading">
          <h2 id="sup-heading">Suppliers (optional)</h2>
          <form className="op-ex-supplier-form" onSubmit={handleSaveSupplier}>
            <input
              placeholder="Supplier name"
              value={supForm.name}
              onChange={(e) => setSupForm((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              placeholder="Tax ID"
              value={supForm.tax_id}
              onChange={(e) => setSupForm((p) => ({ ...p, tax_id: e.target.value }))}
            />
            <input
              placeholder="Phone"
              value={supForm.phone}
              onChange={(e) => setSupForm((p) => ({ ...p, phone: e.target.value }))}
            />
            <input
              placeholder="Email"
              value={supForm.email}
              onChange={(e) => setSupForm((p) => ({ ...p, email: e.target.value }))}
            />
            <textarea
              placeholder="Notes"
              rows={2}
              value={supForm.notes}
              onChange={(e) => setSupForm((p) => ({ ...p, notes: e.target.value }))}
            />
            <div className="op-ex-form-actions">
              <button type="submit">{editingSup ? 'Update supplier' : 'Add supplier'}</button>
              {editingSup && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setEditingSup(null)
                    setSupForm({ name: '', tax_id: '', phone: '', email: '', notes: '' })
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
          <ul className="op-ex-mini-list">
            {suppliers.map((s) => (
              <li key={s.$id}>
                <span>{s.name}</span>
                <span className="op-ex-actions">
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => {
                      setEditingSup(s)
                      setSupForm({
                        name: s.name || '',
                        tax_id: s.tax_id || '',
                        phone: s.phone || '',
                        email: s.email || '',
                        notes: s.notes || ''
                      })
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" className="linkish" onClick={() => setConfirmDelSup(s)}>
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="op-ex-card" aria-labelledby="exp-heading">
        <h2 id="exp-heading">Expenses</h2>
        <div className="op-ex-toolbar">
          <label>
            Status{' '}
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
              <option value="void">Void</option>
            </select>
          </label>
          {(canEdit || canApprove) && (
            <button type="button" className="btn-secondary op-ex-export-btn" onClick={handleExportCsv}>
              Export CSV
            </button>
          )}
        </div>

        {canEdit && (
          <form className="op-ex-expense-form" onSubmit={handleSaveExpense}>
            <h3>{editingExpense ? 'Edit draft' : 'New draft'}</h3>
            <div className="op-ex-grid">
              <label>
                Category
                <select
                  required
                  value={expenseForm.category_id}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, category_id: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {sortedCategories.filter((c) => c.is_active).map((c) => (
                    <option key={c.$id} value={c.$id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Supplier
                <select
                  value={expenseForm.supplier_id}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, supplier_id: e.target.value }))}
                >
                  <option value="">—</option>
                  {suppliers.map((s) => (
                    <option key={s.$id} value={s.$id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="span-2">
                Description
                <input
                  required
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))}
                />
              </label>
              <label>
                Amount
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))}
                />
              </label>
              <label>
                Currency (optional)
                <input
                  placeholder="e.g. KES"
                  value={expenseForm.currency}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, currency: e.target.value }))}
                />
              </label>
              <label>
                Tax amount (optional)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={expenseForm.tax_amount}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, tax_amount: e.target.value }))}
                />
              </label>
              <label>
                Incurred on
                <input
                  type="date"
                  required
                  value={expenseForm.incurred_on}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, incurred_on: e.target.value }))}
                />
              </label>
              <label>
                Payment method
                <select
                  value={expenseForm.payment_method}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, payment_method: e.target.value }))}
                >
                  {PAYMENT_METHODS.map((o) => (
                    <option key={o.value || 'empty'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reference / invoice #
                <input
                  value={expenseForm.reference}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, reference: e.target.value }))}
                />
              </label>
              <label>
                Linked staff (optional)
                <select
                  value={expenseForm.linked_employee_id}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, linked_employee_id: e.target.value }))}
                >
                  <option value="">—</option>
                  {employees.map((em) => (
                    <option key={em.$id} value={em.$id}>
                      {em.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="span-2">
                Notes
                <input
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </label>
            </div>
            <div className="op-ex-form-actions">
              <button type="submit">{editingExpense ? 'Save draft' : 'Save as draft'}</button>
              {editingExpense && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setEditingExpense(null)
                    setExpenseForm({ ...emptyExpense, incurred_on: format(new Date(), 'yyyy-MM-dd') })
                  }}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        )}

        {loading ? (
          <p>Loading…</p>
        ) : (
          <div className="op-ex-table-wrap">
            <table className="op-ex-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Supplier</th>
                  <th>Staff</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((row) => (
                  <tr key={row.$id}>
                    <td>{String(row.incurred_on || '').slice(0, 10)}</td>
                    <td>{row.description}</td>
                    <td>{categoryName(row.category_id)}</td>
                    <td>{supplierName(row.supplier_id)}</td>
                    <td>{employeeName(row.linked_employee_id)}</td>
                    <td>
                      {row.amount != null ? Number(row.amount).toLocaleString() : '—'}
                      {row.currency ? ` ${row.currency}` : ''}
                    </td>
                    <td>
                      <span className={`op-ex-status op-ex-status--${String(row.status)}`}>{row.status}</span>
                    </td>
                    <td className="op-ex-actions-cell">
                      {canEdit && row.status === 'draft' && (
                        <>
                          <button type="button" className="linkish" onClick={() => startEditExpense(row)}>
                            Edit
                          </button>
                          <button type="button" className="linkish" onClick={() => setConfirmDelExp(row)}>
                            Delete
                          </button>
                        </>
                      )}
                      {canApprove && row.status === 'draft' && (
                        <>
                          <button
                            type="button"
                            className="linkish"
                            onClick={async () => {
                              try {
                                await approveOperationalExpense(row.$id)
                                toast.success('Approved')
                                await loadAll()
                              } catch (err) {
                                toast.error(err.message || 'Approve failed')
                              }
                            }}
                          >
                            Approve
                          </button>
                          <button type="button" className="linkish" onClick={() => setRejectModal(row)}>
                            Reject
                          </button>
                        </>
                      )}
                      {canApprove && row.status === 'approved' && (
                        <>
                          <button
                            type="button"
                            className="linkish"
                            onClick={() => {
                              setPaidModal(row)
                              setPaidOn(format(new Date(), 'yyyy-MM-dd'))
                              setPaidMethod(row.payment_method || '')
                            }}
                          >
                            Mark paid
                          </button>
                          <button type="button" className="linkish" onClick={() => setVoidModal(row)}>
                            Void
                          </button>
                        </>
                      )}
                      {canApprove && row.status === 'paid' && (
                        <button type="button" className="linkish" onClick={() => setVoidModal(row)}>
                          Void
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!expenses.length && <p className="muted">No expenses for this filter.</p>}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!confirmDelCat}
        title="Delete category?"
        message={confirmDelCat ? `Remove “${confirmDelCat.name}”?` : ''}
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDelCat(null)}
        onConfirm={async () => {
          if (!confirmDelCat) return
          try {
            await deleteExpenseCategory(confirmDelCat.$id)
            toast.success('Deleted')
            setConfirmDelCat(null)
            await loadAll()
          } catch (err) {
            toast.error(err.message || 'Delete failed')
          }
        }}
      />

      <ConfirmDialog
        open={!!confirmDelSup}
        title="Delete supplier?"
        message={confirmDelSup ? `Remove “${confirmDelSup.name}”?` : ''}
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDelSup(null)}
        onConfirm={async () => {
          if (!confirmDelSup) return
          try {
            await deleteExpenseSupplier(confirmDelSup.$id)
            toast.success('Deleted')
            setConfirmDelSup(null)
            await loadAll()
          } catch (err) {
            toast.error(err.message || 'Delete failed')
          }
        }}
      />

      <ConfirmDialog
        open={!!confirmDelExp}
        title="Delete draft?"
        message="This removes the draft permanently."
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDelExp(null)}
        onConfirm={async () => {
          if (!confirmDelExp) return
          try {
            await deleteOperationalExpense(confirmDelExp.$id)
            toast.success('Deleted')
            setConfirmDelExp(null)
            await loadAll()
          } catch (err) {
            toast.error(err.message || 'Delete failed')
          }
        }}
      />

      {rejectModal && (
        <div className="op-ex-modal-overlay" role="dialog" aria-modal="true">
          <div className="op-ex-modal">
            <h3>Reject expense</h3>
            <label>
              Reason
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Required"
              />
            </label>
            <div className="op-ex-form-actions">
              <button type="button" className="btn-secondary" onClick={() => setRejectModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const r = rejectReason.trim()
                  if (!r) {
                    toast.error('Enter a reason')
                    return
                  }
                  try {
                    await rejectOperationalExpense(rejectModal.$id, r)
                    toast.success('Rejected')
                    setRejectModal(null)
                    setRejectReason('')
                    await loadAll()
                  } catch (err) {
                    toast.error(err.message || 'Reject failed')
                  }
                }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {voidModal && (
        <div className="op-ex-modal-overlay" role="dialog" aria-modal="true">
          <div className="op-ex-modal">
            <h3>Void expense</h3>
            <label>
              Reason
              <textarea
                rows={3}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Required for audit"
              />
            </label>
            <div className="op-ex-form-actions">
              <button type="button" className="btn-secondary" onClick={() => setVoidModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const r = voidReason.trim()
                  if (!r) {
                    toast.error('Enter a reason')
                    return
                  }
                  try {
                    await voidOperationalExpense(voidModal.$id, r)
                    toast.success('Voided')
                    setVoidModal(null)
                    setVoidReason('')
                    await loadAll()
                  } catch (err) {
                    toast.error(err.message || 'Void failed')
                  }
                }}
              >
                Void
              </button>
            </div>
          </div>
        </div>
      )}

      {paidModal && (
        <div className="op-ex-modal-overlay" role="dialog" aria-modal="true">
          <div className="op-ex-modal">
            <h3>Mark as paid</h3>
            <label>
              Paid on
              <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </label>
            <label>
              Payment method
              <select value={paidMethod} onChange={(e) => setPaidMethod(e.target.value)}>
                {PAYMENT_METHODS.filter((o) => o.value).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="op-ex-form-actions">
              <button type="button" className="btn-secondary" onClick={() => setPaidModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) {
                    toast.error('Pick a valid date')
                    return
                  }
                  try {
                    await markOperationalExpensePaid(paidModal.$id, paidOn, paidMethod)
                    toast.success('Marked paid')
                    setPaidModal(null)
                    await loadAll()
                  } catch (err) {
                    toast.error(err.message || 'Update failed')
                  }
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OperationalExpenses
