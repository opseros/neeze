/**
 * What "/" shows. Admin → Site settings → Landing page sets the default, and a temporary change
 * (another page and/or a spotlight banner) for a date range that switches back by itself.
 * Pure: unit-tested in tests/landing.test.ts.
 */

export const LANDING_PAGES = ['news', 'directory', 'community'] as const
export type LandingPage = (typeof LANDING_PAGES)[number]
export const DEFAULT_LANDING: LandingPage = 'news'

export const NEWS_SECTIONS = ['local', 'civic', 'health', 'education', 'transport', 'events', 'business', 'alerts'] as const
export type NewsSection = (typeof NEWS_SECTIONS)[number]

export const SPOTLIGHT_TONES = ['navy', 'teal', 'alert'] as const

export type Spotlight = { headline: string; text?: string | null; imageUrl?: string | null; buttonLabel?: string | null; buttonLink?: string | null; tone: (typeof SPOTLIGHT_TONES)[number] }

type LandingSettings = {
  defaultPage?: string | null
  temporary?: {
    active?: boolean | null
    from?: string | null
    until?: string | null
    page?: string | null
    showSpotlight?: boolean | null
    headline?: string | null
    text?: string | null
    image?: { url?: string | null; sizes?: { hero?: { url?: string | null } } } | number | null
    buttonLabel?: string | null
    buttonLink?: string | null
    tone?: string | null
  } | null
} | null | undefined

const isPage = (v: unknown): v is LandingPage => LANDING_PAGES.includes(v as LandingPage)

/** Only site paths and https links; never javascript: or other schemes. */
export function safeLink(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (/^\/(?!\/)[^\s]*$/.test(s)) return s
  if (/^https:\/\/[^\s]+$/i.test(s)) return s
  return null
}

export function isTemporaryActive(t: NonNullable<NonNullable<LandingSettings>['temporary']>, now = new Date()) {
  if (!t?.active) return false
  if (t.from && new Date(t.from) > now) return false
  if (t.until && new Date(t.until) <= now) return false
  return true
}

export function resolveLanding(settings: LandingSettings, now = new Date()): { page: LandingPage; spotlight: Spotlight | null; temporary: boolean } {
  const base = isPage(settings?.defaultPage) ? settings!.defaultPage : DEFAULT_LANDING
  const t = settings?.temporary
  if (!t || !isTemporaryActive(t, now)) return { page: base as LandingPage, spotlight: null, temporary: false }
  const page = isPage(t.page) ? t.page : (base as LandingPage)
  const img = t.image && typeof t.image === 'object' ? (t.image.sizes?.hero?.url ?? t.image.url ?? null) : null
  const spotlight: Spotlight | null =
    t.showSpotlight && t.headline?.trim()
      ? {
          headline: t.headline.trim(),
          text: t.text?.trim() || null,
          imageUrl: img,
          buttonLabel: t.buttonLabel?.trim() || null,
          buttonLink: safeLink(t.buttonLink),
          tone: SPOTLIGHT_TONES.includes(t.tone as never) ? (t.tone as Spotlight['tone']) : 'navy',
        }
      : null
  return { page, spotlight, temporary: true }
}
