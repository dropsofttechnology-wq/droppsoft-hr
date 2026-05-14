<?php
/**
 * Main content area for pages/posts built with Elementor (no theme title wrapper).
 *
 * @package Dropsoft_Corporate
 */

defined('ABSPATH') || exit;

$template_args = isset($args) && is_array($args) ? $args : array();
$ds_el_extra   = '';
if (!empty($template_args['extra_class']) && is_string($template_args['extra_class'])) {
	$ds_el_extra = ' ' . sanitize_html_class($template_args['extra_class']);
}
?>
<main id="main" class="ds-elementor-page<?php echo esc_attr($ds_el_extra); ?>" role="main">
	<?php the_content(); ?>
</main>
