import { AlertTriangle, CheckCircle2, CircleAlert } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { Container } from '@/components/ui'
import { isStaff } from '@/access/roles'
import { WINDOWS, windowDays } from '@/lib/insights'
import { loadInsights } from '@/lib/insights-server'
import { getCurrentUser } from '@/lib/server'

export const metadata = { title: 'Insights', robots: { index: false } }
export const dynamic = 'force-dynamic'

const num = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-IN'))
const pctText = (n: number | null) => (n == null ? '—' : `${n}%`)
const hours = (h: number | null) => (h == null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h * 10) / 10} h` : `${Math.round(h / 24)} days`)

/** Status always carries an icon and a word, never colour alone. */
function Status({ level, children }: { level: "good" | "warn" | "bad"; children?: React.ReactNode }) {
  const map = {
    good: { Icon: CheckCircle2, cls: 'text-emerald-800 bg-emerald-50', word: 'On track' },
    warn: { Icon: AlertTriangle, cls: 'text-amber-900 bg-amber-50', word: 'Watch' },
    bad: { Icon: CircleAlert, cls: 'text-red-800 bg-red-50', word: 'Needs action' },
  }[level]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${map.cls}`}>
      <map.Icon className="size-3.5" aria-hidden /> {map.word}
      {children}
    </span>
  )
}

function Tile({ label, value, sub, status }: { label: string; value: string; sub?: string; status?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-ink">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
        {status && <Status level={status} />}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  )
}

/** Single-series daily bars: thin, 2px gaps, rounded data end on the baseline, value on hover/focus. */
function Bars({ title, data, unit }: { title: string; data: { day: string; count: number }[]; unit: string }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  const total = data.reduce((s, d) => s + d.count, 0)
  const fmt = (day: string) => new Date(day + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return (
    <figure className="rounded-2xl border border-line bg-white p-4">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-muted tabular-nums">
          {num(total)} {unit}
        </span>
      </figcaption>
      <div className="relative mt-4 h-36 border-b border-line" role="img" aria-label={`${title}: ${data.map((d) => `${fmt(d.day)} ${d.count}`).join(', ')}`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" aria-hidden />
        <span className="absolute -top-2 left-0 bg-white pr-1 text-[11px] text-muted tabular-nums" aria-hidden>
          {max}
        </span>
        <div className="flex h-full items-end gap-[2px]">
          {data.map((d) => (
            <div key={d.day} tabIndex={0} className="group relative flex h-full flex-1 items-end outline-none">
              <div className="w-full rounded-t-[4px] bg-brand-navy group-hover:bg-brand-blue group-focus-visible:bg-brand-blue" style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 2 : 0 }} />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-white group-hover:block group-focus-visible:block">
                {fmt(d.day)}: {d.count}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted" aria-hidden>
        <span>{fmt(data[0].day)}</span>
        <span>{fmt(data[data.length - 1].day)}</span>
      </div>
    </figure>
  )
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  // Staff sign in at /admin with a password and may have no mobile number, so no requireUser here.
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login?redirect=%2Finsights')
  if (!isStaff(user)) notFound()
  const days = windowDays((await searchParams).days)
  const d = await loadInsights(days)
  const r = d.response
  const responseLevel = r.rate == null ? undefined : r.rate >= 80 ? 'good' : r.rate >= 50 ? 'warn' : 'bad'
  const noResultLevel = d.funnel.noResultRate == null ? undefined : d.funnel.noResultRate <= 15 ? 'good' : d.funnel.noResultRate <= 30 ? 'warn' : 'bad'
  const modLevel = d.moderation.oldestOpenHours == null ? 'good' : d.moderation.oldestOpenHours <= 24 ? 'warn' : 'bad'

  return (
    <Container className="py-6 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Insights</h1>
          <p className="text-muted">Launch KPIs for the last {days} days. Anonymous: no names, numbers or accounts behind these counts.</p>
        </div>
        <nav aria-label="Time range" className="flex gap-1 rounded-xl border border-line bg-white p-1">
          {WINDOWS.map((w) => (
            <Link key={w} href={`/insights?days=${w}`} aria-current={w === days ? 'page' : undefined} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${w === days ? 'bg-brand-navy text-white' : 'text-muted hover:text-ink'}`}>
              {w} days
            </Link>
          ))}
        </nav>
      </div>

      <h2 className="mt-8 text-lg font-semibold">People finding providers</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Searches" value={num(d.funnel.searches)} sub={`${pctText(d.funnel.noResultRate)} found nothing`} status={noResultLevel} />
        <Tile label="Listing views" value={num(d.funnel.views)} sub={d.funnel.mobileShare != null ? `${d.funnel.mobileShare}% of all activity on phones` : undefined} />
        <Tile label="Call + WhatsApp taps" value={num(d.funnel.calls + d.funnel.whatsapp)} sub={`${num(d.funnel.calls)} calls · ${num(d.funnel.whatsapp)} WhatsApp`} />
        <Tile label="Requests sent" value={num(d.funnel.requests)} sub={`${pctText(d.funnel.conversion)} of listing views`} />
      </div>

      <h2 className="mt-8 text-lg font-semibold">Providers answering</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={`Answered within ${r.targetHours} h`} value={pctText(r.rate)} sub={`of ${num(r.counted)} requests old enough to judge`} status={responseLevel as never} />
        <Tile label="Median time to first answer" value={hours(r.medianHours)} />
        <Tile label="Never answered" value={num(r.unanswered)} sub={`older than ${r.targetHours} h`} status={r.unanswered ? 'bad' : r.counted ? 'good' : undefined} />
        <Tile label="Jobs completed" value={num(d.outcome.completed)} sub={`${pctText(d.outcome.completionRate)} of requests · ${num(d.outcome.reviews)} reviews (${pctText(d.outcome.feedbackRate)})`} />
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Bars title="Requests per day" data={d.daily.requests} unit="requests" />
        <Bars title="Searches per day" data={d.daily.searches} unit="searches" />
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold">Providers needing a nudge</h2>
          <p className="text-sm text-muted">Slowest first. Call them, check their number, or pause the listing.</p>
          {r.providers.length ? (
            <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="px-3 py-2 font-medium">Provider</th>
                    <th className="px-3 py-2 text-right font-medium">Requests</th>
                    <th className="px-3 py-2 text-right font-medium">In {r.targetHours} h</th>
                    <th className="px-3 py-2 text-right font-medium">Unanswered</th>
                    <th className="px-3 py-2 text-right font-medium">Median</th>
                  </tr>
                </thead>
                <tbody>
                  {r.providers.map((p) => (
                    <tr key={p.provider} className="border-b border-line last:border-0">
                      <td className="px-3 py-2">
                        <Link href={`/admin/collections/providers/${p.provider}`} className="font-medium text-brand-blue">{p.name}</Link>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.requests}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pctText(p.rate)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.unanswered}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{hours(p.medianHours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-line bg-white p-4 text-sm text-muted">Every provider answered within {r.targetHours} hours, or there are no requests old enough yet.</p>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold">Searches that found nothing</h2>
          <p className="text-sm text-muted">What to list next, or an alias to add (Admin → Categories / Localities).</p>
          {d.noResultTerms.length ? (
            <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="px-3 py-2 font-medium">Search</th>
                    <th className="px-3 py-2 text-right font-medium">Times</th>
                    <th className="px-3 py-2 text-right font-medium">Last</th>
                  </tr>
                </thead>
                <tbody>
                  {d.noResultTerms.map((t) => (
                    <tr key={t.q} className="border-b border-line last:border-0">
                      <td className="px-3 py-2">
                        <Link href={`/explore?q=${encodeURIComponent(t.q)}`} className="text-brand-blue">{t.q}</Link>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.n}</td>
                      <td className="px-3 py-2 text-right text-muted">{new Date(t.last).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-line bg-white p-4 text-sm text-muted">No empty searches in this period.</p>
          )}
          {d.topSearches.length > 0 && (
            <>
              <h3 className="mt-5 font-semibold">Most searched</h3>
              <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                {d.topSearches.map((t) => (
                  <li key={t.q} className="rounded-full border border-line bg-white px-3 py-1">
                    {t.q} <span className="text-muted tabular-nums">· {t.n}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <h2 className="mt-8 text-lg font-semibold">Community and moderation</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Open reports" value={num(d.moderation.openReports)} sub={d.moderation.oldestOpenHours != null ? `oldest ${hours(d.moderation.oldestOpenHours)}` : 'none waiting'} status={modLevel} />
        <Tile label="Median time to resolve" value={hours(d.moderation.medianResolveHours)} sub={`${num(d.moderation.resolved)} resolved`} />
        <Tile label="Posts waiting for review" value={num(d.moderation.pendingPosts)} sub={d.moderation.oldestPendingHours != null ? `oldest ${hours(d.moderation.oldestPendingHours)}` : undefined} status={d.moderation.pendingPosts ? (d.moderation.oldestPendingHours! > 24 ? 'bad' : 'warn') : 'good'} />
        <Tile label="New accounts" value={num(d.newUsers)} sub={`${num(d.moderation.postsPublished)} posts published · ${num(d.funnel.installs)} app installs`} />
      </div>
      <p className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
        <Link href="/admin/collections/content-reports?where[status][equals]=open" className="text-brand-blue">Open reports →</Link>
        <Link href="/admin/collections/posts?where[status][equals]=pending" className="text-brand-blue">Review queue →</Link>
        <Link href="/admin" className="text-brand-blue">Admin →</Link>
      </p>
      <p className="mt-8 text-xs text-muted">
        Counted: searches on Explore, listing page views, call/WhatsApp taps and app installs, from browsers that don’t send Do Not Track. Requests, answers, reviews and reports come from the records themselves. Events are kept for 400 days.
      </p>
    </Container>
  )
}
