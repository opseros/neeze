import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'

export const LOCALES = ['bn', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'bn'
export const LOCALE_COOKIE = 'NEXT_LOCALE'

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale)

// Locale lives in a cookie, not the URL, so /admin and /api stay untouched.
export default getRequestConfig(async () => {
  const store = await cookies()
  const v = store.get(LOCALE_COOKIE)?.value
  const locale: Locale = isLocale(v) ? v : DEFAULT_LOCALE
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'Asia/Kolkata',
  }
})
