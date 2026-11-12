import { getLocale, getTranslations } from 'next-intl/server'

import { LanguagePicker, OutboxList } from '@/components/client'
import { AuthPanel, SignOutButton } from '@/components/auth'
import { CancelRequestButton } from '@/components/forms'
import { StatusTimeline } from '@/components/timeline'
import { ReviewForm, Stars } from '@/components/reviews'
import { canReview } from '@/lib/reviews'
import { getOwnedListings } from '@/lib/account'
import Link from 'next/link'
import { Store, Bookmark } from 'lucide-react'
import { Container, PageTitle } from '@/components/ui'
import type { Provider } from '@/payload-types'
import { redirect } from 'next/navigation'

import { enabledProviders } from '@/lib/auth/server'
import { getCurrentUser, getPayloadClient } from '@/lib/server'
import { fmtDate } from '@/lib/format'
import { UnblockButton } from '@/components/community'
import { publicName } from '@/lib/reviews'

const CANCELLABLE = new Set(['submitted', 'assigned', 'contacted', 'quoted', 'accepted'])
const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-900',
  cancelled: 'bg-slate-100 text-slate-700',
  rejected: 'bg-slate-100 text-slate-700',
  expired: 'bg-slate-100 text-slate-700',
}

export async function generateMetadata() {
  const t = await getTranslations('me')
  return { title: t('title') }
}

export default async function MePage() {
  const t = await getTranslations()
  const locale = await getLocale()
  const user = await getCurrentUser()

  if (!user) {
    return (
      <>
        <PageTitle title={t('me.title')} />
        <Container className="grid max-w-xl gap-4 py-6 md:py-10">
          <div className="card p-6 md:p-8">
            <AuthPanel providers={enabledProviders()} next="/me" />
          </div>
          <OutboxList />
        </Container>
      </>
    )
  }

  if (!user.phone) redirect('/account/complete?next=/me')
  const payload = await getPayloadClient()
  // Access control does the filtering: a customer only ever sees their own requests.
  const { docs } = await payload.find({
    collection: 'requests',
    where: { customer: { equals: user.id } },
    sort: '-createdAt',
    limit: 50,
    depth: 1,
    user,
    overrideAccess: false,
  })
  const owned = await getOwnedListings(user)
  // `customer` is a private field, so this lookup runs server-side, limited to the signed-in user.
  const myReviews = await payload.find({ collection: 'reviews', where: { customer: { equals: user.id } }, limit: 100, depth: 0, overrideAccess: true })
  const reviewByRequest = new Map(myReviews.docs.map((rv) => [typeof rv.request === 'object' ? rv.request.id : rv.request, rv]))
  const fmt = (d: string) => fmtDate(d, locale, { dateStyle: 'medium', timeStyle: 'short' })
  const blockedIds = ((user.blockedUsers ?? []) as (number | { id: number })[]).map((b) => (typeof b === 'object' ? b.id : b))
  const blocked = blockedIds.length
    ? (await payload.find({ collection: 'users', where: { id: { in: blockedIds } }, limit: 100, depth: 0, overrideAccess: true, select: { name: true } })).docs.map((u) => ({ id: u.id, name: publicName(u.name) }))
    : []

  return (
    <>
      <PageTitle title={t('me.title')} />
      <Container className="grid gap-6 py-6 md:grid-cols-[280px_1fr] md:py-8 lg:gap-10">
        <aside className="grid content-start gap-4 md:sticky md:top-24 md:self-start">
        <section className="card flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.name ?? user.email}</p>
            {user.email && <p className="truncate text-sm text-muted">{user.email}</p>}
            <p className="text-sm text-muted">{user.phone}</p>
          </div>
          <SignOutButton />
        </section>
        <section className="card grid gap-2">
          <h2 className="font-semibold">{t('me.language')}</h2>
          <LanguagePicker current={locale} compact />
        </section>
        <Link href={owned.length ? '/provider' : '/provider/listing/new'} className="card flex items-center gap-3 transition hover:border-brand-blue/40">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-teal/10 text-brand-teal">
            <Store className="size-5" aria-hidden />
          </span>
          <span className="font-semibold">{owned.length ? t('nav2.dashboard') : t('home2.bizCta')}</span>
        </Link>
        <Link href="/saved" className="card flex items-center gap-3 transition hover:border-brand-blue/40">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-blue/10 text-brand-blue">
            <Bookmark className="size-5" aria-hidden />
          </span>
          <span className="font-semibold">{t('me.savedLink')}</span>
        </Link>
        {blocked.length > 0 && (
          <section className="card grid gap-2">
            <h2 className="font-semibold">{t('community.blockedTitle')}</h2>
            <ul className="grid gap-1">
              {blocked.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{b.name}</span>
                  <UnblockButton userId={b.id} />
                </li>
              ))}
            </ul>
          </section>
        )}
        </aside>

        <section className="grid content-start gap-3">
          <h2 className="text-lg font-semibold">{t('me.requests')}</h2>
          <OutboxList />
          {docs.length === 0 ? (
            <p className="card text-muted">{t('me.noRequests')}</p>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {docs.map((r) => {
                const p = typeof r.provider === 'object' ? (r.provider as Provider) : null
                return (
                  <li key={r.id} className="card grid gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{p?.name ?? '—'}</span>
                      <span className={`pill ${STATUS_STYLE[r.status ?? ''] ?? 'bg-sky-100 text-sky-900'}`}>{t(`me.status.${r.status ?? 'submitted'}` as 'me.status.submitted')}</span>
                    </div>
                    <p className="line-clamp-2 text-sm">{r.description}</p>
                    <p className="text-xs text-muted">
                      {r.code} · {fmt(r.createdAt)}
                    </p>
                    {r.quoteNote && <p className="rounded-lg bg-surface p-2 text-sm">{r.quoteNote}</p>}
                    {(() => {
                      const existing = reviewByRequest.get(r.id)
                      if (existing) return <span className="flex items-center gap-2 text-sm"><Stars value={existing.rating} size="size-3.5" /> <span className="text-muted">{t('reviews.thanks')}</span></span>
                      const completedAt = (r.history ?? []).filter((h) => h.status === 'completed').at(-1)?.at
                      return canReview({ isCustomer: true, status: r.status, completedAt, alreadyReviewed: false }).ok ? <ReviewForm requestId={r.id} /> : null
                    })()}
                    <details className="group mt-1">
                      <summary className="cursor-pointer list-none text-sm font-medium text-brand-blue">{t('dash.timeline')} ▾</summary>
                      <div className="mt-3">
                        <StatusTimeline status={r.status ?? 'submitted'} history={r.history} compact />
                      </div>
                    </details>
                    {CANCELLABLE.has(r.status ?? '') && (
                      <div className="text-right">
                        <CancelRequestButton id={r.id} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </Container>
    </>
  )
}
