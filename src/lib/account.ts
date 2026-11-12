import 'server-only'
import { redirect } from 'next/navigation'

import type { Provider, User } from '@/payload-types'
import { getCurrentUser, getPayloadClient } from './server'

/** Signed-in user with a mobile number, or redirect to sign-in / complete-profile. */
export async function requireUser(next: string): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect(`/signin?next=${encodeURIComponent(next)}`)
  if (!user.phone) redirect(`/account/complete?next=${encodeURIComponent(next)}`)
  return user
}

export async function getOwnedListings(user: User): Promise<Provider[]> {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({ collection: 'providers', where: { owners: { contains: user.id } }, depth: 0, limit: 50, sort: '-updatedAt', user, overrideAccess: false })
  return docs as Provider[]
}

export async function unreadCount(user: User): Promise<number> {
  const payload = await getPayloadClient()
  const { totalDocs } = await payload.count({ collection: 'notifications', where: { and: [{ user: { equals: user.id } }, { read: { equals: false } }] }, overrideAccess: true })
  return totalDocs
}

export function relativeTime(iso: string, locale: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat(locale === 'bn' ? 'bn-IN' : 'en-IN', { numeric: 'auto' })
  const abs = Math.abs(diff)
  if (abs < 60) return rtf.format(Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 604800) return rtf.format(Math.round(diff / 86400), 'day')
  return new Date(iso).toLocaleDateString(locale === 'bn' ? 'bn-IN' : 'en-IN', { dateStyle: 'medium' })
}
