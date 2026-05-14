<?php
/**
 * Dropsoft Corporate Parallax — theme bootstrap.
 *
 * @package Dropsoft_Corporate
 */

if (!defined('ABSPATH')) {
    exit;
}

define('DROPSOFT_CORPORATE_VERSION', '1.2.3');

require_once get_template_directory() . '/inc/pricing-data.php';

/*
 * Optional analytics overrides (set in wp-config.php before this theme loads):
 * define( 'DROPSOFT_GA4_ID', 'G-XXXXXXXXXX' );
 * define( 'DROPSOFT_PLAUSIBLE_DOMAIN', 'yoursite.co.ke' ); // no https://
 * define( 'DROPSOFT_PLAUSIBLE_SCRIPT_URL', 'https://analytics.yoursite.co.ke/js/script.js' ); // self-hosted Plausible
 * If Plausible domain is set (constant or Customizer), it takes priority over GA4.
 */

/**
 * Theme setup — Gutenberg-friendly.
 */
function dropsoft_corporate_setup() {
    load_theme_textdomain('dropsoft-corporate', get_template_directory() . '/languages');

    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('responsive-embeds');
    add_theme_support('wp-block-styles');
    add_theme_support('align-wide');
    add_theme_support('editor-styles');
    add_editor_style('style.css');

    add_theme_support(
        'custom-logo',
        array(
            'height'      => 120,
            'width'       => 400,
            'flex-height' => true,
            'flex-width'  => true,
        )
    );

    add_theme_support(
        'html5',
        array('search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script')
    );

    register_nav_menus(
        array(
            'primary' => __('Primary Menu', 'dropsoft-corporate'),
            'footer'  => __('Footer Menu', 'dropsoft-corporate'),
        )
    );

    if (!isset($GLOBALS['content_width'])) {
        $GLOBALS['content_width'] = (int) apply_filters('dropsoft_corporate_content_width', 1200);
    }
}
add_action('after_setup_theme', 'dropsoft_corporate_setup');

/**
 * Elementor: content width (widgets, sections) and Theme Builder locations.
 */
function dropsoft_corporate_elementor_register_locations($elementor_theme_manager) {
    if (is_object($elementor_theme_manager) && method_exists($elementor_theme_manager, 'register_all_core_location')) {
        $elementor_theme_manager->register_all_core_location();
    }
}
add_action('elementor/theme/register_locations', 'dropsoft_corporate_elementor_register_locations');

/**
 * Whether Elementor is active (free or Pro).
 *
 * @return bool
 */
function dropsoft_corporate_is_elementor_active() {
    return class_exists('\Elementor\Plugin', false);
}

/**
 * Whether a post/page was built with the Elementor editor.
 *
 * @param int|null $post_id Post ID, or null for current post in the loop.
 * @return bool
 */
function dropsoft_corporate_is_built_with_elementor($post_id = null) {
    if (!dropsoft_corporate_is_elementor_active()) {
        return false;
    }
    $post_id = $post_id !== null ? absint($post_id) : get_the_ID();
    if (!$post_id) {
        return false;
    }
    $post_type = get_post_type($post_id);
    if (!$post_type || !post_type_supports($post_type, 'editor')) {
        return false;
    }
    $document = \Elementor\Plugin::$instance->documents->get($post_id);
    return is_object($document) && method_exists($document, 'is_built_with_elementor') && $document->is_built_with_elementor();
}

/**
 * Static front page is set and built with Elementor (use full Elementor layout instead of marketing front-page.php).
 *
 * @return bool
 */
function dropsoft_corporate_is_elementor_static_front_page() {
    if (!is_front_page() || 'page' !== get_option('show_on_front')) {
        return false;
    }
    $front_id = (int) get_option('page_on_front');
    return $front_id > 0 && dropsoft_corporate_is_built_with_elementor($front_id);
}

/**
 * @param string[] $classes Body classes.
 * @return string[]
 */
function dropsoft_corporate_body_class_elementor($classes) {
    if (!dropsoft_corporate_is_elementor_active()) {
        return $classes;
    }
    if (is_singular()) {
        $id = (int) get_queried_object_id();
        if ($id && dropsoft_corporate_is_built_with_elementor($id)) {
            $classes[] = 'ds-elementor-built';
        }
    }
    return $classes;
}
add_filter('body_class', 'dropsoft_corporate_body_class_elementor');

/**
 * Lighter background path on phones / tablets (no animated canvas).
 *
 * @param string[] $classes Body classes.
 * @return string[]
 */
function dropsoft_corporate_body_class_circuit_lite($classes) {
    if (function_exists('wp_is_mobile') && wp_is_mobile()) {
        $classes[] = 'ds-circuit-lite';
    }
    return $classes;
}
add_filter('body_class', 'dropsoft_corporate_body_class_circuit_lite');

/**
 * Avoid Rellax / theme JS conflicting with Elementor preview iframe.
 */
function dropsoft_corporate_elementor_dequeue_theme_scripts() {
    if (!dropsoft_corporate_is_elementor_active()) {
        return;
    }
    $elementor = \Elementor\Plugin::$instance;
    if (!isset($elementor->preview) || !is_object($elementor->preview)) {
        return;
    }
    if (!$elementor->preview->is_preview_mode()) {
        return;
    }
    wp_dequeue_script('rellax');
    wp_dequeue_script('dropsoft-corporate-theme');
    wp_dequeue_script('dropsoft-corporate-circuit-bg');
}
add_action('wp_enqueue_scripts', 'dropsoft_corporate_elementor_dequeue_theme_scripts', 100);

/**
 * Enqueue styles, Rellax, and theme behaviours.
 */
function dropsoft_corporate_assets() {
    wp_enqueue_style(
        'dropsoft-corporate-fonts',
        'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Outfit:wght@400;500;600;700&display=swap',
        array(),
        null
    );

    wp_enqueue_style(
        'dropsoft-corporate',
        get_stylesheet_uri(),
        array(),
        DROPSOFT_CORPORATE_VERSION
    );

    global $wp_version;
    $script_load = version_compare($wp_version, '6.3', '>=')
        ? array(
            'in_footer' => true,
            'strategy'  => 'defer',
        )
        : true;

    wp_enqueue_script(
        'rellax',
        'https://cdn.jsdelivr.net/npm/rellax@1.12.1/rellax.min.js',
        array(),
        '1.12.1',
        $script_load
    );

    wp_enqueue_script(
        'dropsoft-corporate-theme',
        get_template_directory_uri() . '/assets/js/theme.js',
        array('rellax'),
        DROPSOFT_CORPORATE_VERSION,
        $script_load
    );

    /* Animated circuit canvas is heavy on mobile GPUs — skip script + use static image only. */
    if (!function_exists('wp_is_mobile') || !wp_is_mobile()) {
        wp_enqueue_script(
            'dropsoft-corporate-circuit-bg',
            get_template_directory_uri() . '/assets/js/circuit-bg.js',
            array(),
            DROPSOFT_CORPORATE_VERSION,
            $script_load
        );
    }
}
add_action('wp_enqueue_scripts', 'dropsoft_corporate_assets');

/**
 * Defer Rellax + theme scripts on WordPress versions older than 6.3 (no script strategy support).
 *
 * @param string $tag    Script HTML.
 * @param string $handle Script handle.
 * @param string $src    Source URL.
 * @return string
 */
function dropsoft_corporate_defer_script_tags($tag, $handle, $src) {
    global $wp_version;
    if (version_compare($wp_version, '6.3', '>=')) {
        return $tag;
    }
    if (!in_array($handle, array('rellax', 'dropsoft-corporate-theme', 'dropsoft-corporate-circuit-bg'), true)) {
        return $tag;
    }
    if (stripos($tag, ' defer') !== false) {
        return $tag;
    }
    return preg_replace('/^<script\\b/i', '<script defer ', $tag, 1);
}
add_filter('script_loader_tag', 'dropsoft_corporate_defer_script_tags', 10, 3);

/**
 * Optional: widen block editor to match front-end for inner pages.
 */
function dropsoft_corporate_editor_width() {
    echo '<style>.wp-block { max-width: 1140px; }</style>';
}
add_action('admin_head', 'dropsoft_corporate_editor_width');

/**
 * Contact form POST handler.
 */
function dropsoft_corporate_handle_contact_form() {
    if (!isset($_POST['dropsoft_contact_submit'])) {
        return;
    }

    if (!isset($_POST['dropsoft_contact_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['dropsoft_contact_nonce'])), 'dropsoft_contact')) {
        wp_safe_redirect(dropsoft_corporate_contact_redirect_url('error'));
        exit;
    }

    // Honeypot — leave empty.
    if (!empty($_POST['dropsoft_company_website'])) {
        wp_safe_redirect(home_url('/'));
        exit;
    }

    $name    = isset($_POST['contact_name']) ? sanitize_text_field(wp_unslash($_POST['contact_name'])) : '';
    $email   = isset($_POST['contact_email']) ? sanitize_email(wp_unslash($_POST['contact_email'])) : '';
    $phone   = isset($_POST['contact_phone']) ? sanitize_text_field(wp_unslash($_POST['contact_phone'])) : '';
    $topic   = isset($_POST['contact_topic']) ? sanitize_text_field(wp_unslash($_POST['contact_topic'])) : '';
    $message = isset($_POST['contact_message']) ? sanitize_textarea_field(wp_unslash($_POST['contact_message'])) : '';

    if ($name === '' || !is_email($email) || $message === '') {
        wp_safe_redirect(dropsoft_corporate_contact_redirect_url('error'));
        exit;
    }

    $to = dropsoft_corporate_get_contact_form_recipient();
    if ($to === '') {
        $to = dropsoft_corporate_get_contact_display_email();
    }
    $subject = sprintf('[%s] %s', wp_specialchars_decode(get_bloginfo('name'), ENT_QUOTES), __('Product / custom dev inquiry', 'dropsoft-corporate'));
    $body    = sprintf(
        "Name: %s\nEmail: %s\nPhone: %s\nInterest: %s\n\nMessage:\n%s\n",
        $name,
        $email,
        $phone,
        $topic,
        $message
    );

    $headers = array('Content-Type: text/plain; charset=UTF-8', 'Reply-To: ' . $name . ' <' . $email . '>');

    $sent = wp_mail($to, $subject, $body, $headers);

    $query = $sent ? 'sent' : 'error';
    wp_safe_redirect(dropsoft_corporate_contact_redirect_url($query));
    exit;
}
add_action('admin_post_nopriv_dropsoft_contact', 'dropsoft_corporate_handle_contact_form');
add_action('admin_post_dropsoft_contact', 'dropsoft_corporate_handle_contact_form');

/**
 * Primary contact email for display (Customizer).
 *
 * @return string
 */
function dropsoft_corporate_get_contact_display_email() {
    $e = trim((string) get_theme_mod('dropsoft_contact_email', 'info@dropsoft.co.ke'));
    if ($e === '') {
        $e = 'info@dropsoft.co.ke';
    }
    $e = sanitize_email($e);
    if ($e && is_email($e)) {
        return strtolower($e);
    }
    $legacy = trim((string) get_theme_mod('dropsoft_sales_email', ''));
    if ($legacy !== '' && is_email($legacy)) {
        return strtolower($legacy);
    }
    return 'info@dropsoft.co.ke';
}

/**
 * Where contact form submissions are delivered (Customizer).
 *
 * @return string Valid email or empty (caller may fall back to admin_email).
 */
function dropsoft_corporate_get_contact_form_recipient() {
    $direct = trim((string) get_theme_mod('dropsoft_contact_form_recipient', ''));
    if ($direct !== '' && is_email($direct)) {
        return $direct;
    }
    $primary = trim((string) get_theme_mod('dropsoft_contact_email', 'info@dropsoft.co.ke'));
    if ($primary !== '' && is_email($primary)) {
        return $primary;
    }
    $legacy = trim((string) get_theme_mod('dropsoft_sales_email', ''));
    if ($legacy !== '' && is_email($legacy)) {
        return $legacy;
    }
    return '';
}

/**
 * @param mixed $value Raw email.
 * @return string
 */
function dropsoft_corporate_sanitize_contact_email_setting($value) {
    $v = sanitize_email((string) $value);
    return $v ? strtolower($v) : '';
}

/**
 * Find a published page by slug (for multi-page marketing URLs).
 *
 * @param string $slug Post name.
 * @return int Page ID or 0.
 */
function dropsoft_corporate_get_page_id_by_slug($slug) {
    $slug = sanitize_title((string) $slug);
    if ($slug === '') {
        return 0;
    }
    $found = get_posts(
        array(
            'name'             => $slug,
            'post_type'        => 'page',
            'post_status'      => 'publish',
            'numberposts'      => 1,
            'suppress_filters' => true,
            'fields'           => 'ids',
        )
    );
    return $found ? (int) $found[0] : 0;
}

/**
 * Permalink for a marketing page slug, or a best-effort URL if the page is missing.
 *
 * @param string $slug Page slug (solutions, pricing, contact, about).
 * @return string
 */
function dropsoft_corporate_page_url($slug) {
    $id = dropsoft_corporate_get_page_id_by_slug($slug);
    if ($id) {
        return get_permalink($id);
    }
    return home_url('/' . sanitize_title((string) $slug) . '/');
}

/**
 * Redirect target after contact form POST.
 *
 * @param string $status sent|error.
 * @return string
 */
function dropsoft_corporate_contact_redirect_url($status) {
    $base = dropsoft_corporate_page_url('contact');
    return add_query_arg('message', sanitize_key($status), $base) . '#contact';
}

/**
 * Create core marketing pages when the theme is activated (idempotent per slug).
 */
function dropsoft_corporate_seed_marketing_pages() {
    if (!function_exists('wp_insert_post')) {
        return;
    }

    $defs = array(
        'solutions' => array(
            'title'   => __('Solutions', 'dropsoft-corporate'),
            'excerpt' => __('Dropsoft HR, ERP, offline architecture, screenshots, and adjacent products.', 'dropsoft-corporate'),
        ),
        'pricing'   => array(
            'title'   => __('Pricing', 'dropsoft-corporate'),
            'excerpt' => __('Dropsoft HR licence tiers, module matrix, yearly discount, and payment details.', 'dropsoft-corporate'),
        ),
        'contact'   => array(
            'title'   => __('Contact', 'dropsoft-corporate'),
            'excerpt' => __('Sales enquiries, demos, and project briefs.', 'dropsoft-corporate'),
        ),
        'about'     => array(
            'title'   => __('About', 'dropsoft-corporate'),
            'excerpt' => __('Mission, delivery model, and trust strip.', 'dropsoft-corporate'),
        ),
    );

    foreach ($defs as $slug => $meta) {
        if (dropsoft_corporate_get_page_id_by_slug($slug)) {
            continue;
        }
        wp_insert_post(
            array(
                'post_title'   => $meta['title'],
                'post_name'    => $slug,
                'post_status'  => 'publish',
                'post_type'    => 'page',
                'post_content' => '',
                'post_excerpt' => isset($meta['excerpt']) ? $meta['excerpt'] : '',
            ),
            true
        );
    }
}
add_action('after_switch_theme', 'dropsoft_corporate_seed_marketing_pages');

/**
 * Open Graph & Twitter Card tags for social previews (WhatsApp, LinkedIn, X).
 */
function dropsoft_corporate_document_meta() {
    if (is_feed() || is_embed() || (function_exists('wp_is_json_request') && wp_is_json_request())) {
        return;
    }

    $brand     = __('Dropsoft Technologies Ltd', 'dropsoft-corporate');
    $default_d = __(
        'Dropsoft Technologies Ltd — KRA-aligned HR & payroll (iTax, NSSF, SHIF, AHL) and offline-first ERP for Kenyan businesses. Local-first automation you can rely on.',
        'dropsoft-corporate'
    );

    $og_title = $brand;
    $og_desc  = $default_d;
    $og_url   = home_url('/');
    $og_type  = 'website';

    if (is_singular()) {
        $og_url = get_permalink();
        $og_type = is_page() ? 'website' : 'article';

        if (is_front_page()) {
            $og_title = get_bloginfo('name');
            if (has_excerpt()) {
                $og_desc = wp_strip_all_tags(get_the_excerpt());
            }
        } else {
            $og_title = get_the_title() . ' | ' . get_bloginfo('name');
            if (has_excerpt()) {
                $og_desc = wp_strip_all_tags(get_the_excerpt());
            } else {
                $raw = get_post_field('post_content', get_queried_object_id());
                $og_desc = wp_trim_words(wp_strip_all_tags($raw), 36, '…');
            }
        }
    }

    $og_image = '';
    $shot     = get_template_directory() . '/screenshot.png';
    if (file_exists($shot)) {
        $og_image = get_template_directory_uri() . '/screenshot.png';
    }
    if (is_singular() && has_post_thumbnail()) {
        $thumb = get_the_post_thumbnail_url(null, 'large');
        if ($thumb) {
            $og_image = $thumb;
        }
    }

    echo '<meta property="og:site_name" content="' . esc_attr(get_bloginfo('name')) . '" />' . "\n";
    echo '<meta property="og:title" content="' . esc_attr($og_title) . '" />' . "\n";
    echo '<meta property="og:description" content="' . esc_attr($og_desc) . '" />' . "\n";
    echo '<meta property="og:url" content="' . esc_url($og_url) . '" />' . "\n";
    echo '<meta property="og:type" content="' . esc_attr($og_type) . '" />' . "\n";
    if ($og_image) {
        echo '<meta property="og:image" content="' . esc_url($og_image) . '" />' . "\n";
    }

    echo '<meta name="twitter:card" content="summary_large_image" />' . "\n";
    echo '<meta name="twitter:title" content="' . esc_attr($og_title) . '" />' . "\n";
    echo '<meta name="twitter:description" content="' . esc_attr($og_desc) . '" />' . "\n";
    if ($og_image) {
        echo '<meta name="twitter:image" content="' . esc_url($og_image) . '" />' . "\n";
    }
}
add_action('wp_head', 'dropsoft_corporate_document_meta', 5);

/**
 * Google Analytics 4 and/or Plausible (Customizer or wp-config constants).
 */
function dropsoft_corporate_tracking_scripts() {
    if (is_feed() || is_embed() || is_preview() || (function_exists('wp_is_json_request') && wp_is_json_request())) {
        return;
    }

    $ga4 = '';
    if (defined('DROPSOFT_GA4_ID') && is_string(DROPSOFT_GA4_ID) && DROPSOFT_GA4_ID !== '') {
        $ga4 = trim(DROPSOFT_GA4_ID);
    } else {
        $ga4 = trim((string) get_theme_mod('dropsoft_ga4_id', ''));
    }

    $plausible = '';
    if (defined('DROPSOFT_PLAUSIBLE_DOMAIN') && is_string(DROPSOFT_PLAUSIBLE_DOMAIN) && DROPSOFT_PLAUSIBLE_DOMAIN !== '') {
        $plausible = strtolower(trim(DROPSOFT_PLAUSIBLE_DOMAIN));
    } else {
        $plausible = strtolower(trim((string) get_theme_mod('dropsoft_plausible_domain', '')));
    }
    $plausible = preg_replace('#^https?://#', '', $plausible);
    $plausible = preg_replace('#/.*$#', '', $plausible);

    if ($plausible !== '' && preg_match('/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i', $plausible)) {
        $script_src = 'https://plausible.io/js/script.js';
        if (defined('DROPSOFT_PLAUSIBLE_SCRIPT_URL') && is_string(DROPSOFT_PLAUSIBLE_SCRIPT_URL) && DROPSOFT_PLAUSIBLE_SCRIPT_URL !== '') {
            $script_src = dropsoft_corporate_normalize_plausible_script_url(DROPSOFT_PLAUSIBLE_SCRIPT_URL);
        } else {
            $custom = trim((string) get_theme_mod('dropsoft_plausible_script_url', ''));
            if ($custom !== '') {
                $script_src = dropsoft_corporate_normalize_plausible_script_url($custom);
            }
        }
        if ($script_src === '') {
            $script_src = 'https://plausible.io/js/script.js';
        }
        printf(
            "<script defer data-domain=\"%s\" src=\"%s\"></script>\n",
            esc_attr($plausible),
            esc_url($script_src)
        );
        return;
    }

    if ($ga4 !== '' && preg_match('/^G-[A-Z0-9]+$/i', $ga4)) {
        $ga4_esc = esc_attr($ga4);
        $ga4_js  = esc_js($ga4);
        echo '<script async src="https://www.googletagmanager.com/gtag/js?id=' . $ga4_esc . '"></script>' . "\n";
        echo "<script>\nwindow.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', '" . $ga4_js . "');\n</script>\n";
    }
}
add_action('wp_head', 'dropsoft_corporate_tracking_scripts', 99);

/**
 * @param string $value Raw domain.
 * @return string
 */
function dropsoft_corporate_sanitize_plausible_domain($value) {
    $value = strtolower(trim((string) $value));
    $value = preg_replace('#^https?://#', '', $value);
    $value = preg_replace('#/.*$#', '', $value);
    if ($value !== '' && !preg_match('/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i', $value)) {
        return '';
    }
    return $value;
}

/**
 * @param string $value Raw GA4 ID.
 * @return string
 */
function dropsoft_corporate_sanitize_ga4_id($value) {
    $value = strtoupper(trim((string) $value));
    if ($value !== '' && !preg_match('/^G-[A-Z0-9]+$/', $value)) {
        return '';
    }
    return $value;
}

/**
 * Normalize Plausible script URL (https only, plausible.io or self-hosted).
 *
 * @param string $url Raw URL.
 * @return string Empty if invalid.
 */
function dropsoft_corporate_normalize_plausible_script_url($url) {
    $url = esc_url_raw(trim((string) $url));
    if ($url === '' || stripos($url, 'https://') !== 0) {
        return '';
    }
    return $url;
}

/**
 * Optional hex color for Customizer (empty = use theme default).
 *
 * @param string $value Raw.
 * @return string #RRGGBB or ''.
 */
function dropsoft_corporate_sanitize_hex_color_optional($value) {
    $c = sanitize_hex_color(trim((string) $value));
    return $c ? $c : '';
}

/**
 * @param string $hex #RGB or #RRGGBB.
 * @return int[]|null [r,g,b]
 */
function dropsoft_corporate_hex_to_rgb($hex) {
    $hex = ltrim((string) $hex, '#');
    if (strlen($hex) === 3) {
        $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
    }
    if (strlen($hex) !== 6 || !ctype_xdigit($hex)) {
        return null;
    }
    return array(hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2)));
}

/**
 * Blend hex toward white (for slightly lighter panels).
 *
 * @param string $hex #RRGGBB.
 * @param float  $t   0–1 toward white.
 * @return string
 */
function dropsoft_corporate_blend_toward_white($hex, $t) {
    $rgb = dropsoft_corporate_hex_to_rgb($hex);
    if ($rgb === null) {
        return $hex;
    }
    $t = max(0.0, min(1.0, (float) $t));
    $r = (int) round($rgb[0] + (255 - $rgb[0]) * $t);
    $g = (int) round($rgb[1] + (255 - $rgb[1]) * $t);
    $b = (int) round($rgb[2] + (255 - $rgb[2]) * $t);
    return sprintf('#%02x%02x%02x', $r, $g, $b);
}

/**
 * Darken by multiplying RGB channels (footer strip).
 *
 * @param string $hex #RRGGBB.
 * @param float  $f   0–1 multiplier.
 * @return string
 */
function dropsoft_corporate_multiply_rgb($hex, $f) {
    $rgb = dropsoft_corporate_hex_to_rgb($hex);
    if ($rgb === null) {
        return $hex;
    }
    $f = max(0.0, min(1.0, (float) $f));
    $r = (int) round($rgb[0] * $f);
    $g = (int) round($rgb[1] * $f);
    $b = (int) round($rgb[2] * $f);
    return sprintf('#%02x%02x%02x', $r, $g, $b);
}

/**
 * Alt text for slideshow / attachment images.
 *
 * @param int $attachment_id Attachment ID.
 * @return string Safe for HTML attribute (already escaped in template with esc_attr).
 */
function dropsoft_corporate_attachment_image_alt($attachment_id) {
    $attachment_id = absint($attachment_id);
    if (!$attachment_id) {
        return '';
    }
    $alt = get_post_meta($attachment_id, '_wp_attachment_image_alt', true);
    if (is_string($alt) && $alt !== '') {
        return $alt;
    }
    $caption = wp_get_attachment_caption($attachment_id);
    if (is_string($caption) && $caption !== '') {
        return wp_strip_all_tags($caption);
    }
    return __('Dropsoft software screenshot', 'dropsoft-corporate');
}

/**
 * Images for the homepage systems slideshow (Customizer).
 *
 * @return array<int, array<string, int|string>>
 */
function dropsoft_corporate_get_slideshow_slides() {
    $slides = array();
    for ($i = 1; $i <= 6; $i++) {
        $id = absint(get_theme_mod('dropsoft_slide_' . $i, 0));
        if (!$id || !wp_attachment_is_image($id)) {
            continue;
        }
        $src = wp_get_attachment_image_src($id, 'large');
        if (!$src) {
            $src = wp_get_attachment_image_src($id, 'full');
        }
        if (!$src) {
            continue;
        }
        $caption = wp_get_attachment_caption($id);
        $slides[] = array(
            'id'      => $id,
            'url'     => $src[0],
            'width'   => (int) $src[1],
            'height'  => (int) $src[2],
            'alt'     => dropsoft_corporate_attachment_image_alt($id),
            'caption' => $caption ? wp_strip_all_tags($caption) : '',
        );
    }
    return $slides;
}

/**
 * @param mixed $value Raw seconds.
 * @return int
 */
function dropsoft_corporate_sanitize_slideshow_interval($value) {
    $n = absint($value);
    if ($n < 3) {
        $n = 3;
    }
    if ($n > 15) {
        $n = 15;
    }
    return $n;
}

/**
 * Build :root overrides when a main background colour is set.
 *
 * @return string CSS or empty.
 */
function dropsoft_corporate_theme_color_css_string() {
    $deep = dropsoft_corporate_sanitize_hex_color_optional((string) get_theme_mod('dropsoft_theme_bg_color', ''));
    if ($deep === '') {
        return '';
    }

    $panel = dropsoft_corporate_sanitize_hex_color_optional((string) get_theme_mod('dropsoft_theme_bg_panel', ''));
    $elev  = dropsoft_corporate_sanitize_hex_color_optional((string) get_theme_mod('dropsoft_theme_bg_elevated', ''));

    if ($panel === '') {
        $panel = dropsoft_corporate_blend_toward_white($deep, 0.08);
    }
    if ($elev === '') {
        $elev = dropsoft_corporate_blend_toward_white($deep, 0.15);
    }

    $css  = ':root {';
    $css .= '--ds-bg-deep: ' . $deep . ';';
    $css .= '--ds-bg-panel: ' . $panel . ';';
    $css .= '--ds-bg-elevated: ' . $elev . ';';
    $css .= '}';
    $css .= '.ds-hero__bg { background-image: radial-gradient(ellipse 120% 80% at 50% -20%, rgba(6, 182, 212, 0.25) 0%, transparent 55%), radial-gradient(ellipse 80% 50% at 100% 50%, rgba(59, 130, 246, 0.12) 0%, transparent 50%), linear-gradient(180deg, var(--ds-bg-deep) 0%, var(--ds-bg-panel) 100%) !important; background-color: var(--ds-bg-deep) !important; }';

    return $css;
}

/**
 * Header & footer overrides from Customizer.
 *
 * @return string CSS or empty.
 */
function dropsoft_corporate_header_footer_css_string() {
    $css  = '';
    $deep = dropsoft_corporate_sanitize_hex_color_optional((string) get_theme_mod('dropsoft_theme_bg_color', ''));

    $footer_bg = dropsoft_corporate_sanitize_hex_color_optional((string) get_theme_mod('dropsoft_footer_bg_color', ''));
    if ($footer_bg !== '') {
        $css .= '.site-footer { background: ' . $footer_bg . ' !important; }';
    } elseif ($deep !== '') {
        $css .= '.site-footer { background: ' . dropsoft_corporate_multiply_rgb($deep, 0.45) . ' !important; }';
    }

    $header_bg = dropsoft_corporate_sanitize_hex_color_optional((string) get_theme_mod('dropsoft_header_bg_color', ''));
    if ($header_bg !== '') {
        $rgb = dropsoft_corporate_hex_to_rgb($header_bg);
        if ($rgb !== null) {
            $r   = $rgb[0];
            $g   = $rgb[1];
            $b   = $rgb[2];
            $top = sprintf('rgba(%d,%d,%d,0.96)', $r, $g, $b);
            $bot = sprintf('rgba(%d,%d,%d,0.82)', $r, $g, $b);
            $min = sprintf('rgba(%d,%d,%d,0.98)', $r, $g, $b);
            $mob = sprintf('rgba(%d,%d,%d,0.99)', $r, $g, $b);
            $css .= '.site-header { background: linear-gradient(180deg, ' . $top . ' 0%, ' . $bot . ' 100%) !important; }';
            $css .= '.site-header--minimal { background: ' . $min . ' !important; }';
            $css .= '@media (max-width: 900px) { .primary-nav { background: ' . $mob . ' !important; } }';
        }
    }

    $header_border = dropsoft_corporate_sanitize_hex_color_optional((string) get_theme_mod('dropsoft_header_border_color', ''));
    if ($header_border !== '') {
        $css .= '.site-header { border-bottom-color: ' . $header_border . ' !important; }';
        $css .= '.site-header--minimal { box-shadow: 0 1px 0 ' . $header_border . ' !important; }';
        $css .= '.site-header .nav-toggle { border-color: ' . $header_border . ' !important; }';
    }

    $nav = dropsoft_corporate_sanitize_hex_color_optional((string) get_theme_mod('dropsoft_header_nav_color', ''));
    if ($nav !== '') {
        $css .= '.primary-nav__list a { color: ' . $nav . ' !important; }';
    }

    $nav_hover = dropsoft_corporate_sanitize_hex_color_optional((string) get_theme_mod('dropsoft_header_nav_hover_color', ''));
    if ($nav_hover !== '') {
        $css .= '.primary-nav__list a:hover, .primary-nav__list a:focus-visible { color: ' . $nav_hover . ' !important; }';
    }

    $title_color = dropsoft_corporate_sanitize_hex_color_optional((string) get_theme_mod('dropsoft_header_site_title_color', ''));
    if ($title_color !== '') {
        $css .= '.site-title-link, .site-title-link .site-title-text { color: ' . $title_color . ' !important; }';
    }

    $footer_border = dropsoft_corporate_sanitize_hex_color_optional((string) get_theme_mod('dropsoft_footer_border_color', ''));
    if ($footer_border !== '') {
        $css .= '.site-footer { border-top-color: ' . $footer_border . ' !important; }';
        $css .= '.site-footer__copy { border-top-color: ' . $footer_border . ' !important; }';
    }

    $footer_title = dropsoft_corporate_sanitize_hex_color_optional((string) get_theme_mod('dropsoft_footer_title_color', ''));
    if ($footer_title !== '') {
        $css .= '.site-footer__name { color: ' . $footer_title . ' !important; }';
    }

    $footer_text = dropsoft_corporate_sanitize_hex_color_optional((string) get_theme_mod('dropsoft_footer_text_color', ''));
    if ($footer_text !== '') {
        $css .= '.site-footer__tag, .site-footer__copy, .site-footer .footer-nav__list a { color: ' . $footer_text . ' !important; }';
    }

    return $css;
}

/**
 * Output Customizer background colours after main stylesheet.
 */
function dropsoft_corporate_enqueue_theme_colors() {
    $css = trim(dropsoft_corporate_theme_color_css_string() . ' ' . dropsoft_corporate_header_footer_css_string());
    if ($css !== '') {
        wp_add_inline_style('dropsoft-corporate', $css);
    }
}
add_action('wp_enqueue_scripts', 'dropsoft_corporate_enqueue_theme_colors', 12);

/**
 * Customizer — hero copy & sales email.
 *
 * @param WP_Customize_Manager $wp_customize Instance.
 */
function dropsoft_corporate_customize_register($wp_customize) {
    $wp_customize->add_section(
        'dropsoft_slideshow',
        array(
            'title'       => __('Dropsoft — Systems slideshow', 'dropsoft-corporate'),
            'description' => __('Upload up to six images (screenshots of HR, ERP, attendance, etc.). They appear in a carousel on the homepage after the flagship product section.', 'dropsoft-corporate'),
            'priority'    => 33,
        )
    );

    $wp_customize->add_setting(
        'dropsoft_slideshow_heading',
        array(
            'default'           => __('Inside the systems', 'dropsoft-corporate'),
            'sanitize_callback' => 'sanitize_text_field',
        )
    );
    $wp_customize->add_control(
        'dropsoft_slideshow_heading',
        array(
            'label'   => __('Slideshow heading', 'dropsoft-corporate'),
            'section' => 'dropsoft_slideshow',
            'type'    => 'text',
        )
    );

    $wp_customize->add_setting(
        'dropsoft_slideshow_interval',
        array(
            'default'           => 6,
            'sanitize_callback' => 'dropsoft_corporate_sanitize_slideshow_interval',
        )
    );
    $wp_customize->add_control(
        'dropsoft_slideshow_interval',
        array(
            'label'       => __('Seconds between slides', 'dropsoft-corporate'),
            'description' => __('From 3 to 15 seconds. Applies when more than one image is set.', 'dropsoft-corporate'),
            'section'     => 'dropsoft_slideshow',
            'type'        => 'number',
            'input_attrs' => array(
                'min'  => 3,
                'max'  => 15,
                'step' => 1,
            ),
        )
    );

    for ($s = 1; $s <= 6; $s++) {
        $wp_customize->add_setting(
            'dropsoft_slide_' . $s,
            array(
                'default'           => 0,
                'sanitize_callback' => 'absint',
            )
        );
        $wp_customize->add_control(
            new WP_Customize_Media_Control(
                $wp_customize,
                'dropsoft_slide_' . $s,
                array(
                    /* translators: %d slide number 1–6 */
                    'label'     => sprintf(__('Slide image %d', 'dropsoft-corporate'), $s),
                    'section'   => 'dropsoft_slideshow',
                    'mime_type' => 'image',
                )
            )
        );
    }

    $wp_customize->add_section(
        'dropsoft_contact_page',
        array(
            'title'       => __('Dropsoft — Contact page', 'dropsoft-corporate'),
            'description' => __('These details appear on the Contact page. Form messages are sent to the delivery address below (defaults to the main contact email).', 'dropsoft-corporate'),
            'priority'    => 34,
        )
    );

    $wp_customize->add_setting(
        'dropsoft_contact_email',
        array(
            'default'           => 'info@dropsoft.co.ke',
            'sanitize_callback' => 'dropsoft_corporate_sanitize_contact_email_setting',
        )
    );
    $wp_customize->add_control(
        'dropsoft_contact_email',
        array(
            'label'       => __('Main contact email', 'dropsoft-corporate'),
            'description' => __('Shown on the Contact page and used for the form if no separate delivery address is set.', 'dropsoft-corporate'),
            'section'     => 'dropsoft_contact_page',
            'type'        => 'email',
        )
    );

    $wp_customize->add_setting(
        'dropsoft_contact_phone',
        array(
            'default'           => '',
            'sanitize_callback' => 'sanitize_text_field',
        )
    );
    $wp_customize->add_control(
        'dropsoft_contact_phone',
        array(
            'label'       => __('Phone', 'dropsoft-corporate'),
            'description' => __('e.g. +254 700 000000 — optional.', 'dropsoft-corporate'),
            'section'     => 'dropsoft_contact_page',
            'type'        => 'text',
        )
    );

    $wp_customize->add_setting(
        'dropsoft_contact_address',
        array(
            'default'           => '',
            'sanitize_callback' => 'sanitize_textarea_field',
        )
    );
    $wp_customize->add_control(
        'dropsoft_contact_address',
        array(
            'label'       => __('Address / office hours (optional)', 'dropsoft-corporate'),
            'description' => __('Shown under the phone line. Plain text; line breaks are kept.', 'dropsoft-corporate'),
            'section'     => 'dropsoft_contact_page',
            'type'        => 'textarea',
        )
    );

    $wp_customize->add_setting(
        'dropsoft_contact_form_recipient',
        array(
            'default'           => '',
            'sanitize_callback' => 'dropsoft_corporate_sanitize_contact_email_setting',
        )
    );
    $wp_customize->add_control(
        'dropsoft_contact_form_recipient',
        array(
            'label'       => __('Form delivery email (optional)', 'dropsoft-corporate'),
            'description' => __('Inquiries from the contact form go here. Leave blank to use the main contact email above.', 'dropsoft-corporate'),
            'section'     => 'dropsoft_contact_page',
            'type'        => 'email',
        )
    );

    $wp_customize->add_setting(
        'dropsoft_sales_email',
        array(
            'default'           => '',
            'sanitize_callback' => 'sanitize_email',
        )
    );
    $wp_customize->add_control(
        'dropsoft_sales_email',
        array(
            'label'       => __('Second email (optional)', 'dropsoft-corporate'),
            'description' => __('Shown as an extra line on the Contact page if different from the main contact email. Leave blank to hide.', 'dropsoft-corporate'),
            'section'     => 'dropsoft_contact_page',
            'type'        => 'email',
        )
    );

    $wp_customize->add_section(
        'dropsoft_corporate',
        array(
            'title'    => __('Dropsoft — Homepage', 'dropsoft-corporate'),
            'priority' => 35,
        )
    );

    $wp_customize->add_setting(
        'dropsoft_hero_kicker',
        array(
            'default'           => __('Business solutions built for East Africa & beyond', 'dropsoft-corporate'),
            'sanitize_callback' => 'sanitize_text_field',
        )
    );
    $wp_customize->add_control(
        'dropsoft_hero_kicker',
        array(
            'label'   => __('Hero kicker', 'dropsoft-corporate'),
            'section' => 'dropsoft_corporate',
            'type'    => 'text',
        )
    );

    $wp_customize->add_setting(
        'dropsoft_hero_headline',
        array(
            'default'           => __('Dropsoft Technologies Ltd — leaders in business automation.', 'dropsoft-corporate'),
            'sanitize_callback' => 'sanitize_text_field',
        )
    );
    $wp_customize->add_control(
        'dropsoft_hero_headline',
        array(
            'label'   => __('Hero headline', 'dropsoft-corporate'),
            'section' => 'dropsoft_corporate',
            'type'    => 'text',
        )
    );

    $wp_customize->add_setting(
        'dropsoft_hero_lead',
        array(
            'default'           => __('From compliant HR & payroll to resilient ERP — we deliver software you can run with confidence, online or offline.', 'dropsoft-corporate'),
            'sanitize_callback' => 'sanitize_textarea_field',
        )
    );
    $wp_customize->add_control(
        'dropsoft_hero_lead',
        array(
            'label'   => __('Hero lead paragraph', 'dropsoft-corporate'),
            'section' => 'dropsoft_corporate',
            'type'    => 'textarea',
        )
    );

    $wp_customize->add_section(
        'dropsoft_colors',
        array(
            'title'       => __('Dropsoft — Colors', 'dropsoft-corporate'),
            'description' => __('Page backgrounds, header bar, and footer strip. Leave any colour empty to use the theme default for that element.', 'dropsoft-corporate'),
            'priority'    => 38,
        )
    );

    $wp_customize->add_setting(
        'dropsoft_theme_bg_color',
        array(
            'default'           => '',
            'sanitize_callback' => 'dropsoft_corporate_sanitize_hex_color_optional',
        )
    );
    $wp_customize->add_control(
        new WP_Customize_Color_Control(
            $wp_customize,
            'dropsoft_theme_bg_color',
            array(
                'label'       => __('Main background', 'dropsoft-corporate'),
                'description' => __('Applies site-wide (--ds-bg-deep). Clear to restore the theme default navy.', 'dropsoft-corporate'),
                'section'     => 'dropsoft_colors',
            )
        )
    );

    $wp_customize->add_setting(
        'dropsoft_theme_bg_panel',
        array(
            'default'           => '',
            'sanitize_callback' => 'dropsoft_corporate_sanitize_hex_color_optional',
        )
    );
    $wp_customize->add_control(
        new WP_Customize_Color_Control(
            $wp_customize,
            'dropsoft_theme_bg_panel',
            array(
                'label'       => __('Panel / section background', 'dropsoft-corporate'),
                'description' => __('Optional. Leave empty to auto-tint from main background.', 'dropsoft-corporate'),
                'section'     => 'dropsoft_colors',
            )
        )
    );

    $wp_customize->add_setting(
        'dropsoft_theme_bg_elevated',
        array(
            'default'           => '',
            'sanitize_callback' => 'dropsoft_corporate_sanitize_hex_color_optional',
        )
    );
    $wp_customize->add_control(
        new WP_Customize_Color_Control(
            $wp_customize,
            'dropsoft_theme_bg_elevated',
            array(
                'label'       => __('Cards & elevated surfaces', 'dropsoft-corporate'),
                'description' => __('Optional. Leave empty to auto-tint from main background.', 'dropsoft-corporate'),
                'section'     => 'dropsoft_colors',
            )
        )
    );

    $wp_customize->add_setting(
        'dropsoft_header_bg_color',
        array(
            'default'           => '',
            'sanitize_callback' => 'dropsoft_corporate_sanitize_hex_color_optional',
        )
    );
    $wp_customize->add_control(
        new WP_Customize_Color_Control(
            $wp_customize,
            'dropsoft_header_bg_color',
            array(
                'label'       => __('Header background', 'dropsoft-corporate'),
                'description' => __('Top navigation bar (subtle gradient from this colour). Clear for default.', 'dropsoft-corporate'),
                'section'     => 'dropsoft_colors',
            )
        )
    );

    $wp_customize->add_setting(
        'dropsoft_header_border_color',
        array(
            'default'           => '',
            'sanitize_callback' => 'dropsoft_corporate_sanitize_hex_color_optional',
        )
    );
    $wp_customize->add_control(
        new WP_Customize_Color_Control(
            $wp_customize,
            'dropsoft_header_border_color',
            array(
                'label'       => __('Header bottom border', 'dropsoft-corporate'),
                'description' => __('Line under the header and mobile menu toggle border.', 'dropsoft-corporate'),
                'section'     => 'dropsoft_colors',
            )
        )
    );

    $wp_customize->add_setting(
        'dropsoft_header_nav_color',
        array(
            'default'           => '',
            'sanitize_callback' => 'dropsoft_corporate_sanitize_hex_color_optional',
        )
    );
    $wp_customize->add_control(
        new WP_Customize_Color_Control(
            $wp_customize,
            'dropsoft_header_nav_color',
            array(
                'label'       => __('Header menu link colour', 'dropsoft-corporate'),
                'section'     => 'dropsoft_colors',
            )
        )
    );

    $wp_customize->add_setting(
        'dropsoft_header_nav_hover_color',
        array(
            'default'           => '',
            'sanitize_callback' => 'dropsoft_corporate_sanitize_hex_color_optional',
        )
    );
    $wp_customize->add_control(
        new WP_Customize_Color_Control(
            $wp_customize,
            'dropsoft_header_nav_hover_color',
            array(
                'label'       => __('Header menu link hover', 'dropsoft-corporate'),
                'section'     => 'dropsoft_colors',
            )
        )
    );

    $wp_customize->add_setting(
        'dropsoft_header_site_title_color',
        array(
            'default'           => '',
            'sanitize_callback' => 'dropsoft_corporate_sanitize_hex_color_optional',
        )
    );
    $wp_customize->add_control(
        new WP_Customize_Color_Control(
            $wp_customize,
            'dropsoft_header_site_title_color',
            array(
                'label'       => __('Site title text (no logo)', 'dropsoft-corporate'),
                'description' => __('When you use text instead of a custom logo.', 'dropsoft-corporate'),
                'section'     => 'dropsoft_colors',
            )
        )
    );

    $wp_customize->add_setting(
        'dropsoft_footer_bg_color',
        array(
            'default'           => '',
            'sanitize_callback' => 'dropsoft_corporate_sanitize_hex_color_optional',
        )
    );
    $wp_customize->add_control(
        new WP_Customize_Color_Control(
            $wp_customize,
            'dropsoft_footer_bg_color',
            array(
                'label'       => __('Footer background', 'dropsoft-corporate'),
                'description' => __('If empty but main background is set, a darker tint of the main colour is used.', 'dropsoft-corporate'),
                'section'     => 'dropsoft_colors',
            )
        )
    );

    $wp_customize->add_setting(
        'dropsoft_footer_border_color',
        array(
            'default'           => '',
            'sanitize_callback' => 'dropsoft_corporate_sanitize_hex_color_optional',
        )
    );
    $wp_customize->add_control(
        new WP_Customize_Color_Control(
            $wp_customize,
            'dropsoft_footer_border_color',
            array(
                'label'       => __('Footer top / divider lines', 'dropsoft-corporate'),
                'section'     => 'dropsoft_colors',
            )
        )
    );

    $wp_customize->add_setting(
        'dropsoft_footer_title_color',
        array(
            'default'           => '',
            'sanitize_callback' => 'dropsoft_corporate_sanitize_hex_color_optional',
        )
    );
    $wp_customize->add_control(
        new WP_Customize_Color_Control(
            $wp_customize,
            'dropsoft_footer_title_color',
            array(
                'label'       => __('Footer site name', 'dropsoft-corporate'),
                'section'     => 'dropsoft_colors',
            )
        )
    );

    $wp_customize->add_setting(
        'dropsoft_footer_text_color',
        array(
            'default'           => '',
            'sanitize_callback' => 'dropsoft_corporate_sanitize_hex_color_optional',
        )
    );
    $wp_customize->add_control(
        new WP_Customize_Color_Control(
            $wp_customize,
            'dropsoft_footer_text_color',
            array(
                'label'       => __('Footer secondary text & links', 'dropsoft-corporate'),
                'description' => __('Tagline, copyright line, and footer menu links.', 'dropsoft-corporate'),
                'section'     => 'dropsoft_colors',
            )
        )
    );

    $wp_customize->add_section(
        'dropsoft_analytics',
        array(
            'title'       => __('Dropsoft — Analytics', 'dropsoft-corporate'),
            'description' => __('Add one tracker. Plausible wins if both are filled. Use optional script URL for self-hosted Plausible. Constants: DROPSOFT_PLAUSIBLE_DOMAIN, DROPSOFT_PLAUSIBLE_SCRIPT_URL, DROPSOFT_GA4_ID.', 'dropsoft-corporate'),
            'priority'    => 45,
        )
    );

    $wp_customize->add_setting(
        'dropsoft_plausible_domain',
        array(
            'default'           => '',
            'sanitize_callback' => 'dropsoft_corporate_sanitize_plausible_domain',
        )
    );
    $wp_customize->add_control(
        'dropsoft_plausible_domain',
        array(
            'label'       => __('Plausible.io domain', 'dropsoft-corporate'),
            'description' => __('Example: yoursite.co.ke (no https://). Required for the data-domain attribute.', 'dropsoft-corporate'),
            'section'     => 'dropsoft_analytics',
            'type'        => 'text',
        )
    );

    $wp_customize->add_setting(
        'dropsoft_plausible_script_url',
        array(
            'default'           => '',
            'sanitize_callback' => 'dropsoft_corporate_normalize_plausible_script_url',
        )
    );
    $wp_customize->add_control(
        'dropsoft_plausible_script_url',
        array(
            'label'       => __('Plausible script URL (optional)', 'dropsoft-corporate'),
            'description' => __('Leave empty to use https://plausible.io/js/script.js. For self-hosted, paste your full script URL (must be https).', 'dropsoft-corporate'),
            'section'     => 'dropsoft_analytics',
            'type'        => 'url',
        )
    );

    $wp_customize->add_setting(
        'dropsoft_ga4_id',
        array(
            'default'           => '',
            'sanitize_callback' => 'dropsoft_corporate_sanitize_ga4_id',
        )
    );
    $wp_customize->add_control(
        'dropsoft_ga4_id',
        array(
            'label'       => __('Google Analytics 4 Measurement ID', 'dropsoft-corporate'),
            'description' => __('Format: G-XXXXXXXXXX. Ignored if Plausible domain is set.', 'dropsoft-corporate'),
            'section'     => 'dropsoft_analytics',
            'type'        => 'text',
        )
    );
}
add_action('customize_register', 'dropsoft_corporate_customize_register');

/**
 * Primary menu fallback anchors.
 */
function dropsoft_corporate_fallback_menu() {
    $solutions = function_exists('dropsoft_corporate_page_url') ? dropsoft_corporate_page_url('solutions') : home_url('/solutions/');
    $pricing   = function_exists('dropsoft_corporate_page_url') ? dropsoft_corporate_page_url('pricing') : home_url('/pricing/');
    $about     = function_exists('dropsoft_corporate_page_url') ? dropsoft_corporate_page_url('about') : home_url('/about/');
    $contact   = function_exists('dropsoft_corporate_page_url') ? dropsoft_corporate_page_url('contact') : home_url('/contact/');
    $home      = home_url('/');

    echo '<ul class="primary-nav__list">';
    echo '<li><a href="' . esc_url($home) . '">' . esc_html__('Home', 'dropsoft-corporate') . '</a></li>';
    echo '<li><a href="' . esc_url($solutions) . '">' . esc_html__('Solutions', 'dropsoft-corporate') . '</a></li>';
    echo '<li><a href="' . esc_url($pricing) . '">' . esc_html__('Pricing', 'dropsoft-corporate') . '</a></li>';
    echo '<li><a href="' . esc_url($about) . '">' . esc_html__('About', 'dropsoft-corporate') . '</a></li>';
    echo '<li><a href="' . esc_url($contact) . '">' . esc_html__('Contact', 'dropsoft-corporate') . '</a></li>';
    echo '</ul>';
}
