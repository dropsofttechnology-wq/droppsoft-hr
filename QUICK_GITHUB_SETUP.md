# ⚡ Quick GitHub Setup Guide

## Fast Track (5 Minutes)

### Step 1: Initialize Git (1 min)

Open PowerShell in your project folder:

```powershell
cd C:\DROPPSOFT_HR
git init
git add .
git commit -m "Initial commit: Droppsoft HR"
```

**OR** run the script:
```powershell
.\setup-github.ps1
```

### Step 2: Create GitHub Repository (2 min)

1. Go to: https://github.com
2. Click **"+"** → **"New repository"**
3. Name: `droppsoft-hr`
4. **DO NOT** check "Initialize with README"
5. Click **"Create repository"**
6. **Copy the repository URL** (looks like: `https://github.com/your-username/droppsoft-hr.git`)

### Step 3: Connect & Push (2 min)

Back in PowerShell:

```powershell
# Replace with YOUR repository URL
git remote add origin https://github.com/your-username/droppsoft-hr.git
git branch -M main
git push -u origin main
```

**If asked for credentials:**
- Username: Your GitHub username
- Password: Use a **Personal Access Token** (not your password)
  - Get token: GitHub → Settings → Developer settings → Personal access tokens → Generate new token
  - Select scope: `repo`
  - Copy token and use as password

### Step 4: Connect to Vercel (3 min)

1. Go to: https://vercel.com
2. Sign up with GitHub (easiest!)
3. Click **"Add New Project"**
4. Find your `droppsoft-hr` repository
5. Click **"Import"**
6. **Framework**: Select **"Vite"**
7. **Environment Variables**: Add these 3:
   ```
   VITE_APPWRITE_ENDPOINT = https://fra.cloud.appwrite.io/v1
   VITE_APPWRITE_PROJECT_ID = 699e69bc0030937b1bee
   VITE_APPWRITE_DATABASE_ID = 699e6e7a12471ab1b8ce
   ```
8. Click **"Deploy"**
9. Wait 1-2 minutes
10. ✅ Done! Your app is live!

## ✅ That's It!

Your app is now:
- ✅ On GitHub (backed up)
- ✅ Deployed on Vercel (live)
- ✅ Auto-deploys on every push

---

**Need more details?** See `GITHUB_TO_VERCEL.md` for complete guide.
