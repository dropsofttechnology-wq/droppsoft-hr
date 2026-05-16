import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/** Roles allowed to use attendance terminal / face enrollment on Android. */
const MOBILE_KIOSK_ROLES = ['admin', 'super_admin', 'manager', 'cashier', 'employee']

/** Desktop: same as AdminRoute (admin, super_admin, manager only). */
const DESKTOP_ATTENDANCE_ROLES = ['admin', 'super_admin', 'manager']

/**
 * On Capacitor (APK), employees can clock in and enroll face; on desktop/web, admin-only.
 */
const MobileAttendanceRoute = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const role = String(user?.prefs?.role || 'admin').toLowerCase()
  const capacitor = import.meta.env.VITE_CAPACITOR === 'true'

  if (capacitor) {
    if (MOBILE_KIOSK_ROLES.includes(role)) {
      return children
    }
    return <Navigate to="/mobile" replace />
  }

  if (DESKTOP_ATTENDANCE_ROLES.includes(role)) {
    return children
  }

  return <Navigate to="/dashboard" replace />
}

export default MobileAttendanceRoute
