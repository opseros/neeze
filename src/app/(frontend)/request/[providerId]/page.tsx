import { MapPin, Phone } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { RequestForm } from '@/components/forms'
import { Container, PageTitle, VerificationBadge } from '@/components/ui'
import type { Locality } from '@/payload-types'
import { getProviderCached } from '@/lib/cache'
import { getContentLocale, getCurrentUser, getLocalities, getSelectedLocality } from '@/lib/server'

const HEALTH_TYPES = new Set(['doctor', 'clinic', 'hospital', 'diagnostic'])

export default async function RequestPage({ params }: { params: Promise<{ providerId: string }> }) {
  const id = Number((await params).providerId)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const p = await getProviderCached(id, await getContentLocale())
  if (!p || !p.acceptsRequests) notFound()

  const t = await getTranslations()
  const [localities, selected, user] = await Promise.all([getLocalities(), getSelectedLocality(), getCurrentUser()])
  const kind = HEALTH_TYPES.has(p.type) ? 'appointment' : 'service'
  const firstCat = (p.categories as (number | { id: number })[])[0]
  const categoryId = typeof firstCat === 'object' ? firstCat.id : firstCat
  const base = typeof p.baseLocality === 'object' ? (p.baseLocality as Locality) : null

  return (
    <>
      <PageTitle
        title={kind === 'appointment' ? t('request.titleAppointment') : t('request.titleService')}
        subtitle={t('request.to', { name: p.name })}
        back={`/p/${p.id}`}
        crumbs={[
          { href: '/', label: t('provider.breadcrumbHome') },
          { href: `/p/${p.id}`, label: p.name },
        ]}
      />
      <Container className="grid gap-6 py-6 md:grid-cols-[1fr_280px] md:py-8 lg:gap-10">
        <div className="rounded-2xl border border-line bg-white p-5 md:p-6">
          <RequestForm
            provider={{ id: p.id, name: p.name, categoryId }}
            kind={kind}
            localities={localities.map((l) => ({ id: l.id, name: l.name }))}
            defaultLocality={selected?.id ?? base?.id}
            user={user ? { id: user.id, name: user.name, phone: user.phone } : null}
          />
        </div>
        <aside className="hidden md:block md:sticky md:top-24 md:self-start">
          <div className="grid gap-2 rounded-2xl border border-line bg-white p-5 text-sm">
            <p className="font-semibold text-ink">{p.name}</p>
            {base && (
              <p className="flex items-center gap-1 text-muted">
                <MapPin className="size-3.5" aria-hidden /> {base.name}
              </p>
            )}
            <VerificationBadge level={p.verification} />
            <a href={`tel:${p.phone}`} className="mt-2 inline-flex items-center gap-1.5 font-medium text-brand-blue">
              <Phone className="size-4" aria-hidden /> {p.phone}
            </a>
          </div>
        </aside>
      </Container>
    </>
  )
}
