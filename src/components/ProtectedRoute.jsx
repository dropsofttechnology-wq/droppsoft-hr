import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }
  const role = String(user?.prefs?.role || '').toLowerCase()
  const exemptFromForcedPassword = role === 'super_admin' || role === 'admin'
  if (
    user?.prefs?.mustChangePassword &&
    !exemptFromForcedPassword &&
    location.pathname !== '/change-password'
  ) {
    return <Navigate to="/change-password" replace />
  }

  return children
}

export default ProtectedRoute
