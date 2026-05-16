import { defaultRoleAllows, PERMISSION_DEFAULT_BY_KEY } from './permissionRoleDefaults'

/**
 * Effective permission: explicit `prefs.permissions[permissionKey]` when set;
 * otherwise role defaults (for Appwrite users without a full matrix in prefs).
 * Local `/api/auth/me` supplies a full map so entries are usually explicit.
 */
export function hasPermission(user, permissionKey) {
  if (!user || !permissionKey) return false
  const role = String(user?.prefs?.role || '').toLowerCase()
  if (role === 'super_admin') return true
  const perms = user?.prefs?.permissions
  if (perms && typeof perms === 'object' && Object.prototype.hasOwnProperty.call(perms, permissionKey)) {
    return !!perms[permissionKey]
  }
  if (import.meta.env.DEV && !PERMISSION_DEFAULT_BY_KEY[permissionKey]) {
    console.warn(`[hasPermission] unknown permission key (no role fallback): ${permissionKey}`)
  }
  return defaultRoleAllows(role, permissionKey)
}
