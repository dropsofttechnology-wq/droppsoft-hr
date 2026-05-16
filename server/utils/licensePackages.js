/** @typedef {'starter' | 'growth' | 'business' | 'enterprise'} PackageId */
/** @typedef {'monthly' | 'quarterly' | 'yearly'} BillingCycle */

export const PAYMENT_DETAILS = {
  legalName: 'Dropsoft Technologies Ltd',
  kcbAccount: '1339824868',
  mpesaPaybill: '522522',
  mpesaAccount: '1339824868',
  currency: 'KES'
}

export const BILLING_CYCLES = [
  { id: 'monthly', label: 'Monthly', multiplier: 1, discountLabel: null },
  { id: 'quarterly', label: 'Quarterly', multiplier: 3, discountLabel: '5% off' },
  { id: 'yearly', label: 'Yearly', multiplier: 12, discountLabel: '15% off' }
]

/** @type {Array<{ id: string, label: string, description: string, monthlyKes: number }>} */
export const BILLABLE_FEATURES = [
  { id: 'face_terminal', label: 'Face attendance & terminal', description: 'Face enrollment and kiosk clocking.', monthlyKes: 1700 },
  { id: 'salary_advance_shopping', label: 'Salary advance & shopping', description: 'Staff advance and shopping deduction workflows.', monthlyKes: 1350 },
  { id: 'statutory_compliance', label: 'Statutory & compliance', description: 'Statutory reports and compliance exports.', monthlyKes: 1150 },
  { id: 'company_analysis', label: 'Company analysis', description: 'Advanced workforce and cost analytics.', monthlyKes: 2000 },
  { id: 'multi_company', label: 'Multi-company', description: 'Manage more than one company in one deployment.', monthlyKes: 2800 },
  { id: 'audit_backup', label: 'Audit log & backup', description: 'Full audit trail and encrypted backup tools.', monthlyKes: 900 },
  { id: 'mobile_app', label: 'Mobile app access', description: 'Android app for attendance, leave, and payslips.', monthlyKes: 1000 }
]

/** @type {Array<{ id: PackageId, name: string, tagline: string, monthlyKes: number, employeeCap: number | null, adminUsers: number, includedFeatures: string[], onboardingKes: number, overagePerEmployeeKes: number }>} */
export const LICENSE_PACKAGES = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Small teams getting started with HR and payroll.',
    monthlyKes: 3200,
    employeeCap: 25,
    adminUsers: 2,
    includedFeatures: [],
    onboardingKes: 54000,
    overagePerEmployeeKes: 68
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'Growing SMEs with attendance and advance workflows.',
    monthlyKes: 4550,
    employeeCap: 100,
    adminUsers: 6,
    includedFeatures: ['face_terminal', 'salary_advance_shopping', 'mobile_app'],
    onboardingKes: 82000,
    overagePerEmployeeKes: 68
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'Mid-size operations with analytics and compliance.',
    monthlyKes: 8600,
    employeeCap: 300,
    adminUsers: 15,
    includedFeatures: ['face_terminal', 'salary_advance_shopping', 'statutory_compliance', 'company_analysis', 'mobile_app', 'audit_backup'],
    onboardingKes: 138000,
    overagePerEmployeeKes: 68
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Large or multi-company deployments with custom scope.',
    monthlyKes: 11000,
    employeeCap: null,
    adminUsers: 30,
    includedFeatures: BILLABLE_FEATURES.map((f) => f.id),
    onboardingKes: 185000,
    overagePerEmployeeKes: 55
  }
]

const PACKAGE_BY_ID = Object.fromEntries(LICENSE_PACKAGES.map((p) => [p.id, p]))
const FEATURE_BY_ID = Object.fromEntries(BILLABLE_FEATURES.map((f) => [f.id, f]))
const CYCLE_BY_ID = Object.fromEntries(BILLING_CYCLES.map((c) => [c.id, c]))

function roundKes(n) {
  return Math.round(Number(n) || 0)
}

function cycleDiscountMultiplier(cycle) {
  if (cycle === 'yearly') return 0.85
  if (cycle === 'quarterly') return 0.95
  return 1
}

/** Extra commercial discount on the renewal (subscription) line only, 0–100%. */
export function normalizeDiscountPercent(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(100, Math.round(n * 100) / 100)
}

/**
 * @param {{ packageId: string, billingCycle: string, employeeCount: number, selectedFeatures?: string[], includeOnboarding?: boolean, discountPercent?: number }} input
 */
export function buildLicenseQuote(input) {
  const packageId = String(input.packageId || '').toLowerCase()
  const billingCycle = String(input.billingCycle || 'monthly').toLowerCase()
  const pkg = PACKAGE_BY_ID[packageId]
  if (!pkg) throw new Error('Unknown package')
  if (!CYCLE_BY_ID[billingCycle]) throw new Error('billingCycle must be monthly, quarterly, or yearly')

  const employeeCount = Math.max(1, Math.floor(Number(input.employeeCount) || 1))
  const includeOnboarding = input.includeOnboarding === true
  const selected = Array.isArray(input.selectedFeatures)
    ? [...new Set(input.selectedFeatures.map((f) => String(f).trim()).filter(Boolean))]
    : []

  const included = new Set(pkg.includedFeatures)
  const addOnFeatures = selected.filter((id) => !included.has(id) && FEATURE_BY_ID[id])
  const addOnMonthly = addOnFeatures.reduce((sum, id) => sum + FEATURE_BY_ID[id].monthlyKes, 0)

  let overageEmployees = 0
  if (pkg.employeeCap != null && employeeCount > pkg.employeeCap) {
    overageEmployees = employeeCount - pkg.employeeCap
  }

  const cycle = CYCLE_BY_ID[billingCycle]
  const baseMonthly = pkg.monthlyKes + addOnMonthly + overageEmployees * pkg.overagePerEmployeeKes
  const grossPeriod = baseMonthly * cycle.multiplier
  const subscriptionSubtotalKes = roundKes(grossPeriod * cycleDiscountMultiplier(billingCycle))
  const discountPercent = normalizeDiscountPercent(
    input.discountPercent ?? input.discount_percent ?? 0
  )
  const discountAmountKes =
    discountPercent > 0 ? roundKes((subscriptionSubtotalKes * discountPercent) / 100) : 0
  const subscriptionKes = roundKes(Math.max(0, subscriptionSubtotalKes - discountAmountKes))
  const onboardingKes = includeOnboarding ? roundKes(pkg.onboardingKes) : 0
  const totalDueKes = subscriptionKes + onboardingKes

  const lineItems = [
    { label: `${pkg.name} renewal licence (${billingCycle})`, amountKes: subscriptionSubtotalKes }
  ]
  if (discountPercent > 0 && discountAmountKes > 0) {
    lineItems.push({ label: `Commercial discount (${discountPercent}%)`, amountKes: -discountAmountKes })
  }
  if (onboardingKes > 0) {
    lineItems.push({ label: 'One-time lifetime licence', amountKes: onboardingKes })
  }

  return {
    packageId: pkg.id,
    packageName: pkg.name,
    billingCycle,
    employeeCount,
    employeeCap: pkg.employeeCap,
    adminUsers: pkg.adminUsers,
    includedFeatures: [...included],
    addOnFeatures,
    overageEmployees,
    subscriptionSubtotalKes,
    discountPercent,
    discountAmountKes,
    subscriptionKes,
    onboardingKes,
    totalDueKes,
    currency: PAYMENT_DETAILS.currency,
    payment: PAYMENT_DETAILS,
    lineItems
  }
}

export function getLicenseCatalogPayload() {
  return {
    payment: PAYMENT_DETAILS,
    billingCycles: BILLING_CYCLES,
    packages: LICENSE_PACKAGES,
    features: BILLABLE_FEATURES
  }
}
