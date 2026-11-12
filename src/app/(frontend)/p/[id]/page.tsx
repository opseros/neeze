import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'

import { SaveButton } from '@/components/client'
import { PageHeader, VerificationBadge } from '@/components/ui'
import type { Category, Locality, Media, Provider } from '@/payload-types'
import { getContentLocale, getPayloadClient } from '@/lib/server'

export const dynamic = 'force-dynamic'

const HEALTH_TYPES = new Set(['doctor', 'clinic', 'hospital', 'diagnostic'])

async function load(id: string): Promise<Provider | null> {
  const n = Number(id)
  if (!Number.isInteger(n)) return null
  const payload = await getPayloadClient()
  // overrideAccess: false + no user = public view only (published listings).
  const { docs } = await payload.find({
    collection: 'providers',
    where: { id: { equals: n } },
    depth: 1,
    limit: 1,
    locale: await getContentLocale(),
    overrideAccess: false,
  })
  return (docs[0] as Provider) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const p = await load((await params).id)
  return p ? { title: p.name, description: p.summary ?? undefined } : {}
}

export default async function ProviderPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await load((await params).id)
  if (!p) notFound()
  const t = await getTranslations('provider')
  const locale = await getLocale()
  const cats = (p.categories as (number | Category)[]).filter((c): c is Category => typeof c === 'object')
  const base = typeof p.baseLocality === 'object' ? (p.baseLocality as Locality) : null
  const areas = ((p.serviceLocalities ?? []) as (number | Locality)[]).filter((l): l is Locality => typeof l === 'object')
  const photos = ((p.photos ?? []) as (number | Media)[]).filter((m): m is Media => typeof m === 'object')
  const isHealth = HEALTH_TYPES.has(p.type)
  const wa = p.whatsapp?.replace(/\D/g, '')
  const mapUrl = p.lat != null && p.lng != null ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` : null
  const dateFmt = (d: string) => new Date(d).toLocaleDateString(locale === 'bn' ? 'bn-IN' : 'en-IN', { dateStyle: 'medium' })

  return (
    <>
      <PageHeader title={p.name} back="/explore" />
      <article className="grid gap-4 px-4 pt-4">
        <section className="card grid gap-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold">{p.name}</h2>
              {p.nameBn && <p className="text-muted">{p.nameBn}</p>}
            </div>
            <VerificationBadge level={p.verification} />
          </div>
          <p className="text-sm text-muted">{[cats.map((c) => c.name).join(', '), base?.name].filter(Boolean).join(' · ')}</p>
          {p.summary && <p>{p.summary}</p>}
          <p className="text-xs text-muted">{t('verificationHelp')}</p>
          {p.lastConfirmedAt && <p className="text-xs text-muted">{t('lastConfirmed', { date: dateFmt(p.lastConfirmedAt) })}</p>}
        </section>

        <div className="grid grid-cols-2 gap-2">
          <a className="btn-primary" href={`tel:${p.phone}`}>
            📞 {t('call')}
          </a>
          {wa ? (
            <a className="btn-whatsapp" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
              {t('whatsapp')}
            </a>
          ) : (
            <SaveButton provider={{ id: p.id, name: p.name, nameBn: p.nameBn, phone: p.phone, whatsapp: p.whatsapp, locality: base?.name, categories: cats.map((c) => c.name) }} />
          )}
        </div>
        {p.acceptsRequests ? (
          <Link className="btn-secondary border-brand-navy text-brand-navy" href={`/request/${p.id}`}>
            {isHealth ? t('appointment') : t('request')}
          </Link>
        ) : (
          <p className="card text-sm text-muted">{t('notAccepting')}</p>
        )}
        {wa && <SaveButton provider={{ id: p.id, name: p.name, nameBn: p.nameBn, phone: p.phone, whatsapp: p.whatsapp, locality: base?.name, categories: cats.map((c) => c.name) }} />}

        {p.services && p.services.length > 0 && (
          <section className="card">
            <h3 className="mb-2 font-semibold">{t('services')}</h3>
            <ul className="divide-y divide-line">
              {p.services.map((s) => (
                <li key={s.id} className="flex justify-between gap-3 py-2 text-sm">
                  <span>{s.title}</span>
                  <span className="shrink-0 text-muted">
                    {s.pricingType === 'quote' || s.price == null ? t('quote') : s.pricingType === 'from' ? t('from', { price: s.price }) : t('fixed', { price: s.price })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {areas.length > 0 && (
          <section className="card">
            <h3 className="mb-2 font-semibold">{t('areas')}</h3>
            <p className="text-sm">{areas.map((a) => a.name).join(', ')}</p>
          </section>
        )}

        {p.hours && p.hours.length > 0 && (
          <section className="card">
            <h3 className="mb-2 font-semibold">{t('hours')}</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {p.hours.map((h) => (
                <div key={h.id} className="contents">
                  <dt className="text-muted">{h.days}</dt>
                  <dd>{h.time}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {(p.address || mapUrl) && (
          <section className="card text-sm">
            <h3 className="mb-1 font-semibold">{t('address')}</h3>
            {p.address && <p className="whitespace-pre-line">{p.address}</p>}
            {mapUrl && (
              <a className="mt-2 inline-block text-brand-blue underline" href={mapUrl} target="_blank" rel="noopener noreferrer">
                {t('openMap')}
              </a>
            )}
          </section>
        )}

        {photos.length > 0 && (
          <ul className="flex snap-x gap-2 overflow-x-auto">
            {photos.map((m) => (
              <li key={m.id} className="shrink-0 snap-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.sizes?.card?.url ?? m.url ?? ''} alt={m.alt} loading="lazy" className="h-40 w-56 rounded-xl object-cover" />
              </li>
            ))}
          </ul>
        )}
      </article>
    </>
  )
}
