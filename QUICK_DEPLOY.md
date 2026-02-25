# Quick Deploy Guide

Fast deployment steps for Droppsoft HR to Appwrite.

## 1. Appwrite Setup (5 minutes)

### Create Project
1. Go to https://cloud.appwrite.io
2. Create project → Name: "Droppsoft HR"
3. **Copy Project ID**

### Create Database
1. Databases → Create Database → Name: "hr_database"
2. **Copy Database ID**

### Create Collections
Go to your database and create these 7 collections:

1. **companies** - Company information
2. **employees** - Employee profiles
3. **attendance** - Attendance records
4. **payroll_runs** - Payroll calculations
5. **face_descriptors** - Face recognition data
6. **settings** - Company settings
7. **audit_log** - Audit trail (optional)

**For each collection:**
- Use the exact collection ID (case-sensitive)
- Add attributes as listed in `DEPLOYMENT_GUIDE.md`
- Set permissions: Read/Write for `users` role

### Enable Authentication
1. Auth → Settings
2. Enable "Email/Password"

## 2. Configure Environment (2 minutes)

1. Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env
   ```

2. Edit `.env` and add:
   ```env
   VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   VITE_APPWRITE_PROJECT_ID=paste-your-project-id
   VITE_APPWRITE_DATABASE_ID=paste-your-database-id
   ```

## 3. Build Application (1 minute)

```bash
cd C:\DROPPSOFT_HR
npm install
npm run build
```

## 4. Deploy (Choose one)

### Option A: Appwrite Hosting
1. Appwrite Console → Hosting
2. Add Platform → Web App
3. Upload `dist` folder contents
4. Set environment variables
5. Deploy

### Option B: Vercel
```bash
npm install -g vercel
vercel --prod
```

### Option C: Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

## 5. Test (2 minutes)

1. Visit your deployed URL
2. Create first user (Appwrite Console → Auth → Users)
3. Login
4. Create company
5. Add employee
6. Test features

## Done! 🎉

Your HR system is now live!

For detailed setup, see `DEPLOYMENT_GUIDE.md`
