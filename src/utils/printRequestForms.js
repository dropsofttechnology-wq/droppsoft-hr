/** Shown at the bottom of every printed page (HTML + PDF reports). */
export const PRINT_BRANDING_FOOTER_TEXT =
  'System developed by Dropsoft Technologies Ltd | Tel: +254 710 689 274 | https://dropsoft.co.ke | Email: info@dropsoft.co.ke'

/** Compassionate, study & unpaid — extended paper form (signatures + deduction choice). Statutory codes use the standard layout. */
export function isCompanyPolicyLeaveType(leaveType) {
  const c = String(leaveType || '')
    .toUpperCase()
    .trim()
  return c === 'COMPASSIONATE' || c === 'STUDY' || c === 'UNPAID'
}

/**
 * Opens a print-friendly HTML document (signing / stamping after approval).
 * @param {string} title
 * @param {string} innerHtml — safe HTML fragment (trusted app content only)
 * @param {{ logoUrl?: string, onePage?: boolean }} [options] — onePage tightens layout for a single A4 sheet
 */
export function openPrintableForm(title, innerHtml, options = {}) {
  const logoUrl = options.logoUrl && String(options.logoUrl).trim()
  const onePage = options.onePage === true
  const resolvedLogoUrl = logoUrl || '/logo.png'
  const logoBlock = `<div class="print-doc-logo-wrap"><img class="print-doc-logo" src="${escapeHtml(resolvedLogoUrl)}" alt="" crossorigin="anonymous" onerror="if(this.dataset.fallback!=='1'){this.dataset.fallback='1';this.src='/logo.png';return;}this.style.display='none';"/></div>`

  // Do not pass noopener in the features string — browsers return null from window.open(),
  // so we never get a reference to write the print document (looks like a blocked pop-up).
  const w = window.open('about:blank', '_blank')
  if (!w) {
    window.alert('Please allow pop-ups to print this form.')
    return
  }
  const doc = w.document
  doc.open()
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>
    @media print {
      @page { margin: ${onePage ? '8mm 10mm 18mm 10mm' : '14mm 14mm 22mm 14mm'}; size: A4; }
      .no-print { display: none !important; }
      .print-doc-footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 6px 12px 4px;
        border-top: 1px solid #ccc;
        background: #fff;
      }
    }
    html { background: #ffffff; color-scheme: only light; }
    .print-doc-shell { min-height: 100vh; box-sizing: border-box; padding-bottom: 56px; background: #ffffff; }
    .print-doc-shell.print-doc-one-page { padding-bottom: 48px; }
    body.print-body-one-page { font-size: 10.5pt; line-height: 1.5; padding: 12px 16px; }
    body.print-body-one-page .print-doc-logo-wrap { margin-bottom: 6px; }
    .print-doc-logo-wrap { text-align: center; margin-bottom: ${onePage ? '10px' : '18px'}; }
    .print-doc-logo { max-height: ${onePage ? '58px' : '82px'}; max-width: 220px; object-fit: contain; background: transparent; }
    body { font-family: system-ui, Segoe UI, sans-serif; font-size: 12.5pt; color: #111; line-height: 1.52; max-width: 720px; margin: 0 auto; padding: 24px; background: #ffffff; }
    .print-doc-footer {
      margin-top: ${onePage ? '12px' : '28px'};
      padding-top: 8px;
      border-top: 1px solid #ddd;
      font-size: ${onePage ? '7pt' : '8pt'};
      line-height: 1.3;
      color: #333;
      text-align: center;
    }
    h1 { font-size: ${onePage ? '1.15rem' : '1.35rem'}; margin: 0 0 ${onePage ? '8px' : '16px'}; text-align: center; }
    .meta { margin-bottom: ${onePage ? '10px' : '20px'}; }
    .meta p { margin: ${onePage ? '4px 0' : '8px 0'}; }
    .label { font-weight: 600; display: inline-block; min-width: ${onePage ? '120px' : '140px'}; }
    .signatures { margin-top: ${onePage ? '26px' : '52px'}; display: grid; grid-template-columns: 1fr 1fr; gap: ${onePage ? '18px' : '34px'}; }
    .signatures.signatures-three { grid-template-columns: 1fr 1fr 1fr; }
    .sign-block { border-top: 1px solid #333; padding-top: ${onePage ? '14px' : '18px'}; min-height: ${onePage ? '156px' : '208px'}; font-size: ${onePage ? '10pt' : 'inherit'}; }
    .print-form-admin-notes {
      border: 1px solid #2563eb;
      background: #eff6ff;
      padding: ${onePage ? '10px 12px' : '12px 14px'};
      margin: ${onePage ? '10px 0' : '14px 0'};
      border-radius: 4px;
      page-break-inside: avoid;
    }
    .print-form-admin-notes strong {
      display: block;
      font-size: ${onePage ? '9.5pt' : '10.5pt'};
      color: #1e3a8a;
      margin-bottom: 6px;
    }
    .print-form-admin-notes-body {
      font-size: ${onePage ? '9pt' : '10pt'};
      line-height: 1.45;
      color: #111;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .toolbar { margin-bottom: 16px; }
    button { padding: 8px 16px; font-size: 14px; cursor: pointer; }
    .print-doc-sub { font-size: ${onePage ? '9.5pt' : '11pt'}; font-weight: 600; color: #444; margin: -4px 0 8px; text-align: center; }
    .print-admin-note { border: 1px solid #c9a227; background: #fffbeb; padding: ${onePage ? '6px 8px' : '10px 12px'}; margin: ${onePage ? '8px 0' : '14px 0'}; font-size: ${onePage ? '8.5pt' : '10pt'}; line-height: 1.35; color: #1a1a1a; }
    .print-admin-note strong { color: #111; }
    .print-system-ok { border: 1px solid #2d6a4f; background: #f0fdf4; padding: ${onePage ? '6px 8px' : '8px 12px'}; margin: ${onePage ? '8px 0' : '14px 0'}; font-size: ${onePage ? '8.5pt' : '10pt'}; color: #14532d; }
    .print-system-mark { border: 1px solid #333; padding: ${onePage ? '8px 10px' : '12px 14px'}; margin-top: ${onePage ? '8px' : '18px'}; page-break-inside: avoid; }
    .print-system-mark h2 { font-size: ${onePage ? '9.5pt' : '11pt'}; margin: 0 0 6px; text-align: left; }
    .print-system-hint { font-size: ${onePage ? '8.5pt' : '9.5pt'}; color: #444; margin: 0 0 6px; line-height: 1.3; }
    .print-system-line { font-size: ${onePage ? '8.5pt' : '10pt'}; margin: 6px 0 0; line-height: 1.4; }
    .print-policy-notes { border: 1px solid #94a3b8; background: #f8fafc; padding: ${onePage ? '6px 10px' : '10px 12px'}; margin: ${onePage ? '8px 0' : '12px 0'}; font-size: ${onePage ? '8.5pt' : '10pt'}; line-height: 1.4; }
    .print-policy-notes ol { margin: 6px 0 0; padding-left: 1.2rem; }
    .print-policy-notes li { margin: 4px 0; }
    .print-deduction-choice { margin: ${onePage ? '8px 0' : '12px 0'}; padding: ${onePage ? '6px 8px' : '8px 10px'}; border: 1px dashed #64748b; font-size: ${onePage ? '8.5pt' : '10pt'}; line-height: 1.4; }
    .print-consent-clause { margin: ${onePage ? '8px 0' : '14px 0'}; padding: ${onePage ? '8px 10px' : '10px 12px'}; border: 1px solid #334155; font-size: ${onePage ? '9pt' : '10.5pt'}; line-height: 1.45; font-style: italic; }
    .print-lead-muted { font-size: ${onePage ? '8.5pt' : '0.95rem'}; color: #444; margin: ${onePage ? '6px 0' : '12px 0'}; }
  </style>
</head>
<body${onePage ? ' class="print-body-one-page"' : ''}>
  <div class="toolbar no-print">
    <button type="button" onclick="window.print()">Print</button>
    <button type="button" onclick="window.close()">Close</button>
  </div>
  <div class="print-doc-shell${onePage ? ' print-doc-one-page' : ''}">
    ${logoBlock}
    ${innerHtml}
    <div class="print-doc-footer">${escapeHtml(PRINT_BRANDING_FOOTER_TEXT)}</div>
  </div>
</body>
</html>`)
  doc.close()
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** HR/admin notes shown on printed leave or salary advance forms (plain text). */
export function printAdminFormNotesHtml(adminFormNotes) {
  const t = String(adminFormNotes || '').trim()
  if (!t) return ''
  return `
  <div class="print-form-admin-notes">
    <strong>Administrator notes (printed on this form)</strong>
    <div class="print-form-admin-notes-body">${escapeHtml(t)}</div>
  </div>`
}

/** Single-page friendly — short system strip + one optional line for pending. */
function leaveSystemReminderAndMark(systemStatus, compact = true) {
  if (systemStatus === 'rejected') {
    return `
  <div class="print-admin-note" style="border-color:#dc2626;background:#fef2f2;">
    <strong>System:</strong> Rejected in Dropsoft HR — print for records only.
  </div>`
  }
  const pending = systemStatus === 'pending'
  if (!pending) {
    return `
  <div class="print-system-ok">
    <strong>System:</strong> Approved in Dropsoft HR — filing copy only.
  </div>`
  }
  if (compact) {
    return `
  <div class="print-admin-note">
    <strong>Administrator:</strong> After sign-off, approve in <strong>Leave management</strong> so balances stay correct.
  </div>
  <p class="print-system-line">☐ Posted in Dropsoft HR on: ________________ &nbsp; Initials: ________________</p>`
  }
  return `
  <div class="print-admin-note">
    <strong>Administrator:</strong> You may print this before approving in the system. After internal sign-off, open <strong>Leave management</strong>
    in Dropsoft HR and click <strong>Approve</strong> on this request so leave balances and records stay correct.
  </div>
  <div class="print-system-mark">
    <h2>Mark as approved on the system</h2>
    <p class="print-system-hint">When the request has been authorised in writing and you have recorded the approval in Dropsoft HR, complete the line below (optional paper trail).</p>
    <p class="print-system-line">☐ Posted / approved in Dropsoft HR (Leave management) on: ____________________ &nbsp; Initials: ____________________</p>
  </div>`
}

function companyPolicyLeaveNotesAndDeduction() {
  return `
  <div class="print-policy-notes">
    <strong>Notes</strong>
    <ol>
      <li>All off days will be deducted from the annual leave balance or salary.</li>
      <li>If this is a sick leave, I will provide the necessary documentation upon return.</li>
    </ol>
  </div>
  <div class="print-deduction-choice">
    <strong>HR / Super admin — apply off days (tick one):</strong>
    <p style="margin:6px 0 0;">☐ Deduct from annual leave balance &nbsp;&nbsp;&nbsp; ☐ Deduct from salary</p>
  </div>`
}

export function buildLeaveApprovalPrintHtml({
  companyName,
  employeeName,
  staffNo,
  department,
  leaveType,
  /** Same as request.leave_type (leave code) — drives company-policy vs statutory layout */
  leaveTypeCode,
  startDate,
  endDate,
  returnToWorkDate,
  daysRequested,
  reason,
  approvedAt,
  approverName,
  systemStatus = 'approved',
  requestRef,
  adminFormNotes
}) {
  const pending = systemStatus === 'pending'
  const codeForPolicy = leaveTypeCode != null && String(leaveTypeCode).trim() !== '' ? leaveTypeCode : leaveType
  const policyForm = isCompanyPolicyLeaveType(codeForPolicy)
  const title = pending ? 'Leave request' : 'Leave approval'
  const sub = pending ? '(Not yet approved in system — print allowed)' : ''
  const sysApprovedLabel = pending ? 'Pending — approve in Leave management' : escapeHtml(approvedAt || '—')
  const sysByLabel = pending ? '—' : escapeHtml(approverName || '—')
  const refLine =
    requestRef != null && String(requestRef).trim()
      ? `<p style="font-size:8.5pt;color:#666;margin:0 0 6px;text-align:center;">Reference: ${escapeHtml(String(requestRef).trim())}</p>`
      : ''

  const signaturesPolicy = `
  <div class="signatures signatures-three">
    <div class="sign-block">Applicant — signature &amp; date</div>
    <div class="sign-block">Approver 1 — signature &amp; date</div>
    <div class="sign-block">Approver 2 — signature &amp; date</div>
  </div>`

  const signaturesStatutory = `
  <div class="signatures signatures-three">
    <div class="sign-block">Employee — signature &amp; date</div>
    <div class="sign-block">Authorising manager 1 — signature &amp; date</div>
    <div class="sign-block">Authorising manager 2 — signature &amp; date</div>
  </div>`

  return `
  <h1>${title} — ${escapeHtml(companyName || 'Company')}</h1>
  ${sub ? `<p class="print-doc-sub">${escapeHtml(sub)}</p>` : ''}
  ${refLine}
  <div class="meta">
    <p><span class="label">Employee</span> ${escapeHtml(employeeName || '')}</p>
    ${staffNo ? `<p><span class="label">Staff No.</span> ${escapeHtml(staffNo)}</p>` : ''}
    <p><span class="label">Leave type</span> ${escapeHtml(leaveType || '')}</p>
    <p><span class="label">Start date</span> <strong>${escapeHtml(startDate || '')}</strong></p>
    <p><span class="label">Last leave date</span> ${escapeHtml(endDate || '')}</p>
    <p><span class="label">Return to work</span> <strong>${escapeHtml(returnToWorkDate || '—')}</strong></p>
    <p><span class="label">Days</span> ${escapeHtml(String(daysRequested ?? ''))}</p>
    ${reason ? `<p><span class="label">Reason</span> ${escapeHtml(reason)}</p>` : ''}
    <p><span class="label">System approval (HR)</span> ${sysApprovedLabel}</p>
    <p><span class="label">Approved by (in system)</span> ${sysByLabel}</p>
  </div>
  ${printAdminFormNotesHtml(adminFormNotes)}
  ${policyForm ? companyPolicyLeaveNotesAndDeduction() : ''}
  ${leaveSystemReminderAndMark(systemStatus, true)}
  <p class="print-lead-muted">${policyForm ? 'Company policy leave — sign and file as per internal procedure.' : 'Statutory / standard leave — for internal filing, signature, and stamp as per company policy.'}</p>
  ${policyForm ? signaturesPolicy : signaturesStatutory}`
}

function advanceSystemReminderAndMark(systemStatus, compact = true) {
  if (systemStatus === 'rejected') {
    return `
  <div class="print-admin-note" style="border-color:#dc2626;background:#fef2f2;">
    <strong>System:</strong> Rejected in Dropsoft HR — print for records only.
  </div>`
  }
  const pending = systemStatus === 'pending'
  if (!pending) {
    return `
  <div class="print-system-ok">
    <strong>System:</strong> Approved and posted in Dropsoft HR — filing copy only.
  </div>`
  }
  if (compact) {
    return `
  <div class="print-admin-note">
    <strong>Administrator:</strong> After sign-off, use <strong>Salary advance → Approve &amp; post to payroll</strong>.
  </div>
  <p class="print-system-line">☐ Posted in Dropsoft HR on: ________________ &nbsp; Initials: ________________</p>`
  }
  return `
  <div class="print-admin-note">
    <strong>Administrator:</strong> You may print this before approving in the system. After internal sign-off, open <strong>Salary advance</strong>
    in Dropsoft HR and use <strong>Approve &amp; post to payroll</strong> so deductions and net pay stay correct.
  </div>
  <div class="print-system-mark">
    <h2>Mark as approved on the system</h2>
    <p class="print-system-hint">When the advance has been authorised in writing and you have approved it in Dropsoft HR (with instalments / payroll month), complete the line below (optional paper trail).</p>
    <p class="print-system-line">☐ Approved &amp; posted in Dropsoft HR (Salary advance) on: ____________________ &nbsp; Initials: ____________________</p>
  </div>`
}

const SALARY_ADVANCE_CONSENT_CLAUSE =
  'I confirm my consent for the agreed deduction. This can be processed at the time of salary payment without any further reference to me.'

export function buildSalaryAdvancePrintHtml({
  companyName,
  employeeName,
  staffNo,
  amount,
  itemLines,
  documentLabel = 'Salary advance',
  reason,
  repaymentPeriod,
  forPeriod,
  applicationDate,
  installmentCount,
  approvedAt,
  approverName,
  systemStatus = 'approved',
  requestRef,
  adminFormNotes
}) {
  const amt = typeof amount === 'number' ? amount.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(amount ?? '')
  const rows = Array.isArray(itemLines) ? itemLines : []
  const pending = systemStatus === 'pending'
  const rejected = systemStatus === 'rejected'
  const titleBase = String(documentLabel || 'Salary advance').trim() || 'Salary advance'
  const title = pending ? `${titleBase} request` : rejected ? `${titleBase} request (rejected)` : `${titleBase} approval`
  const sub = pending ? '(Not yet approved in system — print allowed)' : ''
  const sysApprovedLabel = pending
    ? 'Pending — use Salary advance → Approve'
    : rejected
      ? 'Rejected in system'
      : escapeHtml(approvedAt || '—')
  const sysByLabel = pending ? '—' : rejected ? '—' : escapeHtml(approverName || '—')
  const refLine =
    requestRef != null && String(requestRef).trim()
      ? `<p style="font-size:8.5pt;color:#666;margin:0 0 6px;text-align:center;">Reference: ${escapeHtml(String(requestRef).trim())}</p>`
      : ''

  return `
  <h1>${title} — ${escapeHtml(companyName || 'Company')}</h1>
  ${sub ? `<p class="print-doc-sub">${escapeHtml(sub)}</p>` : ''}
  ${refLine}
  <div class="meta">
    <p><span class="label">Employee</span> ${escapeHtml(employeeName || '')}</p>
    ${staffNo ? `<p><span class="label">Staff No.</span> ${escapeHtml(staffNo)}</p>` : ''}
    ${applicationDate ? `<p><span class="label">Application date</span> ${escapeHtml(applicationDate)}</p>` : ''}
    ${installmentCount != null && installmentCount !== '' ? `<p><span class="label">Installments (months)</span> ${escapeHtml(String(installmentCount))}</p>` : ''}
    ${forPeriod ? `<p><span class="label">First payroll month (deduction)</span> ${escapeHtml(forPeriod)}</p>` : ''}
    <p><span class="label">Amount requested</span> KES ${escapeHtml(amt)}</p>
    ${
      rows.length
        ? `<div style="margin-top:10px;overflow-x:auto;">
      <table style="border-collapse:collapse;width:100%;font-size:11px;">
        <thead>
          <tr>
            <th style="text-align:left;border:1px solid #ccc;padding:5px;">Item code</th>
            <th style="text-align:right;border:1px solid #ccc;padding:5px;">Qty</th>
            <th style="text-align:right;border:1px solid #ccc;padding:5px;">Unit price</th>
            <th style="text-align:right;border:1px solid #ccc;padding:5px;">Line total</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((line) => {
              const qty = Number(line?.qty) || 0
              const unitPrice = Number(line?.unit_price) || 0
              const total = Math.round(qty * unitPrice * 100) / 100
              return `<tr>
                <td style="border:1px solid #ccc;padding:5px;">${escapeHtml(String(line?.item_code || ''))}</td>
                <td style="text-align:right;border:1px solid #ccc;padding:5px;">${escapeHtml(
                  qty.toLocaleString(undefined, { maximumFractionDigits: 3 })
                )}</td>
                <td style="text-align:right;border:1px solid #ccc;padding:5px;">${escapeHtml(
                  unitPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })
                )}</td>
                <td style="text-align:right;border:1px solid #ccc;padding:5px;">${escapeHtml(
                  total.toLocaleString(undefined, { maximumFractionDigits: 2 })
                )}</td>
              </tr>`
            })
            .join('')}
        </tbody>
      </table>
    </div>`
        : ''
    }
    ${repaymentPeriod ? `<p><span class="label">Repayment</span> ${escapeHtml(repaymentPeriod)}</p>` : ''}
    ${reason ? `<p><span class="label">Purpose</span> ${escapeHtml(reason)}</p>` : ''}
    <p><span class="label">System approval (HR)</span> ${sysApprovedLabel}</p>
    <p><span class="label">Approved by (in system)</span> ${sysByLabel}</p>
  </div>
  ${printAdminFormNotesHtml(adminFormNotes)}
  <div class="print-consent-clause">${escapeHtml(SALARY_ADVANCE_CONSENT_CLAUSE)}</div>
  ${advanceSystemReminderAndMark(systemStatus, true)}
  <p class="print-lead-muted">For payroll and finance records. Sign after reading the consent above.</p>
  <div class="signatures signatures-three">
    <div class="sign-block">Employee — signature &amp; date (confirms consent)</div>
    <div class="sign-block">Authorising manager 1 — signature &amp; date</div>
    <div class="sign-block">Authorising manager 2 — signature &amp; date</div>
  </div>`
}
