# 📤 Step 2: Deploy Application Files - Detailed Guide

## Where to Find It in Appwrite Console

**Location**: **"Sites"** or **"Hosting"** (depending on your Appwrite version)

### Navigation Path:
1. Go to: https://fra.cloud.appwrite.io
2. Login to your project
3. In the left sidebar, look for:
   - **"Sites"** (newer versions) OR
   - **"Hosting"** (older versions)
4. Click on it

## Step-by-Step Deployment

### 1. Create New Site/Platform
- Click **"Add Platform"** or **"Create Site"** button
- Select **"Web App"** as the platform type
- Name it: `Droppsoft HR` (or any name you prefer)

### 2. Upload Files
You have two options:

#### Option A: Upload Files Directly
- Click **"Upload Files"** or **"Deploy"** button
- Navigate to: `C:\DROPPSOFT_HR\dist`
- **Select ALL files and folders**:
  - `index.html`
  - `vite.svg`
  - `assets/` folder (with all files inside)
- Upload them

#### Option B: Drag and Drop
- Open File Explorer
- Navigate to: `C:\DROPPSOFT_HR\dist`
- Select all files (Ctrl+A)
- Drag and drop them into the Appwrite upload area

### 3. Set Environment Variables
After uploading, you need to set environment variables:

1. Look for **"Environment Variables"** or **"Env"** section
2. Add these 3 variables:

   ```
   VITE_APPWRITE_ENDPOINT = https://fra.cloud.appwrite.io/v1
   VITE_APPWRITE_PROJECT_ID = 699e69bc0030937b1bee
   VITE_APPWRITE_DATABASE_ID = 699e6e7a12471ab1b8ce
   ```

3. Save the environment variables

### 4. Deploy
- Click **"Deploy"** or **"Save"** button
- Wait for deployment to complete (usually 1-2 minutes)
- You'll see a success message

### 5. Get Your URL
- Once deployed, you'll see your site URL
- It will look like: `https://your-site-name.appwrite.io` or similar
- **Copy this URL** - this is your application URL!

## ✅ Verification

After deployment:
1. Click on your site URL to open it
2. You should see the login page
3. If you see the login page, deployment was successful!

## 🆘 Troubleshooting

**Can't find "Sites" or "Hosting"?**
- Make sure you're in the correct project
- Check if your Appwrite plan includes hosting
- Some plans may not have hosting enabled

**Files won't upload?**
- Make sure you're uploading from the `dist` folder
- Check file sizes (should be small)
- Try uploading one file at a time if batch fails

**Environment variables not working?**
- Make sure variable names start with `VITE_`
- Check for typos in the values
- Redeploy after setting variables

---

**Next**: After deployment, go to Step 3 (Create First User)
