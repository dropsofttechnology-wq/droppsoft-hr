<?php
/**
 * 404 — on-brand “system” message.
 *
 * @package Dropsoft_Corporate
 */

$GLOBALS['dropsoft_minimal_header'] = true;

get_header();
?>

<main id="main" class="ds-standard-page ds-error-page">
	<div class="ds-standard-page__inner ds-error-page__inner">
		<p class="ds-error-page__code" aria-hidden="true"><?php esc_html_e('404', 'dropsoft-corporate'); ?></p>
		<h1 class="ds-error-page__title"><?php esc_html_e('System route not found', 'dropsoft-corporate'); ?></h1>
		<p class="ds-error-page__lead">
			<?php esc_html_e('That address does not match any page on this site — like a broken deep link in a legacy module. The rest of Dropsoft is still online.', 'dropsoft-corporate'); ?>
		</p>
		<p class="ds-error-page__hint">
			<?php esc_html_e('Check the URL for typos, or return to the homepage to explore our HR & ERP systems.', 'dropsoft-corporate'); ?>
		</p>
		<a class="ds-btn ds-btn--primary ds-error-page__btn" href="<?php echo esc_url( home_url( '/' ) ); ?>">
			<?php esc_html_e('Return to homepage', 'dropsoft-corporate'); ?>
		</a>
	</div>
</main>

<?php
unset( $GLOBALS['dropsoft_minimal_header'] );
get_footer();
