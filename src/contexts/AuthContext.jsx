import { createContext, useContext, useState, useEffect } from 'react'
import { account } from '../config/appwrite'
import { getEmployeeByUserId } from '../services/employeeService'
import { isLocalDataSource } from '../config/dataSource'
import { getApiBaseUrl } from '../config/api'
import { LOCAL_USER_ID_KEY } from '../config/constants'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

function mapLocalUserToContext(u) {
  return {
    $id: u.id,
    email: u.email,
    username: u.username || null,
    name: u.name,
    prefs: {
      role: u.role || 'admin',
      companyId: null,
      mustChangePassword: !!u.must_change_password,
      permissions: u.permissions && typeof u.permissions === 'object' ? u.permissions : {}
    }
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()
  }, [])

  const enrichUserWithEmployee = async (baseUser) => {
    try {
      const employee = await getEmployeeByUserId(baseUser.$id)

      if (!employee) {
        return {
          ...baseUser,
          prefs: {
            ...(baseUser.prefs || {}),
            role: baseUser.prefs?.role || 'admin',
            companyId: baseUser.prefs?.companyId || null
          }
        }
      }

      return {
        ...baseUser,
        prefs: {
          ...(baseUser.prefs || {}),
          // Login role (sys_users / Appwrite) wins over employee-record role for access control
          role: baseUser.prefs?.role || employee.role || 'employee',
          companyId: employee.company_id || baseUser.prefs?.companyId || null,
          employeeId: employee.$id
        }
      }
    } catch (error) {
      console.error('Error enriching user with employee profile:', error)
      return baseUser
    }
  }

  const checkUser = async () => {
    try {
      if (isLocalDataSource()) {
        const id = localStorage.getItem(LOCAL_USER_ID_KEY)
        if (!id) {
          setUser(null)
          return
        }
        const base = await getApiBaseUrl()
        if (!base) {
          setUser(null)
          return
        }
        const r = await fetch(`${base}/api/auth/me`, { headers: { 'x-user-id': id } })
        if (!r.ok) {
          localStorage.removeItem(LOCAL_USER_ID_KEY)
          setUser(null)
          return
        }
        const data = await r.json()
        const mapped = mapLocalUserToContext(data.user)
        const enriched = await enrichUserWithEmployee(mapped)
        setUser(enriched)
        return
      }

      const userData = await account.get()
      const enriched = await enrichUserWithEmployee(userData)
      setUser(enriched)
    } catch (error) {
      setUser(null)
      if (!isLocalDataSource()) {
        try {
          await account.deleteSession('current')
        } catch (err) {
          /* ignore */
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const loginLocal = async (identifier, password) => {
    const base = await getApiBaseUrl()
    if (!base) {
      return { success: false, error: 'Local API URL is not configured' }
    }
    const r = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      return { success: false, error: data.error || 'Login failed' }
    }
    localStorage.setItem(LOCAL_USER_ID_KEY, data.user.id)
    const mapped = mapLocalUserToContext(data.user)
    const enriched = await enrichUserWithEmployee(mapped)
    setUser(enriched)
    return {
      success: true,
      mustChangePassword: !!data.must_change_password,
      loginRole: String(data.user?.role || '').toLowerCase()
    }
  }

  const registerLocal = async (email, username, password, name) => {
    const base = await getApiBaseUrl()
    if (!base) {
      return { success: false, error: 'Local API URL is not configured' }
    }
    const r = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password, name })
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      return { success: false, error: data.error || 'Registration failed' }
    }
    return { success: true, message: data.message || 'Registration submitted. Await admin approval.' }
  }

  const logoutLocal = async () => {
    localStorage.removeItem(LOCAL_USER_ID_KEY)
    setUser(null)
  }

  const login = async (identifier, password) => {
    if (isLocalDataSource()) {
      return loginLocal(identifier, password)
    }
    try {
      try {
        const sessions = await account.listSessions()
        if (sessions.sessions && sessions.sessions.length > 0) {
          for (const session of sessions.sessions) {
            try {
              await account.deleteSession(session.$id)
            } catch (err) {
              console.log('Session cleanup:', err.message)
            }
          }
        }
      } catch (sessionError) {
        try {
          await account.deleteSession('current')
        } catch (err) {
          console.log('No existing session to clear')
        }
      }

      await account.createEmailSession(identifier, password)
      const userData = await account.get()
      const enriched = await enrichUserWithEmployee(userData)
      setUser(enriched)
      return { success: true }
    } catch (error) {
      console.error('Login error:', error)
      let errorMessage = 'Login failed'
      if (error.code === 401 || error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.'
      } else if (error.message?.includes('User not found') || error.message?.includes('not found')) {
        errorMessage = 'No account found with this email. Please register first or check your email address.'
      } else if (error.message?.includes('Invalid credentials')) {
        errorMessage = 'Invalid email or password. Please try again.'
      } else if (error.message?.includes('session is active') || error.message?.includes('session is prohibited')) {
        errorMessage = 'Session conflict detected. Please refresh the page and try again.'
      } else if (error.message) {
        errorMessage = error.message
      }
      return { success: false, error: errorMessage }
    }
  }

  const logout = async () => {
    if (isLocalDataSource()) {
      return logoutLocal()
    }
    try {
      try {
        const sessions = await account.listSessions()
        if (sessions.sessions && sessions.sessions.length > 0) {
          for (const session of sessions.sessions) {
            try {
              await account.deleteSession(session.$id)
            } catch (err) {
              /* continue */
            }
          }
        }
      } catch (err) {
        try {
          await account.deleteSession('current')
        } catch (deleteErr) {
          /* ignore */
        }
      }
      setUser(null)
    } catch (error) {
      console.error('Logout error:', error)
      setUser(null)
    }
  }

  const register = async (email, username, password, name) => {
    if (isLocalDataSource()) {
      return registerLocal(email, username, password, name)
    }
    try {
      try {
        await account.deleteSession('current')
      } catch (err) {
        /* ignore */
      }

      await account.create('unique()', email, password, name)
      const loginResult = await login(email, password)
      return loginResult
    } catch (error) {
      console.error('Registration error:', error)
      let errorMessage = 'Registration failed'
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        errorMessage = 'An account with this email already exists. Please login instead.'
      } else if (error.message?.includes('password')) {
        errorMessage = 'Password does not meet requirements. Please use a stronger password.'
      } else if (error.message) {
        errorMessage = error.message
      }
      return { success: false, error: errorMessage }
    }
  }

  const value = {
    user,
    loading,
    login,
    logout,
    register,
    changePassword: async (currentPassword, newPassword) => {
      if (!isLocalDataSource()) {
        return { success: false, error: 'Password change is only available in local mode for this flow' }
      }
      const base = await getApiBaseUrl()
      if (!base) return { success: false, error: 'Local API URL is not configured' }
      const r = await fetch(`${base}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': localStorage.getItem(LOCAL_USER_ID_KEY) || ''
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) return { success: false, error: data.error || 'Failed to change password' }
      await checkUser()
      return { success: true }
    },
    resetPasswordByIdentifier: async (identifier, newPassword) => {
      if (!isLocalDataSource()) {
        return { success: false, error: 'Password reset is only available in local mode for this flow' }
      }
      const base = await getApiBaseUrl()
      if (!base) return { success: false, error: 'Local API URL is not configured' }
      const r = await fetch(`${base}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          new_password: newPassword
        })
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) return { success: false, error: data.error || 'Failed to reset password' }
      return { success: true }
    },
    checkUser
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
