import { describe, expect, it } from 'vitest'

import { alertKey, shouldSend } from '../src/lib/alerts'

describe('error alerts', () => {
  it('groups the same error on different records', () => {
    expect(alertKey('Post 123 not found', '/community/123')).toBe(alertKey('Post 456 not found', '/community/456'))
    expect(alertKey('Boom', '/a')).not.toBe(alertKey('Bang', '/a'))
  })
  it('mails each error at most once an hour', () => {
    const t = Date.now()
    expect(shouldSend('k1', t)).toBe(true)
    expect(shouldSend('k1', t + 60_000)).toBe(false)
    expect(shouldSend('k1', t + 3_700_000)).toBe(true)
  })
})
