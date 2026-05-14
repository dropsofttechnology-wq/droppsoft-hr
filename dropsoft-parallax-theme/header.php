<?php
/**
 * Theme header.
 *
 * @package Dropsoft_Corporate
 */
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo('charset'); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php
	// Open Graph / Twitter cards: see dropsoft_corporate_document_meta() in functions.php (wp_head).
	wp_head();
	?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<?php
$dropsoft_circuit_style = 'background-image: url(' . esc_url(get_template_directory_uri() . '/assets/images/circuit-motherboard-bg.png') . ');';
?>
<div class="ds-circuit-bg" aria-hidden="true">
	<div class="ds-circuit-bg__image" style="<?php echo esc_attr($dropsoft_circuit_style); ?>"></div>
	<div class="ds-circuit-bg__scrim"></div>
	<?php if (!function_exists('wp_is_mobile') || !wp_is_mobile()) : ?>
		<canvas class="ds-circuit-bg__canvas" width="300" height="150"></canvas>
	<?php endif; ?>
</div>
<a class="skip-link screen-reader-text" href="#main"><?php esc_html_e('Skip to content', 'dropsoft-corporate'); ?></a>

<?php
$dropsoft_minimal_header = ! empty( $GLOBALS['dropsoft_minimal_header'] );
?>
<?php
$dropsoft_elementor_header = function_exists('elementor_theme_do_location') && elementor_theme_do_location('header');
?>
<?php if (!$dropsoft_elementor_header) : ?>
<header class="site-header<?php echo $dropsoft_minimal_header ? ' site-header--minimal' : ''; ?>">
	<div class="site-header__inner">
		<div class="site-branding">
			<?php
			if (has_custom_logo()) {
				the_custom_logo();
			} else {
				?>
				<a href="<?php echo esc_url(home_url('/')); ?>" class="site-title-link">
					<span class="site-title-mark" aria-hidden="true"></span>
					<span class="site-title-text"><?php bloginfo('name'); ?></span>
				</a>
				<?php
			}
			?>
		</div>
		<button type="button" class="nav-toggle" aria-expanded="false" aria-controls="primary-nav" data-nav-toggle>
			<span class="nav-toggle__bar"></span>
			<span class="nav-toggle__bar"></span>
			<span class="nav-toggle__bar"></span>
			<span class="screen-reader-text"><?php esc_html_e('Menu', 'dropsoft-corporate'); ?></span>
		</button>
		<nav id="primary-nav" class="primary-nav" aria-label="<?php esc_attr_e('Primary', 'dropsoft-corporate'); ?>">
			<?php
			wp_nav_menu(
				array(
					'theme_location' => 'primary',
					'container'      => false,
					'menu_class'     => 'primary-nav__list',
					'fallback_cb'    => 'dropsoft_corporate_fallback_menu',
				)
			);
			?>
		</nav>
	</div>
</header>
<?php endif; ?>
