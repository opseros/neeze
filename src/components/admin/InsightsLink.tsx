import Link from 'next/link'

/** Shown above the admin dashboard: a way into the launch KPIs. */
export function InsightsLink() {
  return (
    <div style={{ marginBottom: 'var(--base)', padding: 'calc(var(--base) * 0.8)', border: '1px solid var(--theme-elevation-150)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <strong>Insights</strong>
        <div style={{ opacity: 0.7, fontSize: 13 }}>Searches with no results, request conversion, provider response times, moderation backlog.</div>
      </div>
      <Link href="/insights" style={{ fontWeight: 600 }}>
        Open Insights →
      </Link>
    </div>
  )
}
