<?php
/**
 * Dropsoft HR licence catalog — mirrors server/utils/licensePackages.js (subscription engine).
 *
 * @package Dropsoft_Corporate
 */

defined('ABSPATH') || exit;

/**
 * Yearly billing applies a 15% discount on the subscription line (12 × monthly × 0.85).
 *
 * @param int $monthly_kes Base monthly package price in KES.
 * @return int
 */
function dropsoft_corporate_pricing_yearly_total_kes($monthly_kes) {
    return (int) round((int) $monthly_kes * 12 * 0.85);
}

/**
 * @param int $amount Amount in KES.
 * @return string
 */
function dropsoft_corporate_format_kes_amount($amount) {
    return 'KES ' . number_format((int) $amount);
}

/**
 * Payment reference (same legal entity & channels as the app).
 *
 * @return array<string, string>
 */
function dropsoft_corporate_get_payment_details() {
    return array(
        'legal_name'   => 'Dropsoft Technologies Ltd',
        'kcb_account'  => '1339824868',
        'mpesa_paybill' => '522522',
        'mpesa_account' => '1339824868',
        'currency'     => 'KES',
    );
}

/**
 * Billable add-on modules (optional extras beyond a plan’s included set).
 *
 * @return array<int, array<string, string|int>>
 */
function dropsoft_corporate_get_billable_features() {
    return array(
        array(
            'id'          => 'face_terminal',
            'label'       => __('Face attendance & terminal', 'dropsoft-corporate'),
            'description' => __('Face enrollment and kiosk clocking.', 'dropsoft-corporate'),
            'monthly_kes' => 1700,
        ),
        array(
            'id'          => 'salary_advance_shopping',
            'label'       => __('Salary advance & shopping', 'dropsoft-corporate'),
            'description' => __('Staff advance and shopping deduction workflows.', 'dropsoft-corporate'),
            'monthly_kes' => 1350,
        ),
        array(
            'id'          => 'statutory_compliance',
            'label'       => __('Statutory & compliance', 'dropsoft-corporate'),
            'description' => __('Statutory reports and compliance exports.', 'dropsoft-corporate'),
            'monthly_kes' => 1150,
        ),
        array(
            'id'          => 'company_analysis',
            'label'       => __('Company analysis', 'dropsoft-corporate'),
            'description' => __('Advanced workforce and cost analytics.', 'dropsoft-corporate'),
            'monthly_kes' => 2000,
        ),
        array(
            'id'          => 'multi_company',
            'label'       => __('Multi-company', 'dropsoft-corporate'),
            'description' => __('Manage more than one company in one deployment.', 'dropsoft-corporate'),
            'monthly_kes' => 2800,
        ),
        array(
            'id'          => 'audit_backup',
            'label'       => __('Audit log & backup', 'dropsoft-corporate'),
            'description' => __('Full audit trail and encrypted backup tools.', 'dropsoft-corporate'),
            'monthly_kes' => 900,
        ),
        array(
            'id'          => 'mobile_app',
            'label'       => __('Mobile app access', 'dropsoft-corporate'),
            'description' => __('Android app for attendance, leave, and payslips.', 'dropsoft-corporate'),
            'monthly_kes' => 1000,
        ),
    );
}

/**
 * Core Dropsoft HR capabilities included with every subscription tier.
 *
 * @return string[]
 */
function dropsoft_corporate_get_core_hr_features() {
    return array(
        __('Employee records & organisational setup', 'dropsoft-corporate'),
        __('Attendance management (clock in/out workflow)', 'dropsoft-corporate'),
        __('Leave management & holiday calendars', 'dropsoft-corporate'),
        __('Payroll processing & payslips', 'dropsoft-corporate'),
        __('Management reports & exports', 'dropsoft-corporate'),
        __('Role-based access control for HR, finance & managers', 'dropsoft-corporate'),
    );
}

/**
 * Licence packages (Dropsoft HR) — amounts align with the live subscription catalog.
 *
 * @return array<string, array<string, mixed>>
 */
function dropsoft_corporate_get_license_packages() {
    $feat = wp_list_pluck(dropsoft_corporate_get_billable_features(), 'id');

    return array(
        'starter' => array(
            'name'                     => __('Starter', 'dropsoft-corporate'),
            'tagline'                  => __('Small teams getting started with HR and payroll.', 'dropsoft-corporate'),
            'monthly_kes'              => 3200,
            'employee_cap'             => 25,
            'admin_users'              => 2,
            'onboarding_kes'           => 54000,
            'overage_per_employee_kes' => 68,
            'included_feature_ids'     => array(),
        ),
        'growth' => array(
            'name'                     => __('Growth', 'dropsoft-corporate'),
            'tagline'                  => __('Growing SMEs with attendance and advance workflows.', 'dropsoft-corporate'),
            'monthly_kes'              => 4550,
            'employee_cap'             => 100,
            'admin_users'              => 6,
            'onboarding_kes'           => 82000,
            'overage_per_employee_kes' => 68,
            'included_feature_ids'     => array('face_terminal', 'salary_advance_shopping', 'mobile_app'),
        ),
        'business' => array(
            'name'                     => __('Business', 'dropsoft-corporate'),
            'tagline'                  => __('Mid-size operations with analytics and compliance.', 'dropsoft-corporate'),
            'monthly_kes'              => 8600,
            'employee_cap'             => 300,
            'admin_users'              => 15,
            'onboarding_kes'           => 138000,
            'overage_per_employee_kes' => 68,
            'included_feature_ids'     => array('face_terminal', 'salary_advance_shopping', 'statutory_compliance', 'company_analysis', 'mobile_app', 'audit_backup'),
        ),
        'enterprise' => array(
            'name'                     => __('Enterprise', 'dropsoft-corporate'),
            'tagline'                  => __('Large or multi-company deployments with custom scope.', 'dropsoft-corporate'),
            'monthly_kes'              => 11000,
            'employee_cap'             => null,
            'admin_users'              => 30,
            'onboarding_kes'           => 185000,
            'overage_per_employee_kes' => 55,
            'included_feature_ids'     => $feat,
        ),
    );
}

/**
 * Whether a plan includes a billable feature ID.
 *
 * @param array<string, mixed> $package Package row from dropsoft_corporate_get_license_packages().
 * @param string               $feature_id Feature id.
 * @return bool
 */
function dropsoft_corporate_plan_includes_feature(array $package, $feature_id) {
    $ids = isset($package['included_feature_ids']) && is_array($package['included_feature_ids'])
        ? $package['included_feature_ids']
        : array();
    return in_array($feature_id, $ids, true);
}
