# Deployment Guide - Droppsoft HR to Appwrite

Complete step-by-step guide to deploy your HR & Payroll system to Appwrite.

## Prerequisites

- Appwrite Cloud account (or self-hosted Appwrite instance)
- Node.js 18+ installed
- Git (optional, for version control)

## Step 1: Create Appwrite Project

1. **Go to Appwrite Console**
   - Visit https://cloud.appwrite.io
   - Sign in or create an account

2. **Create New Project**
   - Click "Create Project"
   - Name: `Droppsoft HR` (or your preferred name)
   - Click "Create"
   - **Copy your Project ID** (you'll need this)

3. **Get API Endpoint**
   - Your endpoint will be: `https://cloud.appwrite.io/v1`
   - (Or your custom domain if using self-hosted)

## Step 2: Create Database and Collections

### 2.1 Create Database

1. In Appwrite Console, go to **Databases**
2. Click **"Create Database"**
3. Name: `hr_database`
4. Click **"Create"**
5. **Copy your Database ID** (you'll need this)

### 2.2 Create Collections

Create the following collections in your database:

#### Collection 1: `companies`
- **Collection ID**: `companies`
- **Name**: Companies
- **Permissions**: 
  - Read: `users` (authenticated users)
  - Write: `users` (authenticated users)

**Attributes**:
- `name` (String, 255, Required)
- `registration_number` (String, 100)
- `tax_pin` (String, 50)
- `address` (String, 500)
- `phone` (String, 50)
- `email` (String, 255)
- `logo_url` (String, 500)
- `status` (String, 50, Required) - Default: `active`
- `created_at` (DateTime, Required)
- `updated_at` (DateTime, Required)

**Indexes**:
- `status` (Key)

#### Collection 2: `employees`
- **Collection ID**: `employees`
- **Name**: Employees
- **Permissions**: Read/Write for `users`

**Attributes**:
- `user_id` (String, 255)
- `company_id` (String, 255, Required)
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
- `status` (String, 50, Required) - Default: `active`
- `created_at` (DateTime, Required)
- `updated_at` (DateTime, Required)

**Indexes**:
- `company_id` (Key)
- `user_id` (Key)
- `status` (Key)

#### Collection 3: `attendance`
- **Collection ID**: `attendance`
- **Name**: Attendance
- **Permissions**: Read/Write for `users`

**Attributes**:
- `user_id` (String, 255, Required)
- `company_id` (String, 255, Required)
- `date` (String, 10, Required) - Format: YYYY-MM-DD
- `clock_in_time` (DateTime)
- `clock_out_time` (DateTime)
- `hours_worked` (Double)
- `overtime_hours` (Double)
- `auth_method` (String, 50) - Values: `face`, `qr`, `manual`
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

#### Collection 4: `payroll_runs`
- **Collection ID**: `payroll_runs`
- **Name**: Payroll Runs
- **Permissions**: Read/Write for `users`

**Attributes**:
- `company_id` (String, 255, Required)
- `employee_id` (String, 255, Required)
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

#### Collection 5: `face_descriptors`
- **Collection ID**: `face_descriptors`
- **Name**: Face Descriptors
- **Permissions**: Read/Write for `users`

**Attributes**:
- `user_id` (String, 255, Required)
- `company_id` (String, 255, Required)
- `descriptor` (String, Required) - JSON array of 128 numbers
- `quality_score` (Double)
- `capture_method` (String, 50) - Values: `auto`, `manual`
- `registered_at` (DateTime, Required)
- `created_at` (DateTime, Required)

**Indexes**:
- `user_id` (Key, Unique)
- `company_id` (Key)

#### Collection 6: `settings`
- **Collection ID**: `settings`
- **Name**: Settings
- **Permissions**: Read/Write for `users`

**Attributes**:
- `company_id` (String, 255)
- `setting_key` (String, 100, Required)
- `setting_value` (String, 1000, Required)
- `updated_at` (DateTime, Required)

**Indexes**:
- `company_id` (Key)
- `setting_key` (Key)

#### Collection 7: `audit_log` (Optional)
- **Collection ID**: `audit_log`
- **Name**: Audit Log
- **Permissions**: Read/Write for `users`

**Attributes**:
- `user_id` (String, 255, Required)
- `company_id` (String, 255)
- `action` (String, 100, Required)
- `entity_type` (String, 100)
- `entity_id` (String, 255)
- `old_value` (String, 5000)
- `new_value` (String, 5000)
- `ip_address` (String, 50)
- `user_agent` (String, 500)
- `created_at` (DateTime, Required)

**Indexes**:
- `user_id` (Key)
- `company_id` (Key)
- `created_at` (Key, Descending)

## Step 3: Set Up Authentication

1. In Appwrite Console, go to **Auth**
2. Click **Settings**
3. Enable **Email/Password** authentication
4. (Optional) Configure email templates

## Step 4: Configure Environment Variables

1. **Copy `.env.example` to `.env`**:
   ```bash
   cd C:\DROPPSOFT_HR
   copy .env.example .env
   ```

2. **Edit `.env` file** and add your Appwrite credentials:
   ```env
   VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   VITE_APPWRITE_PROJECT_ID=your-project-id-here
   VITE_APPWRITE_DATABASE_ID=your-database-id-here
   
   VITE_FACE_API_CDN=https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.6.9/dist/face-api.min.js
   VITE_FACE_MODELS_PATH=https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.6.9/model/
   
   VITE_APP_NAME=Droppsoft HR
   VITE_APP_VERSION=1.0.0
   ```

3. **Replace**:
   - `your-project-id-here` with your actual Project ID
   - `your-database-id-here` with your actual Database ID

## Step 5: Build the Application

```bash
cd C:\DROPPSOFT_HR
npm install
npm run build
```

This creates a `dist` folder with production-ready files.

## Step 6: Deploy to Hosting

You have several options:

### Option A: Appwrite Hosting (Recommended)

1. **In Appwrite Console**, go to **Hosting**
2. Click **"Add Platform"** → **"Web App"**
3. Name: `Droppsoft HR`
4. **Upload the `dist` folder contents**:
   - Drag and drop all files from `C:\DROPPSOFT_HR\dist`
   - Or use Appwrite CLI (see below)

5. **Set Environment Variables** in Appwrite Hosting:
   - `VITE_APPWRITE_ENDPOINT`
   - `VITE_APPWRITE_PROJECT_ID`
   - `VITE_APPWRITE_DATABASE_ID`

6. **Deploy** and get your hosting URL

### Option B: Vercel

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   cd C:\DROPPSOFT_HR
   vercel --prod
   ```

3. Add environment variables in Vercel dashboard

### Option C: Netlify

1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Deploy:
   ```bash
   cd C:\DROPPSOFT_HR
   netlify deploy --prod --dir=dist
   ```

3. Add environment variables in Netlify dashboard

### Option D: Any Static Host

Upload the `dist` folder contents to:
- GitHub Pages
- AWS S3 + CloudFront
- Azure Static Web Apps
- Any static hosting service

**Important**: Make sure to set environment variables in your hosting platform!

## Step 7: Test the Application

1. **Visit your deployed URL**
2. **Create your first user**:
   - Go to Appwrite Console → Auth → Users
   - Click "Create User"
   - Enter email and password
   - Or use the registration form (if implemented)

3. **Login** to the application

4. **Create your first company**:
   - Go to Companies page
   - Click "Create Company"
   - Fill in company details
   - Save

5. **Add employees**:
   - Go to Employees page
   - Click "Add Employee"
   - Fill in employee details
   - Save

6. **Test face enrollment**:
   - Go to Face Enrollment page
   - Select employee
   - Enroll face data

7. **Test attendance**:
   - Go to Attendance Terminal
   - Test face recognition, QR, or manual entry

8. **Process payroll**:
   - Go to Payroll page
   - Select period
   - Preview and save payroll

9. **Generate reports**:
   - Go to Reports page
   - Select report type and period
   - Generate and download

## Step 8: Production Checklist

- [ ] All collections created with correct attributes
- [ ] All indexes created
- [ ] Permissions set correctly
- [ ] Environment variables configured
- [ ] Application built successfully
- [ ] Application deployed to hosting
- [ ] Environment variables set in hosting platform
- [ ] First user created
- [ ] First company created
- [ ] Tested all major features

## Troubleshooting

### Issue: "Cannot connect to Appwrite"
- Check `.env` file has correct values
- Verify Project ID and Database ID are correct
- Check Appwrite project is active
- Verify network connectivity

### Issue: "Permission denied"
- Check collection permissions in Appwrite Console
- Ensure user is authenticated
- Verify user has correct roles

### Issue: "Collection not found"
- Verify collection IDs match exactly (case-sensitive)
- Check database ID is correct
- Ensure collections are created

### Issue: "Build fails"
- Run `npm install` again
- Check for syntax errors
- Verify all dependencies are installed

## Support

For issues:
1. Check Appwrite Console logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Review collection permissions

## Next Steps

After deployment:
1. Set up regular backups
2. Configure email notifications (optional)
3. Set up monitoring
4. Train users
5. Document company-specific processes

---

**Congratulations!** Your HR & Payroll system is now live on Appwrite! 🎉
