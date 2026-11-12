import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import Link from 'next/link'

import { PwaChrome } from '@/components/client'
import { MobileNav, SiteFooter, SiteHeader } from '@/components/ui'
import { enabledProviders } from '@/lib/auth/server'
import { getSiteSettings } from '@/lib/server'
import { SESSION_COOKIE } from '@/lib/session'
import './styles.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app')
  return {
    metadataBase: new URL(siteUrl),
    title: { default: 'Neeze · Silchar', template: '%s · Neeze' },
    description: t('tagline'),
    applicationName: 'Neeze',
    appleWebApp: { capable: true, title: 'Neeze', statusBarStyle: 'default' },
    formatDetection: { telephone: false },
    icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
    openGraph: { title: 'Neeze', description: t('tagline'), images: ['/images/og.jpg'], type: 'website', locale: 'bn_IN' },
  }
}

export const viewport: Viewport = {
  themeColor: '#173B62',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

const TONE: Record<string, string> = {
  info: 'bg-sky-100 text-sky-950',
  warning: 'bg-amber-100 text-amber-950',
  critical: 'bg-red-700 text-white',
}

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const t = await getTranslations('app')
  // Static pages (the offline fallback) are prerendered at build time: don't touch the database then.
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build'
  const settings = isBuild ? null : await getSiteSettings().catch(() => null)
  const banner = settings?.alertBanner
  const store = isBuild ? null : await cookies()
  const signedIn = Boolean(store?.get(SESSION_COOKIE) || store?.get('payload-token'))

  return (
    <html lang={locale}>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
          {t('skip')}
        </a>
        <NextIntlClientProvider>
          <PwaChrome />
          {banner?.enabled && banner.message && (
            <div role="alert" className={`px-4 py-2 text-center text-sm font-medium ${TONE[banner.tone ?? 'warning']}`}>
              {banner.message}{' '}
              <Link href="/emergency" className="underline">
                ☎
              </Link>
            </div>
          )}
          <SiteHeader locale={locale} signedIn={signedIn} providers={enabledProviders()} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter supportPhone={settings?.supportPhone} />
          <div className="h-16 md:hidden" aria-hidden />
          <MobileNav />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
