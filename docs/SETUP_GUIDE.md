# Droppsoft HR - Setup Guide

Complete setup instructions for deploying the HR & Payroll Management System on Appwrite.

## Prerequisites

- Node.js 18+ and npm
- Appwrite Cloud account (or self-hosted Appwrite)
- Modern web browser

## Step 1: Install Dependencies

```bash
cd C:\DROPPSOFT_HR
npm install
```

## Step 2: Set Up Appwrite

### 2.1 Create Appwrite Project

1. Go to https://cloud.appwrite.io (or your Appwrite instance)
2. Create a new project
3. Note your **Project ID** and **API Endpoint**

### 2.2 Create Database

1. In Appwrite Console, go to **Databases**
2. Create a new database
3. Note your **Database ID**

### 2.3 Create Collections

Create the following collections in your database (see `docs/appwrite-schema.md` for detailed schema):

1. **companies** - Company information
2. **employees** - Employee profiles
3. **attendance** - Attendance records
4. **payroll_runs** - Payroll calculations
5. **face_descriptors** - Face recognition data
6. **settings** - System settings
7. **audit_log** - Audit trail

### 2.4 Set Up Authentication

1. Go to **Auth** in Appwrite Console
2. Enable **Email/Password** authentication
3. Configure email templates (optional)

### 2.5 Configure Permissions

For each collection, set permissions:

- **Read**: All authenticated users
- **Write**: Based on user roles (admin, hr, payroll, employee)

## Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Edit `.env` and add your Appwrite credentials:

```env
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your-project-id-here
VITE_APPWRITE_DATABASE_ID=your-database-id-here
```

## Step 4: Run Development Server

```bash
npm run dev
```

The app will be available at http://localhost:3000

## Step 5: Create First Admin User

1. Go to http://localhost:3000/login
2. Click "Register" (or create user via Appwrite Console)
3. Register with email/password
4. The first user will need admin privileges (set in Appwrite Console)

## Step 6: Create Your First Company

1. Login to the application
2. Go to **Companies** page
3. Click "Create Company"
4. Fill in company details
5. Save

## Step 7: Add Employees

1. Go to **Employees** page
2. Click "Add Employee"
3. Fill in employee details:
   - Name, ID Number, KRA PIN
   - Basic Salary
   - Department, Position
   - Bank Details
4. Save

## Step 8: Enroll Face Data

1. Go to **Face Enrollment** page
2. Select an employee
3. Allow camera access
4. Follow on-screen instructions to capture face
5. Face data will be saved automatically

## Step 9: Test Attendance Terminal

1. Go to **Attendance Terminal** page
2. Allow camera access
3. Stand in front of camera
4. System should recognize face and clock in/out

## Step 10: Process Payroll

1. Go to **Payroll** page
2. Select period (YYYY-MM format)
3. Click "Process Payroll"
4. System will calculate:
   - Gross Pay
   - Statutory Deductions (SHIF, NSSF, AHL)
   - PAYE
   - Net Pay
5. Review and approve

## Step 11: Generate Reports

1. Go to **Reports** page
2. Select report type:
   - P10 Tax Returns
   - P9 Tax Deduction Cards
   - NSSF Contributions
   - SHIF Remittance
   - AHL Report
   - Payroll Report
3. Select period
4. Click "Generate"
5. Download report

## Production Deployment

### Build for Production

```bash
npm run build
```

This creates a `dist` folder with optimized production files.

### Deploy to Hosting

You can deploy the `dist` folder to:

- **Vercel**: `vercel --prod`
- **Netlify**: Drag and drop `dist` folder
- **Appwrite Hosting**: Use Appwrite's hosting service
- **Any static host**: Upload `dist` folder contents

### Environment Variables in Production

Make sure to set environment variables in your hosting platform:

- `VITE_APPWRITE_ENDPOINT`
- `VITE_APPWRITE_PROJECT_ID`
- `VITE_APPWRITE_DATABASE_ID`

## Troubleshooting

### Issue: Cannot connect to Appwrite

**Solution**: 
- Check your `.env` file has correct values
- Verify Appwrite project is active
- Check network connectivity

### Issue: Permission denied errors

**Solution**:
- Verify collection permissions in Appwrite Console
- Ensure user is authenticated
- Check user roles/permissions

### Issue: Face recognition not working

**Solution**:
- Ensure camera permissions are granted
- Check browser supports WebRTC
- Verify face-api.js models are loading
- Check browser console for errors

### Issue: Reports not generating

**Solution**:
- Ensure payroll has been processed for the period
- Check employee data is complete
- Verify company settings are configured

## Next Steps

1. **Customize Branding**: Update logo, colors, company name
2. **Configure Settings**: Set up payroll rates, statutory deductions
3. **Import Data**: Bulk import employees and historical data
4. **Set Up Email**: Configure email notifications
5. **Backup Strategy**: Set up regular database backups

## Support

For issues or questions:
- Check documentation in `docs/` folder
- Review `APPLICATION_SPECIFICATION.md` for feature details
- Check Appwrite documentation: https://appwrite.io/docs
