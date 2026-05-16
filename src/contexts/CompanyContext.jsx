import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { getCompanies } from '../services/companyService'

const CompanyContext = createContext()

export const useCompany = () => {
  const context = useContext(CompanyContext)
  if (!context) {
    throw new Error('useCompany must be used within CompanyProvider')
  }
  return context
}

export const CompanyProvider = ({ children }) => {
  const { user } = useAuth()
  const [companies, setCompanies] = useState([])
  const [currentCompany, setCurrentCompany] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadCompanies()
    }
  }, [user])

  const loadCompanies = async () => {
    try {
      const data = await getCompanies()

      const role = user?.prefs?.role || 'admin'
      const preferredCompanyId = user?.prefs?.companyId

      // For employees, restrict visible companies to their assigned company (if set)
      let visibleCompanies = data
      if (role !== 'admin' && role !== 'super_admin' && role !== 'manager' && preferredCompanyId) {
        const matched = data.filter((c) => c.$id === preferredCompanyId)
        if (matched.length > 0) {
          visibleCompanies = matched
        }
      }

      setCompanies(visibleCompanies)

      // Auto-select if only one visible company
      if (visibleCompanies.length === 1) {
        setCurrentCompany(visibleCompanies[0])
        localStorage.setItem('currentCompanyId', visibleCompanies[0].$id)
      } else {
        // Load previous selection from localStorage
        const savedCompanyId = localStorage.getItem('currentCompanyId')
        if (savedCompanyId) {
          const company = visibleCompanies.find((c) => c.$id === savedCompanyId)
          if (company) {
            setCurrentCompany(company)
          }
        }
      }
    } catch (error) {
      console.error('Error loading companies:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectCompany = (company) => {
    setCurrentCompany(company)
    localStorage.setItem('currentCompanyId', company.$id)
  }

  const value = {
    companies,
    currentCompany,
    loading,
    selectCompany,
    loadCompanies
  }

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}
