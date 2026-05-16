import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { hasPermission } from '../utils/permissions'

/** Fee ledger uses the local SQLite API; permission still gates access. */
const FeeLedgerAccessRoute = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!hasPermission(user, 'fee_ledger')) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default FeeLedgerAccessRoute
