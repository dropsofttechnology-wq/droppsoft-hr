# 🚀 Quick Deploy to Vercel (5 Minutes)

## Why Vercel?
- ✅ Free hosting
- ✅ Perfect for React apps
- ✅ Easy deployment
- ✅ Automatic HTTPS
- ✅ Works with Appwrite

## Step-by-Step

### 1. Create Vercel Account (1 min)
1. Go to: https://vercel.com
2. Click **"Sign Up"**
3. Sign up with GitHub, Google, or Email
4. Verify your email if needed

### 2. Deploy Your App (3 min)

#### Option A: Drag & Drop (Easiest)
1. In Vercel dashboard, click **"Add New Project"**
2. Click **"Upload"** or look for drag-and-drop area
3. Open File Explorer
4. Navigate to: `C:\DROPPSOFT_HR\dist`
5. **Select ALL files** (Ctrl+A):
   - `index.html`
   - `vite.svg`
   - `assets` folder
6. Drag them into Vercel upload area
7. Wait for upload

#### Option B: Import from Folder
1. Click **"Add New Project"**
2. Click **"Import"** or **"Upload"**
3. Browse to: `C:\DROPPSOFT_HR\dist`
4. Select all files
5. Upload

### 3. Configure Project (1 min)
1. **Project Name**: `droppsoft-hr` (or any name)
2. **Framework Preset**: Select **"Other"** or **"Vite"**
3. **Root Directory**: Leave as is (or set to `/`)

### 4. Set Environment Variables (Important!)
1. Before deploying, click **"Environment Variables"** or **"Advanced"**
2. Add these 3 variables:

   ```
   Name: VITE_APPWRITE_ENDPOINT
   Value: https://fra.cloud.appwrite.io/v1
   
   Name: VITE_APPWRITE_PROJECT_ID
   Value: 699e69bc0030937b1bee
   
   Name: VITE_APPWRITE_DATABASE_ID
   Value: 699e6e7a12471ab1b8ce
   ```

3. Click **"Add"** for each variable
4. Make sure they're set for **Production**, **Preview**, and **Development**

### 5. Deploy
1. Click **"Deploy"** button
2. Wait 1-2 minutes
3. You'll see: **"Congratulations! Your project has been deployed"**
4. **Copy your URL** (e.g., `https://droppsoft-hr.vercel.app`)

### 6. Test Your App
1. Click on your deployment URL
2. You should see the login page
3. ✅ Success!

## ✅ You're Live!

Your app is now deployed and accessible worldwide!

## Next Steps
1. Enable Email/Password auth in Appwrite (if not done)
2. Create your first user in Appwrite
3. Login to your app and start using it!

---

**Note**: Vercel gives you a free subdomain. You can also add your own custom domain later.
