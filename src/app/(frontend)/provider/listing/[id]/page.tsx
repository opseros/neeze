import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { ListingForm } from '@/components/listing-form'
import { Container, PageTitle } from '@/components/ui'
import type { Provider } from '@/payload-types'
import { requireUser } from '@/lib/account'
import { getCategoriesCached } from '@/lib/cache'
import { getContentLocale, getLocalities, getPayloadClient } from '@/lib/server'

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id
  const user = await requireUser(`/provider/listing/${raw}`)
  const [t, tv, contentLocale] = await Promise.all([getTranslations('listing'), getTranslations('verticals'), getContentLocale()])
  const [categories, localities] = await Promise.all([getCategoriesCached(contentLocale), getLocalities()])

  let listing: Provider | null = null
  if (raw !== 'new') {
    const id = Number(raw)
    if (!Number.isInteger(id)) notFound()
    const payload = await getPayloadClient()
    const { docs } = await payload.find({ collection: 'providers', where: { and: [{ id: { equals: id } }, { owners: { contains: user.id } }] }, limit: 1, depth: 0, locale: contentLocale, user, overrideAccess: false })
    listing = (docs[0] as Provider) ?? null
    if (!listing) notFound()
  }

  return (
    <>
      <PageTitle title={listing ? t('editTitle') : t('newTitle')} subtitle={listing ? listing.name : t('intro')} back="/provider" />
      <Container className="max-w-3xl py-6 md:py-8">
        <div className="card p-5 md:p-8">
          <ListingForm
            categories={categories.map((c) => ({ id: c.id, name: c.name, group: tv(c.vertical as 'services') }))}
            localities={localities.map((l) => ({ id: l.id, name: l.name }))}
            initial={
              listing
                ? {
                    id: listing.id,
                    name: listing.name,
                    nameBn: listing.nameBn,
                    type: listing.type,
                    category: (listing.categories as number[])[0],
                    summary: listing.summary,
                    baseLocality: listing.baseLocality as number,
                    serviceLocalities: (listing.serviceLocalities ?? []) as number[],
                    phone: listing.phone,
                    whatsapp: listing.whatsapp,
                    address: listing.address,
                    acceptsRequests: listing.acceptsRequests,
                  }
                : undefined
            }
          />
        </div>
      </Container>
    </>
  )
}
