import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { hasPermission } from '../utils/permissions'

const CbcGradingAccessRoute = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) return <div>Loading...</div>

  if (!user) return <Navigate to="/login" replace />

  if (!hasPermission(user, 'cbc_grading')) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default CbcGradingAccessRoute
