import { describe, expect, it } from 'vitest'

import { LIMITS, canEditPost, canInteract, cleanText, countLinks, initialStatus, isReportReason } from '../src/lib/community'

describe('who goes live straight away', () => {
  const base = { isStaff: false, publishedBefore: 0, text: 'Any good tailor near Tarapur?' }
  it('open mode: everyone', () => expect(initialStatus({ ...base, mode: 'open' })).toBe('published'))
  it('first-post mode: first post waits, later ones go live', () => {
    expect(initialStatus({ ...base, mode: 'first-post' })).toBe('pending')
    expect(initialStatus({ ...base, mode: 'first-post', publishedBefore: 1 })).toBe('published')
  })
  it('all mode: every post waits', () => expect(initialStatus({ ...base, mode: 'all', publishedBefore: 9 })).toBe('pending'))
  it('staff always go live', () => expect(initialStatus({ ...base, mode: 'all', isStaff: true })).toBe('published'))
  it('several links wait for review in any mode', () => {
    expect(initialStatus({ ...base, mode: 'open', text: 'see https://a.in and www.b.com' })).toBe('pending')
    expect(initialStatus({ ...base, mode: 'open', text: 'see https://a.in' })).toBe('published')
  })
  it('comments go live unless spammy', () => {
    expect(initialStatus({ ...base, mode: 'all', kind: 'comment' })).toBe('published')
    expect(initialStatus({ ...base, mode: 'all', kind: 'comment', text: 'http://x.y http://z.w' })).toBe('pending')
  })
})

describe('who may take part', () => {
  const now = new Date('2026-11-12T10:00:00Z')
  it('needs sign-in and a mobile number', () => {
    expect(canInteract(null)).toEqual({ ok: false, reason: 'signin_required' })
    expect(canInteract({ phone: null })).toEqual({ ok: false, reason: 'phone_required' })
    expect(canInteract({ phone: '+919800000000' })).toEqual({ ok: true })
  })
  it('suspended and restricted people are stopped', () => {
    expect(canInteract({ phone: '+91', suspended: true })).toEqual({ ok: false, reason: 'suspended' })
    expect(canInteract({ phone: '+91' }, '2026-11-13T00:00:00Z', now)).toEqual({ ok: false, reason: 'restricted' })
    expect(canInteract({ phone: '+91' }, '2026-11-11T00:00:00Z', now)).toEqual({ ok: true })
  })
})

describe('helpers', () => {
  it('edit window is a day, never after removal', () => {
    const now = new Date('2026-11-12T10:00:00Z')
    expect(canEditPost({ createdAt: '2026-11-12T00:00:00Z', status: 'published' }, now)).toBe(true)
    expect(canEditPost({ createdAt: '2026-11-10T00:00:00Z', status: 'published' }, now)).toBe(false)
    expect(canEditPost({ createdAt: '2026-11-12T09:00:00Z', status: 'removed' }, now)).toBe(false)
  })
  it('cleans text and caps length', () => {
    expect(cleanText('  a\r\n\n\n\nb  ', 100)).toBe('a\n\nb')
    expect(cleanText('x'.repeat(2000), LIMITS.postBody)).toHaveLength(LIMITS.postBody)
    expect(cleanText(42, 10)).toBe('')
  })
  it('counts links', () => expect(countLinks('a http://x.in b www.y.com c')).toBe(2))
  it('report reasons fit the target', () => {
    expect(isReportReason('post', 'spam')).toBe(true)
    expect(isReportReason('news', 'correction')).toBe(true)
    expect(isReportReason('news', 'spam')).toBe(false)
    expect(isReportReason('provider', 'wrong-info')).toBe(true)
    expect(isReportReason('user', 'spam')).toBe(false)
  })
})
