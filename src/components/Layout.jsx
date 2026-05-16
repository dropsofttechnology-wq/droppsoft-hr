import { useState, useEffect, useRef } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { isLocalDataSource } from '../config/dataSource'
import { DATABASE_ID } from '../config/appwrite'
import { hasPermission } from '../utils/permissions'
import { getApiBaseUrl } from '../config/api'
import { useAutoLogout } from '../hooks/useAutoLogout'
import { StudentQrScanToolbarButton } from './school/StudentQrScanner'
import './Layout.css'

/** Non-interactive sidebar group label */
function NavGroup({ label }) {
  return (
    <li className="nav-group-label" role="presentation">
      <span>{label}</span>
    </li>
  )
}

const Layout = () => {
  const { user, logout } = useAuth()
  const { currentCompany } = useCompany()
  const location = useLocation()
  const { isInstallable, isInstalled, installPWA } = usePWAInstall()
  const [subHealth, setSubHealth] = useState(null)
  const [pendingUsersCount, setPendingUsersCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(
    () => import.meta.env.VITE_CAPACITOR !== 'true'
  )
  const [sidebarHovered, setSidebarHovered] = useState(false)
  const inactivityTimerRef = useRef(null)
  const INACTIVITY_DELAY = 5000 // 5 seconds of inactivity before auto-hide

  useAutoLogout()

  const isActive = (path) => location.pathname === path
  const role = user?.prefs?.role || 'admin'
  const isCompanyAdmin =
    role === 'admin' ||
    role === 'super_admin' ||
    role === 'manager'
  const isStaffOps = isCompanyAdmin || role === 'cashier'
  const isApprovalOps = isCompanyAdmin
  const isSuperAdmin = role === 'super_admin'
  const isCapacitor = import.meta.env.VITE_CAPACITOR === 'true'
  const showOperationalExpenses =
    (isLocalDataSource() || !!DATABASE_ID) &&
    (hasPermission(user, 'operational_expenses') || hasPermission(user, 'operational_expenses_approval'))
  const showFeeLedger = isLocalDataSource() && hasPermission(user, 'fee_ledger')
  const showStudentAttendance = isLocalDataSource() && hasPermission(user, 'school_attendance')
  const showCbcGrading = isLocalDataSource() && hasPermission(user, 'cbc_grading')

  useEffect(() => {
    if (!isCapacitor) return
    if (!sidebarOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isCapacitor, sidebarOpen])

  useEffect(() => {
    if (!isLocalDataSource()) return
    let cancelled = false
    ;(async () => {
      const base = await getApiBaseUrl()
      if (!base || cancelled) return
      try {
        const r = await fetch(`${base}/api/health`)
        if (!r.ok || cancelled) return
        const d = await r.json()
        if (!cancelled) setSubHealth(d.subscription || null)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  useEffect(() => {
    if (!isLocalDataSource() || !isCompanyAdmin) return
    let cancelled = false
    ;(async () => {
      try {
        const base = await getApiBaseUrl()
        if (!base || cancelled) return
        const r = await fetch(`${base}/api/users`, {
          headers: { 'x-user-id': user?.$id || '' }
        })
        if (!r.ok || cancelled) return
        const rows = await r.json()
        if (cancelled) return
        const count = (rows || []).filter(
          (u) => String(u.registration_status || '').toLowerCase() === 'pending_approval'
        ).length
        setPendingUsersCount(count)
      } catch {
        /* ignore badge fetch failures */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [location.pathname, user?.$id, isCompanyAdmin])

  const handleInstall = async () => {
    await installPWA()
  }

  // Auto-hide sidebar after inactivity
  useEffect(() => {
    const resetTimer = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
      }
      
      // Only auto-hide if sidebar is open and not hovered
      inactivityTimerRef.current = setTimeout(() => {
        if (sidebarOpen && !sidebarHovered) {
          setSidebarOpen(false)
        }
      }, INACTIVITY_DELAY)
    }

    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    events.forEach(event => {
      window.addEventListener(event, resetTimer, true)
    })

    resetTimer()

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetTimer, true)
      })
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
      }
    }
  }, [sidebarOpen, sidebarHovered])

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const handleSidebarMouseEnter = () => {
    setSidebarHovered(true)
    setSidebarOpen(true)
  }

  const handleSidebarMouseLeave = () => {
    setSidebarHovered(false)
    // Don't auto-hide immediately on mouse leave, let the inactivity timer handle it
  }

  const showSubBanner =
    isLocalDataSource() &&
    subHealth &&
    subHealth.configured &&
    (!subHealth.active || (subHealth.daysRemaining != null && subHealth.daysRemaining <= 7))

  const isMobileHub = isCapacitor && location.pathname === '/mobile'

  if (isMobileHub) {
    return (
      <div className={`layout layout--mobile-hub${showSubBanner ? ' layout--sub-banner' : ''}`}>
        {showSubBanner && (
          <div className={`subscription-banner ${subHealth.active ? 'subscription-banner--warn' : 'subscription-banner--expired'}`}>
            {!subHealth.active ? (
              <>
                <strong>Subscription ended.</strong> A super admin must renew under{' '}
                <Link to="/settings/system">System maintenance</Link>.
              </>
            ) : (
              <>
                <strong>Subscription ending soon:</strong> {subHealth.daysRemaining} day(s) left. Renew under{' '}
                <Link to="/settings/system">System maintenance</Link>.
              </>
            )}
          </div>
        )}
        <main className="main-content main-content--mobile-hub">
          <Outlet />
        </main>
        <button
          type="button"
          className="logout-fallback-btn"
          onClick={logout}
          aria-label="Log out"
        >
          Logout
        </button>
      </div>
    )
  }

  return (
    <div
      className={`layout${showSubBanner ? ' layout--sub-banner' : ''}${
        isCapacitor ? ' layout--capacitor' : ''
      }`}
    >
      {showSubBanner && (
        <div className={`subscription-banner ${subHealth.active ? 'subscription-banner--warn' : 'subscription-banner--expired'}`}>
          {!subHealth.active ? (
            <>
              <strong>Subscription ended.</strong> A super admin must renew under{' '}
              <Link to="/settings/system">System maintenance</Link>.
            </>
          ) : (
            <>
              <strong>Subscription ending soon:</strong> {subHealth.daysRemaining} day(s) left. Renew under{' '}
              <Link to="/settings/system">System maintenance</Link>.
            </>
          )}
        </div>
      )}
      {/* Toggle Button */}
      <button 
        className={`sidebar-toggle ${sidebarOpen ? 'open' : ''}`}
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? '◀' : '▶'}
      </button>
      {!sidebarOpen && (
        <button
          type="button"
          className="logout-fallback-btn"
          onClick={logout}
          aria-label="Log out"
        >
          Logout
        </button>
      )}

      {isCapacitor && sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <nav 
        className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        <div className="sidebar-header">
          <div className="logo-container">
            <img 
              src="/logo.png" 
              alt="DROPSOFT SCH erp Logo" 
              className="app-logo" 
              onError={(e) => { 
                e.target.style.display = 'none';
                const title = e.target.nextElementSibling;
                if (title) title.style.display = 'block';
              }} 
            />
            <h1 className="app-title">DROPSOFT SCH erp</h1>
          </div>
          {currentCompany && (
            <div className="company-badge">
              {currentCompany.name}
            </div>
          )}
        </div>
        
        <ul className="nav-menu">
          <NavGroup label="Overview" />
          {isCapacitor && (
            <li>
              <Link to="/mobile" className={isActive('/mobile') ? 'active' : ''}>
                Mobile home
              </Link>
            </li>
          )}
          <li>
            <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
              Dashboard
            </Link>
          </li>
          {isCompanyAdmin && (
            <li>
              <Link
                to="/company-analysis"
                className={isActive('/company-analysis') ? 'active' : ''}
              >
                Company analysis
              </Link>
            </li>
          )}
          <li>
            <Link to="/how-to-use" className={isActive('/how-to-use') ? 'active' : ''}>
              How to use
            </Link>
          </li>
          {isCompanyAdmin && (
            <li>
              <Link to="/plans" className={isActive('/plans') ? 'active' : ''}>
                Plans &amp; licensing
              </Link>
            </li>
          )}
          {isLocalDataSource() && import.meta.env.VITE_CAPACITOR === 'true' && (
            <li>
              <Link to="/server-setup" className={isActive('/server-setup') ? 'active' : ''}>
                HR server connection
              </Link>
            </li>
          )}
          {isLocalDataSource() && (
            <li>
              <Link to="/installation" className={isActive('/installation') ? 'active' : ''}>
                Server installation info
              </Link>
            </li>
          )}

          <NavGroup label="My HR" />
          <li>
            <Link to="/attendance/history" className={isActive('/attendance/history') ? 'active' : ''}>
              Attendance history
            </Link>
          </li>
          <li>
            <Link to="/leave/request" className={isActive('/leave/request') ? 'active' : ''}>
              Request leave
            </Link>
          </li>
          {isLocalDataSource() && (
            <li>
              <Link
                to="/salary-advance/request"
                className={isActive('/salary-advance/request') ? 'active' : ''}
              >
                Request salary advance
              </Link>
            </li>
          )}
          {isLocalDataSource() && (
            <li>
              <Link
                to="/shopping/request"
                className={isActive('/shopping/request') ? 'active' : ''}
              >
                Request shopping
              </Link>
            </li>
          )}
          <li>
            <Link to="/payslips" className={isActive('/payslips') ? 'active' : ''}>
              Payslips
            </Link>
          </li>

          {isCompanyAdmin && (
            <>
              <NavGroup label="Organisation" />
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
                <Link
                  to="/employees/opening-balances"
                  className={isActive('/employees/opening-balances') ? 'active' : ''}
                >
                  Opening balances
                </Link>
              </li>
            </>
          )}

          {isCompanyAdmin && (
            <>
              <NavGroup label="Attendance" />
              <li>
                <Link to="/attendance/terminal" className={isActive('/attendance/terminal') ? 'active' : ''}>
                  Attendance terminal
                </Link>
              </li>
              <li>
                <Link to="/attendance/enrollment" className={isActive('/attendance/enrollment') ? 'active' : ''}>
                  Face enrollment
                </Link>
              </li>
              <li>
                <Link to="/attendance/bulk" className={isActive('/attendance/bulk') ? 'active' : ''}>
                  Bulk attendance
                </Link>
              </li>
              <li>
                <Link to="/attendance/manual" className={isActive('/attendance/manual') ? 'active' : ''}>
                  Manual attendance
                </Link>
              </li>
              <li>
                <Link to="/attendance/historical" className={isActive('/attendance/historical') ? 'active' : ''}>
                  Historical data entry
                </Link>
              </li>
            </>
          )}

          {isApprovalOps && (
            <>
              <NavGroup label="Leave &amp; time off" />
              {isStaffOps && (
                <li>
                  <Link to="/holidays" className={isActive('/holidays') ? 'active' : ''}>
                    Holidays
                  </Link>
                </li>
              )}
              <li>
                <Link to="/leave" className={isActive('/leave') ? 'active' : ''}>
                  Leave management
                </Link>
              </li>
              {isStaffOps && (
                <li>
                  <Link to="/leave/types" className={isActive('/leave/types') ? 'active' : ''}>
                    Leave types
                  </Link>
                </li>
              )}
              <li>
                <Link to="/salary-advance" className={isActive('/salary-advance') ? 'active' : ''}>
                  Salary advances
                </Link>
              </li>
              {isCompanyAdmin && (
                <li>
                  <Link to="/shopping" className={isActive('/shopping') ? 'active' : ''}>
                    Shopping management
                  </Link>
                </li>
              )}
            </>
          )}

          {isCompanyAdmin && (
            <>
              <NavGroup label="Payroll &amp; reporting" />
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
                <Link to="/banks" className={isActive('/banks') ? 'active' : ''}>
                  Banks
                </Link>
              </li>
              {showOperationalExpenses && (
                <li>
                  <Link
                    to="/school/operational-expenses"
                    className={isActive('/school/operational-expenses') ? 'active' : ''}
                  >
                    Operational expenses
                  </Link>
                </li>
              )}
              {showFeeLedger && (
                <li>
                  <Link
                    to="/school/fee-ledger?tab=summary"
                    className={isActive('/school/fee-ledger') ? 'active' : ''}
                  >
                    Fee ledger
                  </Link>
                </li>
              )}
              {showStudentAttendance && (
                <li>
                  <Link
                    to="/school/student-attendance"
                    className={isActive('/school/student-attendance') ? 'active' : ''}
                  >
                    Student attendance
                  </Link>
                </li>
              )}
              {showCbcGrading && (
                <li>
                  <Link
                    to="/school/cbc-grading"
                    className={isActive('/school/cbc-grading') ? 'active' : ''}
                  >
                    CBC grading
                  </Link>
                </li>
              )}
            </>
          )}

          {isCompanyAdmin && (
            <>
              <NavGroup label="Settings" />
              <li>
                <Link to="/settings" className={isActive('/settings') ? 'active' : ''}>
                  Company settings
                </Link>
              </li>
              {isSuperAdmin && isLocalDataSource() && (
                <li>
                  <Link
                    to="/settings/system"
                    className={isActive('/settings/system') ? 'active' : ''}
                  >
                    System maintenance
                  </Link>
                </li>
              )}
              {isCompanyAdmin && isLocalDataSource() && (
                <li>
                  <Link
                    to="/settings/user-roles"
                    className={isActive('/settings/user-roles') ? 'active' : ''}
                  >
                    <span>Users &amp; roles</span>
                    {pendingUsersCount > 0 && (
                      <span className="nav-badge" aria-label={`${pendingUsersCount} pending registrations`}>
                        {pendingUsersCount}
                      </span>
                    )}
                  </Link>
                </li>
              )}
              {isCompanyAdmin && isLocalDataSource() && (
                <li>
                  <Link
                    to="/settings/activity-log"
                    className={isActive('/settings/activity-log') ? 'active' : ''}
                  >
                    Activity log
                  </Link>
                </li>
              )}
              {isCompanyAdmin && isLocalDataSource() && (
                <li>
                  <Link to="/settings/pairing" className={isActive('/settings/pairing') ? 'active' : ''}>
                    Mobile pairing (QR)
                  </Link>
                </li>
              )}
              {isCompanyAdmin && isLocalDataSource() && (
                <li>
                  <Link
                    to="/settings/lan-connection"
                    className={isActive('/settings/lan-connection') ? 'active' : ''}
                  >
                    LAN: connect other PCs
                  </Link>
                </li>
              )}
            </>
          )}
        </ul>

        <div className="sidebar-footer">
          {isInstallable && !isInstalled && (
            <button 
              onClick={handleInstall} 
              className="install-pwa-btn"
              title="Install App"
            >
              📱 Install App
            </button>
          )}
          <div className="user-info">
            <span>{user?.name || user?.email}</span>
          </div>
          <button onClick={logout} className="logout-btn">
            Logout
          </button>
        </div>
      </nav>

      <main className={`main-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {isLocalDataSource() && (showFeeLedger || showStudentAttendance) ? (
          <div className="school-module-toolbar">
            <StudentQrScanToolbarButton />
          </div>
        ) : null}
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
