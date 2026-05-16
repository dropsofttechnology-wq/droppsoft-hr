import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/** Admin, super_admin, or manager — approve leave and salary-advance requests. */
const ApproverRoute = ({ children }) => {
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
    role === 'manager'

  if (!ok) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default ApproverRoute
