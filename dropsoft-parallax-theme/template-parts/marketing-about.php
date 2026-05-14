<?php
/**
 * About page — mission, delivery model, trust strip.
 *
 * @package Dropsoft_Corporate
 */

defined('ABSPATH') || exit;

$contact_url = function_exists('dropsoft_corporate_page_url') ? dropsoft_corporate_page_url('contact') : home_url('/contact/');
?>

<section class="ds-section ds-about ds-about--page">
	<div class="ds-container ds-about__panel">
		<div class="ds-reveal">
			<h2 class="ds-section__title"><?php esc_html_e('About Dropsoft Technologies Ltd', 'dropsoft-corporate'); ?></h2>
			<p class="ds-about__mission">
				<strong><?php esc_html_e('Our mission', 'dropsoft-corporate'); ?></strong>
				<?php esc_html_e(' is to provide robust, local-first business automation — software that respects real infrastructure, intermittent connectivity, and the regulatory environment you operate in.', 'dropsoft-corporate'); ?>
			</p>
			<p class="ds-about__mission">
				<?php esc_html_e('We partner with organisations that need more than generic cloud templates: clear implementations, training, and ongoing improvements so your systems stay aligned with how you actually work.', 'dropsoft-corporate'); ?>
			</p>
			<p class="ds-about__mission">
				<?php esc_html_e('Our delivery teams combine product engineering with field experience — from statutory payroll runs to multi-branch stock counts — so you are not translating vendor jargon into Kenyan operating reality on your own.', 'dropsoft-corporate'); ?>
			</p>
			<p class="ds-about__mission">
				<?php esc_html_e('Security and continuity are treated as product features: encrypted backups, audit trails where modules support them, and upgrade paths that do not strand historical payroll data.', 'dropsoft-corporate'); ?>
			</p>
			<p class="ds-solutions-intro__cta">
				<a class="ds-btn ds-btn--primary" href="<?php echo esc_url($contact_url); ?>"><?php esc_html_e('Talk to our team', 'dropsoft-corporate'); ?></a>
			</p>
		</div>
		<div class="ds-reveal">
			<div class="ds-stat-row">
				<div class="ds-stat">
					<div class="ds-stat__value"><?php esc_html_e('Local-first', 'dropsoft-corporate'); ?></div>
					<div class="ds-stat__label"><?php esc_html_e('Designed for on-prem & hybrid deployments', 'dropsoft-corporate'); ?></div>
				</div>
				<div class="ds-stat">
					<div class="ds-stat__value"><?php esc_html_e('Compliance', 'dropsoft-corporate'); ?></div>
					<div class="ds-stat__label"><?php esc_html_e('Statutory-aware HR & finance workflows', 'dropsoft-corporate'); ?></div>
				</div>
				<div class="ds-stat">
					<div class="ds-stat__value"><?php esc_html_e('Custom dev', 'dropsoft-corporate'); ?></div>
					<div class="ds-stat__label"><?php esc_html_e('Tailored modules & integrations on request', 'dropsoft-corporate'); ?></div>
				</div>
			</div>
		</div>
	</div>
</section>

<section class="ds-trusted-marquee" aria-label="<?php esc_attr_e('Organisations that rely on Dropsoft-class systems in the field', 'dropsoft-corporate'); ?>">
	<div class="ds-container ds-trusted-marquee__head">
		<p class="ds-trusted-marquee__title"><?php esc_html_e('Trusted by teams in the field', 'dropsoft-corporate'); ?></p>
		<p class="ds-trusted-marquee__sub"><?php esc_html_e('Examples only — replace with your approved client logos when you have permission.', 'dropsoft-corporate'); ?></p>
	</div>
	<div class="ds-trusted-marquee__viewport">
		<div class="ds-trusted-marquee__track">
			<div class="ds-trusted-marquee__group">
				<div class="ds-trusted-logo"><span class="ds-trusted-logo__mark"><?php esc_html_e('Ereto Bookshop', 'dropsoft-corporate'); ?></span></div>
				<div class="ds-trusted-logo"><span class="ds-trusted-logo__mark"><?php esc_html_e('Nairobi Wholesale Co.', 'dropsoft-corporate'); ?></span></div>
				<div class="ds-trusted-logo"><span class="ds-trusted-logo__mark"><?php esc_html_e('Rift Agro Supplies', 'dropsoft-corporate'); ?></span></div>
				<div class="ds-trusted-logo"><span class="ds-trusted-logo__mark"><?php esc_html_e('Lakeview Pharmacy', 'dropsoft-corporate'); ?></span></div>
				<div class="ds-trusted-logo"><span class="ds-trusted-logo__mark"><?php esc_html_e('Tumaini Schools', 'dropsoft-corporate'); ?></span></div>
				<div class="ds-trusted-logo"><span class="ds-trusted-logo__mark"><?php esc_html_e('Mama Njeri Retail', 'dropsoft-corporate'); ?></span></div>
			</div>
			<div class="ds-trusted-marquee__group" aria-hidden="true">
				<div class="ds-trusted-logo"><span class="ds-trusted-logo__mark"><?php esc_html_e('Ereto Bookshop', 'dropsoft-corporate'); ?></span></div>
				<div class="ds-trusted-logo"><span class="ds-trusted-logo__mark"><?php esc_html_e('Nairobi Wholesale Co.', 'dropsoft-corporate'); ?></span></div>
				<div class="ds-trusted-logo"><span class="ds-trusted-logo__mark"><?php esc_html_e('Rift Agro Supplies', 'dropsoft-corporate'); ?></span></div>
				<div class="ds-trusted-logo"><span class="ds-trusted-logo__mark"><?php esc_html_e('Lakeview Pharmacy', 'dropsoft-corporate'); ?></span></div>
				<div class="ds-trusted-logo"><span class="ds-trusted-logo__mark"><?php esc_html_e('Tumaini Schools', 'dropsoft-corporate'); ?></span></div>
				<div class="ds-trusted-logo"><span class="ds-trusted-logo__mark"><?php esc_html_e('Mama Njeri Retail', 'dropsoft-corporate'); ?></span></div>
			</div>
		</div>
	</div>
</section>
