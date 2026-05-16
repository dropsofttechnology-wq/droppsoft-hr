/**
 * Ed25519 public key (SPKI PEM) used to verify offline LAN license tokens (`DHR1.*`).
 * Override with env LICENSE_PUBLIC_KEY_ED25519_PEM for production keys.
 *
 * Dev keypair generated locally for testing only — replace in production.
 */
export const EMBEDDED_LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAHma6ATonOtIYEmb3ehJjkxoLHLuzV4vRNl7u8Z7tGWs=
-----END PUBLIC KEY-----
`
