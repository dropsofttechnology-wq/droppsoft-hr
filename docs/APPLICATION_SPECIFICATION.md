# HR & Payroll Management System - Complete Application Specification

## Table of Contents
1. [System Overview](#system-overview)
2. [Core Features](#core-features)
3. [Attendance Management System](#attendance-management-system)
4. [Face Recognition & Biometric System](#face-recognition--biometric-system)
5. [Payroll Calculation Engine](#payroll-calculation-engine)
6. [Reports & Exports](#reports--exports)
7. [Employee Management](#employee-management)
8. [Company & Multi-Tenant Management](#company--multi-tenant-management)
9. [User Interface & User Experience](#user-interface--user-experience)
10. [Technical Architecture](#technical-architecture)

---

## System Overview

This is a comprehensive Human Resources and Payroll Management System designed for Kenyan businesses. The system provides:

- **Multi-Company Support**: Manage multiple companies/organizations within a single installation
- **Real-Time Attendance Tracking**: Face recognition, QR code, and manual clock-in/out
- **Automated Payroll Processing**: Complete payroll calculations with statutory compliance
- **Statutory Compliance**: Automated generation of KRA, NSSF, SHIF, and AHL reports
- **Employee Self-Service**: Employees can view payslips, attendance records, and enroll biometric data
- **Admin Dashboard**: Comprehensive management interface for HR operations

---

## Core Features

### 1. Multi-Tenant Architecture
- **Company Isolation**: Each company has isolated data, settings, and employees
- **Company-Specific Settings**: Payroll rates, statutory deductions, and policies per company
- **Cross-Company Reporting**: Generate reports for individual companies or all companies
- **Company Management**: Create, edit, activate/deactivate companies

### 2. User Roles & Permissions
- **Administrator**: Full system access, all reports, employee management
- **HR Manager**: Employee management, attendance oversight, payroll processing
- **Payroll Officer**: Payroll processing, report generation, payslip management
- **Employee**: Self-service portal (view payslips, attendance, enroll face)

### 3. Authentication Methods
- **Face Recognition**: Real-time 1:N matching for instant clock-in/out
- **QR Code**: Employee-specific QR codes for quick authentication
- **Manual Entry**: Staff ID/PIN entry for fallback authentication
- **Hybrid Mode**: Combine multiple authentication methods

### 4. Data Security & Compliance
- **Encrypted Storage**: Sensitive data encrypted at rest
- **Audit Logging**: Complete transaction history (36-month retention)
- **Data Privacy**: Biometric data stored as mathematical templates (not images)
- **Access Control**: Role-based permissions and company-level isolation

---

## Attendance Management System

### 1. Clock-In/Out Methods

#### Face Recognition Terminal
- **Real-Time Detection**: Continuous face detection using webcam
- **1:N Matching**: Compare detected face against all enrolled employees
- **Confidence Threshold**: Configurable matching threshold (default 90%)
- **Automatic Status Detection**: Determines clock-in vs clock-out based on last status
- **Performance**: Sub-second authentication, instant feedback

#### QR Code Authentication
- **Employee QR Codes**: Unique QR token per employee
- **Instant Scanning**: Fast QR code detection and validation
- **Offline Support**: Queue attendance logs when offline, sync when online
- **Mobile Optimized**: Full-screen scanner for mobile devices

#### Manual Entry
- **Staff ID Entry**: Numeric keypad for staff ID/PIN entry
- **Employee Search**: Search by name or employee number
- **Reason Field**: Optional reason for manual entry

### 2. Attendance Features

#### Time Windows & Restrictions
- **Clock-In Window**: Configurable earliest/latest clock-in time
- **Clock-Out Window**: Configurable earliest/latest clock-out time
- **Minimum Time Gap**: Prevent duplicate clock-ins within specified period (default 1.5 seconds)
- **Working Hours**: Define standard working hours per company/department

#### Geolocation Tracking
- **Location Capture**: GPS coordinates captured on clock-in/out
- **Location Verification**: Optional geofencing for attendance validation
- **Address Resolution**: Reverse geocoding to human-readable addresses

#### Attendance Status
- **Present**: Employee clocked in and out
- **Absent**: No attendance record for the day
- **Late**: Clocked in after designated time
- **Early Departure**: Clocked out before designated time
- **Overtime**: Worked beyond standard hours

### 3. Timesheet Generation
- **Daily Breakdown**: Clock-in/out times per day
- **Hours Calculation**: Total hours worked per day/week/month
- **Overtime Calculation**: Automatic overtime hours (1.5x, 2x rates)
- **Holiday Tracking**: Identify and flag holidays
- **Absence Detection**: Calculate absent days and deductions

### 4. Bulk Operations
- **Bulk Clock-In**: Import attendance records from CSV/Excel
- **Overwrite Option**: Replace existing records or append
- **Date Range Selection**: Bulk operations for specific periods
- **Validation**: Data validation before bulk import

---

## Face Recognition & Biometric System

### 1. Face Enrollment System

#### Enrollment Interface
- **3-Step Process**: 
  1. Employee Selection & Information
  2. Face Capture with Quality Checks
  3. Completion & Confirmation
- **Real-Time Preview**: Live camera feed with face guide overlay
- **Quality Indicators**: Visual feedback for lighting, face size, angle
- **Auto-Capture Mode**: Automatically captures when quality thresholds are met
- **Manual Capture**: Option to manually capture face

#### Quality Validation
- **Brightness Check**: Optimal range 30-90% of frame brightness
- **Contrast Validation**: Ensures sufficient contrast for recognition
- **Sharpness Measurement**: Detects blurry images
- **Face Coverage**: Face must be 15-60% of frame
- **Face Angle**: Maximum 15° deviation from front-facing
- **Face Size**: Minimum face size for accurate recognition

#### Liveness Detection
- **Blink Detection**: Eye Aspect Ratio (EAR) analysis to detect blinks
- **Head Movement**: Detects head rotation and movement
- **Anti-Spoofing**: Prevents photo-of-photo attacks
- **Optional Feature**: Can be enabled/disabled per company

#### Face Data Storage
- **Template Format**: 128-element feature vector (Float32Array)
- **Not Raw Images**: Only mathematical descriptors stored (privacy-compliant)
- **Storage Location**: Linked to employee/user account
- **Metadata**: Registration timestamp, quality score, capture method

### 2. Face Recognition Terminal

#### Detection & Matching
- **Detection Model**: TinyFaceDetector (fast) or SSD MobileNetV1 (accurate)
- **Landmark Detection**: 68 facial landmarks for alignment
- **Descriptor Extraction**: 128-element feature vector per face
- **1:N Matching**: Compare against all enrolled employees simultaneously
- **Matching Algorithm**: Cosine similarity with configurable threshold

#### Performance Optimization
- **Lazy Loading**: Models loaded only when needed
- **Caching**: Face descriptors cached client-side
- **Auto-Reload**: Descriptors reloaded after new enrollments
- **Periodic Refresh**: Automatic refresh every 5 minutes
- **Fast Path**: Optimized clock-in/out endpoint (bypasses heavy calculations)

#### Error Handling
- **No Face Data**: Graceful handling when no employees enrolled
- **Invalid Descriptors**: Validation and filtering of corrupted data
- **Network Errors**: Offline queue support
- **Camera Errors**: Clear error messages and fallback options

### 3. Face Data Management

#### Admin Functions
- **Check Face Data**: Verify if employee has enrolled face
- **Delete Face Data**: Remove face descriptor for employee
- **Bulk Operations**: Enroll/delete multiple employees
- **Export/Import**: Backup and restore face data

#### Employee Self-Service
- **Self-Enrollment**: Employees can enroll their own face
- **Re-Enrollment**: Update face data if recognition fails
- **Status Indicator**: Visual indicator showing enrollment status

---

## Payroll Calculation Engine

### 1. Calculation Flow

```
Basic Salary (from employee profile)
    +
Allowances (Housing, Transport, etc.)
    +
Overtime Pay (1.5x, 2x rates)
    +
Holiday Pay (if applicable)
    -
Absence Deductions
    =
GROSS PAY
    -
SHIF Deduction (2.75% of Gross, min 300)
    -
NSSF Deduction (Tiered: 6% of first 7,000 + 6% of 7,001-36,000)
    -
AHL Deduction (1.5% of Gross)
    =
TAXABLE PAY
    -
PAYE (Progressive tax brackets - Personal Relief 2,400)
    -
Other Deductions (Loans, Advances, etc.)
    =
NET PAY
```

### 2. Gross Pay Calculation

#### Basic Salary
- **Source**: Employee profile (immutable during payroll run)
- **Update Method**: Only changed via employee profile update
- **Consistency**: Same basic salary used across all calculations

#### Allowances
- **Housing Allowance**: 
  - Fixed amount OR percentage of basic salary
  - Company-specific configuration
- **Transport Allowance**: Fixed amount per employee
- **Standard Allowance**: Company-wide fixed allowance
- **Custom Allowances**: Additional allowances per employee

#### Overtime Calculation
- **1.5x Rate**: First 2 hours of overtime per day
- **2x Rate**: Hours beyond 2 hours of overtime
- **Calculation Base**: 
  - Fixed amount per hour, OR
  - Percentage of gross salary (before overtime)
- **Daily Rate**: Gross salary ÷ 30 days
- **Hourly Rate**: Daily rate ÷ standard working hours

#### Holiday Pay
- **Daily Rate**: Gross Salary ÷ 30 days
- **Holiday Rate**: (Daily Rate ÷ Gross Salary) × 100%
- **Holiday Days**: Count of public holidays in period
- **Holiday Pay**: Daily Rate × Holiday Days

#### Absence Deduction
- **Daily Rate**: Gross Salary ÷ Working Days in Month
- **Absent Days**: Days with no attendance record
- **Deduction Amount**: Daily Rate × Absent Days
- **Subtracted from Gross**: Reduces gross pay before deductions

### 3. Statutory Deductions

#### SHIF (Social Health Insurance Fund)
- **Rate**: 2.75% of Gross Pay
- **Minimum**: KES 300.00 (if 2.75% < 300, use 300)
- **Employee Contribution**: 2.75% of Gross Pay
- **Employer Contribution**: 2.75% of Gross Pay (separate calculation)
- **Deducted Before Tax**: Yes (reduces taxable pay)

#### NSSF (National Social Security Fund)
- **Tiered Structure**:
  - **Tier I**: 6% of first KES 7,000 (Maximum KES 420.00)
  - **Tier II**: 6% of amount from KES 7,001 to KES 36,000
- **Employee Contribution**: Tier I + Tier II
- **Employer Contribution**: Matching amount (separate calculation)
- **Deducted Before Tax**: Yes (reduces taxable pay)
- **Note**: Tier II upper limit may change (2025/2026: KES 29,000)

#### AHL (Affordable Housing Levy)
- **Rate**: 1.5% of Gross Pay (uncapped)
- **Employee Contribution**: 1.5% of Gross Pay
- **Employer Contribution**: 1.5% of Gross Pay (separate calculation)
- **Deducted Before Tax**: Yes (reduces taxable pay)

### 4. PAYE (Pay As You Earn) Calculation

#### Taxable Pay
```
Taxable Pay = Gross Pay - SHIF - NSSF - AHL
```

#### Progressive Tax Brackets (2026)
- **0 - 24,000**: 10%
- **24,001 - 32,333**: 25%
- **32,334+**: 30%

#### Personal Relief
- **Amount**: KES 2,400.00 per month
- **Applied**: Deducted from calculated tax (not taxable pay)

#### PAYE Formula
```
Tax = (Taxable Pay × Tax Rate) - Personal Relief
```

#### Example Calculation
```
Taxable Pay: KES 50,000
Tax Calculation:
  - First 24,000: 24,000 × 10% = 2,400
  - Next 8,333: 8,333 × 25% = 2,083.25
  - Remaining 17,667: 17,667 × 30% = 5,300.10
  - Total Tax: 2,400 + 2,083.25 + 5,300.10 = 9,783.35
  - Less Personal Relief: 9,783.35 - 2,400 = 7,383.35
PAYE = KES 7,383.35
```

### 5. Net Pay Calculation

#### Other Deductions
- **Salary Advances**: Deducted from net pay
- **Loans**: Installment deductions
- **Other Deductions**: Custom deductions per employee

#### Net Pay Formula
```
Net Pay = Gross Pay - SHIF - NSSF - AHL - PAYE - Other Deductions
```

### 6. Payroll Processing

#### Payroll Run
- **Period Selection**: Month/Year (YYYY-MM format)
- **Employee Selection**: All employees or specific employees
- **Calculation**: Recalculates all values using current formulas
- **Data Source**: Uses employee profile basic salary (not historical snapshots)
- **Consistency**: All reports use same calculation method

#### Projected Payroll
- **Mid-Month Projection**: Estimate payroll before period ends
- **Actual Days**: Calculate based on days worked so far
- **Projected Days**: Estimate remaining days in period
- **Projected Gross**: (Actual Earnings ÷ Actual Days) × Total Days
- **Use Case**: Budgeting and cash flow planning

#### Payroll History
- **Historical Records**: All payroll runs stored
- **Audit Trail**: Complete calculation breakdown per period
- **Reconciliation**: Compare historical vs current calculations
- **Retention**: 36 months (statutory requirement)

---

## Reports & Exports

### 1. Statutory Compliance Reports

#### P10 Tax Returns (KRA)
- **Format**: ZIP file containing CSV files
- **Purpose**: Submit to Kenya Revenue Authority (KRA)
- **Deadline**: 9th of following month
- **Contents**:
  - **A_Basic_Information.csv**: Employer details, return period, totals
  - **B_Employee_Details.csv**: Employee payroll data with PAYE calculations
  - **M_AHL_Dtls.csv**: Affordable Housing Levy details
  - **N_Tax_Due.csv**: Summary of total tax due
- **Import**: CSV files can be imported into official KRA P10 Excel template
- **Validation**: Use KRA Excel macro to validate and generate final submission

#### P9 Tax Deduction Cards
- **Format**: HTML files (one per employee) in ZIP archive
- **Purpose**: Annual tax summary for employees
- **Period**: Full year (select any month to generate entire year)
- **Contents**:
  - Monthly breakdown of Basic Salary, Benefits, Gross Pay
  - Retirement Contributions, Owner Occupied Interest
  - Chargeable Pay, Tax, Relief, PAYE
  - Annual totals and summary
- **PDF Generation**: Use browser Print to PDF function
- **Company Branding**: Includes company logo and details

#### NSSF Contributions Statement
- **Format**: CSV file (flat data, no header row)
- **Purpose**: Upload to NSSF Self-Service portal
- **Deadline**: 15th of following month
- **Column Order** (Fixed):
  1. Payroll Number (Optional)
  2. Surname
  3. Other Names
  4. ID Number
  5. KRA PIN
  6. NSSF Number (Text format - preserves leading zeros and 'X')
  7. Gross Pay
  8. Voluntary Contributions
- **Format Rules**:
  - Identification columns (A-F) are Text format
  - Gross Pay is General format
  - No formulas or totals below last record
- **Alternative Format**: PDF-ready HTML report with company branding

#### SHIF Remittance Report
- **Format**: CSV file
- **Purpose**: Submit to Social Health Authority (SHA) portal
- **Contents**:
  - Payroll Number
  - Firstname, Lastname
  - Identity Type (ID/Passport)
  - ID Number
  - KRA PIN
  - SHIF Registration Number (or ID/Passport)
  - Contribution Amount (2.75% of Gross Pay)
  - Phone Number
- **Format**: Matches SHAH REPORT format for direct upload

#### AHL Report
- **Format**: HTML report (PDF-ready)
- **Purpose**: Internal reconciliation for Affordable Housing Levy
- **Contents**:
  - Employee details
  - Gross Pay
  - Employee Contribution (1.5%)
  - Employer Contribution (1.5%)
  - Total Contribution (3.0%)
- **Use Case**: Internal audit and reconciliation

### 2. Internal Reports

#### Company Payroll Report
- **Format**: HTML report (PDF-ready)
- **Purpose**: Comprehensive payroll summary for company
- **Contents**:
  - Employee list with all earnings
  - All deductions (SHIF, NSSF, AHL, PAYE)
  - Net pay per employee
  - Company totals and summaries
- **Branding**: Includes company logo and details
- **Period**: Monthly or custom date range

#### Payslips Archive
- **Format**: HTML file containing all payslips (PDF-ready)
- **Purpose**: Employee payslip distribution
- **Contents**: Individual payslips for all employees in period
- **PDF Generation**: Use browser Print to PDF function
- **Distribution**: Can be emailed or printed

#### Bank Payment Reports
- **Format**: HTML reports grouped by bank (ZIP archive)
- **Purpose**: Bank transfer instructions and reconciliation
- **Contents**:
  - Employee payment details grouped by bank
  - Account numbers, amounts, employee names
  - Bank-specific totals
- **Use Case**: Prepare bank transfer files or manual transfers
- **Branding**: Each bank report includes company logo

#### Attendance Register
- **Format**: HTML/CSV report
- **Purpose**: Daily attendance tracking
- **Contents**:
  - Employee list with daily clock-in/out times
  - Hours worked per day
  - Late arrivals, early departures
  - Absent days
  - Monthly summary
- **Period**: Monthly or custom date range

#### Salary Advance Report
- **Format**: HTML/CSV report
- **Purpose**: Track salary advances and repayments
- **Contents**:
  - Employee advances issued
  - Repayment schedule
  - Outstanding balances
  - Deduction history

#### Audit Log
- **Format**: CSV/HTML export
- **Purpose**: Complete transaction history
- **Contents**:
  - All system changes (payroll, employee updates, settings)
  - User actions with timestamps
  - Before/after values for changes
- **Retention**: 36 months (statutory requirement)
- **Use Case**: Compliance audits and troubleshooting

### 3. Report Features

#### Data Consistency
- **Standardized Source**: All reports use same calculation method
- **Real-Time Calculation**: Values recalculated using current formulas
- **No Historical Snapshots**: Uses employee profile data (not stored payroll values)
- **Guaranteed Consistency**: Payroll Report, Bank Report, NSSF, SHIF, AHL, P10 show identical values

#### Export Options
- **CSV**: For Excel import and data analysis
- **HTML**: PDF-ready reports with company branding
- **ZIP**: Multiple files packaged together
- **PDF**: Generated via browser Print to PDF (for HTML reports)

#### Report Customization
- **Period Selection**: Monthly, quarterly, annual, or custom range
- **Employee Filter**: All employees, specific departments, or individual employees
- **Company Filter**: Single company or all companies
- **Date Range**: Flexible start and end dates

---

## Employee Management

### 1. Employee Profile

#### Basic Information
- **Personal Details**: Name, ID Number, KRA PIN, NSSF Number, SHIF Number
- **Contact Information**: Phone, Email, Address
- **Employment Details**: Employee Number, Staff Number, Department, Position
- **Contract Information**: Start Date, End Date, Employment Type

#### Financial Information
- **Basic Salary**: Primary salary component (immutable during payroll)
- **Allowances**: Housing, Transport, Custom allowances
- **Bank Details**: Account Number, Bank Name, Branch
- **Tax Information**: KRA PIN, Personal Relief eligibility

#### Status Management
- **Active**: Employee is active and included in payroll
- **Inactive**: Employee is not included in payroll
- **Terminated**: Employee contract ended
- **On Leave**: Temporary status (may affect payroll)

### 2. Employee Operations

#### Create Employee
- **Profile Setup**: Enter all basic and financial information
- **User Account**: Create linked user account for self-service
- **Initial Settings**: Set department, position, start date
- **Face Enrollment**: Option to enroll face during creation

#### Update Employee
- **Profile Updates**: Modify employee information
- **Salary Changes**: Update basic salary (affects future payroll)
- **Status Changes**: Activate, deactivate, or terminate
- **Department Transfer**: Move employee to different department

#### Delete Employee
- **Soft Delete**: Mark as deleted (retain historical data)
- **Hard Delete**: Complete removal (with confirmation)
- **Data Retention**: Historical payroll data preserved for compliance

### 3. Employee Self-Service

#### Payslip Access
- **View Payslips**: Access current and historical payslips
- **Download**: PDF download option
- **Print**: Print-friendly format

#### Attendance Records
- **View Attendance**: Daily clock-in/out times
- **Hours Summary**: Total hours worked per period
- **Overtime Details**: Overtime hours and rates

#### Face Enrollment
- **Self-Enrollment**: Employees can enroll their own face
- **Re-Enrollment**: Update face data if needed
- **Status Check**: View enrollment status

---

## Company & Multi-Tenant Management

### 1. Company Profile

#### Company Information
- **Basic Details**: Company Name, Registration Number, Tax PIN
- **Contact Information**: Address, Phone, Email
- **Logo**: Company logo for reports and branding
- **Status**: Active/Inactive

#### Company Settings
- **Payroll Settings**: 
  - Standard Allowance
  - Housing Allowance (Fixed or Percentage)
  - Overtime Rates (Fixed or Percentage)
- **Statutory Rates**:
  - SHIF Rate (default 2.75%)
  - SHIF Minimum (default 300)
  - NSSF Tier I Limit (default 7,000)
  - NSSF Tier II Upper Limit (default 36,000)
  - AHL Rate (default 1.5%)
  - Personal Relief (default 2,400)
- **Attendance Settings**:
  - Working Hours
  - Clock-In/Out Windows
  - Minimum Time Gap
  - Geolocation Requirements

### 2. Company Operations

#### Create Company
- **Profile Setup**: Enter company information
- **Initial Settings**: Configure default settings
- **Admin Assignment**: Assign company administrators

#### Update Company
- **Profile Updates**: Modify company information
- **Settings Changes**: Update payroll and attendance settings
- **Logo Upload**: Update company logo

#### Company Isolation
- **Data Separation**: Employees, payroll, attendance isolated per company
- **Settings Isolation**: Company-specific settings don't affect others
- **Cross-Company Access**: Admins can access all companies

---

## User Interface & User Experience

### 1. Design Principles

#### Responsive Design
- **Mobile-First**: Optimized for mobile devices
- **Tablet Support**: Full functionality on tablets
- **Desktop**: Enhanced experience on large screens
- **Touch-Friendly**: Minimum 48px touch targets

#### Modern Theme
- **Color Palette**: 
  - Deep Navy (Primary)
  - Slate Grey (Secondary)
  - Emerald Green (Success)
  - High-contrast buttons for visibility
- **Typography**: Bold, sans-serif fonts for readability
- **Dark Mode**: Professional dark theme option

### 2. Attendance Terminal UI

#### Visual Feedback
- **Scanning Animation**: Pulsing laser line animation during scanning
- **Success Feedback**: 
  - Green flash background effect
  - Toast notification with employee name and time
  - Audio beep for success
- **Error Feedback**:
  - Red shake animation
  - Error message overlay
  - Audio buzz for failure
- **Auto-Reset**: Messages disappear after 2-3 seconds

#### Status Display
- **Current Time**: Large digital clock
- **Status Message**: Current operation status
- **Employee Info**: Display recognized employee details
- **Mode Indicator**: Show active authentication method

### 3. Face Enrollment UI

#### Step-by-Step Process
- **Progress Indicator**: Visual progress bar showing current step
- **Quality Indicators**: Real-time feedback for:
  - Lighting quality
  - Face size
  - Face angle
  - Image sharpness
- **Face Guide Overlay**: Visual guide for face positioning
- **Status Messages**: Clear instructions at each step

#### Face Data Indicator
- **Visual Badge**: Green checkmark if face data exists
- **Status Text**: "✓ Face data exists" or "No face data"
- **Admin Actions**: Delete button for administrators

### 4. Performance Optimizations

#### Fast-Path Operations
- **Clock-In/Out**: Optimized endpoint bypassing heavy calculations
- **Minimal Data**: Fetch only required employee data
- **Lazy Loading**: Load face recognition models only when needed
- **Caching**: Client-side caching of employee and face data

#### Asynchronous Operations
- **Non-Blocking**: All operations use async/await or promises
- **Background Processing**: Geolocation fetched asynchronously
- **Progressive Loading**: Load data incrementally

---

## Technical Architecture

### 1. Face Recognition Technology

#### Library & Models
- **Library**: face-api.js (v1.6.9) or equivalent
- **Detection Models**:
  - TinyFaceDetector (Fast)
  - SSD MobileNetV1 (Accurate)
- **Landmark Model**: FaceLandmark68Net (68 facial landmarks)
- **Recognition Model**: FaceRecognitionNet (128-element descriptors)

#### Descriptor Format
- **Type**: 128-element Float32Array
- **Storage**: JSON string in database
- **Matching**: Cosine similarity
- **Threshold**: Configurable (default 0.4 = 60% similarity minimum)

#### Performance Metrics
- **Detection Speed**: ~100ms per frame
- **Matching Speed**: <10ms for 1:N matching (up to 1000 employees)
- **Enrollment Time**: 2-5 seconds
- **Terminal Response**: <500ms end-to-end

### 2. QR Code System

#### QR Code Generation
- **Format**: Employee-specific unique token
- **Encoding**: Base64 or UUID
- **Storage**: Linked to employee account
- **Regeneration**: Can regenerate if compromised

#### Scanning Technology
- **Library**: html5-qrcode (v2.3.8) or equivalent
- **Performance**: 30-40 FPS scanning
- **Mobile Optimized**: Full-screen scanner
- **Offline Support**: Queue scans when offline

### 3. Database Schema

#### Core Tables

**Companies Table**
- id (Primary Key)
- name, registration_number, tax_pin
- address, phone, email
- logo_url
- status (active/inactive)
- created_at, updated_at

**Employees Table**
- id (Primary Key)
- user_id (Foreign Key to Users)
- company_id (Foreign Key to Companies)
- employee_id, staff_no
- name, department, position
- basic_salary
- status (active/inactive)
- contract_start_date, contract_end_date
- created_at, updated_at

**Attendance Table**
- id (Primary Key)
- user_id (Foreign Key)
- company_id (Foreign Key)
- date (DATE)
- clock_in_time (DATETIME)
- clock_out_time (DATETIME)
- hours_worked (DECIMAL)
- overtime_hours (DECIMAL)
- auth_method (face/qr/manual)
- location_lat, location_lng
- location_address
- created_at, updated_at

**Payroll Runs Table**
- id (Primary Key)
- company_id (Foreign Key)
- period (YYYY-MM)
- employee_id (Foreign Key)
- basic_salary, allowances, gross_pay
- shif_employee, shif_employer
- nssf_employee, nssf_employer
- ahl_employee, ahl_employer
- taxable_pay, paye
- other_deductions, net_pay
- calculated_at, created_at

**Face Descriptors Table** (or User Meta)
- user_id (Foreign Key)
- descriptor (TEXT/JSON - 128-element array)
- registered_at (TIMESTAMP)
- quality_score (DECIMAL)
- capture_method (auto/manual)

**Settings Table**
- id (Primary Key)
- company_id (Foreign Key, nullable for global)
- setting_key (VARCHAR)
- setting_value (TEXT)
- updated_at

### 4. API Endpoints

#### Authentication Endpoints
- `POST /api/attendance/clock-in` - Clock in employee
- `POST /api/attendance/clock-out` - Clock out employee
- `POST /api/attendance/log-by-qr` - Fast QR clock-in/out
- `GET /api/attendance/status/:employee_id` - Get current status

#### Face Recognition Endpoints
- `POST /api/face/enroll` - Save face descriptor
- `GET /api/face/descriptors` - Get all face descriptors
- `DELETE /api/face/descriptor/:user_id` - Delete face descriptor
- `GET /api/face/check/:user_id` - Check if face exists

#### Payroll Endpoints
- `POST /api/payroll/calculate` - Calculate payroll for period
- `POST /api/payroll/run` - Process payroll run
- `GET /api/payroll/history/:employee_id` - Get payroll history
- `GET /api/payroll/payslip/:employee_id/:period` - Get payslip

#### Report Endpoints
- `GET /api/reports/p10/:period` - Generate P10 report
- `GET /api/reports/p9/:year` - Generate P9 reports
- `GET /api/reports/nssf/:period` - Generate NSSF report
- `GET /api/reports/shif/:period` - Generate SHIF report
- `GET /api/reports/payroll/:period` - Generate payroll report

### 5. Security Considerations

#### Data Protection
- **Encryption**: Sensitive data encrypted at rest and in transit
- **HTTPS**: All communications over HTTPS
- **Token-Based Auth**: JWT or session tokens for API access
- **Nonce Verification**: CSRF protection for state-changing operations

#### Access Control
- **Role-Based**: Permissions based on user roles
- **Company Isolation**: Data access restricted by company
- **Audit Logging**: All sensitive operations logged

#### Biometric Data Privacy
- **Template Storage**: Only mathematical templates stored (not images)
- **GDPR Compliance**: Right to deletion, data portability
- **Retention Policy**: Configurable data retention periods

### 6. Performance Requirements

#### Response Times
- **Clock-In/Out**: <500ms end-to-end
- **Face Recognition**: <100ms detection + <10ms matching
- **Payroll Calculation**: <2 seconds per employee
- **Report Generation**: <30 seconds for 100 employees

#### Scalability
- **Employees**: Support up to 10,000 employees per company
- **Concurrent Users**: 100+ simultaneous terminal users
- **Face Matching**: 1:N matching for 1,000+ employees in <100ms

#### Browser Support
- **Chrome/Edge**: Recommended (best performance)
- **Firefox**: Supported
- **Safari**: Supported (iOS 11+)
- **Mobile Browsers**: Full support

---

## Implementation Notes

### 1. Data Consistency Policy
- **Single Source of Truth**: Employee profile is authoritative for basic salary
- **Real-Time Calculation**: All values recalculated using current formulas
- **No Historical Snapshots**: Payroll runs store calculated values but reports recalculate
- **Guaranteed Consistency**: All reports show identical values for same period

### 2. Statutory Compliance
- **Kenyan Tax Laws**: Implements current KRA tax brackets and rates
- **NSSF Tiered Structure**: Correctly implements Tier I and Tier II
- **SHIF Minimum**: Enforces minimum contribution of KES 300
- **AHL Uncapped**: 1.5% of gross pay with no upper limit
- **Personal Relief**: KES 2,400 deducted from calculated tax

### 3. Error Handling
- **Graceful Degradation**: System continues operating if optional features fail
- **User-Friendly Messages**: Clear error messages for users
- **Comprehensive Logging**: All errors logged for debugging
- **Fallback Options**: Manual entry if biometric fails

### 4. Offline Support
- **Queue Operations**: Attendance logs queued when offline
- **Sync on Reconnect**: Automatic sync when connection restored
- **Local Storage**: IndexedDB for offline data storage
- **Service Worker**: PWA support for offline functionality

---

## Summary

This HR & Payroll Management System provides:

1. **Complete Attendance Management**: Face recognition, QR codes, manual entry
2. **Automated Payroll Processing**: Full calculation engine with statutory compliance
3. **Comprehensive Reporting**: KRA, NSSF, SHIF, AHL, and internal reports
4. **Multi-Company Support**: Isolated data and settings per company
5. **Employee Self-Service**: Payslips, attendance, face enrollment
6. **Modern UI/UX**: Responsive design with instant feedback
7. **High Performance**: Sub-second authentication, optimized calculations
8. **Security & Compliance**: Encrypted data, audit logging, GDPR-ready

The system is designed to be framework-agnostic and can be implemented using any modern web technology stack (Node.js, Python/Django, PHP/Laravel, Java/Spring, etc.) while maintaining the same business logic and feature set.

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-05  
**Target Audience**: Developers, System Architects, Business Analysts
