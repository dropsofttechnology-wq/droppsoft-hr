<?php
/**
 * Single blog post — matches standard content layout (see index.php archives).
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
					<p class="ds-blog-meta">
						<time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date()); ?></time>
						<?php
						$cats = get_the_category();
						if (!empty($cats)) {
							echo ' <span class="ds-blog-meta__sep">·</span> ';
							echo esc_html($cats[0]->name);
						}
						?>
					</p>
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
				<?php
				wp_link_pages(
					array(
						'before' => '<nav class="ds-page-links" aria-label="' . esc_attr__('Page', 'dropsoft-corporate') . '"><span class="ds-page-links__label">' . esc_html__('Pages:', 'dropsoft-corporate') . '</span>',
						'after'  => '</nav>',
					)
				);
				?>
				<nav class="ds-post-nav" aria-label="<?php esc_attr_e('Post navigation', 'dropsoft-corporate'); ?>">
					<?php
					the_post_navigation(
						array(
							'prev_text' => '<span class="ds-post-nav__dir">' . esc_html__('Previous', 'dropsoft-corporate') . '</span><span class="ds-post-nav__title">%title</span>',
							'next_text' => '<span class="ds-post-nav__dir">' . esc_html__('Next', 'dropsoft-corporate') . '</span><span class="ds-post-nav__title">%title</span>',
						)
					);
					?>
				</nav>
			</article>
		</div>
	</main>
		<?php
	}
}

unset($GLOBALS['dropsoft_minimal_header']);
get_footer();
