import { describe, expect, it, beforeAll } from 'vitest'

import { grantableRoles, isRoleEscalation, isStaff } from '../src/access/roles'
import { canTransition, needsReason } from '../src/lib/requestStatus'
import { buildSearchText, normalizeForSearch, normalizeIndianMobile } from '../src/lib/text'
import { readCookie, signSession, verifySession } from '../src/lib/session'
import { hashOtp, otpMatches, generateOtp } from '../src/lib/otp'

beforeAll(() => {
  process.env.SESSION_SECRET = 'x'.repeat(40)
})

describe('roles', () => {
  const sa = { roles: ['super-admin'] }
  const admin = { roles: ['admin'] }
  const customer = { roles: ['customer'] }

  it('only staff reach /admin', () => {
    expect(isStaff(admin)).toBe(true)
    expect(isStaff({ roles: ['editor'] })).toBe(true)
    expect(isStaff(customer)).toBe(false)
    expect(isStaff({ roles: ['provider'] })).toBe(false)
    expect(isStaff(null)).toBe(false)
  })
  it('an admin cannot make anyone (incl. themselves) admin or super-admin', () => {
    expect(isRoleEscalation(admin, ['admin'], ['admin', 'super-admin'])).toBe(true)
    expect(isRoleEscalation(admin, ['customer'], ['admin'])).toBe(true)
    expect(isRoleEscalation(admin, ['admin'], [])).toBe(true) // removing admin needs super-admin too
  })
  it('an admin can grant provider/editor/moderator', () => {
    expect(isRoleEscalation(admin, ['customer'], ['customer', 'provider'])).toBe(false)
    expect(grantableRoles(admin)).not.toContain('super-admin')
  })
  it('super-admin can grant anything; customers nothing', () => {
    expect(isRoleEscalation(sa, [], ['admin'])).toBe(false)
    expect(isRoleEscalation(customer, ['customer'], ['customer', 'provider'])).toBe(true)
  })
})

describe('request status transitions', () => {
  it('customer can cancel early and accept a quote, but not complete', () => {
    expect(canTransition('customer', 'submitted', 'cancelled')).toBe(true)
    expect(canTransition('customer', 'quoted', 'accepted')).toBe(true)
    expect(canTransition('customer', 'in-progress', 'completed')).toBe(false)
    expect(canTransition('customer', 'submitted', 'completed')).toBe(false)
  })
  it('provider follows the lifecycle in order', () => {
    expect(canTransition('provider', 'submitted', 'contacted')).toBe(true)
    expect(canTransition('provider', 'contacted', 'quoted')).toBe(true)
    expect(canTransition('provider', 'accepted', 'in-progress')).toBe(true)
    expect(canTransition('provider', 'in-progress', 'completed')).toBe(true)
    expect(canTransition('provider', 'submitted', 'completed')).toBe(false)
  })
  it('terminal states are final for non-staff', () => {
    for (const actor of ['customer', 'provider', 'system'] as const) {
      expect(canTransition(actor, 'cancelled', 'submitted')).toBe(false)
      expect(canTransition(actor, 'completed', 'in-progress')).toBe(false)
    }
    expect(canTransition('staff', 'cancelled', 'submitted')).toBe(true)
  })
  it('cancel and reject need a reason', () => {
    expect(needsReason('cancelled')).toBe(true)
    expect(needsReason('rejected')).toBe(true)
    expect(needsReason('contacted')).toBe(false)
  })
})

describe('search text', () => {
  it('matches spelling variants', () => {
    expect(normalizeForSearch('Taraapur')).toBe(normalizeForSearch('TARAPUR '))
    expect(normalizeForSearch('A.C.  repair!')).toBe('a c repair')
  })
  it('keeps Bengali letters and vowel signs', () => {
    expect(normalizeForSearch('তারাপুর')).toContain('ত')
    expect(normalizeForSearch('তারাপুর').length).toBeGreaterThan(3)
  })
  it('dedupes parts', () => {
    expect(buildSearchText(['Plumber', 'plumber', 'প্লাম্বার'])).toBe('plumber প্লাম্বার')
  })
})

describe('phone numbers', () => {
  it('normalises Indian mobiles to E.164', () => {
    expect(normalizeIndianMobile('98765 43210')).toBe('+919876543210')
    expect(normalizeIndianMobile('+91-98765-43210')).toBe('+919876543210')
    expect(normalizeIndianMobile('098765 43210')).toBe('+919876543210')
  })
  it('rejects non-mobiles', () => {
    expect(normalizeIndianMobile('12345')).toBeNull()
    expect(normalizeIndianMobile('5876543210')).toBeNull()
    expect(normalizeIndianMobile('')).toBeNull()
  })
})

describe('session cookie', () => {
  it('round-trips and rejects tampering', () => {
    const tok = signSession(42)
    expect(verifySession(tok)?.uid).toBe(42)
    const [body, sig] = tok.split('.')
    const forged = Buffer.from(JSON.stringify({ uid: 1, exp: 9e9 })).toString('base64url')
    expect(verifySession(`${forged}.${sig}`)).toBeNull()
    expect(verifySession(`${body}.AAAA`)).toBeNull()
    expect(verifySession('garbage')).toBeNull()
  })
  it('expires', () => {
    const tok = signSession(1, Date.now() - 31 * 24 * 3600 * 1000)
    expect(verifySession(tok)).toBeNull()
  })
  it('reads cookies', () => {
    expect(readCookie('a=1; neeze_session=abc.def; b=2', 'neeze_session')).toBe('abc.def')
  })
})

describe('otp', () => {
  it('is 6 digits and only the hash matches', () => {
    const code = generateOtp()
    expect(code).toMatch(/^\d{6}$/)
    const h = hashOtp('+919876543210', code)
    expect(h).not.toContain(code)
    expect(otpMatches('+919876543210', code, h)).toBe(true)
    expect(otpMatches('+919876543211', code, h)).toBe(false)
  })
})
