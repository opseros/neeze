import { ArrowRight, Phone, Siren } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { getLocale, getTranslations } from 'next-intl/server'

import { LanguagePicker } from '@/components/client'
import { CategoryIcon, VERTICAL_ICONS } from '@/components/icons'
import { Container, ProviderCard } from '@/components/ui'
import { LOCALE_COOKIE } from '@/i18n/request'
import { getActiveVerticals, getCategoriesCached, getFeaturedProvidersCached, getNewsListCached } from '@/lib/cache'
import { getContentLocale, getLocalities, getSelectedLocality, getSiteSettings } from '@/lib/server'

const VERTICAL_ORDER = ['services', 'health', 'business', 'market', 'education', 'fitness', 'travel'] as const

export default async function Home() {
  const [locale, contentLocale, t] = await Promise.all([getLocale(), getContentLocale(), getTranslations()])
  const hasChosenLanguage = Boolean((await cookies()).get(LOCALE_COOKIE))
  const [localities, selected, categories, activeVerticals, featured, news, settings] = await Promise.all([
    getLocalities(),
    getSelectedLocality(),
    getCategoriesCached(contentLocale),
    getActiveVerticals(),
    getFeaturedProvidersCached(contentLocale, 6),
    getNewsListCached(contentLocale, 3),
    getSiteSettings().catch(() => null),
  ])
  const verticals = VERTICAL_ORDER.filter((v) => activeVerticals.includes(v))
  const serviceCats = categories.filter((c) => c.vertical === 'services')
  const emergency = (settings?.emergencyContacts ?? []).slice(0, 3)
  const dateFmt = (d: string) => new Date(d).toLocaleDateString(locale === 'bn' ? 'bn-IN' : 'en-IN', { dateStyle: 'medium' })

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-brand-navy">
        <Image src="/images/silchar-hero.webp" alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-45" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-navy via-brand-navy/85 to-brand-navy/30" />
        <Container className="py-10 md:py-20">
          <div className="max-w-2xl text-white">
            <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-5xl">{t('hero.title')}</h1>
            <p className="mt-3 text-base text-white/85 md:text-lg">{t('hero.subtitle')}</p>
            <form action="/explore" role="search" className="mt-6 grid gap-2 rounded-2xl bg-white p-2 shadow-lg sm:grid-cols-[1fr_auto_auto]">
              <label htmlFor="q" className="sr-only">
                {t('home.search')}
              </label>
              <input id="q" name="q" type="search" enterKeyHint="search" placeholder={t('home.searchPlaceholder')} className="h-12 rounded-xl px-3 text-base text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-brand-blue" />
              <label htmlFor="locality" className="sr-only">
                {t('home.yourArea')}
              </label>
              <select id="locality" name="locality" defaultValue={selected?.id ?? 'all'} className="h-12 rounded-xl border border-line bg-surface px-3 text-sm text-ink">
                <option value="all">{t('hero.areaAll')}</option>
                {localities.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-primary h-12 px-6">
                {t('hero.searchButton')}
              </button>
            </form>
            {!hasChosenLanguage && (
              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/85">
                <span>{t('welcome.chooseLanguage')} · Choose your language</span>
                <LanguagePicker current={locale} compact />
              </div>
            )}
          </div>
        </Container>
      </section>

      {/* Emergency strip */}
      {emergency.length > 0 && (
        <div className="border-b border-red-100 bg-red-50">
          <Container className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-red-900">
              <Siren className="size-4" aria-hidden /> {t('home.emergencyStrip')}
            </span>
            {emergency.map((c) => (
              <a key={c.id} href={`tel:${c.phone}`} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-semibold text-red-800 ring-1 ring-red-200 hover:bg-red-100">
                <Phone className="size-3.5" aria-hidden /> {c.phone} <span className="font-normal text-red-900/70">· {c.label}</span>
              </a>
            ))}
            <Link href="/emergency" className="ml-auto font-medium text-red-900 underline-offset-2 hover:underline">
              {t('home.allEmergency')}
            </Link>
          </Container>
        </div>
      )}

      {/* Categories */}
      <Container className="pt-10 md:pt-14">
        <h2 className="text-xl font-bold tracking-tight md:text-2xl">{t('home.browseTitle')}</h2>
        <ul className={`mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 ${verticals.length > 3 ? 'lg:grid-cols-4' : ''}`}>
          {verticals.map((v) => {
            const Icon = VERTICAL_ICONS[v]
            return (
              <li key={v}>
                <Link href={`/explore?vertical=${v}`} className="flex h-full items-start gap-3 rounded-2xl border border-line bg-white p-4 transition hover:border-brand-blue/40 hover:shadow-sm">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-teal/10 text-brand-teal">
                    <Icon className="size-5" aria-hidden strokeWidth={1.75} />
                  </span>
                  <span>
                    <span className="block font-semibold text-ink">{t(`verticals.${v}`)}</span>
                    <span className="mt-0.5 block text-sm text-muted">{t(`verticalsDesc.${v}`)}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </Container>

      {/* Neeze Services */}
      <Container className="pt-10 md:pt-14">
        <div className="rounded-3xl bg-white p-5 ring-1 ring-line md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">{t('home.servicesTitle')}</h2>
              <p className="mt-1 text-muted">{t('home.servicesBody')}</p>
            </div>
            <Link href="/explore?vertical=services" className="inline-flex items-center gap-1 font-semibold text-brand-blue">
              {t('home.viewAll')} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {serviceCats.map((c) => (
              <li key={c.id}>
                <Link href={`/explore?category=${c.slug}`} className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-3 text-sm font-medium text-ink transition hover:border-brand-blue/40 hover:bg-surface">
                  <CategoryIcon slug={c.slug} vertical={c.vertical} className="size-5 shrink-0 text-brand-navy" />
                  <span className="min-w-0">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      {/* Featured providers */}
      {featured.length > 0 && (
        <Container className="pt-10 md:pt-14">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">{t('home.featured')}</h2>
            <Link href="/explore" className="inline-flex items-center gap-1 font-semibold text-brand-blue">
              {t('home.viewAll')} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => (
              <ProviderCard key={p.id} p={p} locale={locale} />
            ))}
          </ul>
        </Container>
      )}

      {/* News */}
      {news.length > 0 && (
        <Container className="pt-10 md:pt-14">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">{t('home.latestNews')}</h2>
            <Link href="/news" className="inline-flex items-center gap-1 font-semibold text-brand-blue">
              {t('home.viewAll')} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {news.map((n) => (
              <li key={n.id}>
                <Link href={`/news/${n.slug}`} className="block h-full rounded-2xl border border-line bg-white p-4 transition hover:border-brand-blue/40 hover:shadow-sm">
                  <p className="font-semibold text-ink">{n.title}</p>
                  {n.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{n.summary}</p>}
                  {n.publishedAt && <p className="mt-2 text-xs text-muted">{dateFmt(n.publishedAt)}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      )}
    </>
  )
}
