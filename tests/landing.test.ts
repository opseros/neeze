import { describe, expect, it } from 'vitest'

import { resolveLanding, safeLink } from '../src/lib/landing'

const now = new Date('2026-11-21T06:00:00Z')

describe('landing page', () => {
  it('defaults to news', () => {
    expect(resolveLanding(null, now)).toEqual({ page: 'news', spotlight: null, temporary: false })
    expect(resolveLanding({ defaultPage: 'directory' }, now).page).toBe('directory')
    expect(resolveLanding({ defaultPage: 'hacked' }, now).page).toBe('news')
  })

  it('temporary change applies only inside its dates', () => {
    const t = { active: true, from: '2026-11-20T00:00:00Z', until: '2026-11-22T00:00:00Z', page: 'community' }
    expect(resolveLanding({ defaultPage: 'news', temporary: t }, now)).toMatchObject({ page: 'community', temporary: true })
    expect(resolveLanding({ defaultPage: 'news', temporary: t }, new Date('2026-11-22T00:00:00Z')).page).toBe('news')
    expect(resolveLanding({ defaultPage: 'news', temporary: t }, new Date('2026-11-19T23:00:00Z')).page).toBe('news')
    expect(resolveLanding({ defaultPage: 'news', temporary: { ...t, active: false } }, now).page).toBe('news')
  })

  it('spotlight on top of the default page', () => {
    const r = resolveLanding({ defaultPage: 'news', temporary: { active: true, until: '2026-12-01T00:00:00Z', showSpotlight: true, headline: ' Flood helpline ', buttonLink: '/emergency', tone: 'alert', image: { url: '/m/a.jpg', sizes: { hero: { url: '/m/a-hero.jpg' } } } } }, now)
    expect(r.page).toBe('news')
    expect(r.spotlight).toEqual({ headline: 'Flood helpline', text: null, imageUrl: '/m/a-hero.jpg', buttonLabel: null, buttonLink: '/emergency', tone: 'alert' })
  })

  it('no spotlight without a headline', () => {
    expect(resolveLanding({ temporary: { active: true, showSpotlight: true, headline: '  ' } }, now).spotlight).toBeNull()
  })

  it('links are site paths or https only', () => {
    expect(safeLink('/emergency')).toBe('/emergency')
    expect(safeLink('https://cachar.gov.in/flood')).toBe('https://cachar.gov.in/flood')
    expect(safeLink('javascript:alert(1)')).toBeNull()
    expect(safeLink('//evil.com')).toBeNull()
    expect(safeLink('http://insecure.in')).toBeNull()
    expect(safeLink(' / spaced')).toBeNull()
  })
})
