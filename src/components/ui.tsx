import { ArrowLeft, BadgeCheck, Bell, ChevronRight, MapPin, Phone, Star } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import type { Category, Locality, Provider } from '@/payload-types'
import { SignInButton, type Providers } from './auth'
import { HeaderNav, LanguageToggle, MobileTabBar } from './nav'
import { CategoryIcon } from './icons'
import { usesBengaliNames } from '@/i18n/locales'

export function Container({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-bold tracking-tight text-brand-navy ${className}`} aria-label="Neeze home">
      <Image src="/icons/icon-192.png" alt="" width={32} height={32} className="size-8 rounded-lg" priority unoptimized />
      <span className="text-xl">Neeze</span>
    </Link>
  )
}

/* ---------- Site chrome ---------- */

export async function SiteHeader({ locale, signedIn, providers, unread = 0 }: { locale: string; signedIn: boolean; providers: Providers; unread?: number }) {
  const t = await getTranslations()
  const links = [
    { href: '/explore?vertical=services', label: t('nav.services'), match: 'services' },
    { href: '/explore?vertical=health', label: t('nav.health'), match: 'health' },
    { href: '/explore?vertical=business', label: t('nav.business'), match: 'business' },
    { href: '/news', label: t('nav.news'), match: '/news' },
    { href: '/emergency', label: t('nav.emergency'), match: '/emergency' },
  ]
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <Container className="flex h-16 items-center gap-4">
        <Logo />
        <HeaderNav links={links} />
        <form action="/explore" role="search" className="ml-auto hidden max-w-xs flex-1 lg:block">
          <label htmlFor="header-q" className="sr-only">
            {t('home.search')}
          </label>
          <input id="header-q" name="q" type="search" placeholder={t('home.searchPlaceholder')} className="input h-10 py-0 text-sm" />
        </form>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <LanguageToggle current={locale} label={t('nav.language')} />
          {signedIn ? (
            <>
              <Link href="/notifications" aria-label={t('nav2.notifications')} className="relative grid size-10 place-items-center rounded-lg border border-line text-ink hover:bg-surface">
                <Bell className="size-5" aria-hidden />
                {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
              </Link>
              <Link href="/me" className="hidden h-10 items-center rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:bg-surface md:inline-flex">
                {t('nav.account')}
              </Link>
            </>
          ) : (
            <SignInButton label={t('nav.signIn')} providers={providers} className="hidden h-10 items-center rounded-lg bg-brand-navy px-4 text-sm font-semibold text-white hover:bg-brand-navy/90 md:inline-flex" />
          )}
        </div>
      </Container>
    </header>
  )
}

export async function SiteFooter({ supportPhone }: { supportPhone?: string | null }) {
  const t = await getTranslations()
  return (
    <footer className="mt-16 border-t border-line bg-white">
      <Container className="grid gap-8 py-8 text-sm md:grid-cols-2 md:py-10 lg:grid-cols-4">
        <div className="grid content-start gap-3 lg:col-span-2">
          <Logo />
          <p className="max-w-sm text-muted">{t('footer.about')}</p>
        </div>
        <nav aria-label={t('footer.explore')} className="hidden content-start gap-2 md:grid">
          <p className="font-semibold text-ink">{t('footer.explore')}</p>
          <Link href="/explore?vertical=services" className="text-muted hover:text-ink">{t('nav.services')}</Link>
          <Link href="/explore?vertical=health" className="text-muted hover:text-ink">{t('nav.health')}</Link>
          <Link href="/explore?vertical=business" className="text-muted hover:text-ink">{t('nav.business')}</Link>
          <Link href="/news" className="text-muted hover:text-ink">{t('nav.news')}</Link>
        </nav>
        <div className="grid content-start gap-2">
          <p className="font-semibold text-ink">{t('footer.help')}</p>
          <Link href="/emergency" className="text-muted hover:text-ink">{t('home.emergency')}</Link>
          <Link href="/me" className="text-muted hover:text-ink">{t('me.requests')}</Link>
          <Link href="/provider" className="text-muted hover:text-ink">{t('nav2.dashboard')}</Link>
          <p className="mt-2 font-semibold text-ink">
            <Link href="/provider/listing/new" className="hover:text-brand-navy">{t('footer.listBusiness')}</Link>
          </p>
          <p className="text-muted">
            {t('footer.listBusinessBody')}
            {supportPhone && (
              <>
                {' '}
                <a href={`tel:${supportPhone}`} className="font-medium text-brand-blue">
                  {supportPhone}
                </a>
              </>
            )}
          </p>
        </div>
      </Container>
      <div className="border-t border-line">
        <Container className="py-4 text-xs text-muted">© {new Date().getFullYear()} {t('footer.rights')}</Container>
      </div>
    </footer>
  )
}

export async function MobileNav() {
  const t = await getTranslations('nav')
  return <MobileTabBar labels={{ home: t('home'), explore: t('explore'), news: t('news'), saved: t('saved'), me: t('me') }} />
}

/* ---------- Page pieces ---------- */

export function PageTitle({ title, subtitle, back, crumbs }: { title: string; subtitle?: string; back?: string; crumbs?: { href: string; label: string }[] }) {
  return (
    <div className="border-b border-line bg-white">
      <Container className="py-5 md:py-8">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2 hidden text-sm text-muted md:block">
            <ol className="flex flex-wrap items-center gap-1">
              {crumbs.map((c) => (
                <li key={c.href} className="flex items-center gap-1">
                  <Link href={c.href} className="hover:text-ink">
                    {c.label}
                  </Link>
                  <ChevronRight className="size-3.5" aria-hidden />
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className="flex items-center gap-2">
          {back && (
            <Link href={back} aria-label="Back" className="-ml-1 rounded-lg p-1 text-brand-navy md:hidden">
              <ArrowLeft className="size-5" />
            </Link>
          )}
          <h1 className="text-xl font-bold tracking-tight text-ink md:text-3xl">{title}</h1>
        </div>
        {subtitle && <p className="mt-1 text-muted md:text-lg">{subtitle}</p>}
      </Container>
    </div>
  )
}

const VERIF_STYLE: Record<string, string> = {
  none: 'bg-slate-100 text-slate-700',
  phone: 'bg-sky-50 text-sky-900 ring-1 ring-sky-200',
  identity: 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200',
  credential: 'bg-emerald-100 text-emerald-950 ring-1 ring-emerald-300',
}

export async function VerificationBadge({ level }: { level?: string | null }) {
  const t = await getTranslations('provider.verification')
  const l = (level ?? 'none') as 'none' | 'phone' | 'identity' | 'credential'
  return (
    <span className={`pill shrink-0 gap-1 ${VERIF_STYLE[l]}`}>
      {l !== 'none' && <BadgeCheck className="size-3.5" aria-hidden />}
      {t(l)}
    </span>
  )
}

const objs = <T,>(xs: unknown[] | null | undefined) => (xs ?? []).filter((x): x is T => typeof x === 'object' && x !== null)

export async function ProviderCard({ p, locale }: { p: Provider; locale: string }) {
  const t = await getTranslations('provider')
  const base = typeof p.baseLocality === 'object' ? (p.baseLocality as Locality) : null
  const cats = objs<Category>(p.categories as unknown[])
  const primary = cats[0]
  const displayName = usesBengaliNames(locale) && p.nameBn ? p.nameBn : p.name
  return (
    <li className="lift group flex flex-col rounded-2xl border border-line bg-white p-4 shadow-card">
      <Link href={`/p/${p.id}`} className="flex flex-1 gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-blue/15 to-brand-teal/10 text-brand-navy">
          <CategoryIcon slug={primary?.slug} vertical={primary?.vertical} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="font-semibold text-ink group-hover:text-brand-navy">{displayName}</span>
          </span>
          <span className="mt-0.5 block text-sm text-muted">{cats.slice(0, 2).map((c) => c.name).join(', ')}</span>
          {base && (
            <span className="mt-1 flex items-center gap-1 text-sm text-muted">
              <MapPin className="size-3.5" aria-hidden /> {base.name}
            </span>
          )}
          {(p.ratingCount ?? 0) >= 3 && p.ratingAvg != null && (
            <span className="mt-1 flex items-center gap-1 text-sm font-medium text-ink">
              <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden /> {p.ratingAvg.toFixed(1)}
              <span className="font-normal text-muted">({p.ratingCount})</span>
            </span>
          )}
          {p.summary && <span className="mt-2 line-clamp-2 block text-sm text-ink/80">{p.summary}</span>}
          <span className="mt-3 block">
            <VerificationBadge level={p.verification} />
          </span>
        </span>
      </Link>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <a className="btn-secondary h-10 min-h-0 py-0 text-sm" href={`tel:${p.phone}`}>
          <Phone className="size-4" aria-hidden /> {t('call')}
        </a>
        <Link className="btn-primary h-10 min-h-0 py-0 text-sm" href={`/p/${p.id}`}>
          {t('request')}
        </Link>
      </div>
    </li>
  )
}
