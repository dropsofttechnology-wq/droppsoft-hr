/**
 * Automated Appwrite Setup using REST API
 * This script creates all collections and configures your database
 */

import axios from 'axios'

// Your Appwrite credentials
const ENDPOINT = 'https://fra.cloud.appwrite.io/v1'
const PROJECT_ID = '699e69bc0030937b1bee'
const API_KEY = 'standard_d861ce435cf641e3b6aa6b7f9d01a43755a908dcca96de8bc9978d36544887706cf87c498501f6ac645bcf4c124b9d4aad0fc99f23941023c5acd930b9cc568481d1b8123a48f842e1b2b439a39794693b5e32921a788f3ab58dfb81635f1b9831bca27fd8ce87f2a10ba15d3bef8c853be749c49c46924c52c61d4d4290259e'

// Create axios instance with Appwrite headers
const appwrite = axios.create({
  baseURL: ENDPOINT,
  headers: {
    'X-Appwrite-Project': PROJECT_ID,
    'X-Appwrite-Key': API_KEY,
    'Content-Type': 'application/json'
  }
})

console.log('\n🚀 Droppsoft HR - Automated Appwrite Setup\n')
console.log('Setting up your Appwrite database...\n')

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function setupAppwrite() {
  try {
    // Step 1: List databases or create one
    console.log('📋 Step 1: Finding or creating database...\n')
    let dbResponse
    try {
      dbResponse = await appwrite.get('/databases')
    } catch (error) {
      console.log('Error fetching databases:', error.response?.data || error.message)
      dbResponse = { data: { databases: [] } }
    }
    
    let databaseId
    if (!dbResponse.data.databases || dbResponse.data.databases.length === 0) {
      console.log('No databases found. Creating new database...\n')
      try {
        const createDbResponse = await appwrite.post('/databases', {
          databaseId: 'unique()',
          name: 'hr_database'
        })
        databaseId = createDbResponse.data.$id
        console.log(`✅ Created database: hr_database (${databaseId})\n`)
        // Wait for database to be ready
        await sleep(1000)
      } catch (error) {
        console.log('❌ Error creating database:', error.response?.data?.message || error.message)
        console.log('   Please create a database manually in Appwrite Console')
        console.log('   Go to: https://fra.cloud.appwrite.io → Databases → Create Database\n')
        process.exit(1)
      }
    } else {
      console.log('Found databases:')
      dbResponse.data.databases.forEach(db => {
        console.log(`   - ${db.name} (ID: ${db.$id})`)
      })

      // Use the first database or find one named "hr_database"
      databaseId = dbResponse.data.databases[0].$id
      const hrDatabase = dbResponse.data.databases.find(db => 
        db.name === 'hr_database' || db.name === 'HR Database'
      )
      if (hrDatabase) {
        databaseId = hrDatabase.$id
        console.log(`\n✅ Using database: ${hrDatabase.name} (${databaseId})\n`)
      } else {
        console.log(`\n⚠️  Using first database: ${dbResponse.data.databases[0].name} (${databaseId})`)
        console.log('   (You can rename it to "hr_database" in Appwrite Console if needed)\n')
      }
    }

    // Update .env file with Database ID
    const { writeFileSync } = await import('fs')
    const envContent = `VITE_APPWRITE_ENDPOINT=${ENDPOINT}
VITE_APPWRITE_PROJECT_ID=${PROJECT_ID}
VITE_APPWRITE_DATABASE_ID=${databaseId}

VITE_FACE_API_CDN=https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.6.9/dist/face-api.min.js
VITE_FACE_MODELS_PATH=https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.6.9/model/

VITE_APP_NAME=Droppsoft HR
VITE_APP_VERSION=1.0.0
`
    writeFileSync('.env', envContent)
    console.log('✅ Updated .env file with Database ID\n')

    // Step 2: Create collections
    console.log('📋 Step 2: Creating collections...\n')

    const collections = [
      {
        id: 'companies',
        name: 'Companies',
        permissions: ['read("users")', 'write("users")'],
        attributes: [
          { key: 'name', type: 'string', size: 255, required: true },
          { key: 'registration_number', type: 'string', size: 100, required: false },
          { key: 'tax_pin', type: 'string', size: 50, required: false },
          { key: 'address', type: 'string', size: 500, required: false },
          { key: 'phone', type: 'string', size: 50, required: false },
          { key: 'email', type: 'string', size: 255, required: false },
          { key: 'logo_url', type: 'string', size: 500, required: false },
          { key: 'status', type: 'string', size: 50, required: true, default: 'active' },
          { key: 'created_at', type: 'datetime', required: true },
          { key: 'updated_at', type: 'datetime', required: true }
        ],
        indexes: [
          { key: 'status', type: 'key' }
        ]
      },
      {
        id: 'employees',
        name: 'Employees',
        permissions: ['read("users")', 'write("users")'],
        attributes: [
          { key: 'user_id', type: 'string', size: 255, required: false },
          { key: 'company_id', type: 'string', size: 255, required: true },
          { key: 'employee_id', type: 'string', size: 100, required: false },
          { key: 'staff_no', type: 'string', size: 100, required: false },
          { key: 'name', type: 'string', size: 255, required: true },
          { key: 'id_number', type: 'string', size: 50, required: false },
          { key: 'kra_pin', type: 'string', size: 50, required: false },
          { key: 'nssf_number', type: 'string', size: 50, required: false },
          { key: 'shif_number', type: 'string', size: 50, required: false },
          { key: 'department', type: 'string', size: 100, required: false },
          { key: 'position', type: 'string', size: 100, required: false },
          { key: 'basic_salary', type: 'double', required: true },
          { key: 'phone', type: 'string', size: 50, required: false },
          { key: 'email', type: 'string', size: 255, required: false },
          { key: 'bank_account', type: 'string', size: 100, required: false },
          { key: 'bank_name', type: 'string', size: 100, required: false },
          { key: 'bank_branch', type: 'string', size: 100, required: false },
          { key: 'contract_start_date', type: 'datetime', required: false },
          { key: 'contract_end_date', type: 'datetime', required: false },
          { key: 'status', type: 'string', size: 50, required: true, default: 'active' },
          { key: 'created_at', type: 'datetime', required: true },
          { key: 'updated_at', type: 'datetime', required: true }
        ],
        indexes: [
          { key: 'company_id', type: 'key' },
          { key: 'user_id', type: 'key' },
          { key: 'status', type: 'key' }
        ]
      },
      {
        id: 'attendance',
        name: 'Attendance',
        permissions: ['read("users")', 'write("users")'],
        attributes: [
          { key: 'user_id', type: 'string', size: 255, required: true },
          { key: 'company_id', type: 'string', size: 255, required: true },
          { key: 'date', type: 'string', size: 10, required: true },
          { key: 'clock_in_time', type: 'datetime', required: false },
          { key: 'clock_out_time', type: 'datetime', required: false },
          { key: 'hours_worked', type: 'double', required: false },
          { key: 'overtime_hours', type: 'double', required: false },
          { key: 'auth_method', type: 'string', size: 50, required: false },
          { key: 'location_lat', type: 'double', required: false },
          { key: 'location_lng', type: 'double', required: false },
          { key: 'location_address', type: 'string', size: 500, required: false },
          { key: 'reason', type: 'string', size: 500, required: false },
          { key: 'created_at', type: 'datetime', required: true },
          { key: 'updated_at', type: 'datetime', required: true }
        ],
        indexes: [
          { key: 'user_id', type: 'key' },
          { key: 'company_id', type: 'key' },
          { key: 'date', type: 'key' }
        ]
      },
      {
        id: 'payroll_runs',
        name: 'Payroll Runs',
        permissions: ['read("users")', 'write("users")'],
        attributes: [
          { key: 'company_id', type: 'string', size: 255, required: true },
          { key: 'employee_id', type: 'string', size: 255, required: true },
          { key: 'period', type: 'string', size: 7, required: true },
          { key: 'basic_salary', type: 'double', required: true },
          { key: 'allowances', type: 'double', required: false },
          { key: 'gross_pay', type: 'double', required: true },
          { key: 'shif_employee', type: 'double', required: false },
          { key: 'shif_employer', type: 'double', required: false },
          { key: 'nssf_employee', type: 'double', required: false },
          { key: 'nssf_employer', type: 'double', required: false },
          { key: 'ahl_employee', type: 'double', required: false },
          { key: 'ahl_employer', type: 'double', required: false },
          { key: 'taxable_pay', type: 'double', required: false },
          { key: 'paye', type: 'double', required: false },
          { key: 'other_deductions', type: 'double', required: false },
          { key: 'net_pay', type: 'double', required: true },
          { key: 'overtime_hours', type: 'double', required: false },
          { key: 'overtime_pay', type: 'double', required: false },
          { key: 'holiday_pay', type: 'double', required: false },
          { key: 'absence_deduction', type: 'double', required: false },
          { key: 'calculated_at', type: 'datetime', required: true },
          { key: 'created_at', type: 'datetime', required: true }
        ],
        indexes: [
          { key: 'company_id', type: 'key' },
          { key: 'employee_id', type: 'key' },
          { key: 'period', type: 'key' }
        ]
      },
      {
        id: 'face_descriptors',
        name: 'Face Descriptors',
        permissions: ['read("users")', 'write("users")'],
        attributes: [
          { key: 'user_id', type: 'string', size: 255, required: true },
          { key: 'company_id', type: 'string', size: 255, required: true },
          { key: 'descriptor', type: 'string', required: true },
          { key: 'quality_score', type: 'double', required: false },
          { key: 'capture_method', type: 'string', size: 50, required: false },
          { key: 'registered_at', type: 'datetime', required: true },
          { key: 'created_at', type: 'datetime', required: true }
        ],
        indexes: [
          { key: 'user_id', type: 'key', unique: true },
          { key: 'company_id', type: 'key' }
        ]
      },
      {
        id: 'settings',
        name: 'Settings',
        permissions: ['read("users")', 'write("users")'],
        attributes: [
          { key: 'company_id', type: 'string', size: 255, required: false },
          { key: 'setting_key', type: 'string', size: 100, required: true },
          { key: 'setting_value', type: 'string', size: 1000, required: true },
          { key: 'updated_at', type: 'datetime', required: true }
        ],
        indexes: [
          { key: 'company_id', type: 'key' },
          { key: 'setting_key', type: 'key' }
        ]
      },
      {
        id: 'audit_log',
        name: 'Audit Log',
        permissions: ['read("users")', 'write("users")'],
        attributes: [
          { key: 'user_id', type: 'string', size: 255, required: true },
          { key: 'company_id', type: 'string', size: 255, required: false },
          { key: 'action', type: 'string', size: 100, required: true },
          { key: 'entity_type', type: 'string', size: 100, required: false },
          { key: 'entity_id', type: 'string', size: 255, required: false },
          { key: 'old_value', type: 'string', size: 5000, required: false },
          { key: 'new_value', type: 'string', size: 5000, required: false },
          { key: 'ip_address', type: 'string', size: 50, required: false },
          { key: 'user_agent', type: 'string', size: 500, required: false },
          { key: 'created_at', type: 'datetime', required: true }
        ],
        indexes: [
          { key: 'user_id', type: 'key' },
          { key: 'company_id', type: 'key' },
          { key: 'created_at', type: 'key', order: 'desc' }
        ]
      }
    ]

    for (const collection of collections) {
      try {
        // Check if collection exists
        try {
          await appwrite.get(`/databases/${databaseId}/collections/${collection.id}`)
          console.log(`⏭️  Collection "${collection.id}" already exists, skipping...`)
          continue
        } catch (e) {
          // Collection doesn't exist, create it
        }

        console.log(`📦 Creating collection: ${collection.id}...`)

        // Create collection
        const createResponse = await appwrite.post(
          `/databases/${databaseId}/collections`,
          {
            collectionId: collection.id,
            name: collection.name,
            permissions: collection.permissions
          }
        )

        console.log(`   ✅ Collection created`)

        // Wait for collection to be ready
        await sleep(1000)

        // Add attributes
        console.log(`   📝 Adding attributes...`)
        for (const attr of collection.attributes) {
          try {
            if (attr.type === 'string') {
              await appwrite.post(
                `/databases/${databaseId}/collections/${collection.id}/attributes/string`,
                {
                  key: attr.key,
                  size: attr.size,
                  required: attr.required,
                  default: attr.default || undefined
                }
              )
            } else if (attr.type === 'double') {
              await appwrite.post(
                `/databases/${databaseId}/collections/${collection.id}/attributes/double`,
                {
                  key: attr.key,
                  required: attr.required,
                  default: attr.default || undefined
                }
              )
            } else if (attr.type === 'datetime') {
              await appwrite.post(
                `/databases/${databaseId}/collections/${collection.id}/attributes/datetime`,
                {
                  key: attr.key,
                  required: attr.required
                }
              )
            }
            // Wait for attribute to be ready
            await sleep(500)
          } catch (err) {
            if (!err.response?.data?.message?.includes('already exists')) {
              console.log(`      ⚠️  Attribute "${attr.key}": ${err.response?.data?.message || err.message}`)
            }
          }
        }

        // Wait a bit more for all attributes to be ready
        await sleep(2000)

        // Create indexes
        console.log(`   🔍 Creating indexes...`)
        for (const index of collection.indexes) {
          try {
            await appwrite.post(
              `/databases/${databaseId}/collections/${collection.id}/indexes`,
              {
                key: index.key,
                type: 'key',
                attributes: [index.key],
                orders: index.order ? [index.order] : undefined
              }
            )
            await sleep(500)
          } catch (err) {
            if (!err.response?.data?.message?.includes('already exists')) {
              console.log(`      ⚠️  Index "${index.key}": ${err.response?.data?.message || err.message}`)
            }
          }
        }

        console.log(`   ✅ Collection "${collection.id}" setup complete!\n`)
      } catch (error) {
        console.log(`   ❌ Error creating collection "${collection.id}": ${error.response?.data?.message || error.message}\n`)
      }
    }

    console.log('\n✅ Setup complete!')
    console.log(`\n📋 Database ID: ${databaseId}`)
    console.log('📋 This has been saved to your .env file\n')
    console.log('🎉 Your Appwrite database is now configured!')
    console.log('\nNext steps:')
    console.log('1. Enable Email/Password authentication in Appwrite Console')
    console.log('2. Deploy your application to Appwrite Hosting')
    console.log('3. Create your first user\n')

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data?.message || error.message)
    if (error.response?.status === 401) {
      console.error('   Authentication failed. Please check your API key.')
    } else if (error.response?.status === 404) {
      console.error('   Project or database not found. Please check your Project ID.')
    } else {
      console.error('   Full error:', error.response?.data || error)
    }
    process.exit(1)
  }
}

setupAppwrite()
