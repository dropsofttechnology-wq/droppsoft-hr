import { Client, Account, Databases, Storage, Functions } from 'appwrite'

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID)

export const account = new Account(client)
export const databases = new Databases(client)
export const storage = new Storage(client)
export const functions = new Functions(client)

// Database and Collection IDs
export const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID

// Collection IDs (will be created in Appwrite)
export const COLLECTIONS = {
  COMPANIES: 'companies',
  EMPLOYEES: 'employees',
  USERS: 'users',
  ATTENDANCE: 'attendance',
  PAYROLL_RUNS: 'payroll_runs',
  FACE_DESCRIPTORS: 'face_descriptors',
  SETTINGS: 'settings',
  REPORTS: 'reports',
  AUDIT_LOG: 'audit_log'
}

export default client
