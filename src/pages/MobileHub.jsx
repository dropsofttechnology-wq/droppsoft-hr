import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'
import { getApiBaseUrl } from '../config/api'
import { fetchHrApiHealth } from '../utils/apiHealth'
import './MobileHub.css'

export default function MobileHub() {
  const { user, logout } = useAuth()
  const { currentCompany } = useCompany()
  const [apiBase, setApiBase] = useState('')
  const [healthOk, setHealthOk] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const base = await getApiBaseUrl()
      if (cancelled || !base) {
        if (!cancelled) setHealthOk(false)
        return
      }
      setApiBase(base)
      const { ok } = await fetchHrApiHealth(base, 5000)
      if (!cancelled) setHealthOk(ok)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const role = String(user?.prefs?.role || 'admin').toLowerCase()
  const isAdmin = ['admin', 'super_admin', 'manager'].includes(role)

  return (
    <div className="mobile-hub">
      <header className="mobile-hub__header">
        <img className="mobile-hub__logo" src="/logo.png" alt="" />
        <div className="mobile-hub__header-text">
          <h1>Dropsoft HR</h1>
          <p className="mobile-hub__sub">Attendance &amp; connection</p>
        </div>
      </header>

      {currentCompany && (
        <p className="mobile-hub__company">{currentCompany.name}</p>
      )}

      <section className="mobile-hub__card mobile-hub__card--status">
        <h2>Connection</h2>
        <p className="mobile-hub__api-line">
          <span className="mobile-hub__label">API</span>
          <code className="mobile-hub__code">{apiBase || '—'}</code>
        </p>
        <p className="mobile-hub__health">
          Status:{' '}
          {healthOk === null && 'Checking…'}
          {healthOk === true && <span className="mobile-hub__ok">Connected</span>}
          {healthOk === false && <span className="mobile-hub__bad">Not reachable</span>}
        </p>
        <div className="mobile-hub__row">
          <Link className="mobile-hub__btn mobile-hub__btn--secondary" to="/server-setup">
            Server settings &amp; QR
          </Link>
        </div>
      </section>

      <section className="mobile-hub__grid">
        <Link className="mobile-hub__tile" to="/attendance/terminal">
          <span className="mobile-hub__tile-icon" aria-hidden>
            ◉
          </span>
          <span className="mobile-hub__tile-title">Clock in / out</span>
          <span className="mobile-hub__tile-desc">Face, QR, or ID</span>
        </Link>
        <Link className="mobile-hub__tile" to="/attendance/enrollment">
          <span className="mobile-hub__tile-icon" aria-hidden>
            ◎
          </span>
          <span className="mobile-hub__tile-title">Face enrollment</span>
          <span className="mobile-hub__tile-desc">Register your face</span>
        </Link>
        <Link className="mobile-hub__tile" to="/attendance/history">
          <span className="mobile-hub__tile-icon" aria-hidden>
            ☰
          </span>
          <span className="mobile-hub__tile-title">Attendance history</span>
        </Link>
        <Link className="mobile-hub__tile" to="/leave/request">
          <span className="mobile-hub__tile-icon" aria-hidden>
            ✎
          </span>
          <span className="mobile-hub__tile-title">Request leave</span>
        </Link>
        <Link className="mobile-hub__tile" to="/salary-advance/request">
          <span className="mobile-hub__tile-icon" aria-hidden>
            ↑
          </span>
          <span className="mobile-hub__tile-title">Salary advance</span>
          <span className="mobile-hub__tile-desc">Submit a request</span>
        </Link>
        <Link className="mobile-hub__tile" to="/payslips">
          <span className="mobile-hub__tile-icon" aria-hidden>
            $
          </span>
          <span className="mobile-hub__tile-title">Payslips</span>
        </Link>
        {isAdmin && (
          <Link className="mobile-hub__tile mobile-hub__tile--admin" to="/dashboard">
            <span className="mobile-hub__tile-title">Full dashboard</span>
            <span className="mobile-hub__tile-desc">Admin tools</span>
          </Link>
        )}
      </section>

      <footer className="mobile-hub__footer">
        <span className="mobile-hub__user">{user?.name || user?.email}</span>
        <button type="button" className="mobile-hub__logout" onClick={() => logout()}>
          Log out
        </button>
      </footer>
    </div>
  )
}
