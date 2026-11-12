import 'server-only'
import config from '@payload-config'
import { cookies, headers } from 'next/headers'
import { getLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import { cache } from 'react'

import type { Locality, User } from '@/payload-types'
import { getLocalitiesCached, getSettingsCached } from './cache'
import { SESSION_COOKIE } from './session'

export const LOCALITY_COOKIE = 'neeze_locality'

export const getPayloadClient = cache(() => getPayload({ config }))

export const getContentLocale = async () => ((await getLocale()) === 'en' ? 'en' : 'bn') as 'en' | 'bn'

/**
 * The signed-in user, or null. Anonymous visitors have no auth cookie, so we return
 * straight away without starting Payload or touching the database.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const store = await cookies()
  if (!store.get(SESSION_COOKIE) && !store.get('payload-token')) return null
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: await headers() })
  return (user as User | null) ?? null
})

export const getLocalities = async (): Promise<Locality[]> => getLocalitiesCached(await getContentLocale())

export const getSelectedLocality = cache(async (): Promise<Locality | null> => {
  const id = Number((await cookies()).get(LOCALITY_COOKIE)?.value)
  if (!id) return null
  return (await getLocalities()).find((l) => l.id === id) ?? null
})

export const getSiteSettings = async () => getSettingsCached(await getContentLocale())
