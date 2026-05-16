import { createPrivateKey, createPublicKey, sign, verify } from 'crypto'
import { EMBEDDED_LICENSE_PUBLIC_KEY_PEM } from '../config/licensePublicKey.js'

export const LICENSE_TOKEN_PREFIX = 'DHR1'
export const LICENSE_PAYLOAD_VERSION = 1

const PLANS = new Set(['monthly', 'quarterly', 'yearly'])

/**
 * Deterministic JSON for signing (sorted keys, shallow object — values must be JSON-serializable).
 * @param {Record<string, unknown>} obj
 */
export function canonicalStringify(obj) {
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(obj[k])}`).join(',')}}`
}

function base64UrlToBuffer(s) {
  let b = String(s).replace(/-/g, '+').replace(/_/g, '/')
  while (b.length % 4) b += '='
  return Buffer.from(b, 'base64')
}

export function bufferToBase64Url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * @param {Record<string, unknown>} payload
 */
export function validateLicensePayload(payload) {
  if (payload.v !== LICENSE_PAYLOAD_VERSION) {
    throw new Error(`Unsupported license version (expected ${LICENSE_PAYLOAD_VERSION})`)
  }
  const dep = payload.deployment_id
  const lid = payload.license_id
  const planRaw = payload.plan
  if (typeof dep !== 'string' || !dep.trim()) {
    throw new Error('License missing deployment_id')
  }
  if (typeof lid !== 'string' || !lid.trim()) {
    throw new Error('License missing license_id')
  }
  if (typeof planRaw !== 'string' || !PLANS.has(planRaw.toLowerCase().trim())) {
    throw new Error('License plan must be monthly, quarterly, or yearly')
  }
  const stackFalse = payload.stack === false
  const hasEnd = typeof payload.valid_until === 'string' && payload.valid_until.trim()
  const hasStart = typeof payload.period_start === 'string' && payload.period_start.trim()
  if (stackFalse && !hasEnd && !hasStart) {
    throw new Error('When stack=false, include period_start or valid_until')
  }
}

/**
 * @param {string} publicKeyPem
 * @param {string} token — format DHR1.<base64url(payload)>.<base64url(sig)>
 * @returns {Record<string, unknown>}
 */
export function verifyLicenseToken(publicKeyPem, token) {
  const trimmed = String(token || '').trim()
  const parts = trimmed.split('.')
  if (parts.length !== 3 || parts[0] !== LICENSE_TOKEN_PREFIX) {
    throw new Error('Invalid license format (expected DHR1.*)')
  }
  const payloadJson = base64UrlToBuffer(parts[1]).toString('utf8')
  const signature = base64UrlToBuffer(parts[2])
  const pub = createPublicKey(publicKeyPem)
  const ok = verify(null, Buffer.from(payloadJson, 'utf8'), pub, signature)
  if (!ok) {
    throw new Error('Invalid license signature')
  }
  /** @type {Record<string, unknown>} */
  const payload = JSON.parse(payloadJson)
  validateLicensePayload(payload)
  return payload
}

/**
 * @param {string} privateKeyPem PKCS8 PEM
 * @param {Record<string, unknown>} payloadObj — fields normalized before stringify
 * @returns {string}
 */
export function signLicenseToken(privateKeyPem, payloadObj) {
  const payloadJson = canonicalStringify(payloadObj)
  const key = createPrivateKey(privateKeyPem)
  const sig = sign(null, Buffer.from(payloadJson, 'utf8'), key)
  const mid = bufferToBase64Url(Buffer.from(payloadJson, 'utf8'))
  const end = bufferToBase64Url(sig)
  return `${LICENSE_TOKEN_PREFIX}.${mid}.${end}`
}

/**
 * Resolve public key PEM: env overrides embedded dev key.
 */
export function getLicensePublicKeyPem() {
  const fromEnv = process.env.LICENSE_PUBLIC_KEY_ED25519_PEM
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).trim()
  }
  return EMBEDDED_LICENSE_PUBLIC_KEY_PEM.trim()
}
