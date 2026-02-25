# 🚀 Deploy Now - Step by Step

Follow these steps in order to deploy your application.

## Step 1: Configure Appwrite Credentials

**Before building, you need to set your Appwrite credentials:**

1. **Get your Appwrite Project ID:**
   - Go to https://cloud.appwrite.io
   - Open your project (or create one)
   - Copy the **Project ID** from the project settings

2. **Get your Database ID:**
   - In Appwrite Console → Databases
   - Open your database (or create one named "hr_database")
   - Copy the **Database ID**

3. **Update `.env` file:**
   - Open `C:\DROPPSOFT_HR\.env`
   - Replace `your-project-id-here` with your actual Project ID
   - Replace `your-database-id-here` with your actual Database ID
   - Save the file

## Step 2: Create Appwrite Collections

**You need to create 7 collections in your Appwrite database:**

1. Go to Appwrite Console → Databases → Your Database
2. Create each collection (see `COLLECTIONS_SETUP.md` for details):

   - **companies** - Company information
   - **employees** - Employee profiles  
   - **attendance** - Attendance records
   - **payroll_runs** - Payroll calculations
   - **face_descriptors** - Face recognition data
   - **settings** - Company settings
   - **audit_log** - Audit trail (optional)

3. For each collection:
   - Add all attributes listed in `COLLECTIONS_SETUP.md`
   - Create indexes as specified
   - Set permissions: Read/Write for `users` role

## Step 3: Enable Authentication

1. Appwrite Console → Auth → Settings
2. Enable **"Email/Password"** authentication
3. Save

## Step 4: Build the Application

Run this command to build for production:

```bash
cd C:\DROPPSOFT_HR
npm run build
```

This creates a `dist` folder with all production files.

## Step 5: Deploy to Hosting

Choose your hosting option:

### Option A: Appwrite Hosting (Easiest)

1. Appwrite Console → Hosting
2. Click **"Add Platform"** → **"Web App"**
3. Name: `Droppsoft HR`
4. Upload all files from `C:\DROPPSOFT_HR\dist` folder
5. Set environment variables:
   - `VITE_APPWRITE_ENDPOINT`
   - `VITE_APPWRITE_PROJECT_ID`
   - `VITE_APPWRITE_DATABASE_ID`
6. Click **Deploy**
7. Get your hosting URL

### Option B: Vercel

```bash
npm install -g vercel
cd C:\DROPPSOFT_HR
vercel --prod
```

Add environment variables in Vercel dashboard.

### Option C: Netlify

```bash
npm install -g netlify-cli
cd C:\DROPPSOFT_HR
netlify deploy --prod --dir=dist
```

Add environment variables in Netlify dashboard.

## Step 6: Create First User

1. Appwrite Console → Auth → Users
2. Click **"Create User"**
3. Enter email and password
4. Click **Create**

## Step 7: Test Your Deployment

1. Visit your deployed URL
2. Login with the user you created
3. Create your first company
4. Add your first employee
5. Test all features!

## ✅ You're Live!

Your HR & Payroll system is now deployed and ready to use!
