# 🚀 Upload to GitHub & Deploy to Vercel

## Step 1: Prepare Your Project for Git

### 1.1 Check .gitignore
Make sure `.gitignore` exists and excludes sensitive files:

```
node_modules/
dist/
.env
.DS_Store
*.log
```

### 1.2 Create .env.example (if not exists)
This helps others know what environment variables are needed:

```
VITE_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your-project-id-here
VITE_APPWRITE_DATABASE_ID=your-database-id-here

VITE_FACE_API_CDN=https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.6.9/dist/face-api.min.js
VITE_FACE_MODELS_PATH=https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.6.9/model/

VITE_APP_NAME=Droppsoft HR
VITE_APP_VERSION=1.0.0
```

## Step 2: Initialize Git Repository

Open PowerShell or Command Prompt in your project folder:

```powershell
cd C:\DROPPSOFT_HR
git init
```

## Step 3: Add Files to Git

```powershell
# Add all files (except those in .gitignore)
git add .

# Check what will be committed
git status
```

## Step 4: Create First Commit

```powershell
git commit -m "Initial commit: Droppsoft HR application"
```

## Step 5: Create GitHub Repository

### 5.1 Go to GitHub
1. Go to: https://github.com
2. Login or create account
3. Click **"+"** icon (top right) → **"New repository"**

### 5.2 Create Repository
- **Repository name**: `droppsoft-hr` (or any name)
- **Description**: "HR & Payroll Management System with Face Recognition"
- **Visibility**: 
  - **Public** (free, anyone can see code)
  - **Private** (only you can see, may need paid plan)
- **DO NOT** check "Initialize with README" (we already have files)
- Click **"Create repository"**

### 5.3 Copy Repository URL
After creating, GitHub will show you the repository URL. It looks like:
- `https://github.com/your-username/droppsoft-hr.git`

**Copy this URL!**

## Step 6: Connect Local Repository to GitHub

Back in PowerShell:

```powershell
# Add GitHub as remote (replace with your URL)
git remote add origin https://github.com/your-username/droppsoft-hr.git

# Verify remote was added
git remote -v
```

## Step 7: Push to GitHub

```powershell
# Push to GitHub (main branch)
git branch -M main
git push -u origin main
```

You'll be prompted for GitHub username and password/token.

**Note**: If you have 2FA enabled, you'll need a Personal Access Token instead of password.

### Creating Personal Access Token (if needed):
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token
3. Select scopes: `repo` (full control)
4. Copy token and use it as password when pushing

## Step 8: Verify Upload

1. Go to your GitHub repository page
2. You should see all your files
3. ✅ Success!

## Step 9: Connect to Vercel

### 9.1 Go to Vercel
1. Go to: https://vercel.com
2. Sign up/Login (use GitHub account for easiest setup)

### 9.2 Import Project
1. Click **"Add New Project"**
2. Click **"Import Git Repository"**
3. Find your `droppsoft-hr` repository
4. Click **"Import"**

### 9.3 Configure Project
1. **Framework Preset**: Select **"Vite"**
2. **Root Directory**: `./` (default)
3. **Build Command**: `npm run build` (should auto-detect)
4. **Output Directory**: `dist` (should auto-detect)
5. **Install Command**: `npm install` (should auto-detect)

### 9.4 Set Environment Variables
**IMPORTANT**: Before deploying, add environment variables:

1. Click **"Environment Variables"**
2. Add these 3 variables:

   ```
   Name: VITE_APPWRITE_ENDPOINT
   Value: https://fra.cloud.appwrite.io/v1
   
   Name: VITE_APPWRITE_PROJECT_ID
   Value: 699e69bc0030937b1bee
   
   Name: VITE_APPWRITE_DATABASE_ID
   Value: 699e6e7a12471ab1b8ce
   ```

3. Make sure they're enabled for:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

4. Click **"Add"** for each

### 9.5 Deploy
1. Click **"Deploy"**
2. Wait 1-2 minutes
3. Vercel will:
   - Install dependencies
   - Build your app
   - Deploy it
4. You'll see: **"Congratulations! Your project has been deployed"**
5. **Copy your URL** (e.g., `https://droppsoft-hr.vercel.app`)

## Step 10: Test Your App

1. Click on your deployment URL
2. You should see the login page
3. ✅ Success!

## ✅ Benefits of This Approach

- ✅ **Automatic Deployments**: Every time you push to GitHub, Vercel auto-deploys
- ✅ **Version Control**: All your code is backed up
- ✅ **Easy Updates**: Just push changes to GitHub
- ✅ **Free Hosting**: Vercel free tier is generous
- ✅ **HTTPS**: Automatic SSL certificate

## 🔄 Future Updates

To update your app:
1. Make changes to your code
2. Commit: `git add .` then `git commit -m "Update message"`
3. Push: `git push`
4. Vercel automatically deploys the update!

---

**Troubleshooting**: If you get errors, check the Vercel deployment logs for details.
