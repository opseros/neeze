import { describe, expect, it } from 'vitest'

import { canReview, publicName, summarize } from '../src/lib/reviews'

const day = 24 * 60 * 60 * 1000
const now = Date.parse('2026-11-12T10:00:00Z')

describe('who can review', () => {
  const base = { isCustomer: true, status: 'completed', completedAt: new Date(now - 2 * day).toISOString(), alreadyReviewed: false, now }
  it('the customer of a completed job, once, within 60 days', () => expect(canReview(base)).toEqual({ ok: true }))
  it('not someone else', () => expect(canReview({ ...base, isCustomer: false })).toEqual({ ok: false, reason: 'not_yours' }))
  it('not before the job is completed', () => {
    expect(canReview({ ...base, status: 'in-progress' })).toEqual({ ok: false, reason: 'not_completed' })
    expect(canReview({ ...base, status: 'cancelled' })).toEqual({ ok: false, reason: 'not_completed' })
  })
  it('not twice', () => expect(canReview({ ...base, alreadyReviewed: true })).toEqual({ ok: false, reason: 'already_reviewed' }))
  it('not after 60 days', () => expect(canReview({ ...base, completedAt: new Date(now - 61 * day).toISOString() })).toEqual({ ok: false, reason: 'too_late' }))
})

describe('reviewer name shown publicly', () => {
  it('first name + initial', () => expect(publicName('asha das')).toBe('Asha D.'))
  it('single name', () => expect(publicName('Bimal')).toBe('Bimal'))
  it('Bengali names', () => expect(publicName('আশা দাস')).toBe('আশা দ.'))
  it('no name', () => expect(publicName('  ')).toBe('Neeze customer'))
})

describe('rating summary', () => {
  it('hides the average below 3 reviews', () => expect(summarize([5, 1])).toEqual({ count: 2, average: 3, showAverage: false }))
  it('rounds to one decimal', () => expect(summarize([5, 4, 4])).toEqual({ count: 3, average: 4.3, showAverage: true }))
  it('ignores invalid ratings', () => expect(summarize([5, 0, 6, 4.5]).count).toBe(1))
})
