import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Customer sessions after phone OTP. A small signed cookie (HMAC-SHA256) holding the user id
 * and expiry. Staff keep using Payload's own email + password login for /admin.
 */
export const SESSION_COOKIE = 'neeze_session'
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30 // 30 days

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set (32+ characters)')
  return s
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url')

/** Sign any small JSON value with an expiry. `purpose` stops one kind of token being replayed as another. */
export function signValue(purpose: string, value: Record<string, unknown>, ttlSeconds: number, now = Date.now()): string {
  const body = b64(JSON.stringify({ ...value, _p: purpose, exp: Math.floor(now / 1000) + ttlSeconds }))
  const sig = b64(createHmac('sha256', secret()).update(body).digest())
  return `${body}.${sig}`
}

export function verifyValue<T extends Record<string, unknown>>(purpose: string, token: string | undefined | null, now = Date.now()): T | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = createHmac('sha256', secret()).update(body).digest()
  const given = Buffer.from(sig, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & { exp: number; _p: string }
    if (data._p !== purpose || typeof data.exp !== 'number' || data.exp * 1000 < now) return null
    return data
  } catch {
    return null
  }
}

export function signSession(userId: number | string, now = Date.now()): string {
  return signValue('session', { uid: userId }, SESSION_MAX_AGE_S, now)
}

export function verifySession(token: string | undefined | null, now = Date.now()): { uid: number | string } | null {
  const v = verifyValue<{ uid: number | string }>('session', token, now)
  return v ? { uid: v.uid } : null
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return undefined
}

export function cookieHeader(name: string, value: string | null, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  if (!value) return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`
}

export function sessionCookieHeader(token: string | null): string {
  return cookieHeader(SESSION_COOKIE, token, SESSION_MAX_AGE_S)
}
