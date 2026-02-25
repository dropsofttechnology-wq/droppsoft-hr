# Quick Start Guide

Get your Droppsoft HR application running in 5 minutes!

## Step 1: Install Dependencies

```bash
cd C:\DROPPSOFT_HR
npm install
```

## Step 2: Set Up Appwrite

1. **Create Appwrite Account**
   - Go to https://cloud.appwrite.io
   - Sign up for free account

2. **Create Project**
   - Click "Create Project"
   - Name it "Droppsoft HR"
   - Copy your **Project ID**

3. **Create Database**
   - Go to Databases → Create Database
   - Name it "hr_database"
   - Copy your **Database ID**

4. **Create Collections**
   - Follow instructions in `docs/appwrite-schema.md`
   - Or use Appwrite Console to create:
     - companies
     - employees
     - attendance
     - payroll_runs
     - face_descriptors
     - settings
     - audit_log

5. **Enable Authentication**
   - Go to Auth → Settings
   - Enable "Email/Password"

## Step 3: Configure Environment

1. Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```env
   VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   VITE_APPWRITE_PROJECT_ID=paste-your-project-id
   VITE_APPWRITE_DATABASE_ID=paste-your-database-id
   ```

## Step 4: Run the App

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Step 5: Create First User

1. The app will redirect to login page
2. You need to create a user first:
   - Option A: Use Appwrite Console → Auth → Users → Create User
   - Option B: Add registration form (coming soon)

3. Login with your credentials

## Step 6: Create Your First Company

1. Go to **Companies** page
2. Click "Create Company"
3. Fill in company details
4. Save

## You're Ready! 🎉

The foundation is set up. Now you can:

- ✅ Login/Logout
- ✅ View Dashboard
- ✅ Navigate between pages
- 🚧 Add companies (UI ready, backend pending)
- 🚧 Add employees (UI ready, backend pending)
- 🚧 Face enrollment (pending)
- 🚧 Attendance terminal (pending)
- 🚧 Payroll (pending)
- 🚧 Reports (pending)

## Next Steps

1. **Complete Company Management**
   - Implement CRUD operations
   - Add company settings

2. **Complete Employee Management**
   - Implement CRUD operations
   - Add employee profiles

3. **Implement Face Recognition**
   - Set up face-api.js
   - Build enrollment system
   - Build attendance terminal

4. **Build Payroll Engine**
   - Implement calculations
   - Add payroll processing

5. **Generate Reports**
   - Implement all statutory reports
   - Add internal reports

## Need Help?

- 📖 Read `docs/SETUP_GUIDE.md` for detailed setup
- 📖 Read `docs/APPLICATION_SPECIFICATION.md` for feature details
- 📖 Read `docs/IMPLEMENTATION_ROADMAP.md` for development plan
- 📖 Read `IMPLEMENTATION_STATUS.md` for current status

## Troubleshooting

### "Cannot connect to Appwrite"
- Check `.env` file has correct values
- Verify Appwrite project is active
- Check internet connection

### "Permission denied"
- Set collection permissions in Appwrite Console
- Ensure user is authenticated

### "Module not found"
- Run `npm install` again
- Delete `node_modules` and reinstall

### Port 3000 already in use
- Change port in `vite.config.js`:
  ```js
  server: {
    port: 3001  // Change to available port
  }
  ```
