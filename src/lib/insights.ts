/**
 * Analytics and launch KPIs. Pure functions here (unit-tested in tests/insights.test.ts);
 * the queries live in lib/insights-server.ts.
 *
 * Privacy: events carry no user id, no IP, no cookie and no device fingerprint. Search text is
 * capped and long digit runs (phone numbers) are masked before storage.
 */

export const EVENT_TYPES = ['search', 'provider_view', 'call', 'whatsapp', 'install'] as const
export type EventType = (typeof EVENT_TYPES)[number]

/** A provider "responded" when they first move a request on (contacted, quoted, accepted or declined). */
export const RESPONSE_TARGET_HOURS = 24
/** Events older than this are deleted. */
export const RETENTION_DAYS = 400

const BOT = /bot|crawl|spider|slurp|preview|lighthouse|headless|monitor|curl|wget|python|axios|node-fetch|facebookexternalhit|whatsapp/i
export const isBot = (ua: string | null | undefined) => !ua || BOT.test(ua)

/** Store what people searched for, not who they are. */
export function cleanQuery(q: unknown): string | null {
  if (typeof q !== 'string') return null
  const s = q
    .normalize('NFC')
    .toLowerCase()
    .replace(/\d[\d\s-]{5,}\d/g, '#') // phone numbers and the like
    .replace(/\S+@\S+/g, '#') // email addresses
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return s || null
}

export type TrackInput = { type?: unknown; q?: unknown; results?: unknown; provider?: unknown; locality?: unknown; category?: unknown; locale?: unknown; mobile?: unknown }
export type TrackRow = { type: EventType; q: string | null; resultCount: number | null; provider: number | null; locality: number | null; category: string | null; locale: string | null; mobile: boolean }

const posInt = (v: unknown) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 && n < 2 ** 31 ? n : null
}

/** Validate a beacon. Returns null when it should be dropped. */
export function parseEvent(input: TrackInput | null): TrackRow | null {
  if (!input || !EVENT_TYPES.includes(input.type as EventType)) return null
  const type = input.type as EventType
  const row: TrackRow = {
    type,
    q: type === 'search' ? cleanQuery(input.q) : null,
    resultCount: type === 'search' ? (Number.isInteger(Number(input.results)) && Number(input.results) >= 0 ? Math.min(Number(input.results), 100000) : null) : null,
    provider: type === 'provider_view' || type === 'call' || type === 'whatsapp' ? posInt(input.provider) : null,
    locality: posInt(input.locality),
    category: typeof input.category === 'string' && /^[a-z0-9-]{1,60}$/.test(input.category) ? input.category : null,
    locale: typeof input.locale === 'string' && /^[a-zA-Z-]{2,12}$/.test(input.locale) ? input.locale : null,
    mobile: input.mobile === true,
  }
  if (type === 'search' && row.resultCount === null) return null
  if ((type === 'provider_view' || type === 'call' || type === 'whatsapp') && !row.provider) return null
  return row
}

export function median(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null)

export type RequestRow = { id: number; provider: number; providerName: string; createdAt: string; status: string; firstResponseAt: string | null }

export type ProviderResponse = {
  provider: number
  name: string
  requests: number
  respondedInTarget: number
  unanswered: number
  medianHours: number | null
  rate: number | null
}

/**
 * Response health per provider, worst first. A request counts once its target window has passed
 * (or it was answered); newer unanswered requests aren't held against anyone yet.
 */
export function responseByProvider(rows: RequestRow[], now = new Date()): ProviderResponse[] {
  const by = new Map<number, ProviderResponse & { hours: number[] }>()
  const target = RESPONSE_TARGET_HOURS * 3600_000
  for (const r of rows) {
    const age = now.getTime() - new Date(r.createdAt).getTime()
    const hours = r.firstResponseAt ? (new Date(r.firstResponseAt).getTime() - new Date(r.createdAt).getTime()) / 3600_000 : null
    if (hours === null && age < target) continue // still within the window
    if (hours === null && r.status === 'cancelled') continue // customer withdrew first
    const p = by.get(r.provider) ?? { provider: r.provider, name: r.providerName, requests: 0, respondedInTarget: 0, unanswered: 0, medianHours: null, rate: null, hours: [] }
    p.requests++
    if (hours === null) p.unanswered++
    else {
      p.hours.push(hours)
      if (hours <= RESPONSE_TARGET_HOURS) p.respondedInTarget++
    }
    by.set(r.provider, p)
  }
  return [...by.values()]
    .map(({ hours, ...p }) => ({ ...p, medianHours: median(hours), rate: pct(p.respondedInTarget, p.requests) }))
    .sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0) || b.unanswered - a.unanswered || b.requests - a.requests)
}

/** One bucket per day (Asia/Kolkata), oldest first, zero-filled. */
export function dailySeries(dates: string[], days: number, now = new Date()): { day: string; count: number }[] {
  const key = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10)
  const counts = new Map<string, number>()
  for (const d of dates) counts.set(key(new Date(d)), (counts.get(key(new Date(d))) ?? 0) + 1)
  const out: { day: string; count: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const day = key(new Date(now.getTime() - i * 86_400_000))
    out.push({ day, count: counts.get(day) ?? 0 })
  }
  return out
}

export const WINDOWS = [7, 30, 90] as const
export const windowDays = (v: unknown) => (WINDOWS.includes(Number(v) as never) ? Number(v) : 30)
