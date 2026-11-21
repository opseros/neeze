import { MessageCircle, Phone, Search, Siren } from 'lucide-react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { getLocale, getTranslations } from 'next-intl/server'

import { LanguagePicker } from '@/components/client'
import { VERTICAL_ICONS } from '@/components/icons'
import { Container } from '@/components/ui'
import { LOCALE_COOKIE } from '@/i18n/request'
import { getActiveVerticals, getCommunityFeedCached, getNewsFrontCached } from '@/lib/cache'
import { getViewer } from '@/lib/community-server'
import { fmtDate, relativeTime } from '@/lib/format'
import type { Spotlight } from '@/lib/landing'
import { getContentLocale, getLocalities, getSelectedLocality, getSiteSettings } from '@/lib/server'
import type { Media, News } from '@/payload-types'

/* ---------- small pieces shared by the news pages ---------- */

/** Each section keeps one colour everywhere; the name always sits beside it, so colour never stands alone. */
const SECTION_COLOR: Record<string, string> = {
  local: 'bg-brand-navy',
  civic: 'bg-brand-blue',
  health: 'bg-brand-teal',
  education: 'bg-violet-600',
  transport: 'bg-amber-500',
  events: 'bg-pink-600',
  business: 'bg-slate-500',
  alerts: 'bg-red-600',
}

export async function SectionMark({ section, href = true }: { section?: string | null; href?: boolean }) {
  const s = section || 'local'
  const t = await getTranslations('news.sections')
  const inner = (
    <>
      <span className={`size-2 rounded-[2px] ${SECTION_COLOR[s] ?? SECTION_COLOR.local}`} aria-hidden />
      {t(s as 'local')}
    </>
  )
  const cls = 'relative z-10 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink'
  return href ? (
    <Link href={`/news?section=${s}`} className={`${cls} hover:underline`}>
      {inner}
    </Link>
  ) : (
    <span className={cls}>{inner}</span>
  )
}

export function newsImage(n: News, size: 'hero' | 'card' | 'thumb' = 'card') {
  const m = typeof n.image === 'object' && n.image ? (n.image as Media) : null
  if (!m?.url) return null
  return { src: m.sizes?.[size]?.url ?? m.sizes?.card?.url ?? m.url, alt: m.alt ?? '' }
}

export function NewsTime({ date, locale }: { date?: string | null; locale: string }) {
  if (!date) return null
  return (
    <time dateTime={date} className="text-[13px] text-muted" title={fmtDate(date, locale, { dateStyle: 'long', timeStyle: 'short' })}>
      {relativeTime(date, locale)}
    </time>
  )
}

/* ---------- spotlight (temporary landing change) ---------- */

const TONE: Record<Spotlight['tone'], { band: string; button: string; overlay: string }> = {
  navy: { band: 'bg-brand-navy text-white', button: 'bg-white text-brand-navy hover:bg-white/90', overlay: 'from-brand-navy/95 via-brand-navy/70 to-brand-navy/10' },
  teal: { band: 'bg-[#0f6e5a] text-white', button: 'bg-white text-[#0f6e5a] hover:bg-white/90', overlay: 'from-[#0b4f41]/95 via-[#0b4f41]/70 to-[#0b4f41]/10' },
  alert: { band: 'bg-red-700 text-white', button: 'bg-white text-red-800 hover:bg-white/90', overlay: 'from-red-900/95 via-red-900/75 to-red-900/15' },
}

export function SpotlightBand({ s }: { s: Spotlight }) {
  const tone = TONE[s.tone]
  const external = s.buttonLink?.startsWith('https://')
  return (
    <section aria-label={s.headline} className={`relative isolate overflow-hidden ${tone.band}`}>
      {s.imageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.imageUrl} alt="" className="absolute inset-0 -z-20 size-full object-cover" />
          <div className={`absolute inset-0 -z-10 bg-gradient-to-r ${tone.overlay}`} />
        </>
      )}
      <Container className={`grid gap-4 ${s.imageUrl ? 'py-12 md:py-20' : 'py-6 md:py-8'} md:grid-cols-[1fr_auto] md:items-end`}>
        <div className="max-w-2xl">
          {s.tone === 'alert' && <Siren className="mb-2 size-6" aria-hidden />}
          <h2 className={`font-news font-bold leading-tight tracking-tight ${s.imageUrl ? 'text-[1.75rem] md:text-4xl' : 'text-2xl md:text-[1.75rem]'}`}>{s.headline}</h2>
          {s.text && <p className="mt-2 max-w-xl text-base text-white/90 md:text-lg">{s.text}</p>}
        </div>
        {s.buttonLink && s.buttonLabel && (
          <a href={s.buttonLink} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={`inline-flex h-12 items-center justify-center rounded-xl px-6 font-semibold ${tone.button}`}>
            {s.buttonLabel}
          </a>
        )}
      </Container>
    </section>
  )
}

/* ---------- story layouts ---------- */

async function Lead({ n, locale }: { n: News; locale: string }) {
  const img = newsImage(n, 'hero')
  return (
    <article className="group relative grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-8 lg:grid-cols-1 lg:gap-5">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img.src} alt={img.alt} fetchPriority="high" className="-mx-4 aspect-[16/10] w-[calc(100%+2rem)] max-w-none object-cover sm:mx-0 sm:w-full sm:rounded-2xl md:aspect-[4/3] lg:aspect-[16/8]" />
      ) : null}
      <div className={`grid content-center gap-3 ${img ? '' : 'md:col-span-2 md:max-w-3xl'}`}>
        <SectionMark section={n.section} />
        <h2 className={`font-news font-bold leading-[1.15] tracking-tight text-ink ${img ? 'text-2xl md:text-[1.75rem] lg:max-w-[26ch] lg:text-[2rem]' : 'text-2xl md:text-[1.875rem] lg:max-w-[30ch]'}`}>
          <Link href={`/news/${n.slug}`} className="after:absolute after:inset-0 group-hover:underline group-hover:underline-offset-4">
            {n.title}
          </Link>
        </h2>
        {n.summary && <p className="line-clamp-4 max-w-[60ch] text-base leading-relaxed text-muted lg:text-lg">{n.summary}</p>}
        <NewsTime date={n.publishedAt} locale={locale} />
      </div>
    </article>
  )
}

async function Secondary({ n, locale }: { n: News; locale: string }) {
  const img = newsImage(n, 'card')
  // Phones: a compact row with a thumbnail on the right. From sm up: picture on top.
  return (
    <article className="group relative flex gap-4 border-t border-line pt-4 first:border-t-0 first:pt-0 sm:grid sm:content-start sm:gap-2 sm:border-t-0 sm:pt-0">
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img.src} alt={img.alt} loading="lazy" className="order-last size-20 shrink-0 rounded-lg object-cover sm:order-none sm:aspect-[3/2] sm:size-auto sm:w-full sm:rounded-xl" />
      )}
      <div className="grid min-w-0 flex-1 content-start gap-1 sm:gap-2">
        <SectionMark section={n.section} />
        <h3 className="font-news text-base font-bold leading-snug text-ink sm:text-[17px] md:text-lg">
          <Link href={`/news/${n.slug}`} className="after:absolute after:inset-0 group-hover:underline group-hover:underline-offset-4">
            {n.title}
          </Link>
        </h3>
        {!img && n.summary && <p className="line-clamp-3 hidden text-sm text-muted sm:block">{n.summary}</p>}
        <NewsTime date={n.publishedAt} locale={locale} />
      </div>
    </article>
  )
}

export async function Brief({ n, locale }: { n: News; locale: string }) {
  const img = newsImage(n, 'thumb')
  return (
    <li className="group relative flex gap-4 border-t border-line py-4 first:border-t-0">
      <div className="grid min-w-0 flex-1 content-start gap-1">
        <SectionMark section={n.section} />
        <h3 className="font-news text-base font-bold leading-snug text-ink">
          <Link href={`/news/${n.slug}`} className="after:absolute after:inset-0 group-hover:underline group-hover:underline-offset-4">
            {n.title}
          </Link>
        </h3>
        <NewsTime date={n.publishedAt} locale={locale} />
      </div>
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img.src} alt="" loading="lazy" className="size-20 shrink-0 rounded-lg object-cover md:h-20 md:w-28" />
      )}
    </li>
  )
}

/* ---------- the front page ---------- */

const VERTICAL_ORDER = ['services', 'health', 'business', 'market', 'education', 'fitness', 'travel'] as const

export async function NewsFront() {
  const [locale, contentLocale, t] = await Promise.all([getLocale(), getContentLocale(), getTranslations()])
  const hasChosenLanguage = Boolean((await cookies()).get(LOCALE_COOKIE))
  const [{ lead, rest }, localities, selected, settings, activeVerticals, feed, viewer] = await Promise.all([
    getNewsFrontCached(contentLocale),
    getLocalities(),
    getSelectedLocality(),
    getSiteSettings().catch(() => null),
    getActiveVerticals(),
    getCommunityFeedCached({ page: 1 }, contentLocale),
    getViewer(),
  ])
  const secondary = rest.slice(0, 3)
  const briefs = rest.slice(3, 10)
  const verticals = VERTICAL_ORDER.filter((v) => activeVerticals.includes(v))
  const emergency = (settings?.emergencyContacts ?? []).slice(0, 4)
  const community = feed.docs.filter((p) => !p.authorId || !viewer.blocked.has(p.authorId)).slice(0, 3)
  const today = fmtDate(new Date(), locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      {/* Masthead: where and when. */}
      <div className="border-b border-line bg-white">
        <Container className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <p className="text-sm text-muted">
            <span className="font-semibold text-ink">{t('news.masthead')}</span>
            <span className="mx-2 text-line" aria-hidden>
              |
            </span>
            <time dateTime={new Date().toISOString().slice(0, 10)}>{today}</time>
          </p>
          {!hasChosenLanguage && <LanguagePicker current={locale} compact />}
        </Container>
      </div>

      <Container className="grid gap-10 py-6 md:py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        {/* Stories */}
        <div className="min-w-0">
          {lead ? (
            <>
              <h1 className="sr-only">{t('news.title')}</h1>
              <Lead n={lead} locale={locale} />
              {/* Phones: services search right under the top story, not after all the news. */}
              <div className="mt-6 rounded-2xl bg-brand-navy p-3 lg:hidden">
              <form action="/explore" role="search" className="flex gap-2">
                <label htmlFor="m-q" className="sr-only">
                  {t('home.search')}
                </label>
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                  <input id="m-q" name="q" type="search" enterKeyHint="search" placeholder={t('home.searchPlaceholder')} className="h-12 w-full rounded-xl bg-white pl-9 pr-2 text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-brand-teal" />
                </div>
                <button type="submit" className="h-12 shrink-0 rounded-xl bg-brand-teal px-4 font-semibold text-white">
                  {t('hero.searchButton')}
                </button>
              </form>
              <ul className="-mx-3 mt-2 flex gap-1 overflow-x-auto px-3">
                {verticals.map((v) => {
                  const Icon = VERTICAL_ICONS[v]
                  return (
                    <li key={v} className="shrink-0">
                      <Link href={`/explore?vertical=${v}`} className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-white/90">
                        <Icon className="size-4 text-brand-teal" aria-hidden /> {t(`verticals.${v}`)}
                      </Link>
                    </li>
                  )
                })}
                <li className="shrink-0">
                  <Link href="/directory" className="flex items-center rounded-lg px-2.5 py-2 text-sm font-semibold text-white underline underline-offset-4">
                    {t('news.browseServices')}
                  </Link>
                </li>
              </ul>
              </div>
              {secondary.length > 0 && (
                <div className="mt-8 grid gap-4 border-t border-line pt-6 sm:grid-cols-3 sm:gap-6">
                  {secondary.map((n) => (
                    <Secondary key={n.id} n={n} locale={locale} />
                  ))}
                </div>
              )}
              {briefs.length > 0 && (
                <section className="mt-8 border-t-2 border-ink pt-4" aria-labelledby="more-news">
                  <div className="flex items-baseline justify-between">
                    <h2 id="more-news" className="text-lg font-bold">
                      {t('news.moreNews')}
                    </h2>
                    <Link href="/news" className="text-sm font-semibold text-brand-blue hover:underline">
                      {t('news.seeAllNews')}
                    </Link>
                  </div>
                  <ul className="mt-1 grid md:grid-cols-2 md:gap-x-8">
                    {briefs.map((n) => (
                      <Brief key={n.id} n={n} locale={locale} />
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-white p-8">
              <h1 className="font-news text-xl font-bold">{t('news.title')}</h1>
              <p className="mt-2 text-muted">{t('news.noNews')}</p>
            </div>
          )}
        </div>

        {/* Services rail */}
        <aside className="grid content-start gap-6" aria-label={t('news.findHelp')}>
          <section className="hidden rounded-2xl bg-brand-navy p-5 text-white lg:block">
            <h2 className="text-lg font-bold">{t('news.findHelp')}</h2>
            <p className="mt-1 text-sm text-white/80">{t('news.findHelpHint')}</p>
            <form action="/explore" role="search" className="mt-4 grid gap-2">
              <label htmlFor="rail-q" className="sr-only">
                {t('home.search')}
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <input id="rail-q" name="q" type="search" enterKeyHint="search" placeholder={t('home.searchPlaceholder')} className="h-12 w-full rounded-xl bg-white pl-9 pr-3 text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-brand-teal" />
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <label htmlFor="rail-area" className="sr-only">
                  {t('home.yourArea')}
                </label>
                <select id="rail-area" name="locality" defaultValue={selected?.id ?? 'all'} className="h-11 min-w-0 rounded-xl bg-white/10 px-3 text-sm text-white ring-1 ring-white/25 [&>option]:text-ink">
                  <option value="all">{t('hero.areaAll')}</option>
                  {localities.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="h-11 rounded-xl bg-brand-teal px-5 font-semibold text-white hover:bg-[#1b8f75]">
                  {t('hero.searchButton')}
                </button>
              </div>
            </form>
            <ul className="mt-4 grid grid-cols-2 gap-2">
              {verticals.map((v) => {
                const Icon = VERTICAL_ICONS[v]
                return (
                  <li key={v}>
                    <Link href={`/explore?vertical=${v}`} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-white/90 hover:bg-white/10">
                      <Icon className="size-4 shrink-0 text-brand-teal" aria-hidden />
                      {t(`verticals.${v}`)}
                    </Link>
                  </li>
                )
              })}
            </ul>
            <Link href="/directory" className="mt-2 inline-block text-sm font-semibold text-white underline-offset-4 hover:underline">
              {t('news.browseServices')}
            </Link>
          </section>

          {emergency.length > 0 && (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <h2 className="flex items-center gap-2 font-bold text-red-900">
                <Siren className="size-4" aria-hidden /> {t('home.emergency')}
              </h2>
              <ul className="mt-3 grid gap-2">
                {emergency.map((c) => (
                  <li key={c.id}>
                    <a href={`tel:${c.phone}`} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-red-100 hover:ring-red-300">
                      <span className="text-sm text-red-950">{c.label}</span>
                      <span className="inline-flex items-center gap-1 font-bold tabular-nums text-red-800">
                        <Phone className="size-3.5" aria-hidden /> {c.phone}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <Link href="/emergency" className="mt-3 inline-block text-sm font-semibold text-red-900 hover:underline">
                {t('home.allEmergency')}
              </Link>
            </section>
          )}

          <section className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-bold">{t('community.fromCommunity')}</h2>
              <Link href="/community" className="text-sm font-semibold text-brand-blue hover:underline">
                {t('community.seeAll')}
              </Link>
            </div>
            {community.length ? (
              <ul className="mt-2">
                {community.map((p) => (
                  <li key={p.id} className="group relative border-t border-line py-3 first:border-t-0">
                    <p className="line-clamp-2 text-[15px] text-ink group-hover:underline">
                      <Link href={`/community/${p.id}`} className="after:absolute after:inset-0">
                        {p.body}
                      </Link>
                    </p>
                    <p className="mt-1 flex items-center gap-3 text-[13px] text-muted">
                      <span>{p.authorName}</span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="size-3.5" aria-hidden /> {p.commentCount}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">{t('community.empty')}</p>
            )}
            <Link href="/community/new" className="mt-2 inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-semibold hover:bg-surface">
              {t('community.write')}
            </Link>
          </section>
        </aside>
      </Container>
    </>
  )
}
