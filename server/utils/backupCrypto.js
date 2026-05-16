import crypto from 'crypto'

/** 8-byte magic for Dropsoft HR encrypted backup v1 */
export const BACKUP_MAGIC = Buffer.from('DSHRBKE1', 'utf8')

const SALT_LEN = 16
const IV_LEN = 12
const TAG_LEN = 16
const KEY_LEN = 32

/**
 * @param {Buffer} buf
 */
export function isEncryptedBackup(buf) {
  return buf.length >= BACKUP_MAGIC.length && buf.subarray(0, BACKUP_MAGIC.length).equals(BACKUP_MAGIC)
}

/**
 * @param {Buffer} plainZip
 * @param {string} password
 */
export function encryptBackupZip(plainZip, password) {
  const salt = crypto.randomBytes(SALT_LEN)
  const key = crypto.scryptSync(String(password), salt, KEY_LEN)
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plainZip), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([BACKUP_MAGIC, salt, iv, ciphertext, tag])
}

/**
 * @param {Buffer} encBuf
 * @param {string} password
 * @returns {Buffer} zip bytes
 */
export function decryptBackupToZip(encBuf, password) {
  if (!isEncryptedBackup(encBuf)) {
    throw new Error('Not an encrypted Dropsoft HR backup file')
  }
  const minLen = BACKUP_MAGIC.length + SALT_LEN + IV_LEN + TAG_LEN + 1
  if (encBuf.length < minLen) {
    throw new Error('Backup file is too small or corrupted')
  }
  let p = BACKUP_MAGIC.length
  const salt = encBuf.subarray(p, p + SALT_LEN)
  p += SALT_LEN
  const iv = encBuf.subarray(p, p + IV_LEN)
  p += IV_LEN
  const tag = encBuf.subarray(encBuf.length - TAG_LEN)
  const ciphertext = encBuf.subarray(p, encBuf.length - TAG_LEN)
  const key = crypto.scryptSync(String(password), salt, KEY_LEN)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}
