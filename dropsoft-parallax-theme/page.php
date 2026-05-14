<?php
/**
 * Standard pages — Terms, Privacy, etc. (no marketing parallax).
 *
 * @package Dropsoft_Corporate
 */

$GLOBALS['dropsoft_minimal_header'] = true;

get_header();

while (have_posts()) {
	the_post();
	if (function_exists('dropsoft_corporate_is_built_with_elementor') && dropsoft_corporate_is_built_with_elementor(get_the_ID())) {
		get_template_part('template-parts/content', 'elementor');
	} else {
		?>
<main id="main" class="ds-standard-page">
	<div class="ds-standard-page__inner">
			<article <?php post_class('ds-standard-page__article'); ?>>
				<header class="ds-standard-page__header">
					<h1 class="ds-standard-page__title"><?php the_title(); ?></h1>
				</header>
				<?php if (has_post_thumbnail()) : ?>
					<div class="ds-standard-page__thumb">
						<?php the_post_thumbnail('large', array('loading' => 'lazy')); ?>
					</div>
				<?php endif; ?>
				<div class="ds-standard-page__content entry-content">
					<?php the_content(); ?>
				</div>
			</article>
	</div>
</main>
		<?php
	}
}

unset($GLOBALS['dropsoft_minimal_header']);
get_footer();
