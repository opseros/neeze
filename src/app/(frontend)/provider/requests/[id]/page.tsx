import { AlertTriangle, CalendarClock, MapPin, MessageCircle, Phone } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'

import { ProviderActions } from '@/components/provider-actions'
import { StatusTimeline } from '@/components/timeline'
import { Container, PageTitle } from '@/components/ui'
import type { Locality, Provider, Request as Req } from '@/payload-types'
import { relativeTime, requireUser } from '@/lib/account'
import { canTransition, type RequestStatus } from '@/lib/requestStatus'
import { getPayloadClient } from '@/lib/server'
import { fmtDate } from '@/lib/format'

const NEXT: Array<'contacted' | 'quoted' | 'accepted' | 'in-progress' | 'completed' | 'rejected'> = ['contacted', 'quoted', 'accepted', 'in-progress', 'completed', 'rejected']

export default async function ProviderRequest({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  const user = await requireUser(`/provider/requests/${(await params).id}`)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const payload = await getPayloadClient()
  // Access control limits this to requests for listings the user owns.
  const { docs } = await payload.find({ collection: 'requests', where: { and: [{ id: { equals: id } }, { 'provider.owners': { contains: user.id } }] }, limit: 1, depth: 1, user, overrideAccess: false })
  const r = docs[0] as Req | undefined
  if (!r) notFound()

  const [t, tr, locale] = await Promise.all([getTranslations('dash'), getTranslations('request'), getLocale()])
  const provider = typeof r.provider === 'object' ? (r.provider as Provider) : null
  const loc = typeof r.locality === 'object' ? (r.locality as Locality) : null
  const allowed = NEXT.filter((s) => s !== r.status && canTransition('provider', r.status as RequestStatus, s))
  const wa = r.contactPhone.replace(/\D/g, '')

  return (
    <>
      <PageTitle title={`${r.contactName} · ${r.code}`} subtitle={provider?.name} back="/provider" crumbs={[{ href: '/provider', label: t('backToInbox') }]} />
      <Container className="grid gap-6 py-6 lg:grid-cols-[1fr_320px] lg:gap-10 lg:py-8">
        <aside className="grid content-start gap-4 lg:order-2 lg:sticky lg:top-24">
          <section className="card grid gap-3 p-5">
            <h2 className="font-semibold">{t('customer')}</h2>
            <p>
              <span className="block font-medium">{r.contactName}</span>
              <span className="text-muted">{r.contactPhone}</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <a href={`tel:${r.contactPhone}`} className="btn-primary">
                <Phone className="size-4" aria-hidden /> {t('callCustomer')}
              </a>
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                <MessageCircle className="size-4" aria-hidden /> {t('whatsappCustomer')}
              </a>
            </div>
          </section>
          <section className="card grid gap-3 p-5">
            <h2 className="font-semibold">{t('actionsTitle')}</h2>
            <ProviderActions id={r.id} allowed={allowed} />
          </section>
          <Link href="/provider" className="text-center text-sm font-medium text-brand-blue">
            ← {t('backToInbox')}
          </Link>
        </aside>
        <div className="grid content-start gap-4 lg:order-1">
          <section className="card grid gap-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{t('need')}</h2>
              {r.urgency === 'urgent' && (
                <span className="pill gap-1 bg-red-100 text-red-800">
                  <AlertTriangle className="size-3" aria-hidden /> {t('urgent')}
                </span>
              )}
            </div>
            <p className="whitespace-pre-line leading-relaxed">{r.description}</p>
            <dl className="grid gap-2 border-t border-line pt-3 text-sm sm:grid-cols-2">
              {loc && (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 text-muted" aria-hidden />
                  <div>
                    <dt className="text-muted">{t('area')}</dt>
                    <dd className="font-medium">{loc.name}</dd>
                  </div>
                </div>
              )}
              {(r.preferredDate || r.preferredWindow) && (
                <div className="flex items-start gap-2">
                  <CalendarClock className="mt-0.5 size-4 text-muted" aria-hidden />
                  <div>
                    <dt className="text-muted">{tr('window')}</dt>
                    <dd className="font-medium">
                      {[r.preferredDate && fmtDate(r.preferredDate, locale, { dateStyle: 'medium' }), tr(`windows.${r.preferredWindow ?? 'any'}` as 'windows.any')].filter(Boolean).join(' · ')}
                    </dd>
                  </div>
                </div>
              )}
              {r.address && (
                <div className="sm:col-span-2">
                  <dt className="text-muted">{t('address')}</dt>
                  <dd className="whitespace-pre-line font-medium">{r.address}</dd>
                </div>
              )}
            </dl>
            <p className="text-xs text-muted">{t('received', { when: relativeTime(r.createdAt, locale) })}</p>
          </section>
          {r.quoteNote && (
            <section className="card border-brand-teal/40 bg-brand-teal/5 p-5">
              <h2 className="mb-1 font-semibold">{t('act.quoted')}</h2>
              <p className="whitespace-pre-line">{r.quoteNote}</p>
            </section>
          )}
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">{t('timeline')}</h2>
            <StatusTimeline status={r.status ?? 'submitted'} history={r.history} audience="provider" />
          </section>
        </div>

      </Container>
    </>
  )
}
