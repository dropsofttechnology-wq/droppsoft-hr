import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'
import {
  downloadLicenseProformaPdf,
  fetchLicenseCatalog,
  quoteLicensePackage,
  submitLicenseOrder
} from '../services/licenseOrderService'
import './LicensePlans.css'

function formatKes(value) {
  const v = Number(value || 0)
  const abs = Math.abs(v).toLocaleString('en-KE')
  if (v < 0) return `-KES ${abs}`
  return `KES ${abs}`
}

const LicensePlans = () => {
  const { user } = useAuth()
  const { currentCompany } = useCompany()
  const role = String(user?.prefs?.role || '').toLowerCase()
  const canSubmit = ['super_admin', 'admin', 'manager'].includes(role)

  const [catalog, setCatalog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [packageId, setPackageId] = useState('growth')
  const [billingCycle, setBillingCycle] = useState('yearly')
  const [employeeCount, setEmployeeCount] = useState(50)
  const [selectedFeatures, setSelectedFeatures] = useState([])
  const [includeOnboarding, setIncludeOnboarding] = useState(true)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [quote, setQuote] = useState(null)
  const [order, setOrder] = useState(null)
  const [proformaLoading, setProformaLoading] = useState(false)

  useEffect(() => {
    setCompanyName((prev) => prev || currentCompany?.name || '')
    setContactName((prev) => prev || user?.name || '')
    setContactEmail((prev) => prev || user?.email || '')
  }, [currentCompany?.name, user?.name, user?.email])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchLicenseCatalog()
        if (!cancelled) setCatalog(data)
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not load plans')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const activePackage = useMemo(
    () => (catalog?.packages || []).find((p) => p.id === packageId) || null,
    [catalog, packageId]
  )

  useEffect(() => {
    if (!catalog) return
    const included = new Set(activePackage?.includedFeatures || [])
    setSelectedFeatures((prev) => prev.filter((id) => !included.has(id)))
  }, [catalog, activePackage])

  useEffect(() => {
    if (!catalog) return
    let cancelled = false
    ;(async () => {
      setQuoteLoading(true)
      try {
        const q = await quoteLicensePackage({
          packageId,
          billingCycle,
          employeeCount,
          selectedFeatures,
          includeOnboarding,
          discountPercent
        })
        if (!cancelled) setQuote(q)
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not calculate quote')
      } finally {
        if (!cancelled) setQuoteLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [catalog, packageId, billingCycle, employeeCount, selectedFeatures, includeOnboarding, discountPercent])

  const toggleFeature = (featureId) => {
    if (activePackage?.includedFeatures?.includes(featureId)) return
    setSelectedFeatures((prev) =>
      prev.includes(featureId) ? prev.filter((id) => id !== featureId) : [...prev, featureId]
    )
  }

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error('Sign in as admin or manager to submit a license order.')
      return
    }
    if (!companyName.trim()) {
      toast.error('Enter your company name.')
      return
    }
    setSubmitting(true)
    try {
      const created = await submitLicenseOrder({
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        packageId,
        billingCycle,
        employeeCount,
        selectedFeatures,
        includeOnboarding,
        discountPercent
      })
      setOrder(created)
      toast.success('License order created. Use the payment reference when paying.')
    } catch (e) {
      toast.error(e.message || 'Could not create order')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadProforma = async () => {
    if (!order?.id) return
    setProformaLoading(true)
    try {
      const blob = await downloadLicenseProformaPdf(order.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Proforma-${order.referenceCode}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Proforma invoice downloaded')
    } catch (e) {
      toast.error(e.message || 'Could not download proforma')
    } finally {
      setProformaLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="license-plans-page">
        <div className="license-plans-loading">Loading plans…</div>
      </div>
    )
  }

  const payment = catalog?.payment

  return (
    <div className="license-plans-page">
      <header className="license-plans-hero">
        <div>
          <p className="license-plans-eyebrow">Dropsoft Technologies Ltd</p>
          <h1>Build your HR licence stack</h1>
          <p className="license-plans-lead">
            Pay a one-time lifetime licence once, then renew annually for updates, support, and cloud access.
            Choose your tier, add modules, and settle through KCB or M-Pesa. After payment is confirmed, activate
            your licence in System maintenance.
          </p>
        </div>
        <div className="license-plans-hero-actions">
          {user ? (
            <Link to="/settings/system" className="license-plans-link-btn">
              Activate licence
            </Link>
          ) : (
            <Link to="/login" className="license-plans-link-btn">
              Sign in
            </Link>
          )}
          <p className="license-plans-hero-note">
            Upfront lifetime licence pricing sits above comparable Kenyan HR suites, with annual renewal for support and updates.
          </p>
        </div>
      </header>

      <section className="license-plans-grid">
        <div className="license-plans-main">
          <div className="license-plans-section-head">
            <h2>Plans</h2>
            <p className="license-plans-section-copy">
              Each tier includes core HR, payroll, attendance, leave, payslips, and role-based access.
            </p>
          </div>
          <div className="license-package-cards">
            {(catalog?.packages || []).map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                className={`license-package-card${packageId === pkg.id ? ' is-selected' : ''}`}
                onClick={() => setPackageId(pkg.id)}
              >
                <div className="license-package-card-head">
                  <h3>{pkg.name}</h3>
                  <p>{pkg.tagline}</p>
                </div>
                <p className="license-package-price">
                  {formatKes(pkg.monthlyKes)}
                  <span> renewal / month</span>
                </p>
                <p className="license-package-once">Lifetime licence from {formatKes(pkg.onboardingKes)}</p>
                <ul>
                  <li>{pkg.employeeCap ? `Up to ${pkg.employeeCap} employees` : 'Custom employee volume'}</li>
                  <li>{pkg.adminUsers} admin or manager users</li>
                  <li>{pkg.includedFeatures.length} modules included</li>
                </ul>
              </button>
            ))}
          </div>

          <div className="license-plans-controls">
            <label>
              Billing cycle
              <select value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)}>
                {(catalog?.billingCycles || []).map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.label}
                    {cycle.discountLabel ? ` (${cycle.discountLabel})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Employees
              <input
                type="number"
                min={1}
                max={5000}
                value={employeeCount}
                onChange={(e) => setEmployeeCount(Number(e.target.value) || 1)}
              />
            </label>
            <label>
              Commercial discount (%)
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={discountPercent}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (Number.isNaN(v)) setDiscountPercent(0)
                  else setDiscountPercent(Math.min(100, Math.max(0, v)))
                }}
              />
            </label>
            <label className="license-checkbox">
              <input
                type="checkbox"
                checked={includeOnboarding}
                onChange={(e) => setIncludeOnboarding(e.target.checked)}
              />
              Include one-time lifetime licence
            </label>
          </div>

          <div className="license-plans-section-head">
            <h2>Optional modules</h2>
            <p className="license-plans-section-copy">Add capabilities beyond your selected tier. Included modules are locked in.</p>
          </div>
          <div className="license-feature-grid">
            {(catalog?.features || []).map((feature) => {
              const included = activePackage?.includedFeatures?.includes(feature.id)
              const checked = included || selectedFeatures.includes(feature.id)
              return (
                <label key={feature.id} className={`license-feature-card${included ? ' is-included' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={included}
                    onChange={() => toggleFeature(feature.id)}
                  />
                  <div>
                    <strong>{feature.label}</strong>
                    <p>{feature.description}</p>
                    <span>{included ? 'Included in plan' : `${formatKes(feature.monthlyKes)}/month`}</span>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        <aside className="license-plans-summary">
          <h2>Package summary</h2>
          {quoteLoading || !quote ? (
            <p className="license-plans-muted">Calculating…</p>
          ) : (
            <>
              <div className="license-summary-block">
                <p className="license-summary-title">{quote.packageName}</p>
                <p className="license-plans-muted">
                  {quote.employeeCount} employees · {quote.billingCycle} billing
                  {quote.discountPercent > 0 ? ` · ${quote.discountPercent}% discount on renewal` : ''}
                </p>
                {(quote.lineItems || []).map((line) => (
                  <div
                    key={line.label}
                    className={`license-summary-line${line.amountKes < 0 ? ' is-discount' : ''}`}
                  >
                    <span>{line.label}</span>
                    <strong>{formatKes(line.amountKes)}</strong>
                  </div>
                ))}
                {quote.discountPercent > 0 && (
                  <p className="license-plans-muted license-discount-note">
                    The percentage discount applies to the renewal line only, not the one-time lifetime licence.
                  </p>
                )}
                <div className="license-summary-total">
                  <span>Total due now</span>
                  <strong>{formatKes(quote.totalDueKes)}</strong>
                </div>
              </div>

              <div className="license-contact-form">
                <h3>Company details</h3>
                <label>
                  Company name
                  <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </label>
                <label>
                  Contact name
                  <input value={contactName} onChange={(e) => setContactName(e.target.value)} />
                </label>
                <label>
                  Email
                  <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                </label>
                <label>
                  Phone
                  <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                </label>
              </div>

              <div className="license-payment-panel">
                <h3>Pay {payment?.legalName}</h3>
                <p>
                  <strong>KCB account:</strong> {payment?.kcbAccount}
                </p>
                <p>
                  <strong>M-Pesa paybill:</strong> {payment?.mpesaPaybill}
                </p>
                <p>
                  <strong>M-Pesa account:</strong> {payment?.mpesaAccount}
                </p>
                <p className="license-plans-muted">
                  Use your order reference as the payment narration after you generate the package below.
                </p>
              </div>

              <button
                type="button"
                className="license-submit-btn"
                disabled={submitting || !canSubmit}
                onClick={handleSubmit}
              >
                {submitting ? 'Creating order…' : 'Generate package & payment reference'}
              </button>
              {!canSubmit && (
                <p className="license-plans-muted">Sign in as admin or manager to submit an order.</p>
              )}
            </>
          )}

          {order && (
            <div className="license-order-result">
              <h3>Order created</h3>
              <p>
                Reference: <strong>{order.referenceCode}</strong>
              </p>
              <p>Amount: {formatKes(order.totalDueKes)}</p>
              <p className="license-plans-muted">
                Download the proforma invoice (PDF) and share it with Dropsoft together with proof of payment so your
                licence can be issued. After you receive your token, activate it under System maintenance.
              </p>
              <button
                type="button"
                className="license-proforma-btn"
                disabled={proformaLoading}
                onClick={handleDownloadProforma}
              >
                {proformaLoading ? 'Preparing PDF…' : 'Download proforma invoice (PDF)'}
              </button>
              <Link to="/settings/system" className="license-plans-link-btn license-plans-link-btn-secondary">
                Open licence activation
              </Link>
            </div>
          )}
        </aside>
      </section>
    </div>
  )
}

export default LicensePlans
