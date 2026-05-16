import nodemailer from 'nodemailer'
import { resolveSchoolTranscriptMailProfile } from './schoolEmailSettings.js'

/**
 * Nodemailer transport built from `school_email_settings` with fallback to shared SMTP settings.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} companyId
 */
export function createSchoolEmailTransporter(db, companyId) {
  const profile = resolveSchoolTranscriptMailProfile(db, companyId)
  const { smtp } = profile
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass || '' } : undefined
  })
  return { transporter, profile }
}

/**
 * @param {{ host: string, port: number, secure: boolean, user: string, pass: string, from?: string }} smtp
 */
export function createTransportFromSmtp(smtp) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass || '' } : undefined
  })
}
