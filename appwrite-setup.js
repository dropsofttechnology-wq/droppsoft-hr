/**
 * Appwrite Setup Script
 * 
 * This script helps verify your Appwrite configuration
 * Run: node appwrite-setup.js
 */

import { Client, Databases, Query } from 'appwrite'
import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') })

const ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1'
const PROJECT_ID = process.env.VITE_APPWRITE_PROJECT_ID
const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID

const COLLECTIONS = {
  COMPANIES: 'companies',
  EMPLOYEES: 'employees',
  ATTENDANCE: 'attendance',
  PAYROLL_RUNS: 'payroll_runs',
  FACE_DESCRIPTORS: 'face_descriptors',
  SETTINGS: 'settings',
  AUDIT_LOG: 'audit_log'
}

async function checkSetup() {
  console.log('🔍 Checking Appwrite Setup...\n')

  // Check environment variables
  if (!PROJECT_ID) {
    console.error('❌ VITE_APPWRITE_PROJECT_ID is not set in .env file')
    return false
  }

  if (!DATABASE_ID) {
    console.error('❌ VITE_APPWRITE_DATABASE_ID is not set in .env file')
    return false
  }

  console.log('✅ Environment variables configured')
  console.log(`   Endpoint: ${ENDPOINT}`)
  console.log(`   Project ID: ${PROJECT_ID}`)
  console.log(`   Database ID: ${DATABASE_ID}\n`)

  // Initialize Appwrite client
  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)

  const databases = new Databases(client)

  try {
    // Check database exists
    console.log('📊 Checking database...')
    const db = await databases.get(DATABASE_ID)
    console.log(`✅ Database found: ${db.name}\n`)

    // Check collections
    console.log('📁 Checking collections...')
    const requiredCollections = Object.values(COLLECTIONS)
    const existingCollections = await databases.listCollections(DATABASE_ID)

    const existingIds = existingCollections.collections.map(c => c.$id)

    for (const collectionId of requiredCollections) {
      if (existingIds.includes(collectionId)) {
        console.log(`✅ Collection found: ${collectionId}`)
      } else {
        console.log(`❌ Collection missing: ${collectionId}`)
        console.log(`   Please create this collection in Appwrite Console`)
      }
    }

    console.log('\n✅ Setup check complete!')
    console.log('\n📝 Next steps:')
    console.log('   1. Create any missing collections')
    console.log('   2. Set up collection attributes (see DEPLOYMENT_GUIDE.md)')
    console.log('   3. Configure collection permissions')
    console.log('   4. Build and deploy the application')

    return true
  } catch (error) {
    console.error('\n❌ Error connecting to Appwrite:')
    console.error(`   ${error.message}`)
    console.error('\n💡 Troubleshooting:')
    console.error('   1. Verify your Project ID is correct')
    console.error('   2. Verify your Database ID is correct')
    console.error('   3. Check your Appwrite endpoint URL')
    console.error('   4. Ensure your Appwrite project is active')
    return false
  }
}

// Run check
checkSetup().catch(console.error)
