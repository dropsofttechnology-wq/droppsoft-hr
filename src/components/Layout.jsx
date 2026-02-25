import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'
import './Layout.css'

const Layout = () => {
  const { user, logout } = useAuth()
  const { currentCompany } = useCompany()
  const location = useLocation()

  const isActive = (path) => location.pathname === path

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h1>Droppsoft HR</h1>
          {currentCompany && (
            <div className="company-badge">
              {currentCompany.name}
            </div>
          )}
        </div>
        
        <ul className="nav-menu">
          <li>
            <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
              Dashboard
            </Link>
          </li>
          <li>
            <Link to="/companies" className={isActive('/companies') ? 'active' : ''}>
              Companies
            </Link>
          </li>
          <li>
            <Link to="/employees" className={isActive('/employees') ? 'active' : ''}>
              Employees
            </Link>
          </li>
          <li>
            <Link to="/attendance/terminal" className={isActive('/attendance/terminal') ? 'active' : ''}>
              Attendance Terminal
            </Link>
          </li>
          <li>
            <Link to="/attendance/enrollment" className={isActive('/attendance/enrollment') ? 'active' : ''}>
              Face Enrollment
            </Link>
          </li>
          <li>
            <Link to="/attendance/history" className={isActive('/attendance/history') ? 'active' : ''}>
              Attendance History
            </Link>
          </li>
          <li>
            <Link to="/settings" className={isActive('/settings') ? 'active' : ''}>
              Settings
            </Link>
          </li>
          <li>
            <Link to="/payroll" className={isActive('/payroll') ? 'active' : ''}>
              Payroll
            </Link>
          </li>
          <li>
            <Link to="/reports" className={isActive('/reports') ? 'active' : ''}>
              Reports
            </Link>
          </li>
          <li>
            <Link to="/payslips" className={isActive('/payslips') ? 'active' : ''}>
              Payslips
            </Link>
          </li>
        </ul>

        <div className="sidebar-footer">
          <div className="user-info">
            <span>{user?.name || user?.email}</span>
          </div>
          <button onClick={logout} className="logout-btn">
            Logout
          </button>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
