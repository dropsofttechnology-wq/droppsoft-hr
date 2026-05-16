import { describe, it, expect } from 'vitest'
import { parsePairingPayload, isLoopbackApiUrl, isEmulatorBridgeHostUrl } from './pairingQr'

describe('parsePairingPayload', () => {
  it('returns null for empty input', () => {
    expect(parsePairingPayload(null)).toBeNull()
    expect(parsePairingPayload('')).toBeNull()
    expect(parsePairingPayload('   ')).toBeNull()
  })

  it('parses JSON dropsoftHrApi (pairing QR payload)', () => {
    const raw = JSON.stringify({ dropsoftHrApi: 'http://192.168.1.50:32100', v: 1 })
    expect(parsePairingPayload(raw)).toBe('http://192.168.1.50:32100')
  })

  it('parses alternate JSON keys to origin only', () => {
    expect(parsePairingPayload(JSON.stringify({ hrApiBase: 'https://hr.local:8443/api/foo' }))).toBe(
      'https://hr.local:8443'
    )
    expect(parsePairingPayload(JSON.stringify({ api: 'http://10.0.2.2:32100' }))).toBe('http://10.0.2.2:32100')
    expect(parsePairingPayload(JSON.stringify({ baseUrl: 'http://192.168.0.1:9000' }))).toBe('http://192.168.0.1:9000')
  })

  it('parses plain http(s) URL to origin', () => {
    expect(parsePairingPayload('http://192.168.1.10:32100')).toBe('http://192.168.1.10:32100')
    expect(parsePairingPayload('http://192.168.1.10:32100/api/health')).toBe('http://192.168.1.10:32100')
    expect(parsePairingPayload('https://server.example.com:443/path')).toBe('https://server.example.com')
  })

  it('parses dropsofthr:// deep link with url query', () => {
    const encoded = encodeURIComponent('http://192.168.1.5:32100')
    expect(parsePairingPayload(`dropsofthr://?url=${encoded}`)).toBe('http://192.168.1.5:32100')
  })

  it('returns null for non-URL garbage', () => {
    expect(parsePairingPayload('hello world')).toBeNull()
    expect(parsePairingPayload('ftp://example.com')).toBeNull()
  })
})

describe('isLoopbackApiUrl', () => {
  it('detects loopback hosts', () => {
    expect(isLoopbackApiUrl('http://127.0.0.1:32100')).toBe(true)
    expect(isLoopbackApiUrl('http://localhost:32100')).toBe(true)
    expect(isLoopbackApiUrl('http://192.168.1.5:32100')).toBe(false)
  })
  it('returns false for empty', () => {
    expect(isLoopbackApiUrl('')).toBe(false)
  })
})

describe('isEmulatorBridgeHostUrl', () => {
  it('detects 10.0.2.2', () => {
    expect(isEmulatorBridgeHostUrl('http://10.0.2.2:32100')).toBe(true)
    expect(isEmulatorBridgeHostUrl('http://192.168.0.1:32100')).toBe(false)
  })
})
