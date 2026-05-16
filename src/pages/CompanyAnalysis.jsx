import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts'
import { useCompany } from '../contexts/CompanyContext'
import { getCompanyAnalysisData } from '../services/companyAnalysisService'
import './CompanyAnalysis.css'

const PIE_COLORS = [
  'var(--color-accent-blue)',
  'var(--color-success)',
  'var(--color-accent-red)',
  '#8b5cf6',
  '#f59e0b',
  '#06b6d4',
  '#64748b',
  '#ec4899'
]

const fmtMoney = (n) =>
  new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
    Number(n) || 0
  )

const PayrollTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="company-analysis-tooltip">
      <div>{p.payload.period}</div>
      <div>
        <strong>{fmtMoney(p.value)}</strong> net pay
      </div>
      <div className="company-analysis-tooltip__muted">{p.payload.lineCount} payroll line(s)</div>
    </div>
  )
}

const CompanyAnalysis = () => {
  const { currentCompany } = useCompany()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!currentCompany?.$id) return
    setError('')
    setLoading(true)
    try {
      const d = await getCompanyAnalysisData(currentCompany.$id)
      setData(d)
    } catch (e) {
      console.error(e)
      setError(e?.message || 'Could not load analysis data.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [currentCompany?.$id])

  useEffect(() => {
    load()
  }, [load])

  if (!currentCompany) {
    return (
      <div className="company-analysis">
        <h1>Company analysis</h1>
        <div className="alert alert-warning company-analysis__alert">
          <strong>No company selected</strong>
          <p>Choose a company from the Companies page to view analytics.</p>
          <button type="button" className="btn-primary" onClick={() => navigate('/companies')}>
            Go to Companies
          </button>
        </div>
      </div>
    )
  }

  const att = data?.attendanceStats

  return (
    <div className="company-analysis">
      <header className="company-analysis__header">
        <div>
          <h1>Company analysis</h1>
          <p className="company-analysis__subtitle">
            Visual overview for <strong>{currentCompany.name}</strong>
          </p>
          <dl className="company-analysis__meta">
            {currentCompany.registration_number && (
              <>
                <dt>Registration</dt>
                <dd>{currentCompany.registration_number}</dd>
              </>
            )}
            {currentCompany.tax_pin && (
              <>
                <dt>Tax PIN</dt>
                <dd>{currentCompany.tax_pin}</dd>
              </>
            )}
            {currentCompany.status && (
              <>
                <dt>Status</dt>
                <dd>{currentCompany.status}</dd>
              </>
            )}
            {(currentCompany.email || currentCompany.phone) && (
              <>
                <dt>Contact</dt>
                <dd>
                  {[currentCompany.email, currentCompany.phone].filter(Boolean).join(' · ')}
                </dd>
              </>
            )}
          </dl>
        </div>
        <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {error && (
        <div className="alert alert-warning company-analysis__alert" role="alert">
          {error}
        </div>
      )}

      {loading && !data && <div className="company-analysis__loading">Loading charts…</div>}

      {data && (
        <>
          <section className="company-analysis__kpis" aria-label="Key figures">
            <div className="company-analysis__kpi">
              <span className="company-analysis__kpi-label">Employees (active)</span>
              <span className="company-analysis__kpi-value">{data.headcount.active}</span>
              <span className="company-analysis__kpi-hint">of {data.headcount.total} total</span>
            </div>
            <div className="company-analysis__kpi">
              <span className="company-analysis__kpi-label">Present today</span>
              <span className="company-analysis__kpi-value">{att?.todayPresent ?? '—'}</span>
              <span className="company-analysis__kpi-hint">
                expected ~{att?.expectedAttendanceToday ?? '—'} (excl. on leave)
              </span>
            </div>
            <div className="company-analysis__kpi">
              <span className="company-analysis__kpi-label">On time / late (today)</span>
              <span className="company-analysis__kpi-value">
                {att != null ? `${att.todayOnTime ?? 0} / ${att.todayLate ?? 0}` : '—'}
              </span>
              <span className="company-analysis__kpi-hint">clock-in vs grace</span>
            </div>
            <div className="company-analysis__kpi">
              <span className="company-analysis__kpi-label">Month attendance rate</span>
              <span className="company-analysis__kpi-value">
                {att?.attendanceRate != null ? `${att.attendanceRate}%` : '—'}
              </span>
              <span className="company-analysis__kpi-hint">vs expected working days</span>
            </div>
            <div className="company-analysis__kpi">
              <span className="company-analysis__kpi-label">Shopping taken (approved)</span>
              <span className="company-analysis__kpi-value">{fmtMoney(data.shopping?.totalApprovedAmount || 0)}</span>
              <span className="company-analysis__kpi-hint">{data.shopping?.approvedCount || 0} approved request(s)</span>
            </div>
          </section>

          <div className="company-analysis__grid">
            <section className="company-analysis__card company-analysis__card--wide">
              <h2>Unique staff present per day (last 14 days)</h2>
              <p className="company-analysis__card-desc">Distinct employees with at least one attendance record.</p>
              <div className="company-analysis__chart" role="img" aria-label="Attendance trend chart">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.attendanceTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="attFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-accent-blue)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--color-accent-blue)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-text-secondary)" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--color-text-secondary)" />
                    <Tooltip
                      formatter={(value) => [value, 'Staff present']}
                      labelStyle={{ color: 'var(--color-text-primary)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="present"
                      name="Present"
                      stroke="var(--color-accent-blue)"
                      fill="url(#attFill)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="company-analysis__card">
              <h2>Staff by department</h2>
              <p className="company-analysis__card-desc">Headcount per department (largest groups).</p>
              <div className="company-analysis__chart">
                {data.departmentBar.length === 0 ? (
                  <p className="company-analysis__empty">No employees to group.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={data.departmentBar}
                      layout="vertical"
                      margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => [value, 'Employees']} />
                      <Bar dataKey="count" name="Employees" fill="var(--color-primary-light)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className="company-analysis__card">
              <h2>Employee status</h2>
              <p className="company-analysis__card-desc">Distribution by employment status.</p>
              <div className="company-analysis__chart company-analysis__chart--pie">
                {data.employeeStatusPie.length === 0 ? (
                  <p className="company-analysis__empty">No employee records.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={data.employeeStatusPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={88}
                        paddingAngle={2}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {data.employeeStatusPie.map((_, i) => (
                          <Cell key={String(i)} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className="company-analysis__card">
              <h2>Leave requests by status</h2>
              <p className="company-analysis__card-desc">
                Last {data.leaveWindowDays} days (overlapping window).
              </p>
              <div className="company-analysis__chart company-analysis__chart--pie">
                {data.leaveStatusPie.length === 0 ? (
                  <p className="company-analysis__empty">No leave requests in this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={data.leaveStatusPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={84}
                        paddingAngle={2}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {data.leaveStatusPie.map((_, i) => (
                          <Cell key={String(i)} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className="company-analysis__card company-analysis__card--wide">
              <h2>Approved leave by type</h2>
              <p className="company-analysis__card-desc">Count of approved requests in the same window.</p>
              {data.leaveTypeBar.length === 0 ? (
                <p className="company-analysis__empty">No approved leave in this period.</p>
              ) : (
                <div className="company-analysis__chart">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.leaveTypeBar} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={56} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="Requests" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="company-analysis__card company-analysis__card--wide">
              <h2>Payroll net pay by month</h2>
              <p className="company-analysis__card-desc">Sum of net pay from saved payroll runs (last 6 months).</p>
              <div className="company-analysis__chart">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.payrollByMonth} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="period" />
                    <YAxis tickFormatter={(v) => fmtMoney(v)} />
                    <Tooltip content={<PayrollTooltip />} />
                    <Bar dataKey="totalNetPay" name="Net pay" fill="var(--color-primary-light)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="company-analysis__card company-analysis__card--wide">
              <h2>Shopping amount by department</h2>
              <p className="company-analysis__card-desc">Approved shopping totals grouped by employee department.</p>
              {data.shopping?.byDepartment?.length ? (
                <div className="company-analysis__chart">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.shopping.byDepartment} margin={{ top: 8, right: 8, left: 0, bottom: 18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={52} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => [fmtMoney(value), 'Shopping amount']} />
                      <Bar dataKey="amount" name="Shopping amount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="company-analysis__empty">No approved shopping records yet.</p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}

export default CompanyAnalysis
