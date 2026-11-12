import { AlertTriangle, ChevronRight, Inbox, MapPin, MessageSquareQuote, Plus, Store } from 'lucide-react'
import { ReplyForm, Stars } from '@/components/reviews'
import type { Review } from '@/payload-types'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'

import { Container, PageTitle } from '@/components/ui'
import type { Locality, Request as Req } from '@/payload-types'
import { getOwnedListings, relativeTime, requireUser } from '@/lib/account'
import { getPayloadClient } from '@/lib/server'

const TABS = {
  new: ['submitted', 'assigned'],
  active: ['contacted', 'quoted', 'accepted', 'in-progress'],
  done: ['completed', 'cancelled', 'rejected', 'expired'],
} as const
type Tab = keyof typeof TABS | 'reviews'

export async function generateMetadata() {
  const t = await getTranslations('dash')
  return { title: t('title'), robots: { index: false } }
}

export default async function ProviderDashboard({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser('/provider')
  const [t, tm, tr, locale] = await Promise.all([getTranslations('dash'), getTranslations('dash.status'), getTranslations('reviews'), getLocale()])
  const tabParam = (await searchParams).tab
  const tab: Tab = (['new', 'active', 'done', 'reviews'] as const).find((x) => x === tabParam) ?? 'new'
  const listings = await getOwnedListings(user)

  if (!listings.length) {
    return (
      <>
        <PageTitle title={t('title')} />
        <Container className="grid max-w-2xl place-items-center py-12 text-center">
          <span className="grid size-16 place-items-center rounded-2xl bg-brand-teal/10 text-brand-teal">
            <Store className="size-8" aria-hidden />
          </span>
          <h2 className="mt-4 text-2xl font-bold">{t('noListingTitle')}</h2>
          <p className="mt-2 max-w-md text-muted">{t('noListingBody')}</p>
          <Link href="/provider/listing/new" className="btn-primary mt-6 px-8">
            <Plus className="size-4" aria-hidden /> {t('addListing')}
          </Link>
        </Container>
      </>
    )
  }

  const payload = await getPayloadClient()
  const ids = listings.map((l) => l.id)
  const base = { provider: { in: ids } }
  const statusTabs = Object.keys(TABS) as (keyof typeof TABS)[]
  const [list, reviewList, ...counts] = await Promise.all([
    tab === 'reviews'
      ? Promise.resolve({ docs: [] as Req[] })
      : payload.find({ collection: 'requests', where: { and: [base, { status: { in: [...TABS[tab]] } }] }, sort: tab === 'done' ? '-updatedAt' : '-createdAt', limit: 50, depth: 1, user, overrideAccess: false }),
    payload.find({ collection: 'reviews', where: { provider: { in: ids } }, sort: '-createdAt', limit: tab === 'reviews' ? 50 : 1, depth: 0, overrideAccess: true }),
    ...statusTabs.map((k) => payload.count({ collection: 'requests', where: { and: [base, { status: { in: [...TABS[k]] } }] }, user, overrideAccess: false })),
  ])
  const count = { ...Object.fromEntries(statusTabs.map((k, i) => [k, counts[i].totalDocs])), reviews: reviewList.totalDocs ?? 0 } as Record<Tab, number>
  const docs = list.docs as Req[]
  const reviews = reviewList.docs as Review[]
  const listingName = new Map(listings.map((l) => [l.id, l.name]))

  return (
    <>
      <PageTitle title={t('title')} subtitle={t('subtitle')} />
      <Container className="grid gap-6 py-6 lg:grid-cols-[1fr_300px] lg:gap-10 lg:py-8">
        <section>
          <nav className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1" aria-label={t('title')}>
            {([...statusTabs, 'reviews'] as Tab[]).map((k) => (
              <Link
                key={k}
                href={`/provider?tab=${k}`}
                aria-current={tab === k ? 'page' : undefined}
                className={`flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${tab === k ? 'bg-brand-navy text-white' : 'text-muted hover:bg-surface'}`}
              >
                {t(`tabs.${k}`)}
                <span className={`rounded-full px-2 text-xs ${tab === k ? 'bg-white/20' : k === 'new' && count.new ? 'bg-red-600 text-white' : 'bg-surface'}`}>{count[k]}</span>
              </Link>
            ))}
          </nav>

          {tab === 'reviews' ? (
            reviews.length === 0 ? (
              <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-white p-10 text-center">
                <MessageSquareQuote className="size-10 text-muted" aria-hidden />
                <p className="mt-3 max-w-sm text-muted">{tr('noneYet')}</p>
              </div>
            ) : (
              <ul className="grid gap-3">
                {reviews.map((rv) => (
                  <li key={rv.id} className="card grid gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars value={rv.rating} size="size-4" />
                      <span className="font-medium">{rv.authorName}</span>
                      <span className="text-xs text-muted">· {listingName.get(typeof rv.provider === 'object' ? rv.provider.id : rv.provider)} · {relativeTime(rv.createdAt, locale)}</span>
                      {rv.status === 'hidden' && <span className="pill bg-slate-100 text-slate-700">hidden</span>}
                    </div>
                    {rv.comment && <p className="whitespace-pre-line text-sm">{rv.comment}</p>}
                    {rv.reply ? (
                      <div className="rounded-lg border-l-4 border-brand-blue/40 bg-surface p-3 text-sm">
                        <p className="text-xs font-semibold text-muted">{tr('reply')}</p>
                        <p className="mt-1 whitespace-pre-line">{rv.reply}</p>
                      </div>
                    ) : (
                      <ReplyForm reviewId={rv.id} />
                    )}
                  </li>
                ))}
              </ul>
            )
          ) : docs.length === 0 ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-white p-10 text-center">
              <Inbox className="size-10 text-muted" aria-hidden />
              <p className="mt-3 max-w-sm text-muted">{tab === 'new' ? t('emptyNew') : tab === 'active' ? t('emptyActive') : t('emptyDone')}</p>
            </div>
          ) : (
            <ul className="grid gap-3">
              {docs.map((r) => {
                const loc = typeof r.locality === 'object' ? (r.locality as Locality) : null
                return (
                  <li key={r.id}>
                    <Link href={`/provider/requests/${r.id}`} className="card flex items-start gap-4 transition hover:border-brand-blue/40 hover:shadow-sm">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{r.contactName}</span>
                          {r.urgency === 'urgent' && (
                            <span className="pill gap-1 bg-red-100 text-red-800">
                              <AlertTriangle className="size-3" aria-hidden /> {t('urgent')}
                            </span>
                          )}
                          <span className="pill bg-sky-50 text-sky-900 ring-1 ring-sky-200">{tm(r.status as 'submitted')}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-ink/80">{r.description}</p>
                        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                          <span>{r.code}</span>
                          {loc && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" aria-hidden /> {loc.name}
                            </span>
                          )}
                          <span>{t('received', { when: relativeTime(r.createdAt, locale) })}</span>
                        </p>
                      </div>
                      <ChevronRight className="mt-1 size-5 shrink-0 text-muted" aria-hidden />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <aside className="grid content-start gap-3 lg:sticky lg:top-24">
          <h2 className="font-semibold">{t('yourListings')}</h2>
          <ul className="grid gap-2">
            {listings.map((l) => (
              <li key={l.id} className="card flex items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.name}</p>
                  <span className={`pill mt-1 ${l.status === 'published' ? 'bg-emerald-50 text-emerald-900' : l.status === 'suspended' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>
                    {t(`listingStatus.${l.status ?? 'pending-review'}` as 'listingStatus.draft')}
                  </span>
                </div>
                <Link href={`/provider/listing/${l.id}`} className="text-sm font-medium text-brand-blue">
                  {t('edit')}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/provider/listing/new" className="btn-secondary">
            <Plus className="size-4" aria-hidden /> {t('addListing')}
          </Link>
        </aside>
      </Container>
    </>
  )
}
