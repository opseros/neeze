/**
 * Pure decision logic for sign-in, kept free of I/O so it can be unit tested.
 */

export type Provider = 'google' | 'microsoft' | 'email'

/** Microsoft's tenant id for personal (outlook.com / hotmail) accounts. */
export const MS_CONSUMER_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad'

export type IdClaims = Record<string, unknown>

export type Identity = {
  provider: Exclude<Provider, 'email'>
  subject: string
  email: string | null
  /** True only when the provider guarantees the address belongs to this person. */
  emailTrusted: boolean
  name: string | null
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

export const normalizeEmail = (e: string | null | undefined) => {
  const v = (e ?? '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254 ? v : null
}

/**
 * Turn ID-token claims into an identity.
 * Google: trust the email only when `email_verified` is true.
 * Microsoft: work/school tenants let admins set any email on an account, so the `email` claim is
 * trusted only for personal Microsoft accounts or when Microsoft says the domain owner verified it
 * (`xms_edov`). Otherwise the person confirms the email with a code first.
 */
export function identityFromClaims(provider: 'google' | 'microsoft', c: IdClaims): Identity | null {
  const subject = str(c.sub)
  if (!subject) return null
  if (provider === 'google') {
    return {
      provider,
      subject,
      email: normalizeEmail(str(c.email)),
      emailTrusted: c.email_verified === true || c.email_verified === 'true',
      name: str(c.name),
    }
  }
  const email = normalizeEmail(str(c.email) ?? str(c.preferred_username))
  const consumer = c.tid === MS_CONSUMER_TENANT
  const edov = c.xms_edov === true || c.xms_edov === 'true' || c.xms_edov === 1
  return { provider, subject, email, emailTrusted: Boolean(email) && (consumer || edov), name: str(c.name) }
}

export type LinkDecision =
  | { action: 'login'; userId: number }
  | { action: 'link'; userId: number } // add this identity to an existing account with the same verified email
  | { action: 'create' }
  | { action: 'verify-email' } // email not trusted: confirm it by code before going further

/**
 * One person, one account: an identity seen before signs straight in; a new identity whose
 * verified email matches an account is added to that account; otherwise a new account.
 */
export function decideLink(id: Identity, byIdentity: number | null, byEmail: number | null): LinkDecision {
  if (byIdentity) return { action: 'login', userId: byIdentity }
  if (!id.email || !id.emailTrusted) return { action: 'verify-email' }
  if (byEmail) return { action: 'link', userId: byEmail }
  return { action: 'create' }
}

/** Only allow redirects back into our own site, never to another host. */
export function safeReturnTo(raw: string | null | undefined, fallback = '/'): string {
  if (!raw || typeof raw !== 'string') return fallback
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\') || raw.includes('\n') || raw.includes('\r')) return fallback
  if (raw.startsWith('/auth/') || raw.startsWith('/api/')) return fallback
  return raw.slice(0, 500)
}

export type PhoneDecision =
  | { action: 'ok' } // number is free (or already this user's)
  | { action: 'take-over'; fromUserId: number } // another account has it but never verified it; verifying moves it here
  | { action: 'conflict' } // another account has verified this number

export function decidePhone(currentUserId: number, holder: { id: number; phoneVerified?: boolean | null } | null, willVerify: boolean): PhoneDecision {
  if (!holder || holder.id === currentUserId) return { action: 'ok' }
  if (holder.phoneVerified) return { action: 'conflict' }
  return willVerify ? { action: 'take-over', fromUserId: holder.id } : { action: 'conflict' }
}
