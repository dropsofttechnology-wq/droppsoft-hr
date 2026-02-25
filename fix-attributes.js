/**
 * Fix missing attributes in Appwrite collections
 */

import axios from 'axios'

const ENDPOINT = 'https://fra.cloud.appwrite.io/v1'
const PROJECT_ID = '699e69bc0030937b1bee'
const API_KEY = 'standard_d861ce435cf641e3b6aa6b7f9d01a43755a908dcca96de8bc9978d36544887706cf87c498501f6ac645bcf4c124b9d4aad0fc99f23941023c5acd930b9cc568481d1b8123a48f842e1b2b439a39794693b5e32921a788f3ab58dfb81635f1b9831bca27fd8ce87f2a10ba15d3bef8c853be749c49c46924c52c61d4d4290259e'
const DATABASE_ID = '699e6e7a12471ab1b8ce'

const appwrite = axios.create({
  baseURL: ENDPOINT,
  headers: {
    'X-Appwrite-Project': PROJECT_ID,
    'X-Appwrite-Key': API_KEY,
    'Content-Type': 'application/json'
  }
})

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fixAttributes() {
  console.log('\n🔧 Fixing missing attributes...\n')

  const fixes = [
    // Employees collection - fix double attributes
    { collection: 'employees', key: 'basic_salary', type: 'float', required: true },
    
    // Attendance collection - fix double attributes
    { collection: 'attendance', key: 'hours_worked', type: 'float', required: false },
    { collection: 'attendance', key: 'overtime_hours', type: 'float', required: false },
    { collection: 'attendance', key: 'location_lat', type: 'float', required: false },
    { collection: 'attendance', key: 'location_lng', type: 'float', required: false },
    
    // Payroll runs - fix all double attributes
    { collection: 'payroll_runs', key: 'basic_salary', type: 'float', required: true },
    { collection: 'payroll_runs', key: 'allowances', type: 'float', required: false },
    { collection: 'payroll_runs', key: 'gross_pay', type: 'float', required: true },
    { collection: 'payroll_runs', key: 'shif_employee', type: 'float', required: false },
    { collection: 'payroll_runs', key: 'shif_employer', type: 'float', required: false },
    { collection: 'payroll_runs', key: 'nssf_employee', type: 'float', required: false },
    { collection: 'payroll_runs', key: 'nssf_employer', type: 'float', required: false },
    { collection: 'payroll_runs', key: 'ahl_employee', type: 'float', required: false },
    { collection: 'payroll_runs', key: 'ahl_employer', type: 'float', required: false },
    { collection: 'payroll_runs', key: 'taxable_pay', type: 'float', required: false },
    { collection: 'payroll_runs', key: 'paye', type: 'float', required: false },
    { collection: 'payroll_runs', key: 'other_deductions', type: 'float', required: false },
    { collection: 'payroll_runs', key: 'net_pay', type: 'float', required: true },
    { collection: 'payroll_runs', key: 'overtime_hours', type: 'float', required: false },
    { collection: 'payroll_runs', key: 'overtime_pay', type: 'float', required: false },
    { collection: 'payroll_runs', key: 'holiday_pay', type: 'float', required: false },
    { collection: 'payroll_runs', key: 'absence_deduction', type: 'float', required: false },
    
    // Face descriptors - fix string and float
    { collection: 'face_descriptors', key: 'descriptor', type: 'string', size: 10000, required: true },
    { collection: 'face_descriptors', key: 'quality_score', type: 'float', required: false }
  ]

  for (const fix of fixes) {
    try {
      // Check if attribute already exists
      try {
        await appwrite.get(`/databases/${DATABASE_ID}/collections/${fix.collection}/attributes/${fix.key}`)
        console.log(`⏭️  Attribute "${fix.key}" in "${fix.collection}" already exists`)
        continue
      } catch (e) {
        // Attribute doesn't exist, create it
      }

      console.log(`📝 Creating attribute "${fix.key}" in "${fix.collection}"...`)

      if (fix.type === 'float') {
        await appwrite.post(
          `/databases/${DATABASE_ID}/collections/${fix.collection}/attributes/float`,
          {
            key: fix.key,
            required: fix.required
          }
        )
      } else if (fix.type === 'string') {
        await appwrite.post(
          `/databases/${DATABASE_ID}/collections/${fix.collection}/attributes/string`,
          {
            key: fix.key,
            size: fix.size,
            required: fix.required
          }
        )
      }

      console.log(`   ✅ Created`)
      await sleep(1000) // Wait for attribute to be ready
    } catch (error) {
      if (error.response?.data?.message?.includes('already exists')) {
        console.log(`   ⏭️  Already exists`)
      } else {
        console.log(`   ⚠️  Error: ${error.response?.data?.message || error.message}`)
      }
    }
  }

  console.log('\n✅ Attribute fixes complete!\n')
  console.log('Note: Some attributes may take a few seconds to be ready.')
  console.log('You can verify them in Appwrite Console.\n')
}

fixAttributes()
