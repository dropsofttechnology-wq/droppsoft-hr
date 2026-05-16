import { useEffect, useState, useMemo } from 'react'
import QRCode from 'qrcode'
import { getApiBaseUrl } from '../config/api'
import { isLocalDataSource } from '../config/dataSource'
import { Link } from 'react-router-dom'
import {
  normalizeApiOrigin,
  isLoopbackApiUrl,
} from '../utils/pairingQr'
import './PairingQrDisplay.css'

const STORAGE_KEY = 'dropsoft_hr_pairing_lan_url'

/**
 * Shows a QR code the Android app can scan. Must encode a LAN URL — not 127.0.0.1 (that is the phone itself).
 */
export default function PairingQrDisplay() {
  const [resolvedBase, setResolvedBase] = useState('')
  const [lanInput, setLanInput] = useState('')
  const [dataUrl, setDataUrl] = useState('')
  const [jsonPayload, setJsonPayload] = useState('')

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

  const effectiveQrOrigin = useMemo(() => {
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

  useEffect(() => {
    let cancelled = false
    if (!effectiveQrOrigin) {
      setJsonPayload('')
      setDataUrl('')
      return
    }
    const payload = JSON.stringify({ dropsoftHrApi: effectiveQrOrigin, v: 1 })
    setJsonPayload(payload)
    QRCode.toDataURL(payload, { width: 240, margin: 2, color: { dark: '#1e3a2e', light: '#ffffff' } })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setDataUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [effectiveQrOrigin])

  const savePairingUrl = () => {
    const n = normalizeApiOrigin(lanInput)
    if (!n || isLoopbackApiUrl(n)) return
    try {
      localStorage.setItem(STORAGE_KEY, lanInput.trim())
    } catch {
      /* ignore */
    }
  }

  const showLoopbackWarning =
    Boolean(resolvedBase) && isLoopbackApiUrl(resolvedBase)

  if (!isLocalDataSource()) {
    return (
      <div className="pairing-qr-page">
        <p>QR pairing applies when using the local HR API (desktop / server).</p>
        <Link to="/dashboard">Back</Link>
      </div>
    )
  }

  return (
    <div className="pairing-qr-page">
      <div className="page-header">
        <h1>Mobile app pairing (QR)</h1>
        <p className="pairing-qr-lead">
          The QR must contain your PC&apos;s <strong>Wi‑Fi / LAN address</strong> (e.g. <code>http://192.168.1.50:32100</code>
          ), not <code>127.0.0.1</code>. On a phone, <code>127.0.0.1</code> means the phone itself, not your computer.
        </p>
      </div>

      {showLoopbackWarning && (
        <div className="pairing-qr-warn pairing-qr-warn--strong">
          This session&apos;s API URL is <code>127.0.0.1</code> (PC-only). Enter your PC&apos;s LAN IP below so the QR is
          scannable from phones. Find it with <code>ipconfig</code> (IPv4 Address) on the machine running{' '}
          <code>npm run server</code>.
        </div>
      )}

      <div className="pairing-qr-lan-box">
        <label className="pairing-qr-label" htmlFor="pairing-lan-url">
          URL encoded in QR (phones must reach this)
        </label>
        <input
          id="pairing-lan-url"
          type="url"
          className="pairing-qr-input"
          placeholder="http://192.168.1.50:32100"
          value={lanInput}
          onChange={(e) => setLanInput(e.target.value)}
          autoComplete="off"
        />
        <p className="pairing-qr-hint">
          On the server PC, set <code>HR_API_BIND=0.0.0.0</code> and open Windows Firewall for TCP port{' '}
          <code>32100</code> (or your <code>HR_API_PORT</code>). Optional: set{' '}
          <code>VITE_PAIRING_LAN_URL</code> in <code>.env.local</code> to prefill this.
        </p>
        <button type="button" className="pairing-qr-save-btn" onClick={savePairingUrl}>
          Save for next visit
        </button>
      </div>

      {!effectiveQrOrigin && (
        <div className="pairing-qr-warn">
          Enter a valid LAN URL above (not 127.0.0.1) to generate the QR code.
        </div>
      )}

      {dataUrl && effectiveQrOrigin && (
        <div className="pairing-qr-box">
          <img src={dataUrl} width={240} height={240} alt="Pairing QR code" />
          <p className="pairing-qr-encoded">
            Encodes: <code>{effectiveQrOrigin}</code>
          </p>
        </div>
      )}

      {jsonPayload && (
        <details className="pairing-qr-details">
          <summary>Payload (for debugging)</summary>
          <pre>{jsonPayload}</pre>
        </details>
      )}

      <p className="pairing-qr-footer">
        <Link to="/settings">← Company settings</Link>
      </p>
    </div>
  )
}
