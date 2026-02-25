# 🚀 Start Here - Deploy to Appwrite

Welcome! This guide will help you deploy your HR & Payroll system to Appwrite in **15 minutes**.

## 📋 Quick Steps

### Step 1: Create Appwrite Project (2 min)

1. Go to **https://cloud.appwrite.io**
2. Sign in or create account
3. Click **"Create Project"**
4. Name: `Droppsoft HR`
5. **Copy your Project ID** (you'll need this!)

### Step 2: Create Database (1 min)

1. In Appwrite Console → **Databases**
2. Click **"Create Database"**
3. Name: `hr_database`
4. **Copy your Database ID** (you'll need this!)

### Step 3: Create Collections (5 min)

Go to your database and create these 7 collections:

1. **companies** - See `COLLECTIONS_SETUP.md` for attributes
2. **employees** - See `COLLECTIONS_SETUP.md` for attributes
3. **attendance** - See `COLLECTIONS_SETUP.md` for attributes
4. **payroll_runs** - See `COLLECTIONS_SETUP.md` for attributes
5. **face_descriptors** - See `COLLECTIONS_SETUP.md` for attributes
6. **settings** - See `COLLECTIONS_SETUP.md` for attributes
7. **audit_log** - Optional, see `COLLECTIONS_SETUP.md`

**For each collection:**
- Use exact collection ID (case-sensitive)
- Add all attributes listed in `COLLECTIONS_SETUP.md`
- Create indexes as specified
- Set permissions: Read/Write for `users` role

### Step 4: Enable Authentication (1 min)

1. Appwrite Console → **Auth** → **Settings**
2. Enable **"Email/Password"**
3. Save

### Step 5: Configure Environment (2 min)

1. In `C:\DROPPSOFT_HR`, create `.env` file:
   ```env
   VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   VITE_APPWRITE_PROJECT_ID=your-project-id-here
   VITE_APPWRITE_DATABASE_ID=your-database-id-here
   
   VITE_FACE_API_CDN=https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.6.9/dist/face-api.min.js
   VITE_FACE_MODELS_PATH=https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.6.9/model/
   
   VITE_APP_NAME=Droppsoft HR
   VITE_APP_VERSION=1.0.0
   ```

2. Replace:
   - `your-project-id-here` with your actual Project ID
   - `your-database-id-here` with your actual Database ID

### Step 6: Verify Setup (1 min)

```bash
cd C:\DROPPSOFT_HR
npm run check:appwrite
```

This will verify your Appwrite connection and collections.

### Step 7: Build Application (1 min)

```bash
npm run build
```

This creates a `dist` folder with production files.

### Step 8: Deploy (2 min)

Choose one option:

#### Option A: Appwrite Hosting (Recommended)

1. Appwrite Console → **Hosting**
2. **Add Platform** → **Web App**
3. Name: `Droppsoft HR`
4. Upload all files from `C:\DROPPSOFT_HR\dist` folder
5. Set environment variables (same as `.env` file)
6. Click **Deploy**
7. Get your hosting URL

#### Option B: Vercel

```bash
npm install -g vercel
vercel --prod
```

Add environment variables in Vercel dashboard.

#### Option C: Netlify

```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

Add environment variables in Netlify dashboard.

### Step 9: Create First User (1 min)

1. Appwrite Console → **Auth** → **Users**
2. Click **"Create User"**
3. Enter email and password
4. Click **Create**

### Step 10: Test Application (2 min)

1. Visit your deployed URL
2. Login with the user you created
3. Create your first company
4. Add your first employee
5. Test features!

## ✅ Done!

Your HR & Payroll system is now live on Appwrite!

## 📚 Documentation

- **Detailed Setup**: `DEPLOYMENT_GUIDE.md`
- **Quick Deploy**: `QUICK_DEPLOY.md`
- **Collections Setup**: `COLLECTIONS_SETUP.md`
- **Deployment Checklist**: `DEPLOYMENT_CHECKLIST.md`
- **Application Spec**: `docs/APPLICATION_SPECIFICATION.md`

## 🆘 Need Help?

1. Check `DEPLOYMENT_GUIDE.md` for detailed instructions
2. Verify all collections are created correctly
3. Check environment variables are set
4. Review browser console for errors
5. Check Appwrite Console logs

## 🎯 Next Steps

After deployment:
1. Create your first company
2. Add employees
3. Enroll face data
4. Process payroll
5. Generate reports

---

**Good luck with your deployment!** 🚀
