<?php
/**
 * Template Name: Elementor full width
 * Template Post Type: page
 *
 * Page layout with theme header/footer and a full-width main area for Elementor sections.
 *
 * @package Dropsoft_Corporate
 */

defined('ABSPATH') || exit;

get_header();

while (have_posts()) {
	the_post();
	get_template_part('template-parts/content', 'elementor');
}

get_footer();
