/**
 * Update .env file and run Appwrite setup
 */

import { writeFileSync } from 'fs'

// Your Appwrite credentials
const ENDPOINT = 'https://fra.cloud.appwrite.io/v1'
const PROJECT_ID = '699e69bc0030937b1bee'

// Update .env file
const envContent = `VITE_APPWRITE_ENDPOINT=${ENDPOINT}
VITE_APPWRITE_PROJECT_ID=${PROJECT_ID}
VITE_APPWRITE_DATABASE_ID=your-database-id-here

VITE_FACE_API_CDN=https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.6.9/dist/face-api.min.js
VITE_FACE_MODELS_PATH=https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.6.9/model/

VITE_APP_NAME=Droppsoft HR
VITE_APP_VERSION=1.0.0
`

writeFileSync('.env', envContent)
console.log('✅ .env file updated with your Appwrite credentials\n')

// Now run the setup
import('./appwrite-auto-setup.js')
