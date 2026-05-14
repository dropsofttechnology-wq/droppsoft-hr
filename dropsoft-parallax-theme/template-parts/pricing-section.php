<?php
/**
 * Dropsoft HR pricing & feature matrix (matches subscription engine catalog).
 *
 * @package Dropsoft_Corporate
 */

defined('ABSPATH') || exit;

$packages = dropsoft_corporate_get_license_packages();
$billable = dropsoft_corporate_get_billable_features();
$core     = dropsoft_corporate_get_core_hr_features();
$payment  = dropsoft_corporate_get_payment_details();
$order    = array('starter', 'growth', 'business', 'enterprise');
?>
<section id="pricing" class="ds-section ds-pricing ds-pricing--catalog" data-pricing-section>
	<div class="ds-container">
		<h2 class="ds-section__title ds-reveal"><?php esc_html_e('Dropsoft HR — licences & pricing', 'dropsoft-corporate'); ?></h2>
		<p class="ds-section__lead ds-reveal">
			<?php esc_html_e('Published figures match the Dropsoft HR subscription catalogue in the product (monthly renewal, optional yearly billing with 15% off, employee caps, and one-time lifetime onboarding). ERP and bespoke work are quoted separately.', 'dropsoft-corporate'); ?>
		</p>

		<div class="ds-pricing-toolbar ds-reveal" role="group" aria-label="<?php esc_attr_e('Billing period', 'dropsoft-corporate'); ?>">
			<span class="ds-pricing-toolbar__label ds-pricing-toolbar__label--monthly" id="ds-pricing-label-monthly"><?php esc_html_e('Monthly renewal', 'dropsoft-corporate'); ?></span>
			<label class="ds-pricing-switch">
				<input type="checkbox" class="ds-pricing-switch__input" id="ds-pricing-period" data-pricing-toggle aria-labelledby="ds-pricing-label-monthly ds-pricing-label-annual" />
				<span class="ds-pricing-switch__track" aria-hidden="true"><span class="ds-pricing-switch__thumb"></span></span>
				<span class="screen-reader-text"><?php esc_html_e('Toggle between monthly and yearly licence display', 'dropsoft-corporate'); ?></span>
			</label>
			<span class="ds-pricing-toolbar__label ds-pricing-toolbar__label--annual" id="ds-pricing-label-annual">
				<?php esc_html_e('Yearly prepay', 'dropsoft-corporate'); ?>
				<span class="ds-pricing-toolbar__save"><?php esc_html_e('15% off', 'dropsoft-corporate'); ?></span>
			</span>
		</div>

		<div class="ds-pricing-table-wrap ds-reveal ds-pricing-table-wrap--wide">
			<table class="ds-pricing-table ds-pricing-table--plans">
				<thead>
					<tr>
						<th scope="col"><?php esc_html_e('Plan detail', 'dropsoft-corporate'); ?></th>
						<?php foreach ($order as $pid) : ?>
							<th scope="col"><?php echo esc_html($packages[ $pid ]['name']); ?></th>
						<?php endforeach; ?>
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row"><?php esc_html_e('Subscription (public list)', 'dropsoft-corporate'); ?></th>
						<?php
						foreach ($order as $pid) :
							$p         = $packages[ $pid ];
							$m         = (int) $p['monthly_kes'];
							$y_total   = dropsoft_corporate_pricing_yearly_total_kes($m);
							$monthly_s = dropsoft_corporate_format_kes_amount($m) . ' / mo';
							$annual_s  = dropsoft_corporate_format_kes_amount($y_total) . ' / yr';
							?>
							<td>
								<span class="ds-price ds-price--dynamic" data-pricing-cell data-monthly="<?php echo esc_attr($monthly_s); ?>" data-annual="<?php echo esc_attr($annual_s); ?>"><?php echo esc_html($monthly_s); ?></span>
							</td>
							<?php
						endforeach;
						?>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e('Employees included', 'dropsoft-corporate'); ?></th>
						<?php foreach ($order as $pid) : ?>
							<?php
							$cap = $packages[ $pid ]['employee_cap'];
							$txt = $cap === null
								? __('300+ (custom)', 'dropsoft-corporate')
								/* translators: %d: employee cap */
								: sprintf(__('Up to %d', 'dropsoft-corporate'), (int) $cap);
							?>
							<td><?php echo esc_html($txt); ?></td>
						<?php endforeach; ?>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e('Admin / manager seats (included)', 'dropsoft-corporate'); ?></th>
						<?php foreach ($order as $pid) : ?>
							<td><?php echo (int) $packages[ $pid ]['admin_users']; ?></td>
						<?php endforeach; ?>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e('Overage (per extra employee / month)', 'dropsoft-corporate'); ?></th>
						<?php foreach ($order as $pid) : ?>
							<?php
							$o = (int) $packages[ $pid ]['overage_per_employee_kes'];
							?>
							<td><?php echo esc_html(dropsoft_corporate_format_kes_amount($o)); ?></td>
						<?php endforeach; ?>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e('One-time lifetime onboarding (catalogue)', 'dropsoft-corporate'); ?></th>
						<?php foreach ($order as $pid) : ?>
							<td><?php echo esc_html(dropsoft_corporate_format_kes_amount((int) $packages[ $pid ]['onboarding_kes'])); ?></td>
						<?php endforeach; ?>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e('Positioning', 'dropsoft-corporate'); ?></th>
						<?php foreach ($order as $pid) : ?>
							<td class="ds-pricing-table__tagline"><?php echo esc_html($packages[ $pid ]['tagline']); ?></td>
						<?php endforeach; ?>
					</tr>
				</tbody>
			</table>
		</div>

		<h2 class="ds-section__title ds-reveal" style="margin-top: 3rem;"><?php esc_html_e('Core HR & payroll (every plan)', 'dropsoft-corporate'); ?></h2>
		<ul class="ds-pricing-core-list ds-reveal">
			<?php foreach ($core as $line) : ?>
				<li><?php echo esc_html($line); ?></li>
			<?php endforeach; ?>
		</ul>

		<h2 class="ds-section__title ds-reveal" style="margin-top: 2.5rem;"><?php esc_html_e('Module matrix — what is bundled', 'dropsoft-corporate'); ?></h2>
		<p class="ds-section__lead ds-reveal"><?php esc_html_e('Ticked cells are included in the monthly renewal for that tier. Anything not bundled can be added as a paid add-on at the list rates below.', 'dropsoft-corporate'); ?></p>

		<div class="ds-pricing-table-wrap ds-reveal ds-pricing-table-wrap--wide">
			<table class="ds-pricing-table ds-matrix">
				<thead>
					<tr>
						<th scope="col"><?php esc_html_e('Module', 'dropsoft-corporate'); ?></th>
						<?php foreach ($order as $pid) : ?>
							<th scope="col"><?php echo esc_html($packages[ $pid ]['name']); ?></th>
						<?php endforeach; ?>
						<th scope="col"><?php esc_html_e('Add-on if not included (KES / mo)', 'dropsoft-corporate'); ?></th>
					</tr>
				</thead>
				<tbody>
					<?php foreach ($billable as $bf) : ?>
						<tr>
							<th scope="row">
								<strong><?php echo esc_html($bf['label']); ?></strong>
								<span class="ds-matrix__desc"><?php echo esc_html($bf['description']); ?></span>
							</th>
							<?php foreach ($order as $pid) : ?>
								<td class="ds-matrix__check">
									<?php if (dropsoft_corporate_plan_includes_feature($packages[ $pid ], $bf['id'])) : ?>
										<span aria-label="<?php esc_attr_e('Included', 'dropsoft-corporate'); ?>">✓</span>
									<?php else : ?>
										<span class="ds-matrix__dash">—</span>
									<?php endif; ?>
								</td>
							<?php endforeach; ?>
							<td><?php echo esc_html(dropsoft_corporate_format_kes_amount((int) $bf['monthly_kes'])); ?></td>
						</tr>
					<?php endforeach; ?>
				</tbody>
			</table>
		</div>

		<h2 class="ds-section__title ds-reveal" style="margin-top: 2.5rem;"><?php esc_html_e('Dropsoft ERP & custom work', 'dropsoft-corporate'); ?></h2>
		<p class="ds-section__lead ds-reveal">
			<?php esc_html_e('Inventory, POS, purchasing, and branch operations are scoped per deployment — branches, SKUs, integrations, and training drive the quote. Ask for a workshop and fixed-scope statement of work.', 'dropsoft-corporate'); ?>
		</p>

		<h2 class="ds-section__title ds-reveal" style="margin-top: 2rem;"><?php esc_html_e('Payment channels (Kenya)', 'dropsoft-corporate'); ?></h2>
		<div class="ds-pricing-pay ds-reveal">
			<p><strong><?php echo esc_html($payment['legal_name']); ?></strong></p>
			<ul>
				<li><?php esc_html_e('KCB Bank — account number:', 'dropsoft-corporate'); ?> <strong><?php echo esc_html($payment['kcb_account']); ?></strong></li>
				<li>
					<?php esc_html_e('M-Pesa paybill:', 'dropsoft-corporate'); ?>
					<strong><?php echo esc_html($payment['mpesa_paybill']); ?></strong>
					<?php esc_html_e('— account:', 'dropsoft-corporate'); ?>
					<strong><?php echo esc_html($payment['mpesa_account']); ?></strong>
				</li>
			</ul>
		</div>

		<p class="ds-pricing-note ds-reveal">
			<?php esc_html_e('All figures are in Kenya Shillings (KES), exclusive of VAT where applicable. Final invoices may reflect employee counts above plan caps, add-on modules, commercial discounts approved in writing, and implementation scope.', 'dropsoft-corporate'); ?>
		</p>
	</div>
</section>
