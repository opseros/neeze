import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'

import { DEFAULT_LOCALE, isLocale, type Locale, LOCALE_COOKIE } from './locales'

export { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALES, type Locale } from './locales'

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
