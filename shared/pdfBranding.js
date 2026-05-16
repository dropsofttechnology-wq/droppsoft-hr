/** PDF letterhead + watermark options — shared by web UI and Node/Electron server (no DOM). */

/** Diagonal watermark is always applied on PDF exports; strength is controlled via opacity settings only. */
export const DEFAULT_PDF_BRANDING = {
  watermarkEnabled: true,
  letterheadLogoEnabled: true,
  watermarkOpacityMul: 0.52
}

function clampOpacityMul(v) {
  return Math.min(1.25, Math.max(0.15, v))
}

export function mergePdfBranding(overrides = {}) {
  const o = overrides && typeof overrides === 'object' ? overrides : {}
  const mul = Number(o.watermarkOpacityMul)
  const watermarkOpacityMul =
    Number.isFinite(mul) && mul > 0 ? clampOpacityMul(mul) : DEFAULT_PDF_BRANDING.watermarkOpacityMul

  const payslipRaw = Number(o.watermarkOpacityMulPayslip)
  /** Stronger default on payslips (dense grids); overridden by `pdf_payslip_watermark_opacity` when set. */
  const watermarkOpacityMulPayslip =
    Number.isFinite(payslipRaw) && payslipRaw > 0
      ? clampOpacityMul(payslipRaw)
      : clampOpacityMul(Math.max(watermarkOpacityMul * 1.35, 0.72))

  return {
    watermarkEnabled: true,
    letterheadLogoEnabled:
      o.letterheadLogoEnabled === undefined
        ? DEFAULT_PDF_BRANDING.letterheadLogoEnabled
        : o.letterheadLogoEnabled !== false,
    watermarkOpacityMul,
    watermarkOpacityMulPayslip
  }
}

/** Map persisted company settings to branding (Settings → PDF appearance). */
export function pdfBrandingFromCompanySettings(raw = {}) {
  if (!raw || typeof raw !== 'object') return mergePdfBranding({})
  const lhRaw = raw.pdf_letterhead_logo_enabled
  const op = parseFloat(raw.pdf_watermark_opacity)
  const opPayslip = parseFloat(raw.pdf_payslip_watermark_opacity)
  const overrides = {}
  if (lhRaw !== undefined && lhRaw !== null && lhRaw !== '') {
    overrides.letterheadLogoEnabled =
      lhRaw === true || lhRaw === 'true' || lhRaw === '1' || lhRaw === 1
  }
  if (Number.isFinite(op) && op > 0) overrides.watermarkOpacityMul = op
  if (Number.isFinite(opPayslip) && opPayslip > 0) overrides.watermarkOpacityMulPayslip = opPayslip
  return mergePdfBranding(overrides)
}
