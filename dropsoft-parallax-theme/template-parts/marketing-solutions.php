<?php
/**
 * Solutions page body: deep product narrative, slideshow, architecture, adjacent products.
 *
 * @package Dropsoft_Corporate
 */

defined('ABSPATH') || exit;

$dropsoft_slides                = dropsoft_corporate_get_slideshow_slides();
$dropsoft_slideshow_heading     = get_theme_mod('dropsoft_slideshow_heading', __('Inside the systems', 'dropsoft-corporate'));
$dropsoft_slideshow_interval_ms = max(3000, min(15000, absint(get_theme_mod('dropsoft_slideshow_interval', 6)) * 1000));
$pricing_url                    = function_exists('dropsoft_corporate_page_url') ? dropsoft_corporate_page_url('pricing') : home_url('/pricing/');
$contact_url                    = function_exists('dropsoft_corporate_page_url') ? dropsoft_corporate_page_url('contact') : home_url('/contact/');
?>

<section class="ds-section ds-solutions-intro">
	<div class="ds-container ds-prose">
		<p class="ds-reveal ds-prose__lead">
			<?php esc_html_e('Dropsoft Technologies Ltd builds business software for East African operators who cannot afford brittle, always-online-only stacks. This page walks through our flagship HR and ERP lines, how they stay compliant with Kenyan payroll rules, and how the same offline-first engine powers day-two operations in the field.', 'dropsoft-corporate'); ?>
		</p>
		<p class="ds-reveal">
			<?php esc_html_e('Dropsoft HR is sold on transparent subscription tiers with employee caps, optional add-on modules, and one-time lifetime onboarding — the figures on our pricing page are generated from the same catalogue embedded in the product. Dropsoft ERP is scoped per branch and SKU depth; we pair it with HR when finance and stock need a single operational picture.', 'dropsoft-corporate'); ?>
		</p>
		<p class="ds-reveal">
			<?php esc_html_e('Whether you start with attendance and payslips only, or roll out inventory and POS together, you get local execution, encrypted backups, and a partner team that understands statutory calendars, union agreements, and multi-site retail.', 'dropsoft-corporate'); ?>
		</p>
		<p class="ds-reveal ds-solutions-intro__cta">
			<a class="ds-btn ds-btn--primary" href="<?php echo esc_url($pricing_url); ?>"><?php esc_html_e('View HR licence pricing', 'dropsoft-corporate'); ?></a>
			<a class="ds-btn ds-btn--ghost" href="<?php echo esc_url($contact_url); ?>"><?php esc_html_e('Book a discovery call', 'dropsoft-corporate'); ?></a>
		</p>
	</div>
</section>

<section id="solutions" class="ds-section ds-big-two">
	<div class="ds-container">
		<h2 class="ds-section__title ds-reveal"><?php esc_html_e('Flagship systems', 'dropsoft-corporate'); ?></h2>
		<p class="ds-section__lead ds-reveal"><?php esc_html_e('Our core products are engineered for compliance, speed, and day-to-day reliability in retail, HR, and back-office teams.', 'dropsoft-corporate'); ?></p>

		<div class="ds-big-two__grid ds-stagger">
			<article class="ds-product-card ds-reveal">
				<span class="ds-product-card__badge"><?php esc_html_e('People & payroll', 'dropsoft-corporate'); ?></span>
				<h3 class="ds-product-card__title"><?php esc_html_e('Dropsoft HR', 'dropsoft-corporate'); ?></h3>
				<p class="ds-product-card__pain"><?php esc_html_e('Stop juggling spreadsheets, missed statutory deadlines, and attendance disputes — one system built for Kenyan employers.', 'dropsoft-corporate'); ?></p>
				<p class="ds-product-card__desc">
					<?php esc_html_e('End-to-end HR, attendance, and payroll with Kenyan statutory compliance and modern workforce tools.', 'dropsoft-corporate'); ?>
				</p>

				<div class="ds-compliance-panel" aria-label="<?php esc_attr_e('Kenya compliance coverage', 'dropsoft-corporate'); ?>">
					<p class="ds-compliance-panel__title"><?php esc_html_e('Compliance-ready for Kenya', 'dropsoft-corporate'); ?></p>
					<div class="ds-badge-grid">
						<div class="ds-compliance-badge">
							<span class="ds-compliance-badge__icon" aria-hidden="true">
								<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" stroke-width="1.5"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
							</span>
							<span class="ds-compliance-badge__label">KRA</span>
							<span class="ds-compliance-badge__hint"><?php esc_html_e('iTax-ready P10, P9 & payroll exports', 'dropsoft-corporate'); ?></span>
						</div>
						<div class="ds-compliance-badge">
							<span class="ds-compliance-badge__icon" aria-hidden="true">
								<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
							</span>
							<span class="ds-compliance-badge__label">NSSF</span>
							<span class="ds-compliance-badge__hint"><?php esc_html_e('Schedules & remittance tracking', 'dropsoft-corporate'); ?></span>
						</div>
						<div class="ds-compliance-badge">
							<span class="ds-compliance-badge__icon" aria-hidden="true">
								<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.5 9h15M4.5 15h15M12 3v18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/></svg>
							</span>
							<span class="ds-compliance-badge__label">SHIF</span>
							<span class="ds-compliance-badge__hint"><?php esc_html_e('Health deductions aligned to rules', 'dropsoft-corporate'); ?></span>
						</div>
						<div class="ds-compliance-badge">
							<span class="ds-compliance-badge__icon" aria-hidden="true">
								<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 22V12h6v10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
							</span>
							<span class="ds-compliance-badge__label">AHL</span>
							<span class="ds-compliance-badge__hint"><?php esc_html_e('Housing levy calculations in-run', 'dropsoft-corporate'); ?></span>
						</div>
					</div>
				</div>

				<ul class="ds-product-card__list">
					<li><?php esc_html_e('Biometric & face recognition attendance with audit-friendly history', 'dropsoft-corporate'); ?></li>
					<li><?php esc_html_e('Payslips, leave, holidays, and role-based access for HR & managers', 'dropsoft-corporate'); ?></li>
					<li><?php esc_html_e('Salary advance and deduction workflows with manager approvals', 'dropsoft-corporate'); ?></li>
					<li><?php esc_html_e('Optional Android app for staff self-service where your policy allows', 'dropsoft-corporate'); ?></li>
				</ul>
			</article>

			<article class="ds-product-card ds-reveal">
				<span class="ds-product-card__badge"><?php esc_html_e('Operations & retail', 'dropsoft-corporate'); ?></span>
				<h3 class="ds-product-card__title"><?php esc_html_e('Dropsoft ERP', 'dropsoft-corporate'); ?></h3>
				<p class="ds-product-card__pain ds-product-card__pain--erp"><?php esc_html_e('Stock-outs, slow checkout lanes, and branches that go dark when the internet blips — we built ERP for how Kenyan retail actually runs.', 'dropsoft-corporate'); ?></p>
				<p class="ds-product-card__desc">
					<?php esc_html_e('Inventory, purchasing, and sales in one stack — tuned for stores that cannot afford downtime.', 'dropsoft-corporate'); ?>
				</p>

				<div class="ds-compliance-panel ds-compliance-panel--erp" aria-label="<?php esc_attr_e('Operations coverage', 'dropsoft-corporate'); ?>">
					<p class="ds-compliance-panel__title"><?php esc_html_e('Built for the shop floor', 'dropsoft-corporate'); ?></p>
					<div class="ds-badge-grid">
						<div class="ds-compliance-badge">
							<span class="ds-compliance-badge__icon" aria-hidden="true">
								<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>
							</span>
							<span class="ds-compliance-badge__label"><?php esc_html_e('Inventory', 'dropsoft-corporate'); ?></span>
							<span class="ds-compliance-badge__hint"><?php esc_html_e('Multi-location stock & reorder points', 'dropsoft-corporate'); ?></span>
						</div>
						<div class="ds-compliance-badge">
							<span class="ds-compliance-badge__icon" aria-hidden="true">
								<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M16 3v4M8 3v4M2 11h20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
							</span>
							<span class="ds-compliance-badge__label">POS</span>
							<span class="ds-compliance-badge__hint"><?php esc_html_e('Integrated checkout & back-office sync', 'dropsoft-corporate'); ?></span>
						</div>
						<div class="ds-compliance-badge">
							<span class="ds-compliance-badge__icon" aria-hidden="true">
								<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5"/></svg>
							</span>
							<span class="ds-compliance-badge__label"><?php esc_html_e('Offline-first', 'dropsoft-corporate'); ?></span>
							<span class="ds-compliance-badge__hint"><?php esc_html_e('Keep selling when connectivity drops', 'dropsoft-corporate'); ?></span>
						</div>
						<div class="ds-compliance-badge">
							<span class="ds-compliance-badge__icon" aria-hidden="true">
								<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
							</span>
							<span class="ds-compliance-badge__label"><?php esc_html_e('Control', 'dropsoft-corporate'); ?></span>
							<span class="ds-compliance-badge__hint"><?php esc_html_e('Purchasing, suppliers & branch visibility', 'dropsoft-corporate'); ?></span>
						</div>
					</div>
				</div>

				<ul class="ds-product-card__list">
					<li><?php esc_html_e('Extensible modules for finance, suppliers, and analytics', 'dropsoft-corporate'); ?></li>
					<li><?php esc_html_e('Designed to pair with Dropsoft HR for workforce + stock clarity', 'dropsoft-corporate'); ?></li>
					<li><?php esc_html_e('Branch rollouts with controlled master data and audit trails', 'dropsoft-corporate'); ?></li>
				</ul>
			</article>
		</div>
	</div>
</section>

<?php
get_template_part(
	'template-parts/slideshow-section',
	null,
	array(
		'slides'      => $dropsoft_slides,
		'heading'     => $dropsoft_slideshow_heading,
		'interval_ms' => $dropsoft_slideshow_interval_ms,
		'viewport_id' => 'ds-slideshow-viewport-solutions',
	)
);
?>

<section id="technical-edge" class="ds-section ds-tech-edge" aria-labelledby="ds-tech-edge-heading">
	<div class="ds-tech-edge__parallax-bg" aria-hidden="true"></div>
	<div class="ds-container ds-tech-edge__grid">
		<div class="ds-tech-edge__copy ds-reveal">
			<p class="ds-tech-edge__kicker"><?php esc_html_e('Technical edge', 'dropsoft-corporate'); ?></p>
			<h2 id="ds-tech-edge-heading" class="ds-section__title" style="margin-bottom: 16px;"><?php esc_html_e('Standalone & offline-first architecture', 'dropsoft-corporate'); ?></h2>
			<p class="ds-tech-edge__lead">
				<?php esc_html_e('Many Kenyan businesses operate where fibre is uneven and power events happen. Dropsoft desktop deployments pair a local HTTP API with a single SQLite database file — so payroll runs, stock movements, and attendance stay consistent even when the internet disappears.', 'dropsoft-corporate'); ?>
			</p>
			<p class="ds-tech-edge__lead">
				<?php esc_html_e('That architecture is deliberate: fewer moving parts on the wire, predictable backups, and the ability to run air-gapped where your policy requires it. When you reconnect, exports and email workflows pick up without manual re-keying.', 'dropsoft-corporate'); ?>
			</p>
			<ul class="ds-tech-edge__list">
				<li><strong><?php esc_html_e('Electron shell', 'dropsoft-corporate'); ?></strong> — <?php esc_html_e('cross-platform desktop with a secure embedded runtime for your HR and operations UI.', 'dropsoft-corporate'); ?></li>
				<li><strong><?php esc_html_e('SQLite at the core', 'dropsoft-corporate'); ?></strong> — <?php esc_html_e('ACID transactions, WAL mode for safer writes, and backups you can snapshot like any other file.', 'dropsoft-corporate'); ?></li>
				<li><strong><?php esc_html_e('No silent data loss', 'dropsoft-corporate'); ?></strong> — <?php esc_html_e('Work queues locally; sync or email exports when the network returns — your team keeps working.', 'dropsoft-corporate'); ?></li>
			</ul>
		</div>
		<div class="ds-tech-edge__visual ds-reveal">
			<div class="ds-tech-edge__visual-inner rellax" data-rellax-speed="0.35">
				<div class="ds-server-art" aria-hidden="true">
					<div class="ds-server-art__rack">
						<span class="ds-server-art__led"></span>
						<span class="ds-server-art__led ds-server-art__led--2"></span>
						<span class="ds-server-art__slot"></span>
						<span class="ds-server-art__slot"></span>
						<span class="ds-server-art__slot"></span>
					</div>
					<div class="ds-server-art__db">
						<span class="ds-server-art__db-label">SQLite</span>
					</div>
					<div class="ds-server-art__orbit"></div>
				</div>
				<p class="ds-tech-edge__caption"><?php esc_html_e('Your data stays on hardware you control — not lost when the link goes quiet.', 'dropsoft-corporate'); ?></p>
			</div>
		</div>
	</div>
</section>

<section id="other-systems" class="ds-section ds-features">
	<div class="ds-container">
		<h2 class="ds-section__title ds-reveal"><?php esc_html_e('Other systems & extensions', 'dropsoft-corporate'); ?></h2>
		<p class="ds-section__lead ds-reveal"><?php esc_html_e('Specialised products and vertical solutions — available standalone or alongside Dropsoft HR / ERP.', 'dropsoft-corporate'); ?></p>

		<div class="ds-feature-grid ds-stagger">
			<article class="ds-feature-tile ds-reveal">
				<div class="ds-feature-tile__icon" aria-hidden="true">▣</div>
				<h3 class="ds-feature-tile__title"><?php esc_html_e('School Management', 'dropsoft-corporate'); ?></h3>
				<p class="ds-feature-tile__text"><?php esc_html_e('Admissions, fees, timetables, exams, and parent communication in one portal — aligned to how Kenyan schools report and collect.', 'dropsoft-corporate'); ?></p>
			</article>
			<article class="ds-feature-tile ds-reveal">
				<div class="ds-feature-tile__icon" aria-hidden="true">▤</div>
				<h3 class="ds-feature-tile__title"><?php esc_html_e('Custom POS', 'dropsoft-corporate'); ?></h3>
				<p class="ds-feature-tile__text"><?php esc_html_e('Branded point-of-sale flows, peripherals, and back-office sync tuned to your retail chain.', 'dropsoft-corporate'); ?></p>
			</article>
			<article class="ds-feature-tile ds-reveal">
				<div class="ds-feature-tile__icon" aria-hidden="true">◈</div>
				<h3 class="ds-feature-tile__title"><?php esc_html_e('Bespoke automation', 'dropsoft-corporate'); ?></h3>
				<p class="ds-feature-tile__text"><?php esc_html_e('Workflow apps, APIs, and integrations — from stock alerts to executive dashboards.', 'dropsoft-corporate'); ?></p>
			</article>
		</div>
	</div>
</section>
