import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useCompany } from '../contexts/CompanyContext'
import { isLocalDataSource } from '../config/dataSource'
import * as cbcApi from '../services/schoolCbcGradingService'
import * as feeApi from '../services/schoolFeeLedgerService'
import { CBC_PERFORMANCE_LEVELS, cbcLevelButtonClass } from '../utils/cbcPerformanceLevels'
import './SchoolCbc.css'

export default function SchoolCbcAssessment() {
  const { currentCompany } = useCompany()
  const companyId = currentCompany?.$id
  const [years, setYears] = useState([])
  const [terms, setTerms] = useState([])
  const [subjects, setSubjects] = useState([])
  const [strands, setStrands] = useState([])
  const [gradeLevels, setGradeLevels] = useState([])
  const [yearId, setYearId] = useState('')
  const [termId, setTermId] = useState('')
  const [classId, setClassId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [strandId, setStrandId] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!companyId || !isLocalDataSource()) return
    ;(async () => {
      try {
        const [y, subj, grades] = await Promise.all([
          feeApi.getAcademicYears(companyId),
          cbcApi.getCbcSubjects(companyId),
          cbcApi.getCbcGradeLevels(companyId)
        ])
        setYears(y)
        setSubjects(subj)
        setGradeLevels(grades)
      } catch (e) {
        toast.error(e.message || 'Failed to load filters')
      }
    })()
  }, [companyId])

  useEffect(() => {
    if (!companyId || !yearId) {
      setTerms([])
      return
    }
    feeApi.getAcademicTerms(companyId, yearId).then(setTerms).catch(() => setTerms([]))
  }, [companyId, yearId])

  useEffect(() => {
    if (!companyId || !subjectId || !classId) {
      setStrands([])
      setStrandId('')
      return
    }
    cbcApi
      .getCbcStrands(companyId, { subjectId, gradeLevel: classId })
      .then((list) => {
        setStrands(list)
        setStrandId((prev) => (list.some((s) => s.$id === prev) ? prev : list[0]?.$id || ''))
      })
      .catch(() => setStrands([]))
  }, [companyId, subjectId, classId])

  const loadMatrix = useCallback(async () => {
    if (!companyId || !yearId || !termId || !classId || !strandId) {
      setRows([])
      return
    }
    try {
      setLoading(true)
      const data = await cbcApi.getCbcAssessmentMatrix(companyId, {
        academicYearId: yearId,
        termId,
        classId,
        strandId
      })
      setRows(
        (data.rows || []).map((r) => ({
          student_id: r.student_id,
          student_number: r.student_number,
          legal_name: r.legal_name,
          performance_level: r.performance_level,
          teacher_remarks: r.teacher_remarks || ''
        }))
      )
      setDirty(false)
    } catch (e) {
      toast.error(e.message || 'Failed to load roster')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [companyId, yearId, termId, classId, strandId])

  useEffect(() => {
    loadMatrix()
  }, [loadMatrix])

  const setLevel = (studentId, level) => {
    setRows((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, performance_level: level } : r))
    )
    setDirty(true)
  }

  const handleSave = async () => {
    if (!companyId || !strandId) return
    const marks = rows.filter((r) => r.performance_level != null)
    if (marks.length === 0) {
      toast.error('Assign at least one performance level')
      return
    }
    try {
      setSaving(true)
      await cbcApi.saveCbcAssessmentMarks(companyId, {
        academic_year_id: yearId,
        term_id: termId,
        strand_id: strandId,
        marks: marks.map((r) => ({
          student_id: r.student_id,
          performance_level: r.performance_level,
          teacher_remarks: r.teacher_remarks
        }))
      })
      toast.success('Assessments saved')
      setDirty(false)
      await loadMatrix()
    } catch (e) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!isLocalDataSource()) {
    return <p className="page-description">CBC assessments require the local API.</p>
  }

  return (
    <div>
      <div className="school-cbc-form">
        <label>
          Academic year
          <select value={yearId} onChange={(e) => { setYearId(e.target.value); setTermId('') }}>
            <option value="">Select…</option>
            {years.map((y) => (
              <option key={y.$id} value={y.$id}>
                {y.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Term
          <select value={termId} onChange={(e) => setTermId(e.target.value)} disabled={!yearId}>
            <option value="">Select…</option>
            {terms.map((t) => (
              <option key={t.$id} value={t.$id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Class / grade
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Select…</option>
            {gradeLevels.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label>
          Subject
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Select…</option>
            {subjects.map((s) => (
              <option key={s.$id} value={s.$id}>
                {s.subject_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Strand
          <select value={strandId} onChange={(e) => setStrandId(e.target.value)} disabled={!strands.length}>
            <option value="">Select…</option>
            {strands.map((st) => (
              <option key={st.$id} value={st.$id}>
                {st.strand_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!yearId || !termId || !classId || !strandId ? (
        <p className="page-description">Select year, term, class, subject, and strand to load the roster.</p>
      ) : loading ? (
        <p className="page-description">Loading students…</p>
      ) : rows.length === 0 ? (
        <p className="page-description">No active students in this class.</p>
      ) : (
        <>
          <div className="school-cbc-table-wrap">
            <table className="school-cbc-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Student</th>
                  {CBC_PERFORMANCE_LEVELS.map((l) => (
                    <th key={l.level} title={l.label}>
                      {l.abbreviation}
                    </th>
                  ))}
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.student_id}>
                    <td>{r.student_number}</td>
                    <td>{r.legal_name}</td>
                    {CBC_PERFORMANCE_LEVELS.map((l) => (
                      <td key={l.level}>
                        <button
                          type="button"
                          className={`school-cbc-level-btn ${r.performance_level === l.level ? `active ${cbcLevelButtonClass(l.level)}` : ''}`}
                          onClick={() => setLevel(r.student_id, l.level)}
                          aria-label={`${l.label} for ${r.legal_name}`}
                        >
                          {l.abbreviation}
                        </button>
                      </td>
                    ))}
                    <td>
                      <input
                        value={r.teacher_remarks}
                        onChange={(e) => {
                          const v = e.target.value
                          setRows((prev) =>
                            prev.map((x) =>
                              x.student_id === r.student_id ? { ...x, teacher_remarks: v } : x
                            )
                          )
                          setDirty(true)
                        }}
                        placeholder="Optional"
                        style={{ width: '100%', minWidth: '120px' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="school-cbc-savebar">
            <button
              type="button"
              className="school-cbc-btn school-cbc-btn--primary"
              onClick={handleSave}
              disabled={saving || !dirty}
            >
              {saving ? 'Saving…' : 'Save assessments'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
