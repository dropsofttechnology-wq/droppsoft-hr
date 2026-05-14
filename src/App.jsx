import { lazy, Suspense } from 'react'
import { Toaster } from 'react-hot-toast'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { CompanyProvider } from './contexts/CompanyContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import StaffRoute from './components/StaffRoute'
import ApproverRoute from './components/ApproverRoute'
import SuperAdminRoute from './components/SuperAdminRoute'
import MobileAttendanceRoute from './components/MobileAttendanceRoute'
import RouteFallback from './components/RouteFallback'
import ExpenseAccessRoute from './components/ExpenseAccessRoute'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Companies = lazy(() => import('./pages/Companies'))
const Employees = lazy(() => import('./pages/Employees'))
const AttendanceTerminal = lazy(() => import('./pages/AttendanceTerminal'))
const AttendanceHistory = lazy(() => import('./pages/AttendanceHistory'))
const FaceEnrollment = lazy(() => import('./pages/FaceEnrollment'))
const Settings = lazy(() => import('./pages/Settings'))
const Payroll = lazy(() => import('./pages/Payroll'))
const Reports = lazy(() => import('./pages/Reports'))
const Payslips = lazy(() => import('./pages/Payslips'))
const Holidays = lazy(() => import('./pages/Holidays'))
const LeaveManagement = lazy(() => import('./pages/LeaveManagement'))
const LeaveTypes = lazy(() => import('./pages/LeaveTypes'))
const LeaveRequest = lazy(() => import('./pages/LeaveRequest'))
const BulkAttendance = lazy(() => import('./pages/BulkAttendance'))
const ManualAttendance = lazy(() => import('./pages/ManualAttendance'))
const HistoricalDataEntry = lazy(() => import('./pages/HistoricalDataEntry'))
const Banks = lazy(() => import('./pages/Banks'))
const SystemMaintenance = lazy(() => import('./pages/SystemMaintenance'))
const UserRoles = lazy(() => import('./pages/UserRoles'))
const SalaryAdvanceRequest = lazy(() => import('./pages/SalaryAdvanceRequest'))
const SalaryAdvanceManagement = lazy(() => import('./pages/SalaryAdvanceManagement'))
const ShoppingRequest = lazy(() => import('./pages/ShoppingRequest'))
const ShoppingManagement = lazy(() => import('./pages/ShoppingManagement'))
const HowToUse = lazy(() => import('./pages/HowToUse'))
const OpeningBalances = lazy(() => import('./pages/OpeningBalances'))
const MobileHub = lazy(() => import('./pages/MobileHub'))
const PairingQrDisplay = lazy(() => import('./pages/PairingQrDisplay'))
const LanDesktopConnection = lazy(() => import('./pages/LanDesktopConnection'))
const CompanyAnalysis = lazy(() => import('./pages/CompanyAnalysis'))
const ChangePassword = lazy(() => import('./pages/ChangePassword'))
const ActivityLog = lazy(() => import('./pages/ActivityLog'))
const LicensePlans = lazy(() => import('./pages/LicensePlans'))
const OperationalExpenses = lazy(() => import('./pages/OperationalExpenses'))

function HomeRedirect() {
  if (import.meta.env.VITE_CAPACITOR === 'true') {
    return <Navigate to="/mobile" replace />
  }
  return <Navigate to="/dashboard" replace />
}

function App() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/plans" element={<LicensePlans />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<HomeRedirect />} />
              <Route path="mobile" element={<MobileHub />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route
                path="company-analysis"
                element={
                  <AdminRoute>
                    <CompanyAnalysis />
                  </AdminRoute>
                }
              />
              <Route path="how-to-use" element={<HowToUse />} />
              <Route
                path="companies"
                element={
                  <AdminRoute>
                    <Companies />
                  </AdminRoute>
                }
              />
              <Route
                path="employees"
                element={
                  <AdminRoute>
                    <Employees />
                  </AdminRoute>
                }
              />
              <Route
                path="employees/opening-balances"
                element={
                  <AdminRoute>
                    <OpeningBalances />
                  </AdminRoute>
                }
              />
              <Route
                path="attendance/terminal"
                element={
                  <MobileAttendanceRoute>
                    <AttendanceTerminal />
                  </MobileAttendanceRoute>
                }
              />
              <Route path="attendance/history" element={<AttendanceHistory />} />
              <Route
                path="attendance/enrollment"
                element={
                  <MobileAttendanceRoute>
                    <FaceEnrollment />
                  </MobileAttendanceRoute>
                }
              />
              <Route
                path="attendance/bulk"
                element={
                  <AdminRoute>
                    <BulkAttendance />
                  </AdminRoute>
                }
              />
              <Route
                path="attendance/manual"
                element={
                  <AdminRoute>
                    <ManualAttendance />
                  </AdminRoute>
                }
              />
              <Route
                path="attendance/historical"
                element={
                  <AdminRoute>
                    <HistoricalDataEntry />
                  </AdminRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <AdminRoute>
                    <Settings />
                  </AdminRoute>
                }
              />
              <Route
                path="settings/system"
                element={
                  <SuperAdminRoute>
                    <SystemMaintenance />
                  </SuperAdminRoute>
                }
              />
              <Route
                path="settings/user-roles"
                element={
                  <AdminRoute>
                    <UserRoles />
                  </AdminRoute>
                }
              />
              <Route
                path="settings/activity-log"
                element={
                  <AdminRoute>
                    <ActivityLog />
                  </AdminRoute>
                }
              />
              <Route
                path="settings/pairing"
                element={
                  <AdminRoute>
                    <PairingQrDisplay />
                  </AdminRoute>
                }
              />
              <Route
                path="settings/lan-connection"
                element={
                  <AdminRoute>
                    <LanDesktopConnection />
                  </AdminRoute>
                }
              />
              <Route
                path="payroll"
                element={
                  <AdminRoute>
                    <Payroll />
                  </AdminRoute>
                }
              />
              <Route
                path="reports"
                element={
                  <AdminRoute>
                    <Reports />
                  </AdminRoute>
                }
              />
              <Route path="payslips" element={<Payslips />} />
              <Route
                path="holidays"
                element={
                  <StaffRoute>
                    <Holidays />
                  </StaffRoute>
                }
              />
              <Route
                path="leave"
                element={
                  <ApproverRoute>
                    <LeaveManagement />
                  </ApproverRoute>
                }
              />
              <Route
                path="leave/types"
                element={
                  <StaffRoute>
                    <LeaveTypes />
                  </StaffRoute>
                }
              />
              <Route path="leave/request" element={<LeaveRequest />} />
              <Route path="change-password" element={<ChangePassword />} />
              <Route path="salary-advance/request" element={<SalaryAdvanceRequest />} />
              <Route path="shopping/request" element={<ShoppingRequest />} />
              <Route
                path="salary-advance"
                element={
                  <ApproverRoute>
                    <SalaryAdvanceManagement />
                  </ApproverRoute>
                }
              />
              <Route
                path="shopping"
                element={
                  <AdminRoute>
                    <ShoppingManagement />
                  </AdminRoute>
                }
              />
              <Route
                path="banks"
                element={
                  <AdminRoute>
                    <Banks />
                  </AdminRoute>
                }
              />
              <Route
                path="school/operational-expenses"
                element={
                  <ExpenseAccessRoute>
                    <OperationalExpenses />
                  </ExpenseAccessRoute>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
      </CompanyProvider>
    </AuthProvider>
  )
}

export default App
