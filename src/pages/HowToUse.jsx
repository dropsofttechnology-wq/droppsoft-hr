import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isLocalDataSource } from '../config/dataSource'
import './HowToUse.css'

const TOC_ALL = [
  { id: 'start', label: 'Getting started' },
  { id: 'system', label: 'System overview' },
  { id: 'features', label: 'Features overview' },
  { id: 'lan', label: 'Server & client (step by step)', show: (ctx) => ctx.local },
  { id: 'mobile', label: 'Android app', show: (ctx) => ctx.local },
  { id: 'company', label: 'Company & employees', show: (ctx) => ctx.isCompanyAdmin },
  { id: 'attendance', label: 'Attendance' },
  { id: 'leave', label: 'Leave' },
  { id: 'advance', label: 'Salary advances' },
  { id: 'holidays', label: 'Holidays', show: (ctx) => ctx.isStaffOps },
  { id: 'payroll', label: 'Payroll & payslips', show: (ctx) => ctx.isCompanyAdmin },
  { id: 'school-finance', label: 'School fee ledger & expenses', show: (ctx) => ctx.local && ctx.isStaffOps },
  { id: 'reports', label: 'Reports & banks', show: (ctx) => ctx.isCompanyAdmin },
  { id: 'settings', label: 'Settings & backup' },
  { id: 'users', label: 'Users & login', show: (ctx) => ctx.isCompanyAdmin && ctx.local },
  { id: 'tips', label: 'Tips' }
]

const HowToUse = () => {
  const { user } = useAuth()
  const role = user?.prefs?.role || 'admin'
  const isSuperAdmin = role === 'super_admin'
  const isCompanyAdmin =
    role === 'admin' || role === 'super_admin' || role === 'manager'
  const isStaffOps =
    isCompanyAdmin || role === 'cashier'
  const isApprovalOps = isCompanyAdmin
  const local = isLocalDataSource()

  const ctx = { isSuperAdmin, isCompanyAdmin, isStaffOps, isApprovalOps, local }
  const toc = TOC_ALL.filter((item) => (item.show ? item.show(ctx) : true))
  const printGuide = () => window.print()

  return (
    <div className="how-to-use">
      <header className="how-to-header">
        <h1>How to use Dropsoft HR</h1>
        <p className="how-to-lead">
          Quick guides for everyday tasks. Your account role controls which menus you see—only relevant sections apply
          to you.
        </p>
        <div className="how-to-header-actions">
          <button type="button" className="how-to-print-btn" onClick={printGuide}>
            Print / Save as PDF
          </button>
        </div>
      </header>

      <nav className="how-to-toc" aria-label="On this page">
        <h2 className="how-to-toc-heading">On this page</h2>
        {toc.map((item) => (
          <a key={item.id} href={`#${item.id}`} className="how-to-toc-link">
            {item.label}
          </a>
        ))}
      </nav>

      <section id="system" className="how-to-section">
        <h2>System overview</h2>
        <p>
          <strong>Dropsoft HR</strong> is a complete HR and payroll operations platform for local desktop/LAN use, with
          Android mobile access. It combines employee administration, attendance, leave workflows, salary advances,
          payroll processing, payslips, reporting, and backups in one integrated system.
        </p>
        <ul className="how-to-list">
          <li>
            <strong>HR core:</strong> companies, employees, opening balances, role-based access, and user management.
          </li>
          <li>
            <strong>Attendance:</strong> face recognition, QR scanner, manual entry, bulk uploads, and history analytics.
          </li>
          <li>
            <strong>Leave &amp; approvals:</strong> leave requests, approval queues, holidays, leave types, and printable
            forms.
          </li>
          <li>
            <strong>Salary advances:</strong> request, maker-checker approval, instalment planning, payroll posting, and
            reversal/deactivation controls.
          </li>
          <li>
            <strong>Payroll:</strong> payroll runs, deductions, payslips, and compliance/report outputs.
          </li>
          <li>
            <strong>Operations:</strong> LAN server/client setup, Android pairing, encrypted backup/restore, and system
            maintenance.
          </li>
        </ul>
      </section>

      <section id="start" className="how-to-section">
        <h2>Getting started</h2>
        <ol className="how-to-steps">
          <li>
            <strong>Sign in</strong> with the email and password your administrator gave you.
          </li>
          <li>
            <strong>Select a company</strong> from the company selector (usually in the header or dashboard) so all
            data you see belongs to that organisation.
          </li>
          <li>
            Use the <strong>sidebar</strong> to move between areas. If a menu item is missing, your role does not
            include that feature—ask an administrator if you need access.
          </li>
          {isCompanyAdmin && local && (
            <li>
              <strong>Local desktop app:</strong> under <strong>Settings → Users &amp; roles</strong>, admins and
              managers can <strong>create</strong> login accounts (email and password) and assign roles. Only a{' '}
              <strong>super admin</strong> can create another super admin.
            </li>
          )}
        </ol>
      </section>

      <section id="features" className="how-to-section">
        <h2>Features overview</h2>
        <p>
          Menus depend on your <strong>role</strong> (employee, cashier, manager, admin, super admin). Below is what the
          desktop app typically offers when you use the <strong>local Windows</strong> build; cloud deployments may differ
          slightly.
        </p>

        <h3>Overview &amp; help</h3>
        <ul className="how-to-list">
          <li>
            <strong>Dashboard</strong> — summary of HR activity and shortcuts.
          </li>
          <li>
            <strong>Company analysis</strong> — trends and breakdowns (admins/managers).
          </li>
          <li>
            <strong>How to use</strong> — this page.
          </li>
          {local && (
            <li>
              <strong>
                <Link to="/installation">Server installation info</Link>
              </strong>{' '}
              — technical reference for the HR API, data folder, and firewall (local desktop).
            </li>
          )}
          <li>
            Use <strong>Install App</strong> in the sidebar footer when shown to add the web app to your home screen (PWA).
          </li>
        </ul>

        <h3>My HR (everyone)</h3>
        <ul className="how-to-list">
          <li>
            <strong>Attendance history</strong> — review clock events for allowed dates.
          </li>
          <li>
            <strong>Request leave</strong> — submit leave with type and reason.
          </li>
          {local && (
            <li>
              <strong>Request salary advance</strong> — submit advance requests (desktop; also on Android from Mobile home).
            </li>
          )}
          <li>
            <strong>Payslips</strong> — view published payslips when your process allows.
          </li>
        </ul>

        {isCompanyAdmin && (
          <>
            <h3>Organisation</h3>
            <ul className="how-to-list">
              <li>
                <strong>Companies</strong> — legal name, tax, logo, and company-scoped data.
              </li>
              <li>
                <strong>Employees</strong> — profiles, IDs, bank details, links to user accounts, CSV bulk import where
                available.
              </li>
              <li>
                <strong>Opening balances</strong> — carry over absences, advance/shopping splits, leave, and deductions when
                onboarding or migrating.
              </li>
            </ul>

            <h3>Attendance (admins)</h3>
            <ul className="how-to-list">
              <li>
                <strong>Attendance terminal</strong> — shared clock-in screen (camera).
              </li>
              <li>
                <strong>Face enrollment</strong> — register faces for recognition at the terminal.
              </li>
              <li>
                <strong>Bulk attendance</strong> — import many rows when devices were not used.
              </li>
              <li>
                <strong>Manual attendance</strong> — key individual records.
              </li>
              <li>
                <strong>Historical data entry</strong> — backfill past months for payroll alignment.
              </li>
            </ul>
          </>
        )}

        {isApprovalOps && (
          <>
            <h3>Leave &amp; time off</h3>
            <ul className="how-to-list">
              {isStaffOps && (
                <li>
                  <strong>Holidays</strong> — public or company holidays and pay rates.
                </li>
              )}
              <li>
                <strong>Leave management</strong> — approve or reject requests; print forms after approval.
              </li>
              {isStaffOps && (
                <li>
                  <strong>Leave types</strong> — configure entitlements and codes (admins).
                </li>
              )}
              <li>
                <strong>Salary advances</strong> — review queues, set payroll months and instalments, print forms.
              </li>
            </ul>
          </>
        )}

        {local && isStaffOps && (
          <>
            <h3>School finance (local desktop)</h3>
            <ul className="how-to-list">
              <li>
                <strong>
                  <Link to="/school/fee-ledger?tab=summary">Fee ledger</Link>
                </strong>{' '}
                — academic years and terms, students, fee charges, and payments (local SQLite API only). The dashboard
                shows active students, open charges, and payments for the selected month.
              </li>
              <li>
                <strong>
                  <Link to="/school/operational-expenses">Operational expenses</Link>
                </strong>{' '}
                — categories, suppliers, and expense lines with approval and mark-paid workflow (local API or Appwrite,
                depending on your deployment).
              </li>
              <li>
                <strong>User activity log</strong> — filter by <em>Fee ledger</em> or <em>School expenses</em> and use{' '}
                <em>Open fee ledger</em> / <em>Open expenses</em> to jump to the matching record.
              </li>
            </ul>
          </>
        )}

        {isCompanyAdmin && (
          <>
            <h3>Payroll &amp; reporting</h3>
            <ul className="how-to-list">
              <li>
                <strong>Payroll</strong> — run periods, statutory deductions, net pay.
              </li>
              <li>
                <strong>Reports</strong> — HR and payroll exports and summaries.
              </li>
              <li>
                <strong>Banks</strong> — maintain bank reference data.
              </li>
            </ul>
          </>
        )}

        {isCompanyAdmin && local && (
          <>
            <h3>Settings (local desktop)</h3>
            <ul className="how-to-list">
              <li>
                <strong>Company settings</strong> — organisation preferences and policies.
              </li>
              {isSuperAdmin && (
                <li>
                  <strong>System maintenance</strong> — subscription window, encrypted <code>.dhrbackup</code> backup and
                  restore (super admin).
                </li>
              )}
              <li>
                <strong>Users &amp; roles</strong> — create logins and assign roles.
              </li>
              <li>
                <Link to="/settings/pairing">
                  <strong>Mobile pairing (QR)</strong>
                </Link>{' '}
                — encode the LAN server URL for phones.
              </li>
              <li>
                <Link to="/settings/lan-connection">
                  <strong>LAN: connect other PCs</strong>
                </Link>{' '}
                — copy server URL, health check, and client snippets.
              </li>
            </ul>
          </>
        )}

        {local && (
          <>
            <h3>Android app</h3>
            <p>
              Same HR API as the desktop server: clock in/out, face enrollment, leave, salary advance, payslips, and Mobile
              home. Pair with <strong>HR server connection</strong> or scan a QR from the PC. Details in the{' '}
              <a href="#mobile">Android app</a> section below.
            </p>
          </>
        )}
      </section>

      {local && (
        <section id="lan" className="how-to-section">
          <h2>Server &amp; client PCs (step by step)</h2>
          <p>
            One <strong>Windows PC</strong> holds the SQLite database and embedded HR API (<strong>server</strong>). Other
            PCs on the same LAN run the <strong>same installer</strong> as <strong>clients</strong>: they do not keep a copy
            of <code>hr.db</code>; they talk to the server over HTTP. Phones use the same server URL via the Android app,
            not the desktop client file.
          </p>

          <div className="how-to-callout">
            <strong>Data folder (each Windows user)</strong>
            <p className="how-to-muted how-to-callout-last">
              Settings and pending installer choices are under{' '}
              <code>%AppData%\DropsoftHR</code> (e.g. <code>C:\Users\…\AppData\Roaming\DropsoftHR</code>). If the installer
              runs elevated (&quot;for all users&quot;), that folder is for the account that ran the installer—use the LAN
              helper on the server to share the correct URL with IT.
            </p>
          </div>

          <h3>Step 1 — Choose server or client in the Windows installer (recommended)</h3>
          <p>
            When you run <strong>Dropsoft HR … Setup … exe</strong> (NSIS installer), after you pick the install folder you
            see a page: <strong>How will this computer use Dropsoft HR?</strong>
          </p>
          <ol className="how-to-steps">
            <li>
              <strong>Server PC</strong> — leave <em>This PC is the HR server</em> <strong>checked</strong>. The database
              and API will run on this machine.
            </li>
            <li>
              <strong>Client PC</strong> — <strong>uncheck</strong> that box. Enter the full server URL including port, e.g.{' '}
              <code>http://192.168.1.10:32100</code>. The address must start with <code>http://</code> or{' '}
              <code>https://</code>.
            </li>
            <li>
              Finish the wizard. On <strong>first launch</strong>, Dropsoft HR reads the pending choice from{' '}
              <code>install-pending.cfg</code>, applies server or client mode, then removes that file when successful. The
              app may <strong>restart once</strong> automatically.
            </li>
            <li>
              If the server URL was wrong or the network was down, fix the URL (see below) and launch again—the app keeps the
              pending file until setup succeeds or you correct it manually.
            </li>
          </ol>
          <p className="how-to-muted">
            <strong>Portable build</strong> (<code>…-portable-…exe</code>) and some dev flows do not run this installer page.
            Use the <strong>first-run setup</strong> in the app instead (same end result: server or remote URL).
          </p>

          <h3>Step 2 — Configure the server PC (LAN API)</h3>
          <p>Even after choosing &quot;server&quot; in the installer, the API must listen on the network (not only localhost).</p>
          <ol className="how-to-steps">
            <li>
              Open <strong>Environment Variables</strong> (search in Windows). Under User or System, add:{' '}
              <code>HR_API_BIND</code> = <code>0.0.0.0</code> and <code>HR_API_PORT</code> = <code>32100</code> (or another
              fixed port you will use everywhere).
            </li>
            <li>
              <strong>Restart Dropsoft HR</strong> fully so it picks up the variables.
            </li>
            <li>
              On the server, open <strong>Windows Defender Firewall → Advanced → Inbound Rules → New rule</strong>: allow{' '}
              <strong>TCP</strong> on that port (e.g. <code>32100</code>) for your network profile (Private is typical on
              office LANs).
            </li>
            <li>
              Find this PC&apos;s <strong>IPv4 address</strong>: open Command Prompt and run <code>ipconfig</code> — use the
              address of the active Wi‑Fi or Ethernet adapter (same subnet as clients).
            </li>
            <li>
              From another device on the LAN, open a browser to{' '}
              <code>http://&lt;server-ip&gt;:&lt;port&gt;/api/health</code> — you should get a successful JSON/OK response.
            </li>
          </ol>
          <p className="how-to-muted">
            Advanced: you can use <code>.env.local</code> next to a Node <code>npm run server</code> deployment with the same
            variables; the desktop app uses the same semantics. See <Link to="/installation">Server installation info</Link>{' '}
            for reference.
          </p>

          <h3>Step 3 — Set up each client PC (if you did not use the installer page)</h3>
          <p>Use any <strong>one</strong> of these (environment variable wins if several are set):</p>
          <ol className="how-to-steps">
            <li>
              <strong>Wizard:</strong> close Dropsoft HR, press <strong>Win+R</strong>, run:{' '}
              <code>&quot;C:\Program Files\Dropsoft HR\Dropsoft HR.exe&quot; --set-server</code> (adjust the path if you
              installed elsewhere). Enter the server URL, e.g. <code>http://192.168.1.10:32100</code>, save, then start the
              app normally.
            </li>
            <li>
              <strong>Config file:</strong> create or edit <code>%AppData%\DropsoftHR\remote-api.json</code> with:{' '}
              <code>{'{ "baseUrl": "http://192.168.1.10:32100" }'}</code> (use your real IP and port).
            </li>
            <li>
              <strong>Environment variable:</strong> set <code>HR_REMOTE_API_URL</code> to the same URL (User or System),
              then restart Dropsoft HR.
            </li>
          </ol>

          <h3>Step 4 — Sign in</h3>
          <p>
            Clients and server use the <strong>same user accounts</strong> stored on the server. On a brand-new server
            database, default super-admin logins may exist—change passwords immediately; see{' '}
            <Link to="/installation">Server installation info</Link> for defaults and security notes.
          </p>

          <h3>Phones (Android)</h3>
          <p>
            Do not use <code>HR_REMOTE_API_URL</code> on phones. Use <strong>HR server connection</strong> in the app or{' '}
            <Link to="/settings/pairing">Mobile pairing (QR)</Link> so the phone stores the LAN URL. The server address must
            be reachable on Wi‑Fi (not <code>127.0.0.1</code>).
          </p>

          <p>
            <Link to="/settings/lan-connection">Open LAN: connect other PCs</Link> for copy‑paste URLs, health link, and the
            same checklist in Settings.
          </p>
        </section>
      )}

      {local && (
        <section id="mobile" className="how-to-section">
          <h2>Android app</h2>
          <p>
            The Dropsoft HR Android app talks to the same <strong>local HR API</strong> as the desktop app. Your phone
            must be on the <strong>same network</strong> as the PC running the server (Wi‑Fi or Ethernet). Use your
            computer&apos;s <strong>LAN address</strong> (e.g. <code>http://192.168.1.50:32100</code>), not{' '}
            <code>127.0.0.1</code>—that always means &quot;this device&quot; only.
          </p>
          <h3>Connect the first time</h3>
          <ol className="how-to-steps">
            <li>
              On the HR PC, run the API with <code>HR_API_BIND=0.0.0.0</code> (see server docs) and allow the port in
              Windows Firewall.
            </li>
            <li>
              In the app, open <strong>HR server connection</strong> (or use <strong>Mobile pairing (QR)</strong> on the PC
              under Settings—encode your PC&apos;s LAN URL in the QR, then scan).
            </li>
            <li>
              After <strong>Test connection</strong> succeeds, save and sign in.
            </li>
          </ol>
          <h3>Mobile home</h3>
          <p>
            After login you land on <strong>Mobile home</strong> with shortcuts to clock in/out, face enrollment,
            attendance history, <strong>Request leave</strong>, <strong>Salary advance</strong> (submit a request),
            payslips, and (for admins) the full dashboard. Open <strong>How to use</strong> anytime from the sidebar for
            full guides.
          </p>
          <h3>Salary advance on the phone</h3>
          <p>
            Tap <strong>Salary advance</strong> on Mobile home, or use <strong>Request salary advance</strong> in the
            sidebar. Fill in amount, purpose, and repayment note like on the desktop—the request follows the same
            approval workflow. Approvers still use <strong>Salary advances</strong> under Leave &amp; time off (or the
            dashboard) on a PC or large screen when processing queues.
          </p>
        </section>
      )}

      {isCompanyAdmin && (
        <section id="company" className="how-to-section">
          <h2>Company & employees</h2>
          <h3>Companies</h3>
          <p>
            Create or edit company records (name, registration, tax details, logo). Each company keeps its own employees,
            attendance, and payroll.
          </p>
          <h3>Employees</h3>
          <p>
            Add staff with basics (name, ID, department, salary, bank details). Link a user account to an employee if they
            should log in to request leave or see payslips. Use bulk import where available to load many rows from CSV.
          </p>
          <h3>Opening balances</h3>
          <p>
            When onboarding or switching from another system, open <strong>Opening balances</strong> to enter absence days
            for a past month, split <strong>salary advance</strong> and <strong>shopping</strong> totals across monthly
            installments from a chosen payroll month, and optionally record leave that already occurred (approved for
            payroll). Use the quick period buttons, search to find staff, the deduction preview column, and{' '}
            <strong>Carryover leave</strong> with leave types from your list; commas in amounts (e.g. 12,500) are accepted.
          </p>
        </section>
      )}

      <section id="attendance" className="how-to-section">
        <h2>Attendance</h2>
        {isCompanyAdmin && (
          <>
            <h3>Attendance terminal & face enrollment</h3>
            <p>
              Set up the clock-in screen for a shared PC or tablet. Enroll faces so employees can check in with the
              camera. Ensure good lighting for reliable recognition.
            </p>
            <h3>Bulk & manual attendance</h3>
            <p>Import or key attendance for many employees when devices were not used.</p>
            <h3>Historical data entry</h3>
            <p>
              Backfill past payroll months with absences, salary advance and shopping deductions, and approved leave lines
              so pay matches what already happened.
            </p>
          </>
        )}
        <h3>Attendance history</h3>
        <p>Everyone with access can review their own (or team) attendance records for selected dates.</p>
      </section>

      <section id="leave" className="how-to-section">
        <h2>Leave</h2>
        <h3>Request leave</h3>
        <p>
          Submit dates, leave type, and reason. Employees normally cannot pick dates in the past;{' '}
          <strong>admins, managers, and cashiers</strong> can enter past dates when recording leave on behalf of
          staff.
        </p>
        {isStaffOps && (
          <p>
            <strong>Leave management:</strong> approve or reject requests. For approved leave, use <strong>Print form</strong>{' '}
            to produce a paper copy for signatures and stamping.
          </p>
        )}
        {isCompanyAdmin && (
          <p>
            <strong>Leave types:</strong> configure codes (e.g. annual, sick), entitlements, and statutory flags per
            company.
          </p>
        )}
      </section>

      <section id="advance" className="how-to-section">
        <h2>Salary advances</h2>
        {isLocalDataSource() ? (
          <>
            <p>
              <strong>Request salary advance:</strong> employees submit amount, purpose, and repayment note from{' '}
              <strong>Request salary advance</strong> in the menu, or from the <strong>Android app</strong> using the{' '}
              <strong>Salary advance</strong> tile on Mobile home (same network and server URL as the desktop).{' '}
              {isApprovalOps && (
                <>
                  Approvers confirm the <strong>first payroll month</strong>, <strong>application date</strong>, and{' '}
                  <strong>instalments</strong> when approving—deductions are then posted to each month&apos;s payroll (and
                  reports). Only users with manager or admin roles can approve requests or edit request details in the
                  management screens. <strong>Print form</strong> is available after approval.
                </>
              )}
            </p>
            {local && (
              <p>
                On the phone, ensure <strong>HR server connection</strong> points at your HR PC&apos;s LAN IP; then use
                Mobile home → <strong>Salary advance</strong> to submit. See the{' '}
                <Link to="/how-to-use#mobile">Android app</Link> section above for pairing and connectivity.
              </p>
            )}
          </>
        ) : (
          <p className="how-to-muted">Salary advance requests are available in the desktop (local) app.</p>
        )}
      </section>

      {isStaffOps && (
        <section id="holidays" className="how-to-section">
          <h2>Holidays</h2>
          <p>
            Define public or company holidays and pay rates (normal daily rate or a custom percentage of the daily
            rate). Custom percentages can use any decimal precision you need.
          </p>
        </section>
      )}

      {local && isStaffOps && (
        <section id="school-finance" className="how-to-section">
          <h2>School fee ledger &amp; operational expenses</h2>
          <p>
            For schools using Dropsoft HR on the <strong>local desktop</strong> build, these modules sit beside payroll.
            They use the same company selector in the header. Your role must include the relevant permissions (
            <strong>fee ledger</strong>, <strong>operational expenses</strong>, and approval where applicable).
          </p>
          <h3>Fee ledger</h3>
          <ol className="how-to-steps">
            <li>
              Open <Link to="/school/fee-ledger?tab=summary">Fee ledger</Link> from the sidebar (local API only).
            </li>
            <li>
              Set up <strong>academic years</strong> and <strong>terms</strong>, then add <strong>students</strong>. The
              years and terms tabs show a <strong>report</strong> per row (charge totals, open balances, and payments
              collected within each period) and support <strong>Export report CSV</strong>.
            </li>
            <li>
              Record <strong>fee charges</strong> (amount, due date, status) and <strong>payments</strong> (receipt number,
              paid date). Use <strong>Charges</strong> / <strong>Payments</strong> on a student row, or the student filter
              on those tabs (<code>?student_id=</code> in the URL), to focus one learner. <strong>Export CSV</strong> is
              available on Students, Charges, and Payments. From a year or term report row, use <strong>Charges</strong> or{' '}
              <strong>Payments</strong> to open the matching tab filtered to that period (payments use paid date within the
              period). Summary cards link to students, charges, or payments for the selected month.
            </li>
            <li>
              <Link to="/school/student-attendance">Student attendance</Link> — <strong>Mark register</strong> (date + class,
              present/absent/late/excused, sticky <em>Save Register</em>, export CSV). Unmarked students default to present until
              saved. Uses each student&apos;s class from the fee ledger; separate from staff clock-in attendance. The{' '}
              <strong>Period report</strong> tab shows attended and coverage rates by student or class
              for a date range (export CSV). From <strong>Fee ledger → Academic years / Terms</strong>, use <em>Attendance</em> on a
              row (when start and end dates are set) to open the report for that period. From <strong>Fee ledger → Students</strong>, use <em>Register</em> on a row to open
              today&apos;s roll call for that class (highlights the student). Saves appear under{' '}
              <strong>User activity log</strong> (Student attendance).
            </li>
            <li>
              The <strong>Summary</strong> tab shows active students, open or partial charges, and payments for the month
              you pick.
            </li>
            <li>
              The dashboard <strong>School fee ledger</strong> card uses the same month control as school operational
              spend and links straight into the ledger.
            </li>
          </ol>
          <h3>Operational expenses</h3>
          <p>
            Use <Link to="/school/operational-expenses">Operational expenses</Link> for supplier spending: categories,
            optional suppliers, draft → approve → mark paid. On cloud (Appwrite) deployments, the same screen works when{' '}
            <code>VITE_APPWRITE_DATABASE_ID</code> is configured; otherwise use the local desktop API.
          </p>
          <h3>Activity log</h3>
          <p>
            Under <strong>User activity log</strong>, filter by <em>Fee ledger</em> or <em>School expenses</em>. Use{' '}
            <em>Open fee ledger</em> or <em>Open expenses</em> to jump to the changed record (highlighted on the correct
            tab).
          </p>
        </section>
      )}

      {isCompanyAdmin && (
        <section id="payroll" className="how-to-section">
          <h2>Payroll & payslips</h2>
          <p>
            Run payroll for a period, review statutory deductions and net pay, and publish or export as needed. Employees
            can open <strong>Payslips</strong> to view their own slips when provided by your process.
          </p>
          {local && (
            <>
              <h3>Gmail integration for payslip emails</h3>
              <p>
                To send payslips by email from the desktop app, configure Gmail SMTP in{' '}
                <strong>Settings → Payslip email (SMTP)</strong>. The app sends one PDF per employee using each employee&apos;s{' '}
                <strong>Email</strong> field.
              </p>
              <ol className="how-to-steps">
                <li>
                  Sign in to the Gmail account you want to send from and enable <strong>2-Step Verification</strong> on that
                  Google account.
                </li>
                <li>
                  Create a Google <strong>App Password</strong> (Google Account → Security → App passwords). Use this app
                  password in Dropsoft HR, not your normal Gmail password.
                </li>
                <li>
                  In <strong>Settings → Payslip email (SMTP)</strong>, set:
                  <ul className="how-to-list">
                    <li>
                      <strong>SMTP host:</strong> <code>smtp.gmail.com</code>
                    </li>
                    <li>
                      <strong>SMTP port:</strong> <code>587</code> (or <code>465</code> for SSL)
                    </li>
                    <li>
                      <strong>Secure:</strong> OFF for 587 (STARTTLS), ON for 465
                    </li>
                    <li>
                      <strong>SMTP user:</strong> your full Gmail address
                    </li>
                    <li>
                      <strong>SMTP pass:</strong> the generated Google App Password
                    </li>
                    <li>
                      <strong>From address:</strong> same Gmail address (or approved sender alias)
                    </li>
                  </ul>
                </li>
                <li>
                  Save settings, go to <strong>Payslips</strong>, choose period, then click{' '}
                  <strong>Email payslips to employees</strong>.
                </li>
                <li>
                  If messages fail, check: employee email addresses, internet connection, Gmail account security alerts, and
                  whether the app password was copied correctly.
                </li>
              </ol>
              <p className="how-to-muted">
                Tip: start with one test employee before sending to everyone for the month.
              </p>
            </>
          )}
        </section>
      )}

      {isCompanyAdmin && (
        <section id="reports" className="how-to-section">
          <h2>Reports & banks</h2>
          <p>
            Generate HR and payroll reports. Maintain bank reference data used across the system where your deployment
            supports it.
          </p>
        </section>
      )}

      <section id="settings" className="how-to-section">
        <h2>Settings & backup</h2>
        {isCompanyAdmin && local && (
          <p>
            Open <strong>Settings → Users &amp; roles</strong> to <strong>add users</strong> (email, temporary password,
            role) and to change roles later. Tell new users to sign in and change their password if your policy requires
            it. Super-admin-only tools (subscription, encrypted backup) stay under <strong>System maintenance</strong>.
          </p>
        )}
        {isCompanyAdmin && (
          <p>
            Company <strong>Settings</strong> hold preferences for your organisation (where configured).
          </p>
        )}
        {isSuperAdmin && isLocalDataSource() && (
          <div className="how-to-callout">
            <strong>System maintenance (super admin)</strong>
            <ul>
              <li>
                <strong>Subscription period</strong> — set how long the installation may be used before renewal.
              </li>
              <li>
                <strong>Automatic backup</strong> — schedule a weekly day and time; the app writes an encrypted{' '}
                <code>.dhrbackup</code> while it is running (same format as a manual download). Set a password and optional
                folder; the PC must be on and Dropsoft HR running at that time.
              </li>
              <li>
                <strong>Manual backup</strong> — download an encrypted <code>.dhrbackup</code> file. Choose a strong
                password; the same password is required to restore. Without it, the backup cannot be opened.
              </li>
              <li>
                <strong>Restore</strong> — upload a <code>.dhrbackup</code> (enter the password) or a legacy plain{' '}
                <code>.zip</code> from older versions. Restart the app after upload to finish restoring.
              </li>
            </ul>
          </div>
        )}
        {!(isSuperAdmin && isLocalDataSource()) && (
          <p className="how-to-muted">
            Encrypted backup and subscription controls are available to super admins in the local desktop app.
          </p>
        )}
      </section>

      {isCompanyAdmin && isLocalDataSource() && (
        <section id="users" className="how-to-section">
          <h2>Users &amp; login (desktop app)</h2>
          <p>
            Go to <strong>Settings → Users &amp; roles</strong>. Use <strong>Create user</strong> to add an account with
            email, password, and role. Link employees to users separately on the <strong>Employees</strong> screen when
            someone should see their own leave or payslips.
          </p>
          <p>
            <strong>Roles:</strong> <em>Employee</em> — self-service leave and payslips;{' '}
            <em>Approver</em> — approve/reject leave and salary advances only; <em>Cashier</em> — approvals plus staff
            operations; <em>Manager / Admin</em> — company data and payroll; <em>Super admin</em> — system maintenance
            and can create other super admins. At least one active super admin must remain.
          </p>
          {!isSuperAdmin && (
            <p className="how-to-muted">
              Your account cannot create or edit <strong>super admin</strong> users—use a super admin for that.
            </p>
          )}
        </section>
      )}

      <section id="tips" className="how-to-section">
        <h2>Tips</h2>
        <ul className="how-to-list">
          <li>Keep the selected company correct before entering data—you are always working in one company context.</li>
          <li>If the app was minimized, use the sidebar toggle to open the menu again.</li>
          <li>After restoring a backup, fully close and reopen Dropsoft HR so the database loads from the restored file.</li>
          <li>For subscription warnings, a super admin should renew under System maintenance before access is limited.</li>
          {local && isStaffOps && (
            <li>
              <strong>Fee ledger:</strong> set up years and terms before students, then charges and payments. Use{' '}
              <strong>User activity log</strong> → <em>Open fee ledger</em> to jump to the exact row; the address bar
              keeps <em>tab</em> and <em>month</em> so you can bookmark or share a link.
            </li>
          )}
        </ul>
      </section>
    </div>
  )
}

export default HowToUse
