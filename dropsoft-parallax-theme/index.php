<?php
/**
 * Blog index, archives, search — and rare fallbacks when no dedicated template exists.
 *
 * @package Dropsoft_Corporate
 */

if (!is_front_page()) {
    $GLOBALS['dropsoft_minimal_header'] = true;
}

get_header();

if (is_home() || is_archive() || is_search()) {
    ?>
	<main id="main" class="ds-standard-page ds-blog-index">
		<div class="ds-standard-page__inner ds-blog-index__inner">
			<header class="ds-blog-index__header">
				<h1 class="ds-blog-index__title">
					<?php
					if (is_home()) {
						esc_html_e('Insights & updates', 'dropsoft-corporate');
					} elseif (is_search()) {
						printf(
							/* translators: %s search query */
							esc_html__('Search results for "%s"', 'dropsoft-corporate'),
							esc_html(get_search_query())
						);
					} elseif (is_category()) {
						single_cat_title();
					} elseif (is_tag()) {
						single_tag_title();
					} elseif (is_author()) {
						the_author();
					} elseif (is_post_type_archive()) {
						post_type_archive_title();
					} elseif (is_tax()) {
						single_term_title();
					} else {
						esc_html_e('Archive', 'dropsoft-corporate');
					}
					?>
				</h1>
				<?php if (is_home() || is_category()) : ?>
					<p class="ds-blog-index__intro"><?php esc_html_e('Regulatory notes, product updates, and practical guides — written for finance and HR teams.', 'dropsoft-corporate'); ?></p>
				<?php endif; ?>
				<?php get_search_form(); ?>
			</header>

			<?php if (have_posts()) : ?>
				<ul class="ds-blog-list">
					<?php
					while (have_posts()) {
						the_post();
						?>
						<li>
							<article <?php post_class('ds-blog-card'); ?>>
								<h2 class="ds-blog-card__title">
									<a href="<?php the_permalink(); ?>"><?php the_title(); ?></a>
								</h2>
								<p class="ds-blog-card__meta">
									<time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date()); ?></time>
									<?php
									$excerpt = get_the_excerpt();
									if ($excerpt !== '') {
										echo ' <span class="ds-blog-meta__sep">·</span> ';
										echo esc_html(wp_trim_words($excerpt, 22, '…'));
									}
									?>
								</p>
								<a class="ds-blog-card__link" href="<?php the_permalink(); ?>"><?php esc_html_e('Read article', 'dropsoft-corporate'); ?></a>
							</article>
						</li>
						<?php
					}
					?>
				</ul>
				<nav class="ds-blog-pagination" aria-label="<?php esc_attr_e('Posts navigation', 'dropsoft-corporate'); ?>">
					<?php
					the_posts_pagination(
						array(
							'mid_size'  => 2,
							'prev_text' => __('« Newer', 'dropsoft-corporate'),
							'next_text' => __('Older »', 'dropsoft-corporate'),
						)
					);
					?>
				</nav>
			<?php else : ?>
				<p class="ds-blog-empty"><?php esc_html_e('No posts found yet. Publish your first article from the dashboard.', 'dropsoft-corporate'); ?></p>
			<?php endif; ?>
		</div>
	</main>
	<?php
} else {
    ?>
	<main id="main" class="ds-standard-page">
		<div class="ds-standard-page__inner">
			<?php
			while (have_posts()) {
				the_post();
				?>
				<article <?php post_class('ds-standard-page__article'); ?>>
					<header class="ds-standard-page__header">
						<h1 class="ds-standard-page__title"><?php the_title(); ?></h1>
					</header>
					<div class="ds-standard-page__content entry-content">
						<?php the_content(); ?>
					</div>
				</article>
				<?php
			}
			?>
		</div>
	</main>
	<?php
}

unset($GLOBALS['dropsoft_minimal_header']);
get_footer();
