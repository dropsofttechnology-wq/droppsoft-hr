import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'

const ChangePassword = () => {
  const { user, changePassword } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!currentPassword || !newPassword) {
      setError('Current password and new password are required')
      return
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match')
      return
    }
    setSaving(true)
    try {
      const result = await changePassword(currentPassword, newPassword)
      if (!result.success) {
        setError(result.error || 'Failed to change password')
        return
      }
      toast.success('Password changed successfully')
      navigate('/dashboard', { replace: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Change temporary password</h1>
      </div>
      <p className="page-description">
        {user?.name || 'User'}, you must change your temporary password before using the system.
      </p>
      <div style={{ maxWidth: 520 }}>
        <form onSubmit={onSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label>Current (temporary) password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>New password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ChangePassword
