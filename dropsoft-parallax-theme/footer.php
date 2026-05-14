<?php
/**
 * Theme footer.
 *
 * @package Dropsoft_Corporate
 */
?>
<?php
$dropsoft_elementor_footer = function_exists('elementor_theme_do_location') && elementor_theme_do_location('footer');
?>
<?php if (!$dropsoft_elementor_footer) : ?>
<footer class="site-footer">
	<div class="site-footer__grid">
		<div class="site-footer__brand">
			<span class="site-footer__name"><?php bloginfo('name'); ?></span>
			<p class="site-footer__tag"><?php bloginfo('description'); ?></p>
		</div>
		<?php if (has_nav_menu('footer')) : ?>
			<nav class="footer-nav" aria-label="<?php esc_attr_e('Footer', 'dropsoft-corporate'); ?>">
				<?php
				wp_nav_menu(
					array(
						'theme_location' => 'footer',
						'container'      => false,
						'menu_class'     => 'footer-nav__list',
					)
				);
				?>
			</nav>
		<?php endif; ?>
	</div>
	<p class="site-footer__copy">
		&copy; <?php echo esc_html(gmdate('Y')); ?>
		<?php bloginfo('name'); ?>.
		<?php esc_html_e('All rights reserved.', 'dropsoft-corporate'); ?>
	</p>
</footer>
<?php endif; ?>
<?php wp_footer(); ?>
</body>
</html>
