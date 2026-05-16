import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { hasPermission } from '../utils/permissions'

/** Users with operational expense capture or approval (local API or Appwrite collections). */
const ExpenseAccessRoute = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const ok =
    hasPermission(user, 'operational_expenses') ||
    hasPermission(user, 'operational_expenses_approval')

  if (!ok) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default ExpenseAccessRoute
