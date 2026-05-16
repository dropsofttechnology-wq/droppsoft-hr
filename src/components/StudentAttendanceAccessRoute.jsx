import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { hasPermission } from '../utils/permissions'

const StudentAttendanceAccessRoute = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!hasPermission(user, 'school_attendance')) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default StudentAttendanceAccessRoute
