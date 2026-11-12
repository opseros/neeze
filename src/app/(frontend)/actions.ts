'use server'

import { cookies } from 'next/headers'

import { LOCALE_COOKIE, isLocale } from '@/i18n/request'
import { LOCALITY_COOKIE } from '@/lib/server'

const YEAR = 60 * 60 * 24 * 365

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return
  ;(await cookies()).set(LOCALE_COOKIE, locale, { path: '/', maxAge: YEAR, sameSite: 'lax' })
}

export async function setLocalityAction(id: number | null) {
  const store = await cookies()
  if (!id || !Number.isInteger(id)) store.delete(LOCALITY_COOKIE)
  else store.set(LOCALITY_COOKIE, String(id), { path: '/', maxAge: YEAR, sameSite: 'lax' })
}
