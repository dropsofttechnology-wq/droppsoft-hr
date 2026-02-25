# Appwrite Database Schema

This document describes all collections and attributes needed for the Droppsoft HR system.

## Collections

### 1. Companies

**Collection ID**: `companies`

**Attributes**:
- `name` (String, 255, Required)
- `registration_number` (String, 100)
- `tax_pin` (String, 50)
- `address` (String, 500)
- `phone` (String, 50)
- `email` (String, 255)
- `logo_url` (String, 500)
- `status` (String, 50, Required) - Values: 'active', 'inactive'
- `created_at` (DateTime, Required)
- `updated_at` (DateTime, Required)

**Indexes**:
- `name` (Full-text search)
- `status` (Key)

### 2. Employees

**Collection ID**: `employees`

**Attributes**:
- `user_id` (String, 255, Required) - Appwrite User ID
- `company_id` (String, 255, Required) - Reference to Companies
- `employee_id` (String, 100)
- `staff_no` (String, 100)
- `name` (String, 255, Required)
- `id_number` (String, 50)
- `kra_pin` (String, 50)
- `nssf_number` (String, 50)
- `shif_number` (String, 50)
- `department` (String, 100)
- `position` (String, 100)
- `basic_salary` (Double, Required)
- `phone` (String, 50)
- `email` (String, 255)
- `bank_account` (String, 100)
- `bank_name` (String, 100)
- `bank_branch` (String, 100)
- `contract_start_date` (DateTime)
- `contract_end_date` (DateTime)
- `status` (String, 50, Required) - Values: 'active', 'inactive', 'terminated'
- `created_at` (DateTime, Required)
- `updated_at` (DateTime, Required)

**Indexes**:
- `company_id` (Key)
- `user_id` (Key, Unique)
- `employee_id` (Key, Unique)
- `status` (Key)
- `name` (Full-text search)

### 3. Attendance

**Collection ID**: `attendance`

**Attributes**:
- `user_id` (String, 255, Required) - Reference to Users
- `company_id` (String, 255, Required) - Reference to Companies
- `date` (String, 10, Required) - Format: YYYY-MM-DD
- `clock_in_time` (DateTime)
- `clock_out_time` (DateTime)
- `hours_worked` (Double)
- `overtime_hours` (Double)
- `auth_method` (String, 50) - Values: 'face', 'qr', 'manual', 'bulk'
- `location_lat` (Double)
- `location_lng` (Double)
- `location_address` (String, 500)
- `reason` (String, 500)
- `created_at` (DateTime, Required)
- `updated_at` (DateTime, Required)

**Indexes**:
- `user_id` (Key)
- `company_id` (Key)
- `date` (Key)
- `company_id_date` (Composite: company_id, date)

### 4. Payroll Runs

**Collection ID**: `payroll_runs`

**Attributes**:
- `company_id` (String, 255, Required)
- `employee_id` (String, 255, Required) - Reference to Employees
- `period` (String, 7, Required) - Format: YYYY-MM
- `basic_salary` (Double, Required)
- `allowances` (Double)
- `gross_pay` (Double, Required)
- `shif_employee` (Double)
- `shif_employer` (Double)
- `nssf_employee` (Double)
- `nssf_employer` (Double)
- `ahl_employee` (Double)
- `ahl_employer` (Double)
- `taxable_pay` (Double)
- `paye` (Double)
- `other_deductions` (Double)
- `net_pay` (Double, Required)
- `overtime_hours` (Double)
- `overtime_pay` (Double)
- `holiday_pay` (Double)
- `absence_deduction` (Double)
- `calculated_at` (DateTime, Required)
- `created_at` (DateTime, Required)

**Indexes**:
- `company_id` (Key)
- `employee_id` (Key)
- `period` (Key)
- `company_period` (Composite: company_id, period)

### 5. Face Descriptors

**Collection ID**: `face_descriptors`

**Attributes**:
- `user_id` (String, 255, Required) - Reference to Users
- `company_id` (String, 255, Required)
- `descriptor` (String, Required) - JSON array of 128 numbers
- `quality_score` (Double)
- `capture_method` (String, 50) - Values: 'auto', 'manual'
- `registered_at` (DateTime, Required)
- `created_at` (DateTime, Required)

**Indexes**:
- `user_id` (Key, Unique)
- `company_id` (Key)

### 6. Settings

**Collection ID**: `settings`

**Attributes**:
- `company_id` (String, 255) - Nullable for global settings
- `setting_key` (String, 100, Required)
- `setting_value` (String, 1000, Required)
- `updated_at` (DateTime, Required)

**Indexes**:
- `company_id` (Key)
- `setting_key` (Key)
- `company_setting` (Composite: company_id, setting_key, Unique)

### 7. Audit Log

**Collection ID**: `audit_log`

**Attributes**:
- `user_id` (String, 255, Required)
- `company_id` (String, 255)
- `action` (String, 100, Required) - e.g., 'create_employee', 'update_payroll'
- `entity_type` (String, 100) - e.g., 'employee', 'payroll'
- `entity_id` (String, 255)
- `old_value` (String, 5000) - JSON
- `new_value` (String, 5000) - JSON
- `ip_address` (String, 50)
- `user_agent` (String, 500)
- `created_at` (DateTime, Required)

**Indexes**:
- `user_id` (Key)
- `company_id` (Key)
- `action` (Key)
- `created_at` (Key, Descending)

## Setup Instructions

1. Create a database in Appwrite Console
2. Create each collection with the attributes listed above
3. Create indexes as specified
4. Set up collection permissions:
   - **Companies**: Read for authenticated users, Write for admins
   - **Employees**: Read for authenticated users, Write for HR/admins
   - **Attendance**: Read for authenticated users, Write for employees (own records) and admins
   - **Payroll Runs**: Read for authenticated users, Write for payroll officers/admins
   - **Face Descriptors**: Read for authenticated users, Write for employees (own) and admins
   - **Settings**: Read for authenticated users, Write for admins
   - **Audit Log**: Read for admins, Write for system

## Permissions Example

For each collection, set permissions like:

```javascript
// Read access for authenticated users
[
  { role: 'users', permission: 'read' }
]

// Write access for specific roles
[
  { role: 'users', permission: 'read' },
  { role: 'admin', permission: 'write' },
  { role: 'hr', permission: 'write' }
]
```
