import 'server-only'
import config from '@payload-config'
import { cookies, headers } from 'next/headers'
import { getLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import { cache } from 'react'

import type { Locality, User } from '@/payload-types'

export const LOCALITY_COOKIE = 'neeze_locality'

export const getPayloadClient = cache(() => getPayload({ config }))

/** The signed-in user (OTP session or staff JWT), or null. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: await headers() })
  return (user as User | null) ?? null
})

export const getContentLocale = async () => (await getLocale()) as 'en' | 'bn'

export const getLocalities = cache(async (): Promise<Locality[]> => {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'localities',
    where: { active: { equals: true } },
    sort: 'sortOrder',
    limit: 200,
    depth: 0,
    locale: await getContentLocale(),
  })
  return docs
})

export const getSelectedLocality = cache(async (): Promise<Locality | null> => {
  const id = Number((await cookies()).get(LOCALITY_COOKIE)?.value)
  if (!id) return null
  return (await getLocalities()).find((l) => l.id === id) ?? null
})

export const getSiteSettings = cache(async () => {
  const payload = await getPayloadClient()
  return payload.findGlobal({ slug: 'site-settings', locale: await getContentLocale(), depth: 0 })
})
