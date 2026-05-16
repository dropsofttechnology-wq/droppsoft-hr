import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { isLocalDataSource } from '../config/dataSource'
import './Login.css'

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

const Login = () => {
  const LAST_IDENTIFIER_KEY = 'hr_last_login_identifier'
  const [identifier, setIdentifier] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regUsername, setRegUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetIdentifier, setResetIdentifier] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  const localMode = isLocalDataSource()
  const showServerSetupLink = localMode && import.meta.env.VITE_CAPACITOR === 'true'
  const { login, register, resetPasswordByIdentifier } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (showRegister) return
    try {
      const remembered = localStorage.getItem(LAST_IDENTIFIER_KEY) || ''
      if (remembered && !identifier) {
        setIdentifier(remembered)
      }
    } catch (_) {
      /* ignore local storage errors */
    }
  }, [showRegister, identifier])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let result
      if (showRegister) {
        const name = regUsername || regEmail.split('@')[0]
        result = await register(regEmail, regUsername, password, name)
      } else {
        result = await login(identifier, password)
      }
      
      if (result.success) {
        if (showRegister) {
          toast.success(result.message || 'Registration submitted. Await admin approval.')
          setShowRegister(false)
          setPassword('')
          setRegEmail('')
          setRegUsername('')
          setIdentifier('')
        } else {
          try {
            localStorage.setItem(LAST_IDENTIFIER_KEY, identifier.trim())
          } catch (_) {
            /* ignore local storage errors */
          }
          toast.success('Welcome back!')
          const skipForcedPw =
            result.mustChangePassword &&
            (result.loginRole === 'super_admin' || result.loginRole === 'admin')
          if (result.mustChangePassword && !skipForcedPw) {
            navigate('/change-password')
          } else if (import.meta.env.VITE_CAPACITOR === 'true') {
            navigate('/mobile')
          } else {
            navigate('/dashboard')
          }
        }
      } else {
        const msg = result.error || 'Authentication failed'
        setError(msg)
        toast.error(msg)
      }
    } catch (err) {
      const msg = 'An unexpected error occurred. Please try again.'
      setError(msg)
      toast.error(msg)
      console.error('Auth error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')
    if (!resetIdentifier.trim()) {
      setError('Enter your email or username')
      return
    }
    if (!resetPassword || resetPassword.length < 6) {
      setError('New password must be at least 6 characters')
      return
    }
    if (resetPassword !== resetConfirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const result = await resetPasswordByIdentifier(resetIdentifier.trim(), resetPassword)
      if (!result.success) {
        setError(result.error || 'Failed to reset password')
        toast.error(result.error || 'Failed to reset password')
        return
      }
      toast.success('Password reset successful. Please login.')
      setShowReset(false)
      setResetPassword('')
      setResetConfirm('')
      setPassword('')
      setIdentifier(resetIdentifier.trim())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo-container">
          <img src="/logo.png" alt="Dropsoft HR Logo" onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
        <h1>Dropsoft HR</h1>
        <p className="subtitle">Payroll & Attendance Management</p>
        
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label>{showRegister ? 'Email' : localMode ? 'Email or username' : 'Email'}</label>
            <input
              type={showRegister ? 'email' : localMode ? 'text' : 'email'}
              value={showRegister ? regEmail : identifier}
              onChange={(e) => (showRegister ? setRegEmail(e.target.value) : setIdentifier(e.target.value))}
              required
              autoFocus
              autoComplete="username"
            />
          </div>
          {showRegister && (
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value.toLowerCase())}
                required
                placeholder="e.g. john.doe"
                minLength={3}
                autoComplete="username"
              />
            </div>
          )}
          {showRegister && (
            <p className="login-server-setup-hint">
              Registration creates a pending employee account. An admin must approve it before you can sign in.
            </p>
          )}
          
          <div className="form-group">
            <label>Password</label>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={showRegister ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>
          
          <button type="submit" disabled={loading} className="login-btn">
            {loading 
              ? (showRegister ? 'Registering...' : 'Logging in...') 
              : (showRegister ? 'Register' : 'Login')
            }
          </button>
          
          <div className="auth-toggle">
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setShowRegister(!showRegister)
                setError('')
                setPassword('')
              }}
            >
              {showRegister 
                ? 'Already have an account? Login' 
                : "Don't have an account? Register"
              }
            </button>
          </div>
          {!showRegister && localMode && (
            <div className="auth-toggle">
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setShowReset((v) => !v)
                  setError('')
                }}
              >
                {showReset ? 'Cancel password reset' : 'Forgot password? Reset here'}
              </button>
            </div>
          )}
          {showReset && !showRegister && localMode && (
            <div className="form-group" style={{ marginTop: 10 }}>
              <label>Reset password (email or username)</label>
              <input
                type="text"
                value={resetIdentifier}
                onChange={(e) => setResetIdentifier(e.target.value)}
                placeholder="Email or username"
                autoComplete="username"
              />
              <label style={{ marginTop: 8 }}>New password</label>
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="New password"
                minLength={6}
                autoComplete="new-password"
              />
              <label style={{ marginTop: 8 }}>Confirm new password</label>
              <input
                type="password"
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                placeholder="Confirm new password"
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="login-btn"
                style={{ marginTop: 10 }}
                disabled={loading}
                onClick={handleResetPassword}
              >
                {loading ? 'Resetting...' : 'Reset password'}
              </button>
            </div>
          )}
          {showServerSetupLink && (
            <p className="login-server-setup-hint">
              <Link to="/server-setup">HR server URL / can&apos;t connect</Link>
            </p>
          )}
          <p className="login-server-setup-hint">
            <Link to="/plans">Plans, licensing &amp; payment</Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export default Login
