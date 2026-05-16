import { Link } from 'react-router-dom'
import './ServerConnection.css'

/**
 * Read-only reference for IT: ports, bind address, and mobile app pairing.
 * Routed outside the local API gate so it opens even when the API is unreachable.
 */
export default function InstallationServerInfo() {
  return (
    <div className="server-connection-page">
      <div className="server-connection-card installation-info-card">
        <div className="server-connection-logo">
          <img src="/logo.png" alt="" onError={(e) => { e.target.style.display = 'none' }} />
        </div>
        <h1>HR server (installation reference)</h1>
        <p className="server-connection-lead">
          Use this page when installing the API on a PC or VM so phones and other PCs can connect.
        </p>

        <section className="installation-section">
          <h2>Default API</h2>
          <ul>
            <li>
              <strong>Port:</strong> <code>32100</code> (override with <code>HR_API_PORT</code> in the server
              environment).
            </li>
            <li>
              <strong>Health check:</strong> <code>GET /api/health</code> — the app uses this to verify connectivity.
            </li>
          </ul>
        </section>

        <section className="installation-section">
          <h2>Listen on the network</h2>
          <p>
            On the machine that runs <code>npm run server</code> (or your packaged service), bind the HTTP server to
            all interfaces so phones on the same LAN can reach it:
          </p>
          <p>
            <code>HR_API_BIND=0.0.0.0</code>
          </p>
          <p>Then allow that TCP port in Windows Firewall (or your host firewall).</p>
        </section>

        <section className="installation-section">
          <h2>Address to give users</h2>
          <p>
            Other devices must use this host&apos;s <strong>LAN IP</strong>, for example{' '}
            <code>http://192.168.1.50:32100</code>. Do not use <code>127.0.0.1</code> from another device — that always
            means &quot;that device itself&quot;.
          </p>
        </section>

        <section className="installation-section">
          <h2>Android app</h2>
          <p>
            The mobile app can store a custom API URL on the device. Open{' '}
            <Link to="/server-setup">HR server connection</Link> in the app to set or change it without rebuilding the
            APK.
          </p>
        </section>

        <div className="server-connection-links">
          <Link to="/login">Back to login</Link>
          <span aria-hidden> · </span>
          <Link to="/server-setup">Configure app server URL</Link>
        </div>
      </div>
    </div>
  )
}
