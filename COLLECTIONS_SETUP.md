# Appwrite Collections Setup Guide

Quick reference for creating all required collections in Appwrite.

## Collection Attributes Reference

### 1. companies

**Attributes** (in order):
```
name (String, 255, Required)
registration_number (String, 100)
tax_pin (String, 50)
address (String, 500)
phone (String, 50)
email (String, 255)
logo_url (String, 500)
status (String, 50, Required) - Default: "active"
created_at (DateTime, Required)
updated_at (DateTime, Required)
```

**Indexes**:
- `status` (Key)

---

### 2. employees

**Attributes**:
```
user_id (String, 255)
company_id (String, 255, Required)
employee_id (String, 100)
staff_no (String, 100)
name (String, 255, Required)
id_number (String, 50)
kra_pin (String, 50)
nssf_number (String, 50)
shif_number (String, 50)
department (String, 100)
position (String, 100)
basic_salary (Double, Required)
phone (String, 50)
email (String, 255)
bank_account (String, 100)
bank_name (String, 100)
bank_branch (String, 100)
contract_start_date (DateTime)
contract_end_date (DateTime)
status (String, 50, Required) - Default: "active"
created_at (DateTime, Required)
updated_at (DateTime, Required)
```

**Indexes**:
- `company_id` (Key)
- `user_id` (Key)
- `status` (Key)

---

### 3. attendance

**Attributes**:
```
user_id (String, 255, Required)
company_id (String, 255, Required)
date (String, 10, Required)
clock_in_time (DateTime)
clock_out_time (DateTime)
hours_worked (Double)
overtime_hours (Double)
auth_method (String, 50)
location_lat (Double)
location_lng (Double)
location_address (String, 500)
reason (String, 500)
created_at (DateTime, Required)
updated_at (DateTime, Required)
```

**Indexes**:
- `user_id` (Key)
- `company_id` (Key)
- `date` (Key)

---

### 4. payroll_runs

**Attributes**:
```
company_id (String, 255, Required)
employee_id (String, 255, Required)
period (String, 7, Required)
basic_salary (Double, Required)
allowances (Double)
gross_pay (Double, Required)
shif_employee (Double)
shif_employer (Double)
nssf_employee (Double)
nssf_employer (Double)
ahl_employee (Double)
ahl_employer (Double)
taxable_pay (Double)
paye (Double)
other_deductions (Double)
net_pay (Double, Required)
overtime_hours (Double)
overtime_pay (Double)
holiday_pay (Double)
absence_deduction (Double)
calculated_at (DateTime, Required)
created_at (DateTime, Required)
```

**Indexes**:
- `company_id` (Key)
- `employee_id` (Key)
- `period` (Key)

---

### 5. face_descriptors

**Attributes**:
```
user_id (String, 255, Required)
company_id (String, 255, Required)
descriptor (String, Required)
quality_score (Double)
capture_method (String, 50)
registered_at (DateTime, Required)
created_at (DateTime, Required)
```

**Indexes**:
- `user_id` (Key, Unique)
- `company_id` (Key)

---

### 6. settings

**Attributes**:
```
company_id (String, 255)
setting_key (String, 100, Required)
setting_value (String, 1000, Required)
updated_at (DateTime, Required)
```

**Indexes**:
- `company_id` (Key)
- `setting_key` (Key)

---

### 7. audit_log (Optional)

**Attributes**:
```
user_id (String, 255, Required)
company_id (String, 255)
action (String, 100, Required)
entity_type (String, 100)
entity_id (String, 255)
old_value (String, 5000)
new_value (String, 5000)
ip_address (String, 50)
user_agent (String, 500)
created_at (DateTime, Required)
```

**Indexes**:
- `user_id` (Key)
- `company_id` (Key)
- `created_at` (Key, Descending)

---

## Permissions Setup

For all collections, set permissions to:
- **Read**: `users` (any authenticated user)
- **Write**: `users` (any authenticated user)

In Appwrite Console:
1. Go to Collection → Settings → Permissions
2. Add permission: Role = `users`, Permission = `read`
3. Add permission: Role = `users`, Permission = `write`

---

## Quick Setup Tips

1. **Create collections in order** - Start with `companies`, then `employees`, etc.
2. **Copy-paste collection IDs** - Use exact IDs (case-sensitive)
3. **Set defaults** - For `status` fields, set default to `"active"`
4. **Create indexes** - After creating attributes, create indexes
5. **Test permissions** - Verify users can read/write after setup

---

## Verification

After creating all collections, run:
```bash
npm run check:appwrite
```

This will verify your setup is correct!
