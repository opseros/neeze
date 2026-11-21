import { describe, expect, it } from 'vitest'

import { cleanQuery, dailySeries, isBot, median, parseEvent, pct, responseByProvider } from '../src/lib/insights'

describe('events stay anonymous and tidy', () => {
  it('masks phone numbers and emails in searches', () => {
    expect(cleanQuery('Plumber 98640 12345 Tarapur')).toBe('plumber # tarapur')
    expect(cleanQuery('call me at a.b@x.com')).toBe('call me at #')
    expect(cleanQuery('  AC   Repair ')).toBe('ac repair')
    expect(cleanQuery('x'.repeat(200))).toHaveLength(80)
    expect(cleanQuery(5)).toBeNull()
  })
  it('accepts only known event shapes', () => {
    expect(parseEvent({ type: 'search', q: 'tailor', results: 0 })).toMatchObject({ type: 'search', q: 'tailor', resultCount: 0 })
    expect(parseEvent({ type: 'search', q: 'tailor' })).toBeNull()
    expect(parseEvent({ type: 'call', provider: 12 })).toMatchObject({ type: 'call', provider: 12, q: null })
    expect(parseEvent({ type: 'call' })).toBeNull()
    expect(parseEvent({ type: 'login', provider: 1 })).toBeNull()
    expect(parseEvent({ type: 'install', category: 'DROP TABLE', locale: 'en' })).toMatchObject({ category: null, locale: 'en' })
    expect(parseEvent(null)).toBeNull()
  })
  it('drops bots and link previews', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true)
    expect(isBot('WhatsApp/2.23')).toBe(true)
    expect(isBot('')).toBe(true)
    expect(isBot('Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile')).toBe(false)
  })
})

describe('KPI maths', () => {
  it('median and percentages', () => {
    expect(median([5, 1, 3])).toBe(3)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([])).toBeNull()
    expect(pct(1, 3)).toBe(33.3)
    expect(pct(1, 0)).toBeNull()
  })

  it('response health per provider, fair to new requests and cancellations', () => {
    const now = new Date('2026-11-21T12:00:00Z')
    const h = (n: number) => new Date(now.getTime() - n * 3600_000).toISOString()
    const rows = [
      { id: 1, provider: 1, providerName: 'Fast', createdAt: h(50), status: 'contacted', firstResponseAt: h(49) },
      { id: 2, provider: 1, providerName: 'Fast', createdAt: h(30), status: 'completed', firstResponseAt: h(28) },
      { id: 3, provider: 2, providerName: 'Slow', createdAt: h(80), status: 'contacted', firstResponseAt: h(20) },
      { id: 4, provider: 2, providerName: 'Slow', createdAt: h(40), status: 'submitted', firstResponseAt: null },
      { id: 5, provider: 2, providerName: 'Slow', createdAt: h(2), status: 'submitted', firstResponseAt: null }, // too new to judge
      { id: 6, provider: 3, providerName: 'Gone', createdAt: h(30), status: 'cancelled', firstResponseAt: null }, // customer withdrew
    ]
    const out = responseByProvider(rows, now)
    expect(out.map((p) => p.name)).toEqual(['Slow', 'Fast'])
    expect(out[0]).toMatchObject({ requests: 2, respondedInTarget: 0, unanswered: 1, medianHours: 60, rate: 0 })
    expect(out[1]).toMatchObject({ requests: 2, respondedInTarget: 2, unanswered: 0, medianHours: 1.5, rate: 100 })
  })

  it('daily buckets are zero-filled in India time', () => {
    const now = new Date('2026-11-21T20:00:00Z') // 01:30 on the 22nd in Kolkata
    const s = dailySeries(['2026-11-21T19:00:00Z', '2026-11-20T10:00:00Z', '2026-11-20T11:00:00Z'], 3, now)
    expect(s).toEqual([
      { day: '2026-11-20', count: 2 },
      { day: '2026-11-21', count: 0 },
      { day: '2026-11-22', count: 1 },
    ])
  })
})
