import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { getApiBaseUrl } from '../config/api'
import { isLocalDataSource } from '../config/dataSource'
import { fetchHrApiHealth } from '../utils/apiHealth'
import { parsePairingPayload, isLoopbackApiUrl, isEmulatorBridgeHostUrl, normalizeApiOrigin } from '../utils/pairingQr'

const LOOPBACK_ERR =
  '127.0.0.1 / localhost means “this device” on the phone — not your HR PC. Use your computer’s LAN IP (check ipconfig), e.g. http://192.168.1.50:32100'

const EMULATOR_HOST_HINT =
  '10.0.2.2 only works from an Android emulator. On a real phone, use your PC’s Wi‑Fi IP (e.g. 192.168.x.x).'
import './ServerConnection.css'

function normalizeBaseUrl(raw) {
  return normalizeApiOrigin(raw)
}

const isCapacitor = import.meta.env.VITE_CAPACITOR === 'true'

export default function ServerConnection() {
  const location = useLocation()
  const navigate = useNavigate()
  const fromGate =
    Boolean(location.state?.errorMessage) || location.state?.attemptedUrl !== undefined

  const [url, setUrl] = useState('')
  const [resolvedHint, setResolvedHint] = useState('')
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [banner, setBanner] = useState(() => location.state?.errorMessage || '')
  const [scanning, setScanning] = useState(false)
  const qrScannerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const base = await getApiBaseUrl()
      const attempted = location.state?.attemptedUrl
      if (!cancelled) {
        setResolvedHint(base || '')
        if (attempted && String(attempted).trim()) {
          setUrl(normalizeBaseUrl(attempted))
        } else if (base) {
          setUrl(base)
        } else if (import.meta.env.VITE_ANDROID_API_URL) {
          setUrl(normalizeBaseUrl(import.meta.env.VITE_ANDROID_API_URL))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [location.state])

  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              qrScannerRef.current?.clear()
            } catch {
              /* ignore */
            }
            qrScannerRef.current = null
          })
      }
    }
  }, [])

  const stopQrScanner = async () => {
    if (!qrScannerRef.current) return
    try {
      await qrScannerRef.current.stop()
      await qrScannerRef.current.clear()
    } catch {
      /* ignore */
    }
    qrScannerRef.current = null
    setScanning(false)
  }

  const startQrScanner = async () => {
    setTestResult(null)
    try {
      const scanner = new Html5Qrcode('hr-pairing-qr-reader')
      qrScannerRef.current = scanner
      setScanning(true)
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decodedText) => {
          const parsed = parsePairingPayload(decodedText)
          if (parsed) {
            stopQrScanner()
            if (isLoopbackApiUrl(parsed)) {
              setTestResult({
                ok: false,
                message:
                  'This QR used 127.0.0.1 / localhost. On the HR PC open Mobile pairing (QR), enter your PC LAN address (ipconfig), save, then scan the new code.'
              })
              return
            }
            setUrl(parsed)
            setTestResult({
              ok: true,
              message: isEmulatorBridgeHostUrl(parsed)
                ? `URL loaded from QR. ${EMULATOR_HOST_HINT} Tap Test connection.`
                : 'URL loaded from QR. Tap Test connection, then Save and go to login.'
            })
          }
        },
        () => {}
      )
    } catch (e) {
      // Some Android WebViews fail with facingMode; retry with explicit camera id.
      try {
        const scanner = new Html5Qrcode('hr-pairing-qr-reader')
        const cameras = await Html5Qrcode.getCameras()
        if (!cameras?.length) {
          throw new Error('No camera found on this device.')
        }
        qrScannerRef.current = scanner
        setScanning(true)
        await scanner.start(
          cameras[0].id,
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText) => {
            const parsed = parsePairingPayload(decodedText)
            if (parsed) {
              stopQrScanner()
              if (isLoopbackApiUrl(parsed)) {
                setTestResult({
                  ok: false,
                  message:
                    'This QR used 127.0.0.1 / localhost. On the HR PC open Mobile pairing (QR), enter your PC LAN address (ipconfig), save, then scan the new code.'
                })
                return
              }
              setUrl(parsed)
              setTestResult({
                ok: true,
                message: isEmulatorBridgeHostUrl(parsed)
                  ? `URL loaded from QR. ${EMULATOR_HOST_HINT} Tap Test connection.`
                  : 'URL loaded from QR. Tap Test connection, then Save and go to login.'
              })
            }
          },
          () => {}
        )
      } catch (fallbackError) {
        setScanning(false)
        qrScannerRef.current = null
        setTestResult({
          ok: false,
          message:
            fallbackError?.message || e?.message || 'Could not start camera. Allow camera permission and try again.'
        })
      }
    }
  }

  const handleTest = async () => {
    const normalized = normalizeBaseUrl(url)
    setTestResult(null)
    if (!normalized) {
      setTestResult({ ok: false, message: 'Enter a server URL first.' })
      return
    }
    if (isLoopbackApiUrl(normalized)) {
      setTestResult({ ok: false, message: LOOPBACK_ERR })
      return
    }
    setTesting(true)
    try {
      const { ok } = await fetchHrApiHealth(normalized, 6000)
      setTestResult(
        ok
          ? { ok: true, message: 'Server responded. You can save and continue.' }
          : {
              ok: false,
              message:
                'No response from /api/health. Check the URL, Wi‑Fi, and that the HR service is running.' +
                (isEmulatorBridgeHostUrl(normalized) ? ` ${EMULATOR_HOST_HINT}` : '')
            }
      )
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    const normalized = normalizeBaseUrl(url)
    setTestResult(null)
    if (!normalized) {
      setTestResult({ ok: false, message: 'Enter a valid URL (e.g. http://192.168.1.10:32100).' })
      return
    }
    if (isLoopbackApiUrl(normalized)) {
      setTestResult({ ok: false, message: LOOPBACK_ERR })
      return
    }

    const { ok } = await fetchHrApiHealth(normalized, 6000)
    if (!ok) {
      setTestResult({
        ok: false,
        message: 'Cannot reach the server. Fix the URL or network, then try Test connection again.'
      })
      return
    }

    if (!isCapacitor) {
      setTestResult({
        ok: false,
        message:
          'Saving a custom URL in-app is only available in the Android app. For desktop browser dev, set VITE_LOCAL_API_URL in .env.local.'
      })
      return
    }

    setSaving(true)
    try {
      const { Preferences } = await import('@capacitor/preferences')
      await Preferences.set({ key: 'hr_api_base_url', value: normalized })
      navigate('/login', { replace: true })
    } catch (e) {
      setTestResult({ ok: false, message: e?.message || 'Could not save. Try again.' })
    } finally {
      setSaving(false)
    }
  }

  const handleClearSaved = async () => {
    if (!isCapacitor) return
    try {
      const { Preferences } = await import('@capacitor/preferences')
      await Preferences.remove({ key: 'hr_api_base_url' })
      setBanner('Saved override cleared. The app will use the built-in default URL on next start.')
      const base = await getApiBaseUrl()
      setResolvedHint(base || '')
      setUrl(base ? normalizeBaseUrl(base) : normalizeBaseUrl(import.meta.env.VITE_ANDROID_API_URL || ''))
    } catch (e) {
      setBanner(e?.message || 'Could not clear saved URL.')
    }
  }

  return (
    <div className="server-connection-page">
      <div className="server-connection-card">
        <div className="server-connection-logo">
          <img src="/logo.png" alt="" onError={(e) => { e.target.style.display = 'none' }} />
        </div>
        <h1>HR server connection</h1>
        <p className="server-connection-lead">
          Point this app at the computer running Dropsoft HR (same Wi‑Fi as this phone). Use the PC&apos;s LAN address,
          not <code>127.0.0.1</code> (that means &quot;this device&quot;).
        </p>

        {isLocalDataSource() && !isCapacitor && (
          <p className="server-connection-note">
            Browser or Electron: set <code>VITE_LOCAL_API_URL</code> and run <code>npm run server</code>. Saving a URL
            here applies to the Android app only.
          </p>
        )}

        {banner && (
          <div className="server-connection-banner" role="status">
            {banner}
          </div>
        )}

        {fromGate && (
          <p className="server-connection-note">
            The app could not reach the API. Set the URL below, save, then sign in.
          </p>
        )}

        {isCapacitor && (
          <div className="server-connection-qr-block">
            <h2 className="server-connection-h2">Scan pairing QR</h2>
            <p className="server-connection-meta">
              On the HR PC, open <strong>Settings → Mobile pairing (QR)</strong> (or Company settings, then the pairing
              link) and scan the code shown there.
            </p>
            <div id="hr-pairing-qr-reader" className="server-connection-qr-view" />
            {!scanning ? (
              <button type="button" className="server-connection-btn secondary" onClick={startQrScanner}>
                Start camera &amp; scan
              </button>
            ) : (
              <button type="button" className="server-connection-btn secondary" onClick={stopQrScanner}>
                Stop scanner
              </button>
            )}
          </div>
        )}

        <label className="server-connection-label" htmlFor="hr-server-url">
          API base URL
        </label>
        <input
          id="hr-server-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="http://192.168.1.50:32100"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="server-connection-input"
        />

        {resolvedHint && (
          <p className="server-connection-meta">
            Currently resolved: <code>{resolvedHint || '(none)'}</code>
          </p>
        )}

        <div className="server-connection-actions">
          <button type="button" className="server-connection-btn secondary" onClick={handleTest} disabled={testing}>
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <button type="button" className="server-connection-btn primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save and go to login'}
          </button>
        </div>

        {isCapacitor && (
          <button type="button" className="server-connection-linkish" onClick={handleClearSaved}>
            Clear saved URL (use app default)
          </button>
        )}

        {testResult && (
          <p className={testResult.ok ? 'server-connection-success' : 'server-connection-error'}>{testResult.message}</p>
        )}

        <div className="server-connection-links">
          <Link to="/login">Back to login</Link>
          <span aria-hidden> · </span>
          <Link to="/installation">Server installation details</Link>
        </div>
      </div>
    </div>
  )
}
