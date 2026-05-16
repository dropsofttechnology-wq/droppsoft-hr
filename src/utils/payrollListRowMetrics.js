/** Re-export shared metrics (packaged in Electron asar; source lives in /shared). */
export {
  PAYROLL_LIST_TABLE_HEADERS,
  pickPayrollRunNumber,
  calcHousingAllowance,
  getPayrollListRowMetrics,
  formatPayrollListRowForPdf
} from '../../shared/payrollListRowMetrics.js'
