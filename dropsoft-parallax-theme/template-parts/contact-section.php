<?php
/**
 * Contact form & sales details (used on Contact page).
 *
 * @package Dropsoft_Corporate
 */

defined('ABSPATH') || exit;

$sales_email     = get_theme_mod('dropsoft_sales_email', '');
$contact_message = isset($_GET['message']) ? sanitize_text_field(wp_unslash($_GET['message'])) : '';
?>
<section id="contact" class="ds-section ds-contact">
	<div class="ds-container ds-contact__grid">
		<div class="ds-reveal">
			<h2 class="ds-section__title"><?php esc_html_e('Contact & custom development', 'dropsoft-corporate'); ?></h2>
			<p class="ds-section__lead" style="margin-bottom: 16px;">
				<?php esc_html_e('Request a demo, a Dropsoft HR licence quote, ERP rollout planning, or a bespoke build. Serious enquiries are triaged within one business day — include headcount, branches, and whether you need offline-first deployment.', 'dropsoft-corporate'); ?>
			</p>
			<p style="color: var(--ds-slate-400); margin: 0;">
				<strong style="color: var(--ds-white);"><?php esc_html_e('WordPress admin email:', 'dropsoft-corporate'); ?></strong>
				<?php echo esc_html(get_option('admin_email')); ?>
			</p>
			<?php if ($sales_email && is_email($sales_email)) : ?>
				<p style="color: var(--ds-slate-400); margin-top: 12px;">
					<strong style="color: var(--ds-white);"><?php esc_html_e('Sales:', 'dropsoft-corporate'); ?></strong>
					<a href="mailto:<?php echo esc_attr($sales_email); ?>"><?php echo esc_html($sales_email); ?></a>
				</p>
			<?php endif; ?>
		</div>

		<div class="ds-reveal">
			<?php if ($contact_message === 'sent') : ?>
				<p class="ds-alert ds-alert--success ds-alert--prominent" role="status"><?php esc_html_e('Message sent successfully — thank you. We will respond as soon as we can.', 'dropsoft-corporate'); ?></p>
			<?php elseif ($contact_message === 'error') : ?>
				<p class="ds-alert ds-alert--error" role="alert"><?php esc_html_e('Something went wrong. Check all required fields and try again.', 'dropsoft-corporate'); ?></p>
			<?php endif; ?>

			<form class="ds-form" method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
				<input type="hidden" name="action" value="dropsoft_contact" />
				<?php wp_nonce_field('dropsoft_contact', 'dropsoft_contact_nonce'); ?>
				<p class="screen-reader-text">
					<label for="dropsoft_company_website"><?php esc_html_e('Leave this field empty', 'dropsoft-corporate'); ?></label>
					<input type="text" name="dropsoft_company_website" id="dropsoft_company_website" value="" tabindex="-1" autocomplete="off" />
				</p>

				<div class="ds-form__row ds-form__row--2">
					<div>
						<label for="contact_name"><?php esc_html_e('Full name', 'dropsoft-corporate'); ?> *</label>
						<input type="text" id="contact_name" name="contact_name" required autocomplete="name" />
					</div>
					<div>
						<label for="contact_email"><?php esc_html_e('Work email', 'dropsoft-corporate'); ?> *</label>
						<input type="email" id="contact_email" name="contact_email" required autocomplete="email" />
					</div>
				</div>

				<div class="ds-form__row ds-form__row--2">
					<div>
						<label for="contact_phone"><?php esc_html_e('Phone (optional)', 'dropsoft-corporate'); ?></label>
						<input type="text" id="contact_phone" name="contact_phone" autocomplete="tel" />
					</div>
					<div>
						<label for="contact_topic"><?php esc_html_e('Interest', 'dropsoft-corporate'); ?></label>
						<select id="contact_topic" name="contact_topic">
							<option value="Dropsoft HR"><?php esc_html_e('Dropsoft HR', 'dropsoft-corporate'); ?></option>
							<option value="Dropsoft ERP"><?php esc_html_e('Dropsoft ERP', 'dropsoft-corporate'); ?></option>
							<option value="School / other product"><?php esc_html_e('School / other product', 'dropsoft-corporate'); ?></option>
							<option value="Custom development"><?php esc_html_e('Custom development', 'dropsoft-corporate'); ?></option>
						</select>
					</div>
				</div>

				<div>
					<label for="contact_message"><?php esc_html_e('Project details', 'dropsoft-corporate'); ?> *</label>
					<textarea id="contact_message" name="contact_message" required placeholder="<?php esc_attr_e('Company size, locations, timeline, integrations…', 'dropsoft-corporate'); ?>"></textarea>
				</div>

				<button type="submit" name="dropsoft_contact_submit" value="1" class="ds-btn ds-btn--primary">
					<?php esc_html_e('Send inquiry', 'dropsoft-corporate'); ?>
				</button>
			</form>
		</div>
	</div>
</section>
