<?php
/**
 * Systems screenshot carousel (Customizer images).
 *
 * Expected $args keys: slides (array), heading (string), interval_ms (int), viewport_id (string).
 *
 * @package Dropsoft_Corporate
 */

defined('ABSPATH') || exit;

$slideshow_args = isset($args) && is_array($args) ? $args : array();
$dropsoft_slides = isset($slideshow_args['slides']) && is_array($slideshow_args['slides']) ? $slideshow_args['slides'] : array();
$dropsoft_slideshow_heading = isset($slideshow_args['heading']) ? (string) $slideshow_args['heading'] : '';
$dropsoft_slideshow_interval_ms = isset($slideshow_args['interval_ms']) ? (int) $slideshow_args['interval_ms'] : 6000;
$viewport_id = !empty($slideshow_args['viewport_id']) ? sanitize_html_class((string) $slideshow_args['viewport_id']) : 'ds-slideshow-viewport';
?>
<section id="systems-slideshow" class="ds-section ds-slideshow" aria-labelledby="ds-slideshow-heading">
	<div class="ds-container">
		<h2 id="ds-slideshow-heading" class="ds-section__title ds-reveal"><?php echo esc_html($dropsoft_slideshow_heading); ?></h2>
		<p class="ds-section__lead ds-reveal"><?php esc_html_e('Real screens from Dropsoft HR, ERP, and related modules — swap in your own shots from the Customizer.', 'dropsoft-corporate'); ?></p>

		<?php if (!empty($dropsoft_slides)) : ?>
			<div
				class="ds-slideshow__frame ds-reveal"
				data-ds-slideshow
				data-interval="<?php echo esc_attr((string) $dropsoft_slideshow_interval_ms); ?>"
				tabindex="0"
			>
				<div id="<?php echo esc_attr($viewport_id); ?>" class="ds-slideshow__viewport">
					<?php
					foreach ($dropsoft_slides as $i => $slide) :
						$active = (0 === $i);
						$cap    = isset($slide['caption']) ? $slide['caption'] : '';
						?>
						<figure
							class="ds-slideshow__slide<?php echo $active ? ' is-active' : ''; ?>"
							data-caption="<?php echo esc_attr($cap); ?>"
							aria-hidden="<?php echo $active ? 'false' : 'true'; ?>"
							<?php
							if (!$active) {
								echo ' inert';
							}
							?>
						>
							<?php
							echo wp_get_attachment_image(
								(int) $slide['id'],
								'large',
								false,
								array(
									'class'    => 'ds-slideshow__img',
									'alt'      => isset($slide['alt']) ? $slide['alt'] : '',
									'loading'  => $active ? 'eager' : 'lazy',
									'decoding' => 'async',
									'sizes'    => '(min-width: 900px) 960px, 100vw',
								)
							);
							?>
						</figure>
						<?php
					endforeach;
					?>
				</div>

				<?php if (count($dropsoft_slides) > 1) : ?>
					<div class="ds-slideshow__toolbar" role="group" aria-label="<?php esc_attr_e('Slideshow controls', 'dropsoft-corporate'); ?>">
						<button type="button" class="ds-slideshow__btn ds-slideshow__btn--prev" data-ds-slideshow-prev aria-controls="<?php echo esc_attr($viewport_id); ?>">
							<span aria-hidden="true">‹</span>
							<span class="screen-reader-text"><?php esc_html_e('Previous slide', 'dropsoft-corporate'); ?></span>
						</button>
						<div class="ds-slideshow__dots" data-ds-slideshow-dots>
							<?php
							foreach ($dropsoft_slides as $i => $slide) :
								$slide_go_label = sprintf(
									/* translators: %d: slide number (1-based). */
									__('Go to slide %d', 'dropsoft-corporate'),
									$i + 1
								);
								?>
								<button
									type="button"
									class="ds-slideshow__dot<?php echo 0 === $i ? ' is-active' : ''; ?>"
									data-slide-to="<?php echo (int) $i; ?>"
									aria-label="<?php echo esc_attr($slide_go_label); ?>"
									aria-current="<?php echo 0 === $i ? 'true' : 'false'; ?>"
								></button>
								<?php
							endforeach;
							?>
						</div>
						<button type="button" class="ds-slideshow__btn ds-slideshow__btn--next" data-ds-slideshow-next aria-controls="<?php echo esc_attr($viewport_id); ?>">
							<span aria-hidden="true">›</span>
							<span class="screen-reader-text"><?php esc_html_e('Next slide', 'dropsoft-corporate'); ?></span>
						</button>
					</div>
				<?php endif; ?>

				<p class="ds-slideshow__live" data-ds-slideshow-live aria-live="polite"><?php echo isset($dropsoft_slides[0]['caption']) ? esc_html($dropsoft_slides[0]['caption']) : ''; ?></p>
			</div>
		<?php else : ?>
			<div class="ds-slideshow__placeholder ds-reveal">
				<p class="ds-slideshow__placeholder-text"><?php esc_html_e('Add images in Appearance → Customize → Dropsoft — Systems slideshow (up to six). They will rotate here automatically.', 'dropsoft-corporate'); ?></p>
				<div class="ds-slideshow__placeholder-grid" aria-hidden="true">
					<div class="ds-slideshow__placeholder-tile"><?php esc_html_e('HR & payroll', 'dropsoft-corporate'); ?></div>
					<div class="ds-slideshow__placeholder-tile"><?php esc_html_e('ERP & inventory', 'dropsoft-corporate'); ?></div>
					<div class="ds-slideshow__placeholder-tile"><?php esc_html_e('Attendance & reports', 'dropsoft-corporate'); ?></div>
				</div>
			</div>
		<?php endif; ?>
	</div>
</section>
