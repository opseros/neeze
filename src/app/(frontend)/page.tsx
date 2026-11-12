import Image from 'next/image'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { getLocale, getTranslations } from 'next-intl/server'

import { LanguagePicker, LocalitySelect } from '@/components/client'
import { VERTICAL_ICON } from '@/components/ui'
import { LOCALE_COOKIE } from '@/i18n/request'
import { getContentLocale, getLocalities, getPayloadClient, getSelectedLocality } from '@/lib/server'

export const dynamic = 'force-dynamic'

const LAUNCH_VERTICALS = ['services', 'health', 'business'] as const
const LATER_VERTICALS = ['market', 'education', 'fitness', 'travel'] as const

export default async function Home() {
  const locale = await getLocale()
  const hasChosenLanguage = Boolean((await cookies()).get(LOCALE_COOKIE))
  if (!hasChosenLanguage) return <Welcome locale={locale} />

  const t = await getTranslations()
  const payload = await getPayloadClient()
  const contentLocale = await getContentLocale()
  const [localities, selected] = await Promise.all([getLocalities(), getSelectedLocality()])
  const [services, news, laterCounts] = await Promise.all([
    payload.find({ collection: 'categories', where: { and: [{ vertical: { equals: 'services' } }, { active: { equals: true } }] }, sort: 'sortOrder', limit: 8, depth: 0, locale: contentLocale }),
    payload.find({ collection: 'news', where: { _status: { equals: 'published' } }, sort: '-publishedAt', limit: 3, depth: 0, locale: contentLocale }),
    payload.find({ collection: 'categories', where: { and: [{ vertical: { in: [...LATER_VERTICALS] } }, { active: { equals: true } }] }, limit: 0, depth: 0 }),
  ])
  const verticals = [...LAUNCH_VERTICALS, ...(laterCounts.totalDocs ? LATER_VERTICALS : [])]

  return (
    <div className="grid gap-5 px-4 pt-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-2xl font-bold tracking-tight text-brand-navy">Neeze</p>
          <p className="text-xs text-muted">{t('app.tagline')}</p>
        </div>
        <div className="w-44">
          <LocalitySelect localities={localities.map((l) => ({ id: l.id, name: l.name }))} current={selected?.id} label={t('home.yourArea')} allLabel={t('home.allSilchar')} />
        </div>
      </header>

      <form action="/explore" role="search" className="flex gap-2">
        <label className="sr-only" htmlFor="q">
          {t('home.search')}
        </label>
        <input id="q" name="q" type="search" enterKeyHint="search" placeholder={t('home.searchPlaceholder')} className="input flex-1" />
        <button className="btn-primary" type="submit">
          {t('home.search')}
        </button>
      </form>

      <section aria-labelledby="browse">
        <h2 id="browse" className="sr-only">
          {t('home.categories')}
        </h2>
        <ul className="grid grid-cols-4 gap-2">
          {verticals.map((v) => (
            <li key={v}>
              <Link href={`/explore?vertical=${v}`} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-white text-center text-xs font-medium">
                <span aria-hidden className="text-2xl">
                  {VERTICAL_ICON[v]}
                </span>
                {t(`verticals.${v}`)}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/emergency" className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-red-200 bg-red-50 text-center text-xs font-medium text-red-900">
              <span aria-hidden className="text-2xl">
                🚑
              </span>
              {t('home.emergency')}
            </Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="svc" className="card bg-brand-navy text-white">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 id="svc" className="text-lg font-semibold">
              {t('home.servicesTitle')}
            </h2>
            <p className="text-sm text-white/80">{t('home.servicesBody')}</p>
          </div>
          <Link href="/explore?vertical=services" className="shrink-0 text-sm underline">
            {t('home.seeAll')}
          </Link>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2">
          {services.docs.map((c) => (
            <li key={c.id}>
              <Link href={`/explore?category=${c.slug}`} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-sm">
                <span aria-hidden>{c.icon}</span> {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {news.docs.length > 0 && (
        <section aria-labelledby="news">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="news" className="font-semibold">
              {t('home.latestNews')}
            </h2>
            <Link href="/news" className="text-sm text-brand-blue">
              {t('home.seeAll')}
            </Link>
          </div>
          <ul className="grid gap-2">
            {news.docs.map((n) => (
              <li key={n.id}>
                <Link href={`/news/${n.slug}`} className="card block">
                  <p className="font-medium">{n.title}</p>
                  {n.publishedAt && <p className="text-xs text-muted">{new Date(n.publishedAt).toLocaleDateString(locale === 'bn' ? 'bn-IN' : 'en-IN', { dateStyle: 'medium' })}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

async function Welcome({ locale }: { locale: string }) {
  const t = await getTranslations('welcome')
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr]">
      <div className="relative h-72 overflow-hidden">
        <Image src="/images/silchar-hero.webp" alt="Silchar from above" fill priority sizes="(max-width: 640px) 100vw, 640px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/90 via-brand-navy/30 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <p className="text-3xl font-bold">Neeze</p>
          <p className="text-sm text-white/90">Everything local, connected · সব কিছু স্থানীয়, এক জায়গায়</p>
        </div>
      </div>
      <div className="grid content-start gap-5 p-5">
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-muted">{t('body')}</p>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">{t('chooseLanguage')} · Choose your language</p>
          <LanguagePicker current={locale} />
        </div>
      </div>
    </div>
  )
}
