import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useCompany } from '../contexts/CompanyContext'
import { isLocalDataSource } from '../config/dataSource'
import * as cbcApi from '../services/schoolCbcGradingService'
import { CBC_PERFORMANCE_LEVELS } from '../utils/cbcPerformanceLevels'
import './SchoolCbc.css'

const emptySubject = { subject_name: '', subject_code: '' }
const emptyStrand = { subject_id: '', grade_level: '', strand_name: '' }

export default function SchoolCbcConfig() {
  const { currentCompany } = useCompany()
  const companyId = currentCompany?.$id
  const [subjects, setSubjects] = useState([])
  const [strands, setStrands] = useState([])
  const [gradeLevels, setGradeLevels] = useState([])
  const [subjectForm, setSubjectForm] = useState(emptySubject)
  const [strandForm, setStrandForm] = useState(emptyStrand)
  const [strandFilterSubject, setStrandFilterSubject] = useState('')
  const [strandFilterGrade, setStrandFilterGrade] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!companyId || !isLocalDataSource()) return
    try {
      setLoading(true)
      const [subj, grades] = await Promise.all([
        cbcApi.getCbcSubjects(companyId),
        cbcApi.getCbcGradeLevels(companyId)
      ])
      setSubjects(subj)
      setGradeLevels(grades)
    } catch (e) {
      toast.error(e.message || 'Failed to load CBC config')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  const loadStrands = useCallback(async () => {
    if (!companyId) return
    try {
      const list = await cbcApi.getCbcStrands(companyId, {
        subjectId: strandFilterSubject || undefined,
        gradeLevel: strandFilterGrade || undefined
      })
      setStrands(list)
    } catch (e) {
      toast.error(e.message || 'Failed to load strands')
      setStrands([])
    }
  }, [companyId, strandFilterSubject, strandFilterGrade])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadStrands()
  }, [loadStrands])

  const addSubject = async (e) => {
    e.preventDefault()
    if (!companyId) return
    try {
      await cbcApi.createCbcSubject(companyId, subjectForm)
      toast.success('Subject added')
      setSubjectForm(emptySubject)
      await load()
    } catch (err) {
      toast.error(err.message || 'Save failed')
    }
  }

  const addStrand = async (e) => {
    e.preventDefault()
    if (!companyId) return
    try {
      await cbcApi.createCbcStrand(companyId, strandForm)
      toast.success('Strand added')
      setStrandForm((p) => ({ ...emptyStrand, subject_id: p.subject_id, grade_level: p.grade_level }))
      await loadStrands()
    } catch (err) {
      toast.error(err.message || 'Save failed')
    }
  }

  const removeSubject = async (id) => {
    if (!companyId || !window.confirm('Delete this subject and all its strands?')) return
    try {
      await cbcApi.deleteCbcSubject(companyId, id)
      toast.success('Subject deleted')
      await load()
      await loadStrands()
    } catch (err) {
      toast.error(err.message || 'Delete failed')
    }
  }

  const removeStrand = async (id) => {
    if (!companyId || !window.confirm('Delete this strand?')) return
    try {
      await cbcApi.deleteCbcStrand(companyId, id)
      toast.success('Strand deleted')
      await loadStrands()
    } catch (err) {
      toast.error(err.message || 'Delete failed')
    }
  }

  if (!isLocalDataSource()) {
    return (
      <p className="page-description">CBC grading requires the local desktop / SQLite API.</p>
    )
  }

  return (
    <div>
      <div className="school-cbc-scale" aria-label="CBC performance scale">
        {CBC_PERFORMANCE_LEVELS.map((l) => (
          <div key={l.level} className={`school-cbc-scale-card school-cbc-scale-card--${l.level}`}>
            <strong>
              {l.level} · {l.abbreviation}
            </strong>
            {l.label}
            <div style={{ opacity: 0.85, marginTop: '0.2rem' }}>{l.description}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.75rem' }}>Learning areas (subjects)</h2>
      <form className="school-cbc-form" onSubmit={addSubject}>
        <label>
          Subject name
          <input
            value={subjectForm.subject_name}
            onChange={(e) => setSubjectForm((p) => ({ ...p, subject_name: e.target.value }))}
            required
            placeholder="Mathematics"
          />
        </label>
        <label>
          Code
          <input
            value={subjectForm.subject_code}
            onChange={(e) => setSubjectForm((p) => ({ ...p, subject_code: e.target.value }))}
            placeholder="MAT"
          />
        </label>
        <button type="submit" className="school-cbc-btn school-cbc-btn--primary">
          Add subject
        </button>
      </form>
      <div className="school-cbc-table-wrap">
        <table className="school-cbc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && subjects.length === 0 ? (
              <tr>
                <td colSpan={3}>Loading…</td>
              </tr>
            ) : subjects.length === 0 ? (
              <tr>
                <td colSpan={3}>No subjects yet.</td>
              </tr>
            ) : (
              subjects.map((s) => (
                <tr key={s.$id}>
                  <td>{s.subject_name}</td>
                  <td>{s.subject_code || '—'}</td>
                  <td>
                    <button type="button" className="school-cbc-btn" onClick={() => removeSubject(s.$id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: '1.1rem', margin: '1.5rem 0 0.75rem' }}>Assessment strands</h2>
      <p className="page-description" style={{ marginTop: 0 }}>
        Tie strands to a subject and grade level (matches student class / form on the fee ledger).
      </p>
      <div className="school-cbc-form">
        <label>
          Filter subject
          <select value={strandFilterSubject} onChange={(e) => setStrandFilterSubject(e.target.value)}>
            <option value="">All</option>
            {subjects.map((s) => (
              <option key={s.$id} value={s.$id}>
                {s.subject_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Filter grade
          <select value={strandFilterGrade} onChange={(e) => setStrandFilterGrade(e.target.value)}>
            <option value="">All</option>
            {gradeLevels.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
      </div>
      <form className="school-cbc-form" onSubmit={addStrand}>
        <label>
          Subject
          <select
            value={strandForm.subject_id}
            onChange={(e) => setStrandForm((p) => ({ ...p, subject_id: e.target.value }))}
            required
          >
            <option value="">Select…</option>
            {subjects.map((s) => (
              <option key={s.$id} value={s.$id}>
                {s.subject_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Grade / class
          <input
            list="cbc-grade-levels"
            value={strandForm.grade_level}
            onChange={(e) => setStrandForm((p) => ({ ...p, grade_level: e.target.value }))}
            required
            placeholder="Grade 4"
          />
          <datalist id="cbc-grade-levels">
            {gradeLevels.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>
        <label>
          Strand name
          <input
            value={strandForm.strand_name}
            onChange={(e) => setStrandForm((p) => ({ ...p, strand_name: e.target.value }))}
            required
            placeholder="Numbers & Fractions"
          />
        </label>
        <button type="submit" className="school-cbc-btn school-cbc-btn--primary" disabled={!subjects.length}>
          Add strand
        </button>
      </form>
      <div className="school-cbc-table-wrap">
        <table className="school-cbc-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Grade</th>
              <th>Strand</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {strands.length === 0 ? (
              <tr>
                <td colSpan={4}>No strands match filters.</td>
              </tr>
            ) : (
              strands.map((st) => (
                <tr key={st.$id}>
                  <td>{st.subject_name}</td>
                  <td>{st.grade_level}</td>
                  <td>{st.strand_name}</td>
                  <td>
                    <button type="button" className="school-cbc-btn" onClick={() => removeStrand(st.$id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
