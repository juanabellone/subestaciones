// Auth con HMAC-SHA256 — compatible con Edge Runtime (middleware) y Node.js

export const COOKIE_NAME = 'session'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

interface SessionPayload {
  role: 'admin' | 'client'
  email: string
  exp: number
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET no configurado')
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

// Solo se usa para ArrayBuffer (resultado de crypto.subtle.sign)
function arrayBufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64urlToUint8Array(str: string): Uint8Array<ArrayBuffer> {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const binary = atob(padded)
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function encryptSession(role: 'admin' | 'client', email: string): Promise<string> {
  const payload: SessionPayload = { role, email, exp: Date.now() + SESSION_DURATION_MS }
  // Usamos btoa directamente sobre el JSON (sin pasar por Uint8Array)
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  const key = await getKey()
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64))
  return `${payloadB64}.${arrayBufferToBase64url(sig)}`
}

export async function decryptSession(token: string): Promise<SessionPayload | null> {
  try {
    const [payloadB64, sigB64] = token.split('.')
    if (!payloadB64 || !sigB64) return null
    const key = await getKey()
    const valid = await crypto.subtle.verify(
      'HMAC', key,
      base64urlToUint8Array(sigB64),
      new TextEncoder().encode(payloadB64)
    )
    if (!valid) return null
    const b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload: SessionPayload = JSON.parse(atob(padded))
    if (Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}
