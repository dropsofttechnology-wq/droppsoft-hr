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
      setCompanies(data)
      
      // Auto-select if only one company
      if (data.length === 1) {
        setCurrentCompany(data[0])
      } else {
        // Load from localStorage
        const savedCompanyId = localStorage.getItem('currentCompanyId')
        if (savedCompanyId) {
          const company = data.find(c => c.$id === savedCompanyId)
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
