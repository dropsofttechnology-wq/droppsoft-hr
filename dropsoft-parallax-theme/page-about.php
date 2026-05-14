<?php
/**
 * Marketing: About (slug `about`).
 *
 * @package Dropsoft_Corporate
 */

$GLOBALS['dropsoft_minimal_header'] = true;

get_header();

while (have_posts()) {
	the_post();
	?>
<main id="main" class="ds-marketing-page">
	<header class="ds-container ds-page-intro">
		<h1 class="ds-page-intro__title"><?php the_title(); ?></h1>
		<?php if (has_excerpt()) : ?>
			<p class="ds-page-intro__lead"><?php echo esc_html(get_the_excerpt()); ?></p>
		<?php endif; ?>
	</header>
	<?php get_template_part('template-parts/marketing', 'about'); ?>
	<?php
	$more = get_post_field('post_content', get_the_ID());
	if (is_string($more) && strlen(trim(wp_strip_all_tags($more))) > 0) {
		?>
	<section class="ds-section">
		<div class="ds-container entry-content ds-page-user-content">
			<?php the_content(); ?>
		</div>
	</section>
		<?php
	}
	?>
</main>
	<?php
}

unset($GLOBALS['dropsoft_minimal_header']);
get_footer();
