import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/** Admin, super_admin, manager, or cashier — operational HR approvals (not company setup). */
const StaffRoute = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const role = user?.prefs?.role || 'admin'
  const ok =
    role === 'admin' ||
    role === 'super_admin' ||
    role === 'manager' ||
    role === 'cashier'

  if (!ok) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default StaffRoute
