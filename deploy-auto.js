/**
 * Automated Deployment Script
 * This script helps automate the deployment process
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'

console.log('\n🚀 Droppsoft HR - Automated Deployment Helper\n')
console.log('This script will help you deploy to Appwrite.\n')

// Check if .env exists and has real values
const envPath = '.env'
let needsConfig = false

if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8')
  if (envContent.includes('your-project-id-here') || envContent.includes('your-database-id-here')) {
    needsConfig = true
    console.log('⚠️  .env file needs to be configured with your Appwrite credentials.\n')
  } else {
    console.log('✅ .env file appears to be configured.\n')
  }
} else {
  console.log('⚠️  .env file not found. Creating template...\n')
  writeFileSync(envPath, `VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your-project-id-here
VITE_APPWRITE_DATABASE_ID=your-database-id-here

VITE_FACE_API_CDN=https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.6.9/dist/face-api.min.js
VITE_FACE_MODELS_PATH=https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.6.9/model/

VITE_APP_NAME=Droppsoft HR
VITE_APP_VERSION=1.0.0
`)
  needsConfig = true
}

// Check if dist folder exists
const distPath = 'dist'
if (!existsSync(distPath)) {
  console.log('📦 Building application...\n')
  try {
    execSync('npm run build', { stdio: 'inherit' })
    console.log('\n✅ Build successful!\n')
  } catch (error) {
    console.log('\n❌ Build failed. Please fix errors and try again.\n')
    process.exit(1)
  }
} else {
  console.log('✅ Production build exists in dist/ folder.\n')
}

// List files ready for deployment
console.log('📁 Files ready for deployment:\n')
try {
  const distFiles = readdirSync(distPath, { recursive: true })
  distFiles.forEach(file => {
    const filePath = join(distPath, file)
    if (statSync(filePath).isFile()) {
      const size = statSync(filePath).size
      console.log(`   ${file} (${(size / 1024).toFixed(2)} KB)`)
    }
  })
} catch (error) {
  console.log('   Error reading dist folder')
}

console.log('\n' + '='.repeat(60))
console.log('📋 DEPLOYMENT INSTRUCTIONS')
console.log('='.repeat(60) + '\n')

if (needsConfig) {
  console.log('STEP 1: Configure Appwrite Credentials\n')
  console.log('1. Go to https://cloud.appwrite.io')
  console.log('2. Create/Open your project')
  console.log('3. Copy your Project ID')
  console.log('4. Create database and copy Database ID')
  console.log('5. Update .env file with your credentials\n')
}

console.log('STEP 2: Create Collections in Appwrite\n')
console.log('You need to create 7 collections manually in Appwrite Console:')
console.log('  1. companies')
console.log('  2. employees')
console.log('  3. attendance')
console.log('  4. payroll_runs')
console.log('  5. face_descriptors')
console.log('  6. settings')
console.log('  7. audit_log (optional)')
console.log('\nSee COLLECTIONS_SETUP.md for detailed attributes.\n')

console.log('STEP 3: Deploy to Appwrite Hosting\n')
console.log('1. Go to Appwrite Console → Hosting')
console.log('2. Click "Add Platform" → "Web App"')
console.log('3. Name: Droppsoft HR')
console.log('4. Upload ALL files from:')
console.log(`   ${join(process.cwd(), distPath)}`)
console.log('5. Set environment variables:')
console.log('   - VITE_APPWRITE_ENDPOINT')
console.log('   - VITE_APPWRITE_PROJECT_ID')
console.log('   - VITE_APPWRITE_DATABASE_ID')
console.log('6. Click Deploy\n')

console.log('STEP 4: Create First User\n')
console.log('1. Appwrite Console → Auth → Users')
console.log('2. Click "Create User"')
console.log('3. Enter email and password')
console.log('4. Click Create\n')

console.log('✅ Deployment files are ready!')
console.log('📚 See DEPLOY_ACTION_PLAN.md for detailed step-by-step instructions.\n')
