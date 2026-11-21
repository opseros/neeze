import type { CollectionConfig } from 'payload'

import { isAdmin, isStaff } from '../access/roles'
import { EVENT_TYPES, RETENTION_DAYS, isBot, parseEvent } from '../lib/insights'

/**
 * Anonymous usage events for the launch KPIs (see /insights). No user, IP, cookie or fingerprint is stored.
 * Written only through POST /api/analytics-events/track.
 */

// Per-instance flood guard: at most 120 events a minute per client address. The address is
// only held in memory for that minute and never written anywhere.
const recent = new Map<string, { n: number; t: number }>()
function allow(ip: string) {
  const now = Date.now()
  if (recent.size > 5000) for (const [k, v] of recent) if (now - v.t > 60_000) recent.delete(k)
  const r = recent.get(ip)
  if (!r || now - r.t > 60_000) {
    recent.set(ip, { n: 1, t: now })
    return true
  }
  r.n++
  return r.n <= 120
}

export const AnalyticsEvents: CollectionConfig = {
  slug: 'analytics-events',
  labels: { singular: 'Event', plural: 'Usage events' },
  admin: { group: 'Insights', hidden: ({ user }) => !isAdmin(user as never), defaultColumns: ['type', 'q', 'resultCount', 'provider', 'createdAt'], description: 'Anonymous usage events behind the Insights page. Kept for 400 days.' },
  access: {
    read: ({ req }) => isStaff(req.user),
    create: () => false,
    update: () => false,
    delete: ({ req }) => isAdmin(req.user),
  },
  defaultSort: '-createdAt',
  fields: [
    { name: 'type', type: 'select', required: true, index: true, options: [...EVENT_TYPES] },
    { name: 'q', type: 'text', index: true },
    { name: 'resultCount', type: 'number' },
    { name: 'provider', type: 'number', index: true },
    { name: 'locality', type: 'number' },
    { name: 'category', type: 'text' },
    { name: 'locale', type: 'text' },
    { name: 'mobile', type: 'checkbox' },
  ],
  timestamps: true,
  endpoints: [
    {
      // POST /api/analytics-events/track — sent with navigator.sendBeacon from the site.
      path: '/track',
      method: 'post',
      handler: async (req) => {
        const h = req.headers
        if (isBot(h.get('user-agent')) || h.get('dnt') === '1' || h.get('sec-gpc') === '1' || h.get('purpose') === 'prefetch') return new Response(null, { status: 204 })
        const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'local'
        if (!allow(ip)) return new Response(null, { status: 429 })
        const text = await req.text?.().catch(() => '')
        let body: unknown = null
        try {
          body = text && text.length < 2000 ? JSON.parse(text) : null
        } catch {
          body = null
        }
        const row = parseEvent(body as never)
        if (!row) return new Response(null, { status: 400 })
        await req.payload.create({ collection: 'analytics-events', overrideAccess: true, data: row })
        // Housekeeping now and then, so old events don't pile up.
        if (Math.random() < 0.002) {
          const before = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString()
          await req.payload.delete({ collection: 'analytics-events', where: { createdAt: { less_than: before } }, overrideAccess: true }).catch(() => null)
        }
        return new Response(null, { status: 204 })
      },
    },
  ],
}
