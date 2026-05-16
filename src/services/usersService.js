import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'

export async function listUsers() {
  if (!isLocalDataSource()) {
    throw new Error('User management is only available in local mode')
  }
  const res = await localApiFetch('/api/users')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load users')
  }
  return res.json()
}

export async function updateUserRole(userId, role) {
  if (!isLocalDataSource()) {
    throw new Error('User management is only available in local mode')
  }
  const res = await localApiFetch(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ role })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to update role')
  }
  return res.json()
}

export async function getRolePermissions() {
  if (!isLocalDataSource()) {
    throw new Error('Role permissions are only available in local mode')
  }
  const res = await localApiFetch('/api/role-permissions')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load role permissions')
  }
  return res.json()
}

export async function saveRolePermissions(matrix) {
  if (!isLocalDataSource()) {
    throw new Error('Role permissions are only available in local mode')
  }
  const res = await localApiFetch('/api/role-permissions', {
    method: 'PUT',
    body: JSON.stringify({ matrix })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to save role permissions')
  }
  return res.json()
}

export async function createUser({ email, password, name, role }) {
  if (!isLocalDataSource()) {
    throw new Error('User management is only available in local mode')
  }
  const res = await localApiFetch('/api/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, name, role })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create user')
  }
  return res.json()
}

export async function createUserWithUsername({ email, username, password, name, role }) {
  if (!isLocalDataSource()) {
    throw new Error('User management is only available in local mode')
  }
  const res = await localApiFetch('/api/users', {
    method: 'POST',
    body: JSON.stringify({ email, username, password, name, role })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create user')
  }
  return res.json()
}

export async function setUserApproval(userId, decision) {
  if (!isLocalDataSource()) {
    throw new Error('User management is only available in local mode')
  }
  const res = await localApiFetch(`/api/users/${encodeURIComponent(userId)}/approval`, {
    method: 'POST',
    body: JSON.stringify({ decision })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to update account approval')
  }
  return res.json()
}

export async function adminResetUserPassword(userId, temporaryPassword) {
  if (!isLocalDataSource()) {
    throw new Error('User management is only available in local mode')
  }
  const res = await localApiFetch(`/api/users/${encodeURIComponent(userId)}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ temporary_password: temporaryPassword })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to reset user password')
  }
  return res.json()
}
