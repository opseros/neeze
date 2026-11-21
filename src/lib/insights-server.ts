import 'server-only'

import { sql } from '@payloadcms/db-postgres'

import { type RequestRow, RESPONSE_TARGET_HOURS, dailySeries, median, pct, responseByProvider } from './insights'
import { getPayloadClient } from './server'

type Rows<T> = { rows: T[] }

/** Everything the Insights page shows, for the last `days` days. Staff-only (checked by the page). */
export async function loadInsights(days: number) {
  const payload = await getPayloadClient()
  const db = payload.db.drizzle
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const q = async <T,>(query: ReturnType<typeof sql>) => ((await db.execute(query)) as unknown as Rows<T>).rows

  const [events, noResult, topSearches, requests, reqDays, searchDays, reviews, moderation, posts, users] = await Promise.all([
    q<{ type: string; n: string; zero: string; mobile: string }>(sql`
      SELECT type::text, count(*) n, count(*) FILTER (WHERE type = 'search' AND result_count = 0) zero, count(*) FILTER (WHERE mobile) mobile
      FROM analytics_events WHERE created_at >= ${since} GROUP BY type`),
    q<{ q: string; n: string; last: string }>(sql`
      SELECT q, count(*) n, max(created_at) last FROM analytics_events
      WHERE type = 'search' AND result_count = 0 AND q IS NOT NULL AND created_at >= ${since}
      GROUP BY q ORDER BY n DESC, last DESC LIMIT 20`),
    q<{ q: string; n: string; avg: string }>(sql`
      SELECT q, count(*) n, round(avg(result_count)) avg FROM analytics_events
      WHERE type = 'search' AND q IS NOT NULL AND created_at >= ${since}
      GROUP BY q ORDER BY n DESC LIMIT 10`),
    q<{ id: number; provider: number; provider_name: string; created_at: string; status: string; first_response: string | null }>(sql`
      SELECT r.id, r.provider_id provider, p.name provider_name, r.created_at, r.status::text,
        (SELECT min(h.at) FROM requests_history h WHERE h._parent_id = r.id AND h.by = 'provider') first_response
      FROM requests r JOIN providers p ON p.id = r.provider_id
      WHERE r.created_at >= ${since}`),
    q<{ created_at: string }>(sql`SELECT created_at FROM requests WHERE created_at >= ${since}`),
    q<{ created_at: string }>(sql`SELECT created_at FROM analytics_events WHERE type = 'search' AND created_at >= ${since}`),
    q<{ n: string }>(sql`SELECT count(*) n FROM reviews WHERE created_at >= ${since}`),
    q<{ open: string; oldest: string | null; resolved_hours: string | null; resolved: string }>(sql`
      SELECT count(*) FILTER (WHERE status = 'open') open,
        min(created_at) FILTER (WHERE status = 'open') oldest,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM resolved_at - created_at) / 3600)
          FILTER (WHERE status <> 'open' AND resolved_at >= ${since}) resolved_hours,
        count(*) FILTER (WHERE status <> 'open' AND resolved_at >= ${since}) resolved
      FROM content_reports`),
    q<{ pending: string; oldest: string | null; published: string }>(sql`
      SELECT count(*) FILTER (WHERE status = 'pending') pending, min(created_at) FILTER (WHERE status = 'pending') oldest,
        count(*) FILTER (WHERE status = 'published' AND created_at >= ${since}) published
      FROM posts`),
    q<{ n: string }>(sql`SELECT count(*) n FROM users WHERE created_at >= ${since}`),
  ])

  const ev = (t: string) => Number(events.find((e) => e.type === t)?.n ?? 0)
  const searches = ev('search')
  const zero = Number(events.find((e) => e.type === 'search')?.zero ?? 0)
  const views = ev('provider_view')
  const allEvents = events.reduce((s, e) => s + Number(e.n), 0)
  const mobileShare = pct(events.reduce((s, e) => s + Number(e.mobile), 0), allEvents)

  const reqRows: RequestRow[] = requests.map((r) => ({ id: r.id, provider: r.provider, providerName: r.provider_name, createdAt: r.created_at, status: r.status, firstResponseAt: r.first_response }))
  const perProvider = responseByProvider(reqRows)
  const counted = perProvider.reduce((s, p) => s + p.requests, 0)
  const inTarget = perProvider.reduce((s, p) => s + p.respondedInTarget, 0)
  const firstHours = reqRows.filter((r) => r.firstResponseAt).map((r) => (new Date(r.firstResponseAt!).getTime() - new Date(r.createdAt).getTime()) / 3600_000)
  const completed = reqRows.filter((r) => r.status === 'completed').length
  const hoursSince = (d: string | null) => (d ? Math.round((Date.now() - new Date(d).getTime()) / 3600_000) : null)

  return {
    days,
    funnel: {
      searches,
      noResult: zero,
      noResultRate: pct(zero, searches),
      views,
      calls: ev('call'),
      whatsapp: ev('whatsapp'),
      requests: reqRows.length,
      conversion: pct(reqRows.length, views),
      installs: ev('install'),
      mobileShare,
    },
    response: {
      targetHours: RESPONSE_TARGET_HOURS,
      rate: pct(inTarget, counted),
      counted,
      medianHours: median(firstHours),
      unanswered: perProvider.reduce((s, p) => s + p.unanswered, 0),
      providers: perProvider.filter((p) => (p.rate ?? 0) < 100).slice(0, 15),
    },
    outcome: { completed, completionRate: pct(completed, reqRows.length), reviews: Number(reviews[0]?.n ?? 0), feedbackRate: pct(Number(reviews[0]?.n ?? 0), completed) },
    moderation: {
      openReports: Number(moderation[0]?.open ?? 0),
      oldestOpenHours: hoursSince(moderation[0]?.oldest ?? null),
      medianResolveHours: moderation[0]?.resolved_hours == null ? null : Math.round(Number(moderation[0].resolved_hours) * 10) / 10,
      resolved: Number(moderation[0]?.resolved ?? 0),
      pendingPosts: Number(posts[0]?.pending ?? 0),
      oldestPendingHours: hoursSince(posts[0]?.oldest ?? null),
      postsPublished: Number(posts[0]?.published ?? 0),
    },
    newUsers: Number(users[0]?.n ?? 0),
    noResultTerms: noResult.map((r) => ({ q: r.q, n: Number(r.n), last: r.last })),
    topSearches: topSearches.map((r) => ({ q: r.q, n: Number(r.n), avg: Number(r.avg) })),
    daily: { requests: dailySeries(reqDays.map((r) => r.created_at), Math.min(days, 30)), searches: dailySeries(searchDays.map((r) => r.created_at), Math.min(days, 30)) },
  }
}

export type Insights = Awaited<ReturnType<typeof loadInsights>>
