import { Client, Account, Databases, Storage, Functions } from 'appwrite'

// Use env endpoint as-is so self-hosted HTTP (e.g. LAN) works; default to Cloud HTTPS
const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1'
const endpointUrl = endpoint.trim()

// Suppress Appwrite localStorage warnings (they're just informational)
const originalWarn = console.warn
console.warn = (...args) => {
  // Filter out Appwrite localStorage warnings
  if (args[0]?.includes?.('localStorage for session management')) {
    return // Suppress this specific warning
  }
  originalWarn.apply(console, args)
}

const client = new Client()
  .setEndpoint(endpointUrl)
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
  AUDIT_LOG: 'audit_log',
  HOLIDAYS: 'holidays',
  LEAVE_REQUESTS: 'leave_requests',
  LEAVE_TYPES: 'leave_types',
  BANKS: 'banks',
  PERIOD_CLOSURES: 'period_closures',
  EMPLOYEE_DEDUCTIONS: 'employee_deductions',
  EXPENSE_CATEGORIES: 'expense_categories',
  EXPENSE_SUPPLIERS: 'expense_suppliers',
  OPERATIONAL_EXPENSES: 'operational_expenses'
}

export default client
