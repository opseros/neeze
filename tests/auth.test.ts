import { beforeAll, describe, expect, it } from 'vitest'

import { MS_CONSUMER_TENANT, decideLink, decidePhone, identityFromClaims, normalizeEmail, safeReturnTo } from '../src/lib/auth/logic'
import { signValue, verifyValue } from '../src/lib/session'

beforeAll(() => {
  process.env.SESSION_SECRET = 'y'.repeat(40)
})

describe('identity from ID-token claims', () => {
  it('trusts Google email only when verified', () => {
    expect(identityFromClaims('google', { sub: '1', email: 'A@Gmail.com', email_verified: true })).toMatchObject({ email: 'a@gmail.com', emailTrusted: true })
    expect(identityFromClaims('google', { sub: '1', email: 'a@gmail.com', email_verified: false })?.emailTrusted).toBe(false)
  })
  it('trusts personal Microsoft accounts', () => {
    expect(identityFromClaims('microsoft', { sub: 'm', email: 'x@outlook.com', tid: MS_CONSUMER_TENANT })?.emailTrusted).toBe(true)
  })
  it('does not trust work-account email unless the domain is verified (xms_edov)', () => {
    expect(identityFromClaims('microsoft', { sub: 'm', email: 'ceo@bank.com', tid: 'some-tenant' })?.emailTrusted).toBe(false)
    expect(identityFromClaims('microsoft', { sub: 'm', email: 'ceo@bank.com', tid: 'some-tenant', xms_edov: true })?.emailTrusted).toBe(true)
    expect(identityFromClaims('microsoft', { sub: 'm', preferred_username: 'p@co.in', tid: 't' })?.email).toBe('p@co.in')
  })
  it('rejects tokens without a subject', () => {
    expect(identityFromClaims('google', { email: 'a@b.co' })).toBeNull()
  })
})

describe('one person, one account', () => {
  const trusted = { provider: 'google' as const, subject: 's', email: 'a@b.co', emailTrusted: true, name: null }
  it('known identity signs in', () => expect(decideLink(trusted, 7, 9)).toEqual({ action: 'login', userId: 7 }))
  it('new identity with an existing verified email links to that account', () => expect(decideLink(trusted, null, 9)).toEqual({ action: 'link', userId: 9 }))
  it('new person gets a new account', () => expect(decideLink(trusted, null, null)).toEqual({ action: 'create' }))
  it('untrusted email never links or creates directly', () => {
    expect(decideLink({ ...trusted, emailTrusted: false }, null, 9)).toEqual({ action: 'verify-email' })
    expect(decideLink({ ...trusted, email: null }, null, null)).toEqual({ action: 'verify-email' })
  })
})

describe('mobile number uniqueness', () => {
  it('free number or own number is fine', () => {
    expect(decidePhone(1, null, true)).toEqual({ action: 'ok' })
    expect(decidePhone(1, { id: 1, phoneVerified: true }, true)).toEqual({ action: 'ok' })
  })
  it('a number another account verified is refused', () => {
    expect(decidePhone(1, { id: 2, phoneVerified: true }, true)).toEqual({ action: 'conflict' })
  })
  it('an unverified claim is taken over only by someone who verifies', () => {
    expect(decidePhone(1, { id: 2, phoneVerified: false }, true)).toEqual({ action: 'take-over', fromUserId: 2 })
    expect(decidePhone(1, { id: 2, phoneVerified: false }, false)).toEqual({ action: 'conflict' })
  })
})

describe('redirect safety', () => {
  it('keeps same-site paths', () => expect(safeReturnTo('/request/12?x=1')).toBe('/request/12?x=1'))
  it('blocks other hosts and tricks', () => {
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '/auth/google', '/api/users', '/x\r\nSet-Cookie: a=b']) {
      expect(safeReturnTo(bad)).toBe('/')
    }
  })
})

describe('signed values', () => {
  it('cannot reuse an OAuth state cookie as a session', () => {
    const tok = signValue('oauth', { uid: 1 }, 600)
    expect(verifyValue('oauth', tok)).toMatchObject({ uid: 1 })
    expect(verifyValue('session', tok)).toBeNull()
  })
})

describe('email normalisation', () => {
  it('lowercases and validates', () => {
    expect(normalizeEmail('  Me@Example.COM ')).toBe('me@example.com')
    expect(normalizeEmail('not-an-email')).toBeNull()
  })
})
