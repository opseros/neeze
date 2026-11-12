import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { RequestForm } from '@/components/forms'
import { PageHeader } from '@/components/ui'
import type { Provider } from '@/payload-types'
import { getContentLocale, getCurrentUser, getLocalities, getPayloadClient, getSelectedLocality } from '@/lib/server'

export const dynamic = 'force-dynamic'

const HEALTH_TYPES = new Set(['doctor', 'clinic', 'hospital', 'diagnostic'])

export default async function RequestPage({ params }: { params: Promise<{ providerId: string }> }) {
  const id = Number((await params).providerId)
  if (!Number.isInteger(id)) notFound()
  const payload = await getPayloadClient()
  const { docs } = await payload.find({ collection: 'providers', where: { id: { equals: id } }, depth: 0, limit: 1, locale: await getContentLocale(), overrideAccess: false })
  const p = docs[0] as Provider | undefined
  if (!p || !p.acceptsRequests) notFound()

  const t = await getTranslations('request')
  const [localities, selected, user] = await Promise.all([getLocalities(), getSelectedLocality(), getCurrentUser()])
  const kind = HEALTH_TYPES.has(p.type) ? 'appointment' : 'service'
  const firstCat = (p.categories as number[])[0]

  return (
    <>
      <PageHeader title={kind === 'appointment' ? t('titleAppointment') : t('titleService')} back={`/p/${p.id}`} />
      <div className="grid gap-3 px-4 pt-4">
        <p className="text-muted">{t('to', { name: p.name })}</p>
        <RequestForm
          provider={{ id: p.id, name: p.name, categoryId: typeof firstCat === 'number' ? firstCat : undefined }}
          kind={kind}
          localities={localities.map((l) => ({ id: l.id, name: l.name }))}
          defaultLocality={selected?.id ?? (typeof p.baseLocality === 'number' ? p.baseLocality : undefined)}
          user={user ? { id: user.id, name: user.name, phone: user.phone } : null}
        />
      </div>
    </>
  )
}
