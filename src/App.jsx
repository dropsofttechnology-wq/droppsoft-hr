import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { CompanyProvider } from './contexts/CompanyContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Companies from './pages/Companies'
import Employees from './pages/Employees'
import AttendanceTerminal from './pages/AttendanceTerminal'
import AttendanceHistory from './pages/AttendanceHistory'
import FaceEnrollment from './pages/FaceEnrollment'
import Settings from './pages/Settings'
import Payroll from './pages/Payroll'
import Reports from './pages/Reports'
import Payslips from './pages/Payslips'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="companies" element={<Companies />} />
            <Route path="employees" element={<Employees />} />
            <Route path="attendance/terminal" element={<AttendanceTerminal />} />
            <Route path="attendance/history" element={<AttendanceHistory />} />
            <Route path="attendance/enrollment" element={<FaceEnrollment />} />
            <Route path="settings" element={<Settings />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="reports" element={<Reports />} />
            <Route path="payslips" element={<Payslips />} />
          </Route>
        </Routes>
      </CompanyProvider>
    </AuthProvider>
  )
}

export default App
