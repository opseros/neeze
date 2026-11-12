import 'server-only'
import config from '@payload-config'
import { randomBytes } from 'crypto'
import { Google, MicrosoftEntraId, decodeIdToken, generateCodeVerifier, generateState } from 'arctic'
import { getPayload, type Payload } from 'payload'

import type { User } from '@/payload-types'
import { OTP_MAX_ATTEMPTS, OTP_MAX_PER_HOUR, OTP_RESEND_GAP_MS, OTP_TTL_MS, generateOtp, hashOtp, otpMatches } from '../otp'
import { SESSION_COOKIE, cookieHeader, readCookie, sessionCookieHeader, signSession, signValue, verifySession, verifyValue } from '../session'
import { type Identity, decideLink, identityFromClaims } from './logic'

export const OAUTH_COOKIE = 'neeze_oauth'
export const LINK_COOKIE = 'neeze_link'

export const payloadClient = () => getPayload({ config })

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

/* ---------- OAuth providers ---------- */

export function oauthClient(provider: string) {
  if (provider === 'google') {
    const id = process.env.GOOGLE_CLIENT_ID
    const secret = process.env.GOOGLE_CLIENT_SECRET
    if (!id || !secret) return null
    return { kind: 'google' as const, client: new Google(id, secret, `${siteUrl()}/auth/google/callback`) }
  }
  if (provider === 'microsoft') {
    const id = process.env.MICROSOFT_CLIENT_ID
    const secret = process.env.MICROSOFT_CLIENT_SECRET
    if (!id || !secret) return null
    const tenant = process.env.MICROSOFT_TENANT ?? 'common'
    return { kind: 'microsoft' as const, client: new MicrosoftEntraId(tenant, id, secret, `${siteUrl()}/auth/microsoft/callback`) }
  }
  return null
}

export const enabledProviders = () => ({ google: Boolean(oauthClient('google')), microsoft: Boolean(oauthClient('microsoft')) })

export function startOAuth(provider: 'google' | 'microsoft', returnTo: string) {
  const o = oauthClient(provider)
  if (!o) return null
  const state = generateState()
  const verifier = generateCodeVerifier()
  const url = o.client.createAuthorizationURL(state, verifier, ['openid', 'profile', 'email'])
  if (provider === 'google') url.searchParams.set('prompt', 'select_account')
  if (provider === 'microsoft') url.searchParams.set('prompt', 'select_account')
  const cookie = cookieHeader(OAUTH_COOKIE, signValue('oauth', { provider, state, verifier, returnTo }, 10 * 60), 10 * 60)
  return { url: url.toString(), cookie }
}

export async function finishOAuth(provider: 'google' | 'microsoft', code: string, state: string, cookieHeaderValue: string | null): Promise<{ identity: Identity; returnTo: string } | { error: string }> {
  const saved = verifyValue<{ provider: string; state: string; verifier: string; returnTo: string }>('oauth', readCookie(cookieHeaderValue, OAUTH_COOKIE))
  if (!saved || saved.provider !== provider || saved.state !== state) return { error: 'state' }
  const o = oauthClient(provider)
  if (!o) return { error: 'disabled' }
  try {
    const tokens = await o.client.validateAuthorizationCode(code, saved.verifier)
    // The ID token comes straight from the provider's token endpoint over TLS, so its claims can be read directly.
    const claims = decodeIdToken(tokens.idToken()) as Record<string, unknown>
    const identity = identityFromClaims(provider, claims)
    if (!identity) return { error: 'claims' }
    return { identity, returnTo: saved.returnTo }
  } catch {
    return { error: 'exchange' }
  }
}

/* ---------- Accounts ---------- */

async function findByIdentity(payload: Payload, id: Identity) {
  const r = await payload.find({
    collection: 'users',
    where: { and: [{ 'identities.provider': { equals: id.provider } }, { 'identities.subject': { equals: id.subject } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (r.docs[0] as User) ?? null
}

export async function findByEmail(payload: Payload, email: string) {
  const r = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
  return (r.docs[0] as User) ?? null
}

export async function createUser(payload: Payload, data: { email: string; name?: string | null; identities?: { provider: string; subject: string }[] }) {
  return (await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: {
      email: data.email,
      emailVerified: true,
      name: data.name ?? undefined,
      roles: ['customer'],
      identities: data.identities ?? [],
      // Payload's email + password login needs a password; social and email-code users never use it.
      password: randomBytes(24).toString('base64url'),
    } as never,
  })) as User
}

export async function addIdentity(payload: Payload, user: User, id: { provider: string; subject: string }) {
  const existing = (user.identities ?? []).map((i) => ({ provider: i.provider, subject: i.subject }))
  if (existing.some((i) => i.provider === id.provider && i.subject === id.subject)) return user
  return (await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { identities: [...existing, id], emailVerified: true } as never })) as User
}

/**
 * Sign in with a Google/Microsoft identity. Returns the user, or `verify-email` when the
 * provider's email can't be trusted (some Microsoft work accounts): the caller then asks for
 * an email code and links this identity afterwards (LINK_COOKIE).
 */
export async function signInWithIdentity(id: Identity): Promise<{ user: User } | { verifyEmail: true; linkCookie: string; email: string | null }> {
  const payload = await payloadClient()
  const byIdentity = await findByIdentity(payload, id)
  const byEmail = id.email ? await findByEmail(payload, id.email) : null
  const decision = decideLink(id, byIdentity?.id ?? null, byEmail?.id ?? null)
  switch (decision.action) {
    case 'login':
      return { user: byIdentity! }
    case 'link':
      return { user: await addIdentity(payload, byEmail!, { provider: id.provider, subject: id.subject }) }
    case 'create':
      return { user: await createUser(payload, { email: id.email!, name: id.name, identities: [{ provider: id.provider, subject: id.subject }] }) }
    case 'verify-email':
      return {
        verifyEmail: true,
        email: id.email,
        linkCookie: cookieHeader(LINK_COOKIE, signValue('link', { provider: id.provider, subject: id.subject, name: id.name ?? '' }, 15 * 60), 15 * 60),
      }
  }
}

export function sessionCookieFor(user: User) {
  return sessionCookieHeader(signSession(user.id))
}

export async function userFromRequest(req: Request): Promise<User | null> {
  const s = verifySession(readCookie(req.headers.get('cookie'), SESSION_COOKIE))
  if (!s) return null
  const payload = await payloadClient()
  const user = (await payload.findByID({ collection: 'users', id: s.uid, depth: 0, overrideAccess: true }).catch(() => null)) as User | null
  return user && !user.suspended ? user : null
}

/* ---------- One-time codes (email sign-in, phone verification) ---------- */

export type CodePurpose = 'email-login' | 'verify-phone'
export type CodeError = 'too_soon' | 'too_many' | 'expired' | 'wrong_code' | 'too_many_attempts'

export async function createCode(payload: Payload, target: string, purpose: CodePurpose, userId?: number): Promise<{ code: string } | { error: CodeError }> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const recent = await payload.find({
    collection: 'otp-challenges',
    where: { and: [{ target: { equals: target } }, { purpose: { equals: purpose } }, { createdAt: { greater_than: since } }] },
    sort: '-createdAt',
    limit: OTP_MAX_PER_HOUR,
    depth: 0,
    overrideAccess: true,
  })
  const last = recent.docs[0]
  if (last && Date.now() - new Date(last.createdAt).getTime() < OTP_RESEND_GAP_MS) return { error: 'too_soon' }
  if (recent.totalDocs >= OTP_MAX_PER_HOUR) return { error: 'too_many' }
  const code = generateOtp()
  await payload.create({
    collection: 'otp-challenges',
    overrideAccess: true,
    data: { target, purpose, user: userId, codeHash: hashOtp(`${purpose}:${target}`, code), expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(), attempts: 0, consumed: false },
  })
  return { code }
}

export async function checkCode(payload: Payload, target: string, purpose: CodePurpose, code: string, userId?: number): Promise<{ ok: true } | { error: CodeError }> {
  const { docs } = await payload.find({
    collection: 'otp-challenges',
    where: { and: [{ target: { equals: target } }, { purpose: { equals: purpose } }, { consumed: { equals: false } }, ...(userId ? [{ user: { equals: userId } }] : [])] },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const ch = docs[0]
  if (!ch || new Date(ch.expiresAt).getTime() < Date.now()) return { error: 'expired' }
  if ((ch.attempts ?? 0) >= OTP_MAX_ATTEMPTS) return { error: 'too_many_attempts' }
  if (!/^\d{6}$/.test(code) || !otpMatches(`${purpose}:${target}`, code, ch.codeHash)) {
    await payload.update({ collection: 'otp-challenges', id: ch.id, overrideAccess: true, data: { attempts: (ch.attempts ?? 0) + 1 } })
    return { error: 'wrong_code' }
  }
  await payload.update({ collection: 'otp-challenges', id: ch.id, overrideAccess: true, data: { consumed: true } })
  return { ok: true }
}

/**
 * Whether a new mobile number is confirmed by a WhatsApp/SMS code before it's saved.
 * Off by default: accounts are already verified through Google, Microsoft or an email code.
 * Turn on with PHONE_VERIFICATION=on once a WhatsApp/SMS channel (OTP_PROVIDER) is ready.
 */
export const phoneVerificationOn = () => process.env.PHONE_VERIFICATION === 'on' && Boolean(process.env.OTP_PROVIDER)

export const publicUser = (u: User) => ({ id: u.id, name: u.name ?? null, email: u.email ?? null, phone: u.phone ?? null, needsPhone: !u.phone })
