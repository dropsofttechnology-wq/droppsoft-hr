/**
 * Interactive Deployment Helper
 * Run: node deploy-interactive.js
 */

import readline from 'readline'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

async function deploy() {
  console.log('\n🚀 Droppsoft HR - Interactive Deployment Helper\n')
  console.log('This will help you configure and deploy your application.\n')

  // Step 1: Get Appwrite credentials
  console.log('📋 Step 1: Appwrite Configuration\n')
  console.log('You need to get these from your Appwrite Console:')
  console.log('  - Project ID: https://cloud.appwrite.io → Your Project → Settings')
  console.log('  - Database ID: https://cloud.appwrite.io → Databases → Your Database\n')

  const endpoint = await question('Appwrite Endpoint [https://cloud.appwrite.io/v1]: ') || 'https://cloud.appwrite.io/v1'
  const projectId = await question('Project ID: ')
  const databaseId = await question('Database ID: ')

  if (!projectId || !databaseId) {
    console.log('\n❌ Project ID and Database ID are required!')
    rl.close()
    return
  }

  // Update .env file
  console.log('\n📝 Updating .env file...')
  const envContent = `VITE_APPWRITE_ENDPOINT=${endpoint}
VITE_APPWRITE_PROJECT_ID=${projectId}
VITE_APPWRITE_DATABASE_ID=${databaseId}

VITE_FACE_API_CDN=https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.6.9/dist/face-api.min.js
VITE_FACE_MODELS_PATH=https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.6.9/model/

VITE_APP_NAME=Droppsoft HR
VITE_APP_VERSION=1.0.0
`

  writeFileSync('.env', envContent)
  console.log('✅ .env file updated!\n')

  // Step 2: Check collections
  console.log('📋 Step 2: Appwrite Collections\n')
  console.log('⚠️  IMPORTANT: You need to create 7 collections in Appwrite:\n')
  console.log('  1. companies')
  console.log('  2. employees')
  console.log('  3. attendance')
  console.log('  4. payroll_runs')
  console.log('  5. face_descriptors')
  console.log('  6. settings')
  console.log('  7. audit_log (optional)\n')
  console.log('See COLLECTIONS_SETUP.md for detailed attributes.\n')

  const collectionsReady = await question('Have you created all collections? (yes/no): ')
  
  if (collectionsReady.toLowerCase() !== 'yes') {
    console.log('\n⚠️  Please create the collections first, then run this script again.')
    console.log('   See COLLECTIONS_SETUP.md for instructions.\n')
    rl.close()
    return
  }

  // Step 3: Build
  console.log('\n📋 Step 3: Building Application\n')
  const buildNow = await question('Build the application now? (yes/no): ')

  if (buildNow.toLowerCase() === 'yes') {
    try {
      console.log('\n🔨 Building... This may take a minute...\n')
      execSync('npm run build', { stdio: 'inherit' })
      console.log('\n✅ Build successful! Production files are in the dist/ folder.\n')
    } catch (error) {
      console.log('\n❌ Build failed. Please check the errors above.')
      rl.close()
      return
    }
  } else {
    console.log('\n⚠️  Skipping build. Run "npm run build" manually when ready.\n')
  }

  // Step 4: Deployment options
  console.log('📋 Step 4: Deployment Options\n')
  console.log('Your application is ready to deploy!\n')
  console.log('Choose your hosting platform:')
  console.log('  1. Appwrite Hosting (Recommended)')
  console.log('  2. Vercel')
  console.log('  3. Netlify')
  console.log('  4. Other (manual upload)\n')

  const deployOption = await question('Select option (1-4): ')

  switch (deployOption) {
    case '1':
      console.log('\n📤 Appwrite Hosting Instructions:\n')
      console.log('1. Go to Appwrite Console → Hosting')
      console.log('2. Click "Add Platform" → "Web App"')
      console.log('3. Name: Droppsoft HR')
      console.log('4. Upload all files from: C:\\DROPPSOFT_HR\\dist')
      console.log('5. Set environment variables:')
      console.log('   - VITE_APPWRITE_ENDPOINT')
      console.log('   - VITE_APPWRITE_PROJECT_ID')
      console.log('   - VITE_APPWRITE_DATABASE_ID')
      console.log('6. Click Deploy\n')
      break
    case '2':
      console.log('\n📤 Vercel Deployment:\n')
      console.log('Run these commands:')
      console.log('  npm install -g vercel')
      console.log('  vercel --prod\n')
      console.log('Add environment variables in Vercel dashboard.\n')
      break
    case '3':
      console.log('\n📤 Netlify Deployment:\n')
      console.log('Run these commands:')
      console.log('  npm install -g netlify-cli')
      console.log('  netlify deploy --prod --dir=dist\n')
      console.log('Add environment variables in Netlify dashboard.\n')
      break
    case '4':
      console.log('\n📤 Manual Upload:\n')
      console.log('Upload all files from: C:\\DROPPSOFT_HR\\dist')
      console.log('to your static hosting service.\n')
      console.log('Make sure to set environment variables in your hosting platform.\n')
      break
  }

  // Step 5: Create first user
  console.log('📋 Step 5: Create First User\n')
  console.log('After deployment, create your first user:')
  console.log('1. Go to Appwrite Console → Auth → Users')
  console.log('2. Click "Create User"')
  console.log('3. Enter email and password')
  console.log('4. Click Create\n')

  console.log('✅ Deployment configuration complete!\n')
  console.log('🎉 Your application is ready to deploy!\n')
  console.log('Next: Follow the deployment instructions above.\n')

  rl.close()
}

deploy().catch(console.error)
