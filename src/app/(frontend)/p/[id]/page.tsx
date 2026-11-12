import { CalendarClock, Clock, MapPin, MessageCircle, Phone, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'

import { SaveButton } from '@/components/client'
import { ReportButton, Stars } from '@/components/reviews'
import { CategoryIcon } from '@/components/icons'
import { Container, PageTitle, VerificationBadge } from '@/components/ui'
import type { Category, Locality, Media } from '@/payload-types'
import { getProviderCached, getProviderReviewsCached } from '@/lib/cache'
import { MIN_REVIEWS_FOR_AVERAGE } from '@/lib/reviews'
import { requestKindFor } from '@/lib/kinds'
import { getContentLocale } from '@/lib/server'
import { fmtDate } from '@/lib/format'
import { usesBengaliNames } from '@/i18n/locales'


async function load(id: string) {
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) return null
  return getProviderCached(n, await getContentLocale())
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const p = await load((await params).id)
  return p ? { title: p.name, description: p.summary ?? undefined } : {}
}

export default async function ProviderPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await load((await params).id)
  if (!p) notFound()
  const [t, locale, reviews] = await Promise.all([getTranslations(), getLocale(), getProviderReviewsCached(p.id, 20)])
  const ratingCount = p.ratingCount ?? 0
  const showAvg = ratingCount >= MIN_REVIEWS_FOR_AVERAGE && p.ratingAvg != null
  const cats = (p.categories as (number | Category)[]).filter((c): c is Category => typeof c === 'object')
  const primary = cats[0]
  const base = typeof p.baseLocality === 'object' ? (p.baseLocality as Locality) : null
  const areas = ((p.serviceLocalities ?? []) as (number | Locality)[]).filter((l): l is Locality => typeof l === 'object')
  const photos = ((p.photos ?? []) as (number | Media)[]).filter((m): m is Media => typeof m === 'object')
  const kind = requestKindFor(p.type)
  const wa = p.whatsapp?.replace(/\D/g, '')
  const mapUrl = p.lat != null && p.lng != null ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` : null
  const dateFmt = (d: string) => fmtDate(d, locale, { dateStyle: 'medium' })
  const displayName = usesBengaliNames(locale) && p.nameBn ? p.nameBn : p.name
  const savePayload = { id: p.id, name: p.name, nameBn: p.nameBn, phone: p.phone, whatsapp: p.whatsapp, locality: base?.name, categories: cats.map((c) => c.name) }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="mb-3 font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )

  return (
    <>
      <PageTitle
        title={displayName}
        subtitle={[cats.map((c) => c.name).join(', '), base?.name].filter(Boolean).join(' · ')}
        back="/explore"
        crumbs={[
          { href: '/', label: t('provider.breadcrumbHome') },
          ...(primary ? [{ href: `/explore?category=${primary.slug}`, label: primary.name }] : [{ href: '/explore', label: t('explore.title') }]),
        ]}
      />
      <Container className="grid gap-6 py-6 lg:grid-cols-[1fr_340px] lg:gap-10 lg:py-8">
        {/* Contact card: first on phones, right-hand column on desktop */}
        <aside className="lg:order-2 lg:sticky lg:top-24 lg:self-start">
          <div className="grid gap-3 rounded-2xl border border-line bg-white p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-blue/10 text-brand-navy">
                <CategoryIcon slug={primary?.slug} vertical={primary?.vertical} className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{t('provider.contactTitle')}</p>
                <VerificationBadge level={p.verification} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              <a className="btn-primary" href={`tel:${p.phone}`}>
                <Phone className="size-4" aria-hidden /> {t('provider.call')}
                <span className="hidden font-normal opacity-80 lg:inline">{p.phone}</span>
              </a>
              {wa && (
                <a className="btn-whatsapp" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" aria-hidden /> {t('provider.whatsapp')}
                </a>
              )}
            </div>
            {p.acceptsRequests ? (
              <Link className="btn-secondary border-brand-navy text-brand-navy" href={`/request/${p.id}`}>
                <CalendarClock className="size-4" aria-hidden /> {kind === 'appointment' ? t('provider.appointment') : kind === 'enquiry' ? t('provider.enquiry') : t('provider.request')}
              </Link>
            ) : (
              <p className="rounded-lg bg-surface p-3 text-sm text-muted">{t('provider.notAccepting')}</p>
            )}
            <SaveButton provider={savePayload} />
            {ratingCount > 0 && (
              <a href="#reviews" className="flex items-center gap-2 text-sm">
                {showAvg && <Stars value={p.ratingAvg!} />}
                <span className="font-medium text-ink">{showAvg ? t('reviews.summary', { avg: p.ratingAvg!.toFixed(1), count: ratingCount }) : t('reviews.fewReviews', { count: ratingCount })}</span>
              </a>
            )}
            <p className="flex gap-2 text-xs text-muted">
              <ShieldCheck className="size-4 shrink-0" aria-hidden /> {t('provider.verificationHelp')}
            </p>
            {p.lastConfirmedAt && <p className="text-xs text-muted">{t('provider.lastConfirmed', { date: dateFmt(p.lastConfirmedAt) })}</p>}
          </div>
        </aside>

        <div className="grid content-start gap-4 lg:order-1">
          {(p.summary || p.nameBn) && (
            <Section title={t('provider.about')}>
              {locale !== 'bn' && p.nameBn && <p className="mb-2 text-muted">{p.nameBn}</p>}
              {p.summary && <p className="leading-relaxed">{p.summary}</p>}
            </Section>
          )}

          {p.services && p.services.length > 0 && (
            <Section title={t('provider.services')}>
              <ul className="divide-y divide-line">
                {p.services.map((s) => (
                  <li key={s.id} className="flex justify-between gap-4 py-2.5">
                    <span>{s.title}</span>
                    <span className="shrink-0 text-muted">
                      {s.pricingType === 'quote' || s.price == null ? t('provider.quote') : s.pricingType === 'from' ? t('provider.from', { price: s.price }) : t('provider.fixed', { price: s.price })}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {areas.length > 0 && (
              <Section title={t('provider.areas')}>
                <ul className="flex flex-wrap gap-2">
                  {areas.map((a) => (
                    <li key={a.id} className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-sm">
                      <MapPin className="size-3.5 text-muted" aria-hidden /> {a.name}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            {p.hours && p.hours.length > 0 && (
              <Section title={t('provider.hours')}>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  {p.hours.map((h) => (
                    <div key={h.id} className="contents">
                      <dt className="flex items-center gap-1.5 text-muted">
                        <Clock className="size-3.5" aria-hidden /> {h.days}
                      </dt>
                      <dd>{h.time}</dd>
                    </div>
                  ))}
                </dl>
              </Section>
            )}
            {(p.address || mapUrl) && (
              <Section title={t('provider.address')}>
                {p.address && <p className="whitespace-pre-line text-sm">{p.address}</p>}
                {mapUrl && (
                  <a className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-blue" href={mapUrl} target="_blank" rel="noopener noreferrer">
                    <MapPin className="size-4" aria-hidden /> {t('provider.openMap')}
                  </a>
                )}
              </Section>
            )}
          </div>

          <section id="reviews" className="scroll-mt-24 rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-ink">{t('reviews.title')}</h2>
              {showAvg && (
                <span className="flex items-center gap-2 text-sm">
                  <Stars value={p.ratingAvg!} /> <span className="font-semibold">{p.ratingAvg!.toFixed(1)}</span>
                  <span className="text-muted">({ratingCount})</span>
                </span>
              )}
            </div>
            {reviews.length === 0 ? (
              <p className="text-sm text-muted">{t('reviews.noneYet')}</p>
            ) : (
              <ul className="divide-y divide-line">
                {reviews.map((rv) => (
                  <li key={rv.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars value={rv.rating} size="size-3.5" />
                      <span className="font-medium">{rv.authorName}</span>
                      <span className="pill bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200">{t('reviews.verified')}</span>
                      <span className="text-xs text-muted">{dateFmt(rv.createdAt)}</span>
                    </div>
                    {rv.comment && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{rv.comment}</p>}
                    {rv.reply && (
                      <div className="mt-3 rounded-lg border-l-4 border-brand-blue/40 bg-surface p-3 text-sm">
                        <p className="text-xs font-semibold text-muted">{t('reviews.reply')}</p>
                        <p className="mt-1 whitespace-pre-line">{rv.reply}</p>
                      </div>
                    )}
                    <div className="mt-2">
                      <ReportButton reviewId={rv.id} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {photos.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((m) => (
                <li key={m.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.sizes?.card?.url ?? m.url ?? ''} alt={m.alt} loading="lazy" className="aspect-[4/3] w-full rounded-xl object-cover" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </>
  )
}
