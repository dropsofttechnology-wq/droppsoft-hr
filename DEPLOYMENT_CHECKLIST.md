# Deployment Checklist

Use this checklist to ensure everything is set up correctly before deploying.

## Pre-Deployment Checklist

### Appwrite Setup
- [ ] Created Appwrite project
- [ ] Copied Project ID
- [ ] Created database
- [ ] Copied Database ID
- [ ] Created all 7 collections:
  - [ ] `companies`
  - [ ] `employees`
  - [ ] `attendance`
  - [ ] `payroll_runs`
  - [ ] `face_descriptors`
  - [ ] `settings`
  - [ ] `audit_log` (optional)
- [ ] Added all required attributes to each collection
- [ ] Created indexes for each collection
- [ ] Set permissions (Read/Write for `users` role)
- [ ] Enabled Email/Password authentication

### Local Configuration
- [ ] Created `.env` file from `.env.example`
- [ ] Added `VITE_APPWRITE_ENDPOINT`
- [ ] Added `VITE_APPWRITE_PROJECT_ID`
- [ ] Added `VITE_APPWRITE_DATABASE_ID`
- [ ] Verified all environment variables are correct

### Build & Test
- [ ] Ran `npm install`
- [ ] Ran `npm run build` (successful)
- [ ] Tested locally with `npm run dev`
- [ ] Verified connection to Appwrite
- [ ] Tested login functionality
- [ ] Tested creating company
- [ ] Tested adding employee

### Deployment
- [ ] Chosen hosting platform (Appwrite/Vercel/Netlify/etc.)
- [ ] Built production files (`npm run build`)
- [ ] Uploaded `dist` folder contents
- [ ] Set environment variables in hosting platform
- [ ] Deployed application
- [ ] Got deployment URL

### Post-Deployment Testing
- [ ] Accessed deployed application
- [ ] Created first user (via Appwrite Console or registration)
- [ ] Logged in successfully
- [ ] Created first company
- [ ] Added first employee
- [ ] Tested face enrollment
- [ ] Tested attendance terminal
- [ ] Tested payroll processing
- [ ] Tested report generation

## Quick Commands

```bash
# Install dependencies
npm install

# Check Appwrite setup
npm run check:appwrite

# Build for production
npm run build

# Test locally
npm run dev
```

## Troubleshooting

If something doesn't work:

1. **Check environment variables** - Verify `.env` file and hosting platform
2. **Check Appwrite Console** - Verify collections and permissions
3. **Check browser console** - Look for JavaScript errors
4. **Check network tab** - Verify API calls are successful
5. **Review logs** - Check Appwrite logs for errors

## Support Resources

- **Deployment Guide**: `DEPLOYMENT_GUIDE.md`
- **Quick Deploy**: `QUICK_DEPLOY.md`
- **Appwrite Docs**: https://appwrite.io/docs
- **Schema Reference**: `docs/appwrite-schema.md`

---

**Ready to deploy?** Follow `QUICK_DEPLOY.md` for step-by-step instructions!
