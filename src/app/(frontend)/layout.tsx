import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'

import { PwaChrome } from '@/components/client'
import { BottomNav } from '@/components/ui'
import { getSiteSettings } from '@/lib/server'
import './styles.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app')
  return {
    metadataBase: new URL(siteUrl),
    title: { default: 'Neeze', template: '%s · Neeze' },
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
  const settings = await getSiteSettings().catch(() => null)
  const banner = settings?.alertBanner
  return (
    <html lang={locale}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
          {t('skip')}
        </a>
        <NextIntlClientProvider>
          <PwaChrome />
          {banner?.enabled && banner.message && (
            <div role="alert" className={`px-4 py-2 text-center text-sm font-medium ${TONE[banner.tone ?? 'warning']}`}>
              {banner.message}{' '}
              <a href="/emergency" className="underline">
                ☎
              </a>
            </div>
          )}
          <main id="main" className="mx-auto min-h-dvh max-w-xl pb-24">
            {children}
          </main>
          <BottomNav />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
