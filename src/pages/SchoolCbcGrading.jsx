import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCompany } from '../contexts/CompanyContext'
import { isLocalDataSource } from '../config/dataSource'
import SchoolCbcConfig from './SchoolCbcConfig'
import SchoolCbcAssessment from './SchoolCbcAssessment'
import SchoolCbcReport from './SchoolCbcReport'
import './SchoolCbc.css'

const TABS = [
  { id: 'config', label: 'Configuration' },
  { id: 'assessment', label: 'Assessments' },
  { id: 'report', label: 'Progress report' }
]

function resolveTab(raw) {
  const v = String(raw || '').trim().toLowerCase()
  if (v === 'assessment' || v === 'assess') return 'assessment'
  if (v === 'report') return 'report'
  return 'config'
}

const SchoolCbcGrading = () => {
  const { currentCompany } = useCompany()
  const companyId = currentCompany?.$id
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = resolveTab(searchParams.get('tab'))
  const [tab, setTab] = useState(tabParam)

  useEffect(() => {
    setTab((prev) => (prev === tabParam ? prev : tabParam))
  }, [tabParam])

  const selectTab = (id) => {
    setTab(id)
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (id === 'config') p.delete('tab')
        else p.set('tab', id)
        return p
      },
      { replace: true }
    )
  }

  if (!isLocalDataSource()) {
    return (
      <div className="school-cbc-page">
        <div className="page-header">
          <h1>CBC grading</h1>
        </div>
        <p className="page-description">
          CBC grading runs on the <strong>local desktop / SQLite API</strong>. Use the desktop build or connect via
          LAN.
        </p>
      </div>
    )
  }

  if (!companyId) {
    return (
      <div className="school-cbc-page">
        <div className="page-header">
          <h1>CBC grading</h1>
        </div>
        <p className="page-description">Select a company in the header.</p>
      </div>
    )
  }

  return (
    <div className="school-cbc-page">
      <div className="page-header">
        <h1>CBC grading</h1>
      </div>
      <p className="page-description">
        Kenyan Competency-Based Curriculum (CBC) uses four levels: EE, ME, AE, BE. Configure{' '}
        <strong>learning areas</strong> and <strong>strands</strong>, record assessments per term, then print learner
        progress reports. Academic years, terms, and classes come from the{' '}
        <Link to="/school/fee-ledger">fee ledger</Link>.
      </p>

      <div className="school-cbc-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'active' : ''}
            onClick={() => selectTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'config' && <SchoolCbcConfig />}
      {tab === 'assessment' && <SchoolCbcAssessment />}
      {tab === 'report' && <SchoolCbcReport />}
    </div>
  )
}

export default SchoolCbcGrading
