import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isLocalDataSource } from '../config/dataSource'

const SuperAdminRoute = ({ children }) => {
  const { user, loading } = useAuth()

  if (!isLocalDataSource()) {
    return <Navigate to="/dashboard" replace />
  }
  if (loading) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>Loading…</div>
    )
  }
  const role = user?.prefs?.role
  if (role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

export default SuperAdminRoute
