import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getApiBaseUrl } from '../config/api'
import { isLocalDataSource } from '../config/dataSource'
import { normalizeApiOrigin, isLoopbackApiUrl } from '../utils/pairingQr'
import './PairingQrDisplay.css'
import './LanDesktopConnection.css'

const STORAGE_KEY = 'dropsoft_hr_lan_desktop_url'

/**
 * Guided setup for one PC as HR server and another Windows PC as thin client (same LAN).
 */
export default function LanDesktopConnection() {
  const [resolvedBase, setResolvedBase] = useState('')
  const [lanInput, setLanInput] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const b = (await getApiBaseUrl()) || ''
      if (cancelled) return
      setResolvedBase(b)
      const stored = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || ''
      const env = (import.meta.env.VITE_PAIRING_LAN_URL && String(import.meta.env.VITE_PAIRING_LAN_URL).trim()) || ''
      if (b && !isLoopbackApiUrl(b)) {
        setLanInput(b)
      } else {
        setLanInput(stored || env || '')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const effectiveOrigin = useMemo(() => {
    const manual = lanInput.trim()
    if (manual) {
      const n = normalizeApiOrigin(manual)
      if (n && !isLoopbackApiUrl(n)) return n
    }
    if (resolvedBase && !isLoopbackApiUrl(resolvedBase)) {
      return normalizeApiOrigin(resolvedBase) || resolvedBase.replace(/\/$/, '')
    }
    return ''
  }, [lanInput, resolvedBase])

  const saveLanUrl = () => {
    const n = normalizeApiOrigin(lanInput)
    if (!n || isLoopbackApiUrl(n)) return
    try {
      localStorage.setItem(STORAGE_KEY, lanInput.trim())
      toast.success('Saved for next visit')
    } catch {
      /* ignore */
    }
  }

  const copyText = async (text, label) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Could not copy — select and copy manually')
    }
  }

  const serverEnvSnippet = `HR_API_BIND=0.0.0.0
HR_API_PORT=32100`

  const remoteJsonSnippet = effectiveOrigin
    ? JSON.stringify({ baseUrl: effectiveOrigin }, null, 2)
    : ''

  const healthUrl = effectiveOrigin ? `${effectiveOrigin}/api/health` : ''

  const showLoopbackWarning = Boolean(resolvedBase) && isLoopbackApiUrl(resolvedBase)

  if (!isLocalDataSource()) {
    return (
      <div className="pairing-qr-page">
        <p>LAN desktop connection applies when using the local HR API (desktop app with SQLite).</p>
        <Link to="/dashboard">Back</Link>
      </div>
    )
  }

  return (
    <div className="pairing-qr-page lan-desktop-page">
      <div className="page-header">
        <h1>Connect other PCs (LAN)</h1>
        <p className="pairing-qr-lead">
          Run Dropsoft HR on <strong>one computer</strong> (server — holds the database). On a <strong>second PC</strong> on
          the same network, run the app as a <strong>thin client</strong> that talks to that server. This is not the same as
          the phone QR flow — see <Link to="/settings/pairing">Mobile pairing (QR)</Link> for Android.
        </p>
      </div>

      <div className="pairing-qr-warn">
        <strong>Trust your network.</strong> Any device on the LAN that can reach the server URL can call the API if the
        firewall allows it. Use only on office or trusted Wi‑Fi; do not expose the port to the public internet without
        HTTPS and proper security.
      </div>

      {showLoopbackWarning && (
        <div className="pairing-qr-warn pairing-qr-warn--strong">
          This session uses <code>127.0.0.1</code> (this PC only). Enter your <strong>server PC&apos;s LAN address</strong>{' '}
          below (from <code>ipconfig</code> → IPv4) so helpers and copy buttons use the URL other computers must use.
        </div>
      )}

      <div className="pairing-qr-lan-box">
        <label className="pairing-qr-label" htmlFor="lan-desktop-url">
          HR API base URL (what other PCs and phones on the LAN use)
        </label>
        <input
          id="lan-desktop-url"
          type="url"
          className="pairing-qr-input"
          placeholder="http://192.168.1.50:32100"
          value={lanInput}
          onChange={(e) => setLanInput(e.target.value)}
          autoComplete="off"
        />
        <p className="pairing-qr-hint">
          Must be <code>http://&lt;server-LAN-IP&gt;:&lt;port&gt;</code>, not <code>127.0.0.1</code>. Optional: set{' '}
          <code>VITE_PAIRING_LAN_URL</code> in <code>.env.local</code> to prefill.
        </p>
        <button type="button" className="pairing-qr-save-btn" onClick={saveLanUrl}>
          Save for next visit
        </button>
      </div>

      <div className="lan-desktop-grid">
        <div className="lan-desktop-card">
          <h2>Server PC (database)</h2>
          <ol>
            <li>
              In the project folder (or server install), add to <code>.env.local</code>:
            </li>
          </ol>
          <div className="lan-desktop-code-block">
            <pre>{serverEnvSnippet}</pre>
            <div className="lan-desktop-copy-row">
              <button
                type="button"
                className="lan-desktop-copy-btn"
                onClick={() => copyText(serverEnvSnippet, 'Server .env snippet')}
              >
                Copy .env lines
              </button>
            </div>
          </div>
          <ol start={2}>
            <li>Restart the HR API (<code>npm run server</code>) or the Dropsoft HR desktop app.</li>
            <li>
              In Windows Firewall, allow <strong>inbound TCP</strong> on the chosen port (e.g. <code>32100</code>).
            </li>
            <li>
              From another machine, open the health URL in a browser — you should see a healthy response.
            </li>
          </ol>
          {healthUrl && (
            <div className="lan-desktop-copy-row">
              <button
                type="button"
                className="lan-desktop-copy-btn lan-desktop-copy-btn--secondary"
                onClick={() => copyText(healthUrl, 'Health check URL')}
              >
                Copy health URL
              </button>
            </div>
          )}
        </div>

        <div className="lan-desktop-card">
          <h2>Client PC (thin client)</h2>
          <p className="lan-desktop-muted" style={{ marginTop: 0 }}>
            No local <code>hr.db</code> — the window loads the app from the server URL.
          </p>
          <ol>
            <li>
              <strong>Option A — environment variable</strong> (shortcut or user env): set{' '}
              <code>HR_REMOTE_API_URL</code> to the server URL, e.g. <code>http://192.168.1.50:32100</code>, then start{' '}
              <code>Dropsoft HR.exe</code>.
            </li>
            <li>
              <strong>Option B — config file</strong>: create{' '}
              <code>%AppData%\DropsoftHR\remote-api.json</code> with:
            </li>
          </ol>
          <div className="lan-desktop-code-block">
            <pre>{remoteJsonSnippet || '{ "baseUrl": "http://192.168.1.50:32100" }'}</pre>
            <div className="lan-desktop-copy-row">
              <button
                type="button"
                className="lan-desktop-copy-btn"
                disabled={!remoteJsonSnippet}
                onClick={() => copyText(remoteJsonSnippet, 'remote-api.json')}
              >
                Copy JSON
              </button>
            </div>
          </div>
          <ol start={3}>
            <li>
              <strong>Option C</strong>: run <code>&quot;Dropsoft HR.exe&quot; --set-server</code> and paste the server URL
              when prompted.
            </li>
            <li>Start the app — it checks <code>/api/health</code> on the server before opening.</li>
          </ol>
        </div>
      </div>

      <p className="lan-desktop-muted">
        <strong>Developer note:</strong> for <code>npm run dev</code> on the client, set{' '}
        <code>VITE_LOCAL_API_URL=http://&lt;server-ip&gt;:&lt;port&gt;</code> in <code>.env.local</code> on the client
        machine.
      </p>

      <div className="lan-desktop-links">
        <Link to="/how-to-use#lan">← How to use (LAN section)</Link>
        <Link to="/settings/pairing">Mobile pairing (QR) for phones</Link>
        <Link to="/settings">Company settings</Link>
      </div>
    </div>
  )
}
