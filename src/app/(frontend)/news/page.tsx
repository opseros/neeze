import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'

import { Brief, NewsTime, SectionMark, newsImage } from '@/components/news-front'
import { Container } from '@/components/ui'
import { getNewsPageCached } from '@/lib/cache'
import { NEWS_SECTIONS } from '@/lib/landing'
import { getContentLocale } from '@/lib/server'

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const [t, sp] = await Promise.all([getTranslations('news'), searchParams])
  const section = NEWS_SECTIONS.includes(sp.section as never) ? sp.section : null
  return { title: section ? `${t(`sections.${section}` as 'sections.local')} · ${t('title')}` : t('title') }
}

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ section?: string; page?: string }> }) {
  const sp = await searchParams
  const section = NEWS_SECTIONS.includes(sp.section as never) ? (sp.section as string) : null
  const page = Math.max(1, Math.min(100, Number(sp.page) || 1))
  const [t, locale, contentLocale] = await Promise.all([getTranslations('news'), getLocale(), getContentLocale()])
  const { docs, totalPages } = await getNewsPageCached(contentLocale, section, page)
  // Page 1 leads with a big story and three under it; later pages are a plain list.
  const first = page === 1 ? (docs[0] ?? null) : null
  const grid = page === 1 ? docs.slice(1, 4) : []
  const list = page === 1 ? docs.slice(4) : docs
  const href = (q: { section?: string | null; page?: number }) => {
    const p = new URLSearchParams()
    const s = q.section === undefined ? section : q.section
    if (s) p.set('section', s)
    if (q.page && q.page > 1) p.set('page', String(q.page))
    const qs = p.toString()
    return qs ? `/news?${qs}` : '/news'
  }
  const chip = (on: boolean) => `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${on ? 'bg-ink text-white' : 'text-muted hover:bg-white hover:text-ink'}`
  const img = first ? newsImage(first, 'hero') : null

  return (
    <>
      <div className="border-b border-line bg-white">
        <Container className="pt-6 md:pt-10">
          <h1 className="font-news text-3xl font-bold tracking-tight md:text-5xl">{section ? t(`sections.${section}` as 'sections.local') : t('title')}</h1>
          <nav aria-label={t('allSections')} className="-mx-4 mt-4 flex gap-1 overflow-x-auto px-4 pb-3 md:mx-0 md:flex-wrap md:px-0">
            <Link href={href({ section: null })} className={chip(!section)} aria-current={!section ? 'page' : undefined}>
              {t('allSections')}
            </Link>
            {NEWS_SECTIONS.map((s) => (
              <Link key={s} href={href({ section: s })} className={chip(section === s)} aria-current={section === s ? 'page' : undefined}>
                {t(`sections.${s}`)}
              </Link>
            ))}
          </nav>
        </Container>
      </div>

      <Container className="py-6 md:py-10">
        {docs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-muted">{t('noNews')}</p>
        ) : (
          <>
            {first && (
              <article className="group relative grid gap-4 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-8">
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.src} alt={img.alt} className="-mx-4 aspect-[16/10] w-[calc(100%+2rem)] max-w-none object-cover sm:mx-0 sm:w-full sm:rounded-2xl" />
                )}
                <div className={`grid content-center gap-3 ${img ? '' : 'md:col-span-2 md:max-w-3xl'}`}>
                  {!section && <SectionMark section={first.section} />}
                  <h2 className="font-news text-[1.75rem] font-bold leading-[1.15] tracking-tight md:text-[2.5rem]">
                    <Link href={`/news/${first.slug}`} className="after:absolute after:inset-0 group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
                      {first.title}
                    </Link>
                  </h2>
                  {first.summary && <p className="text-base leading-relaxed text-muted md:text-lg">{first.summary}</p>}
                  <NewsTime date={first.publishedAt} locale={locale} />
                </div>
              </article>
            )}
            {grid.length > 0 && (
              <ul className={`grid gap-x-8 sm:grid-cols-3 ${first ? 'mt-8 border-t border-line pt-2' : ''}`}>
                {grid.map((n) => {
                  const im = newsImage(n, 'card')
                  return (
                    <li key={n.id} className="group relative grid content-start gap-2 py-4">
                      {im && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={im.src} alt={im.alt} loading="lazy" className="aspect-[3/2] w-full rounded-xl object-cover" />
                      )}
                      {!section && <SectionMark section={n.section} />}
                      <h3 className="font-news text-lg font-bold leading-snug md:text-xl">
                        <Link href={`/news/${n.slug}`} className="after:absolute after:inset-0 group-hover:underline group-hover:underline-offset-4">
                          {n.title}
                        </Link>
                      </h3>
                      {!im && n.summary && <p className="line-clamp-3 text-sm text-muted">{n.summary}</p>}
                      <NewsTime date={n.publishedAt} locale={locale} />
                    </li>
                  )
                })}
              </ul>
            )}
            {list.length > 0 && (
              <ul className="mt-4 grid border-t-2 border-ink md:grid-cols-2 md:gap-x-8">
                {list.map((n) => (
                  <Brief key={n.id} n={n} locale={locale} />
                ))}
              </ul>
            )}
            {totalPages > 1 && (
              <nav className="mt-8 flex items-center justify-between border-t border-line pt-4 text-sm font-semibold" aria-label={t('pages')}>
                {page > 1 ? <Link href={href({ page: page - 1 })} className="text-brand-blue">← {page - 1}</Link> : <span />}
                <span className="text-muted tabular-nums">
                  {page} / {totalPages}
                </span>
                {page < totalPages ? <Link href={href({ page: page + 1 })} className="text-brand-blue">{page + 1} →</Link> : <span />}
              </nav>
            )}
          </>
        )}
      </Container>
    </>
  )
}
