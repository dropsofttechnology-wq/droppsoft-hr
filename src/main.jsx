import React, { useState, useEffect, Component } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App.jsx'
import ServerConnection from './pages/ServerConnection.jsx'
import InstallationServerInfo from './pages/InstallationServerInfo.jsx'
import './styles/index.css'
import { isLocalDataSource } from './config/dataSource'

if (typeof document !== 'undefined' && import.meta.env.VITE_CAPACITOR === 'true') {
  document.documentElement.classList.add('capacitor-native')
}
import { getApiBaseUrl } from './config/api'
import { waitForHrApiHealth } from './utils/apiHealth'

function LocalApiGate({ children }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  /** `null` = not failed yet; `''` = no base URL configured; otherwise failed health at this URL */
  const [attemptedUrl, setAttemptedUrl] = useState(null)

  useEffect(() => {
    if (!isLocalDataSource()) {
      setReady(true)
      return
    }
    let cancelled = false
    ;(async () => {
      const base = await getApiBaseUrl()
      if (!base) {
        if (!cancelled) {
          setAttemptedUrl('')
          setError(
            import.meta.env.VITE_CAPACITOR === 'true'
              ? 'No HR server URL is configured yet. Enter your PC\'s LAN address on the next screen.'
              : 'Local API URL missing. Set VITE_LOCAL_API_URL (e.g. http://127.0.0.1:32100) for dev, or launch the Electron app.'
          )
        }
        return
      }
      // Android: do not block on /api/health — unreachable servers used to stall here for minutes (many retries).
      // Mobile hub + server-setup show connection status; user fixes URL or network there.
      if (import.meta.env.VITE_CAPACITOR === 'true') {
        if (!cancelled) setReady(true)
        return
      }
      // Desktop Electron / same-origin: if this HTML loaded, the HR API already served it — do not block on health
      // (avoids rare fetch/ timing issues and long "Starting…" or stuck blank states).
      const desktopHttp =
        typeof window !== 'undefined' &&
        window.droppsoftDesktop?.isDesktop === true &&
        (window.location?.protocol === 'http:' || window.location?.protocol === 'https:')
      if (desktopHttp) {
        if (!cancelled) setReady(true)
        return
      }
      const ok = await waitForHrApiHealth(base)
      if (cancelled) return
      if (!ok) {
        setAttemptedUrl(base)
        setError(
          'Could not reach the local HR API at ' +
            base +
            '. Start the server (npm run server) or Electron, or change the URL in HR server connection.'
        )
        return
      }
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <Navigate
        to="/server-setup"
        replace
        state={{
          errorMessage: error,
          ...(attemptedUrl !== null ? { attemptedUrl } : {})
        }}
      />
    )
  }

  if (!ready) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          color: '#444'
        }}
      >
        Starting local HR service…
      </div>
    )
  }

  return children
}

/** Catches render errors so the root is not a blank screen (easier support / debugging). */
class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[Dropsoft HR] UI error:', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            padding: '2rem',
            fontFamily: 'system-ui, sans-serif',
            maxWidth: '40rem',
            margin: '0 auto'
          }}
        >
          <h1 style={{ color: '#b91c1c' }}>Something went wrong</h1>
          <p style={{ color: '#444' }}>The app hit an error while rendering. Try refreshing the page.</p>
          <pre
            style={{
              background: '#f1f5f9',
              padding: '1rem',
              borderRadius: '8px',
              overflow: 'auto',
              fontSize: '0.85rem'
            }}
          >
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

/** Electron file:// and Capacitor WebView: hash routing avoids blank routes. */
function AppRouter({ children }) {
  const useHash =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' || import.meta.env.VITE_CAPACITOR === 'true')
  const Router = useHash ? HashRouter : BrowserRouter
  return <Router>{children}</Router>
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <AppRouter>
        <Routes>
          <Route path="/installation" element={<InstallationServerInfo />} />
          <Route path="/server-setup" element={<ServerConnection />} />
          <Route
            path="*"
            element={
              <LocalApiGate>
                <App />
              </LocalApiGate>
            }
          />
        </Routes>
      </AppRouter>
    </RootErrorBoundary>
  </React.StrictMode>
)
