import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  listUsers,
  updateUserRole,
  createUserWithUsername,
  getRolePermissions,
  saveRolePermissions,
  setUserApproval,
  adminResetUserPassword
} from '../services/usersService'
import { isLocalDataSource } from '../config/dataSource'
import './UserRoles.css'

const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Super admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'approver', label: 'Approver (leave & advance)' },
  { value: 'hod', label: 'HOD (request only)' },
  { value: 'employee', label: 'Employee' },
  { value: 'user', label: 'User' }
]

const roleLabel = (value) => ROLE_OPTIONS.find((o) => o.value === value)?.label || value

const UserRoles = () => {
  const { user } = useAuth()
  const actorRole = user?.prefs?.role || 'admin'
  const isSuperAdmin = actorRole === 'super_admin'

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    name: '',
    role: 'employee'
  })

  const [permPayload, setPermPayload] = useState(null)
  const [permLoading, setPermLoading] = useState(false)
  const [permSaving, setPermSaving] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [resettingUserId, setResettingUserId] = useState('')
  const pendingUsers = useMemo(
    () => users.filter((u) => String(u.registration_status || '').toLowerCase() === 'pending_approval'),
    [users]
  )

  const createRoleOptions = useMemo(() => {
    if (isSuperAdmin) return ROLE_OPTIONS
    return ROLE_OPTIONS.filter((o) => o.value !== 'super_admin')
  }, [isSuperAdmin])

  useEffect(() => {
    if (!isLocalDataSource()) return
    load()
  }, [])

  useEffect(() => {
    if (!isLocalDataSource() || !isSuperAdmin) return
    let cancelled = false
    ;(async () => {
      try {
        setPermLoading(true)
        const data = await getRolePermissions()
        if (!cancelled) setPermPayload(data)
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Failed to load role permissions')
      } finally {
        if (!cancelled) setPermLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isSuperAdmin])

  const load = async () => {
    try {
      setLoading(true)
      const data = await listUsers()
      setUsers(data)
    } catch (e) {
      toast.error(e.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const onRoleChange = async (userId, newRole, targetRow) => {
    if (!isSuperAdmin && String(targetRow?.role || '').toLowerCase() === 'super_admin') {
      toast.error('Only a super admin can change this account')
      return
    }
    try {
      setSavingId(userId)
      await updateUserRole(userId, newRole)
      toast.success('Role updated')
      await load()
    } catch (e) {
      toast.error(e.message || 'Failed to update role')
    } finally {
      setSavingId(null)
    }
  }

  const onPermissionToggle = async (permissionKey, role, nextAllowed) => {
    if (role === 'super_admin' || !permPayload) return
    const matrix = {}
    for (const p of permPayload.permissions || []) {
      matrix[p.key] = { ...p.byRole }
    }
    if (!matrix[permissionKey]) matrix[permissionKey] = {}
    matrix[permissionKey][role] = nextAllowed
    setPermSaving(true)
    try {
      const data = await saveRolePermissions(matrix)
      setPermPayload(data)
      toast.success('Permission updated')
    } catch (e) {
      toast.error(e.message || 'Failed to save')
    } finally {
      setPermSaving(false)
    }
  }

  const onCreate = async (e) => {
    e.preventDefault()
    if (!form.email.trim() || !form.username.trim() || !form.password) {
      toast.error('Email, username and password are required')
      return
    }
    setCreating(true)
    try {
      await createUserWithUsername({
        email: form.email.trim(),
        username: form.username.trim().toLowerCase(),
        password: form.password,
        name: form.name.trim(),
        role: form.role
      })
      toast.success('User created. They can sign in with the email and password you set.')
      setForm({ email: '', username: '', password: '', name: '', role: 'employee' })
      await load()
    } catch (err) {
      toast.error(err.message || 'Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  const onApproveUser = async (userId) => {
    try {
      await setUserApproval(userId, 'approve')
      toast.success('Account approved')
      await load()
    } catch (e) {
      toast.error(e.message || 'Failed to approve account')
    }
  }

  const onRejectUser = async (userId) => {
    try {
      await setUserApproval(userId, 'reject')
      toast.success('Account rejected')
      await load()
    } catch (e) {
      toast.error(e.message || 'Failed to reject account')
    }
  }

  const onConfirmPendingAction = async () => {
    if (!pendingAction?.userId || !pendingAction?.decision) return
    const { userId, decision } = pendingAction
    setPendingAction(null)
    if (decision === 'approve') await onApproveUser(userId)
    else await onRejectUser(userId)
  }

  const onAdminResetPassword = async (targetUser) => {
    const tempPassword = window.prompt(
      `Enter temporary password for ${targetUser.email}.\nMinimum 6 characters.`
    )
    if (tempPassword == null) return
    if (String(tempPassword).length < 6) {
      toast.error('Temporary password must be at least 6 characters')
      return
    }
    try {
      setResettingUserId(String(targetUser.id))
      await adminResetUserPassword(targetUser.id, tempPassword)
      toast.success('Password reset. User must change password at next login.')
    } catch (e) {
      toast.error(e.message || 'Failed to reset password')
    } finally {
      setResettingUserId('')
    }
  }

  if (!isLocalDataSource()) {
    return (
      <div className="user-roles-page">
        <div className="alert alert-warning">
          User management is only available in the desktop (local SQLite) app.
        </div>
      </div>
    )
  }

  return (
    <div className="user-roles-page">
      <div className="page-header">
        <h1>Users &amp; roles</h1>
      </div>
      <p className="page-description">
        Create login accounts and assign roles. Employees can use self-service leave and payslips; HOD users can raise
        requests but cannot approve; approver and cashier roles can submit requests and run other allowed operations but
        cannot approve leave, salary advances, or shopping unless granted in the matrix below; admins and managers approve
        those requests and manage company data. Only a <strong>super admin</strong> can create another super
        admin account. At least one super admin must always remain.
      </p>

      {pendingUsers.length > 0 && (
        <section className="user-roles-create">
          <h2>Pending registrations ({pendingUsers.length})</h2>
          <p className="page-description">
            Employees who self-registered from the login page appear here. Approve to activate their account.
          </p>
          <div className="user-roles-table-wrap">
            <table className="user-roles-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Requested role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((u) => (
                  <tr key={`pending-${u.id}`}>
                    <td>{u.email}</td>
                    <td>{u.username || '—'}</td>
                    <td>{u.name || '—'}</td>
                    <td>{ROLE_OPTIONS.find((o) => o.value === (u.role || 'employee'))?.label || u.role || 'Employee'}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn-link btn-success-link"
                          onClick={() => setPendingAction({ userId: u.id, decision: 'approve' })}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn-link btn-danger-link"
                          onClick={() => setPendingAction({ userId: u.id, decision: 'reject' })}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isSuperAdmin && (
        <section className="user-roles-permissions" aria-labelledby="perm-matrix-heading">
          <h2 id="perm-matrix-heading">Role permissions</h2>
          <p className="user-roles-perm-intro">
            Choose which roles can use each system function (payroll, attendance, leave approval, user accounts, and the
            rest). Super admin always has full access. Employees can still use self-service leave, salary-advance and shopping
            requests where the app allows; this matrix controls approval and admin actions.
          </p>
          {permLoading ? (
            <div className="loading">Loading permissions…</div>
          ) : permPayload ? (
            <div className="perm-matrix-wrap">
              <table className="perm-matrix">
                <thead>
                  <tr>
                    <th scope="col" className="perm-matrix-fn">
                      Function
                    </th>
                    {(permPayload.roles || []).map((r) => (
                      <th key={r} scope="col" className="perm-matrix-role">
                        {roleLabel(r)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(permPayload.permissions || []).map((p) => (
                    <tr key={p.key}>
                      <td className="perm-matrix-fn">
                        <span className="perm-matrix-label">{p.label}</span>
                        {p.description ? <span className="perm-matrix-desc">{p.description}</span> : null}
                      </td>
                      {(permPayload.roles || []).map((r) => {
                        const checked = !!p.byRole?.[r]
                        const disabled = r === 'super_admin' || permSaving
                        return (
                          <td key={r} className="perm-matrix-cell">
                            <label className="perm-matrix-toggle">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={disabled}
                                onChange={() => onPermissionToggle(p.key, r, !checked)}
                                aria-label={`${p.label} — ${roleLabel(r)}`}
                              />
                            </label>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      )}

      <section className="user-roles-create">
        <h2>Create user</h2>
        <form onSubmit={onCreate} className="user-roles-create-form">
          <div className="ur-row">
            <label>
              Email <span className="required">*</span>
              <input
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="name@company.com"
                required
              />
            </label>
            <label>
              Username <span className="required">*</span>
              <input
                type="text"
                autoComplete="off"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="john.doe"
                required
              />
            </label>
          </div>
          <div className="ur-row">
            <label>
              Temporary password <span className="required">*</span>
              <input
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min. 6 characters"
                minLength={6}
                required
              />
            </label>
          </div>
          <div className="ur-row">
            <label>
              Display name
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
              />
            </label>
            <label>
              Role
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {createRoleOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="ur-actions">
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </form>
      </section>

      {loading ? (
        <div className="loading">Loading users…</div>
      ) : (
        <div className="user-roles-table-wrap">
          <h2 className="user-roles-table-heading">All users</h2>
          <table className="user-roles-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Username</th>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Active</th>
                <th>Security</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const locked = !isSuperAdmin && String(u.role || '').toLowerCase() === 'super_admin'
                const roleLabel = ROLE_OPTIONS.find((o) => o.value === (u.role || 'user'))?.label || u.role
                return (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td>{u.username || '—'}</td>
                    <td>{u.name || '—'}</td>
                    <td>
                      {locked ? (
                        <span className="role-locked" title="Only a super admin can change this account">
                          {roleLabel}
                        </span>
                      ) : (
                        <select
                          value={u.role || 'user'}
                          disabled={savingId === u.id}
                          onChange={(e) => onRoleChange(u.id, e.target.value, u)}
                          className="role-select"
                        >
                          {(isSuperAdmin ? ROLE_OPTIONS : ROLE_OPTIONS.filter((o) => o.value !== 'super_admin')).map(
                            (o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            )
                          )}
                        </select>
                      )}
                    </td>
                    <td>
                      <span>{u.registration_status || (u.active === 0 ? 'inactive' : 'approved')}</span>
                      {String(u.registration_status || '').toLowerCase() === 'pending_approval' && (
                        <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn-link btn-success-link"
                            onClick={() => setPendingAction({ userId: u.id, decision: 'approve' })}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn-link btn-danger-link"
                            onClick={() => setPendingAction({ userId: u.id, decision: 'reject' })}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                    <td>{u.active === 0 ? 'No' : 'Yes'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-link"
                        disabled={resettingUserId === String(u.id)}
                        onClick={() => onAdminResetPassword(u)}
                      >
                        {resettingUserId === String(u.id) ? 'Resetting…' : 'Reset password'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={!!pendingAction}
        title={pendingAction?.decision === 'approve' ? 'Approve account' : 'Reject account'}
        message={
          pendingAction?.decision === 'approve'
            ? 'Activate this pending account and force first login password change?'
            : 'Reject this pending account? The user will not be able to sign in.'
        }
        confirmLabel={pendingAction?.decision === 'approve' ? 'Approve' : 'Reject'}
        cancelLabel="Cancel"
        danger={pendingAction?.decision === 'reject'}
        onConfirm={onConfirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  )
}

export default UserRoles
