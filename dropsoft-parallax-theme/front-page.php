<?php
/**
 * Front page — Dropsoft Technologies Ltd marketing layout.
 * Hero copy: Appearance → Customize → Dropsoft — Homepage.
 *
 * @package Dropsoft_Corporate
 */

get_header();

if (function_exists('dropsoft_corporate_is_elementor_static_front_page') && dropsoft_corporate_is_elementor_static_front_page()) {
	while (have_posts()) {
		the_post();
		get_template_part(
			'template-parts/content',
			'elementor',
			array(
				'extra_class' => 'ds-elementor-page--front',
			)
		);
	}
	get_footer();
	return;
}

$hero_kicker    = get_theme_mod('dropsoft_hero_kicker', __('Business solutions built for East Africa & beyond', 'dropsoft-corporate'));
$hero_headline  = get_theme_mod('dropsoft_hero_headline', __('Dropsoft Technologies Ltd — leaders in business automation.', 'dropsoft-corporate'));
$hero_lead      = get_theme_mod('dropsoft_hero_lead', __('From compliant HR & payroll to resilient ERP — we deliver software you can run with confidence, online or offline.', 'dropsoft-corporate'));
$dropsoft_slides                = dropsoft_corporate_get_slideshow_slides();
$dropsoft_slideshow_heading     = get_theme_mod('dropsoft_slideshow_heading', __('Inside the systems', 'dropsoft-corporate'));
$dropsoft_slideshow_interval_ms = max(3000, min(15000, absint(get_theme_mod('dropsoft_slideshow_interval', 6)) * 1000));

$solutions_url = function_exists('dropsoft_corporate_page_url') ? dropsoft_corporate_page_url('solutions') : home_url('/solutions/');
$pricing_url   = function_exists('dropsoft_corporate_page_url') ? dropsoft_corporate_page_url('pricing') : home_url('/pricing/');
$contact_url   = function_exists('dropsoft_corporate_page_url') ? dropsoft_corporate_page_url('contact') : home_url('/contact/');
$about_url     = function_exists('dropsoft_corporate_page_url') ? dropsoft_corporate_page_url('about') : home_url('/about/');
?>

<main id="main">

	<section class="ds-hero" aria-label="<?php esc_attr_e('Introduction', 'dropsoft-corporate'); ?>">
		<div class="ds-hero__bg" aria-hidden="true"></div>
		<div class="ds-container ds-hero__grid">
			<div class="ds-hero__content ds-reveal">
				<p class="ds-hero__kicker"><?php echo esc_html($hero_kicker); ?></p>
				<h1 class="ds-hero__headline"><?php echo esc_html($hero_headline); ?></h1>
				<p class="ds-hero__lead"><?php echo esc_html($hero_lead); ?></p>
				<p class="ds-hero__sublead">
					<?php esc_html_e('Explore flagship HR and ERP pages, licence pricing that mirrors the in-product catalogue, and a contact path for demos and bespoke work — all split into clear sections so your team can share direct links.', 'dropsoft-corporate'); ?>
				</p>
				<div class="ds-hero__actions">
					<a class="ds-btn ds-btn--primary" href="<?php echo esc_url($solutions_url); ?>"><?php esc_html_e('Solutions & architecture', 'dropsoft-corporate'); ?></a>
					<a class="ds-btn ds-btn--ghost" href="<?php echo esc_url($pricing_url); ?>"><?php esc_html_e('HR licence pricing', 'dropsoft-corporate'); ?></a>
					<a class="ds-btn ds-btn--ghost" href="<?php echo esc_url($contact_url); ?>"><?php esc_html_e('Contact sales', 'dropsoft-corporate'); ?></a>
				</div>
			</div>
			<div class="ds-hero__visual ds-reveal" aria-hidden="true">
				<div class="ds-hero__orb ds-hero__orb--1 rellax" data-rellax-speed="-1.2"></div>
				<div class="ds-hero__orb ds-hero__orb--2 rellax" data-rellax-speed="0.8"></div>
				<div class="ds-hero__card rellax" data-rellax-speed="-0.3">
					<p class="ds-hero__card-label"><?php esc_html_e('Why teams choose Dropsoft', 'dropsoft-corporate'); ?></p>
					<p class="ds-hero__card-title"><?php esc_html_e('Local-first. Statutory-ready. Built to scale.', 'dropsoft-corporate'); ?></p>
					<ul class="ds-hero__card-list">
						<li><?php esc_html_e('Kenyan payroll & statutory reporting (KRA, NSSF, SHIF, AHL)', 'dropsoft-corporate'); ?></li>
						<li><?php esc_html_e('Offline-capable operations for real-world networks', 'dropsoft-corporate'); ?></li>
						<li><?php esc_html_e('Transparent HR tiers with optional modules — same numbers as the product', 'dropsoft-corporate'); ?></li>
					</ul>
				</div>
			</div>
		</div>
	</section>

	<section class="ds-section ds-home-overview">
		<div class="ds-container ds-prose">
			<h2 class="ds-section__title ds-reveal"><?php esc_html_e('What we deliver', 'dropsoft-corporate'); ?></h2>
			<p class="ds-reveal">
				<?php esc_html_e('Dropsoft Technologies Ltd focuses on business automation that survives the conditions our clients actually face: branch-level retail, distributed HR teams, and finance workflows that must remain auditable when connectivity is unreliable. Our marketing site is organised by topic so you can send colleagues straight to pricing, architecture, or contact without scrolling a single long page.', 'dropsoft-corporate'); ?>
			</p>
			<p class="ds-reveal">
				<?php esc_html_e('Dropsoft HR subscriptions are priced in Kenya Shillings with published employee caps, admin seats, overage rules, and one-time onboarding — aligned to the subscription engine inside the application. Dropsoft ERP and school or POS extensions are scoped with a discovery workshop and written statement of work.', 'dropsoft-corporate'); ?>
			</p>
		</div>
	</section>

	<section class="ds-section ds-hub" aria-label="<?php esc_attr_e('Site sections', 'dropsoft-corporate'); ?>">
		<div class="ds-container">
			<h2 class="ds-section__title ds-reveal"><?php esc_html_e('Explore the site', 'dropsoft-corporate'); ?></h2>
			<div class="ds-hub__grid ds-stagger">
				<a class="ds-hub-card ds-reveal" href="<?php echo esc_url($solutions_url); ?>">
					<span class="ds-hub-card__kicker"><?php esc_html_e('Products', 'dropsoft-corporate'); ?></span>
					<span class="ds-hub-card__title"><?php esc_html_e('Solutions', 'dropsoft-corporate'); ?></span>
					<span class="ds-hub-card__text"><?php esc_html_e('HR & ERP deep dive, screenshots, offline architecture, and adjacent systems.', 'dropsoft-corporate'); ?></span>
				</a>
				<a class="ds-hub-card ds-reveal" href="<?php echo esc_url($pricing_url); ?>">
					<span class="ds-hub-card__kicker"><?php esc_html_e('Dropsoft HR', 'dropsoft-corporate'); ?></span>
					<span class="ds-hub-card__title"><?php esc_html_e('Pricing', 'dropsoft-corporate'); ?></span>
					<span class="ds-hub-card__text"><?php esc_html_e('Plans, module matrix, yearly 15% discount, payment channels, and commercial notes.', 'dropsoft-corporate'); ?></span>
				</a>
				<a class="ds-hub-card ds-reveal" href="<?php echo esc_url($about_url); ?>">
					<span class="ds-hub-card__kicker"><?php esc_html_e('Company', 'dropsoft-corporate'); ?></span>
					<span class="ds-hub-card__title"><?php esc_html_e('About', 'dropsoft-corporate'); ?></span>
					<span class="ds-hub-card__text"><?php esc_html_e('Mission, delivery philosophy, and how we support implementations.', 'dropsoft-corporate'); ?></span>
				</a>
				<a class="ds-hub-card ds-reveal" href="<?php echo esc_url($contact_url); ?>">
					<span class="ds-hub-card__kicker"><?php esc_html_e('Next step', 'dropsoft-corporate'); ?></span>
					<span class="ds-hub-card__title"><?php esc_html_e('Contact', 'dropsoft-corporate'); ?></span>
					<span class="ds-hub-card__text"><?php esc_html_e('Demo requests, licence questions, ERP rollout planning, and custom development.', 'dropsoft-corporate'); ?></span>
				</a>
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
			'viewport_id' => 'ds-slideshow-viewport-home',
		)
	);
	?>

</main>

<?php
get_footer();
