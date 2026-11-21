import { RichText } from '@payloadcms/richtext-lexical/react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'

import { ReportButton } from '@/components/community'
import { Brief, SectionMark, newsImage } from '@/components/news-front'
import { Container } from '@/components/ui'
import type { News } from '@/payload-types'
import { getNewsBySlugCached, getRelatedNewsCached } from '@/lib/cache'
import { getContentLocale } from '@/lib/server'
import { fmtDate } from '@/lib/format'

async function load(slug: string): Promise<News | null> {
  return getNewsBySlugCached(slug.slice(0, 200), await getContentLocale())
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const n = await load((await params).slug)
  return n ? { title: n.title, description: n.summary ?? undefined } : {}
}

export default async function Article({ params }: { params: Promise<{ slug: string }> }) {
  const n = await load((await params).slug)
  if (!n) notFound()
  const [t, tr, locale, contentLocale] = await Promise.all([getTranslations('news'), getTranslations('report'), getLocale(), getContentLocale()])
  const related = await getRelatedNewsCached(contentLocale, n.section ?? 'local', n.id)
  const fmt = (d: string) => fmtDate(d, locale, { dateStyle: 'long', timeStyle: 'short' })
  const img = newsImage(n, 'hero')
  const updated = n.updatedAt && n.publishedAt && new Date(n.updatedAt).getTime() - new Date(n.publishedAt).getTime() > 3600_000
  return (
    <>
      <article>
        <header className="border-b border-line bg-white">
          <Container className="max-w-3xl py-6 md:py-10">
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/news" className="font-medium text-brand-blue hover:underline">{t('title')}</Link>
              <span className="text-line" aria-hidden>/</span>
              <SectionMark section={n.section} />
            </nav>
            <h1 className="mt-4 font-news text-[2rem] font-bold leading-[1.15] tracking-tight text-ink md:text-5xl">{n.title}</h1>
            {n.summary && <p className="mt-4 text-lg leading-relaxed text-muted md:text-xl">{n.summary}</p>}
            <p className="mt-4 text-sm text-muted">
              {n.byline && <span className="mr-3 font-semibold text-ink">{n.byline}</span>}
              {n.publishedAt && <time dateTime={n.publishedAt}>{fmt(n.publishedAt)}</time>}
              {updated && <span className="ml-3">{t('updated', { date: fmt(n.updatedAt) })}</span>}
            </p>
          </Container>
        </header>
        {img && (
          <Container className="max-w-4xl pt-6 md:pt-8">
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt={img.alt} className="-mx-4 aspect-[16/9] w-[calc(100%+2rem)] max-w-none object-cover sm:mx-0 sm:w-full sm:rounded-2xl" />
              {img.alt && img.alt !== 'Photo' && <figcaption className="mt-2 text-sm text-muted">{img.alt}</figcaption>}
            </figure>
          </Container>
        )}
        <Container className="max-w-3xl py-6 md:py-10">
          {n.body && <RichText data={n.body} className="article-body max-w-[68ch]" />}
          {n.sources && n.sources.length > 0 && (
            <section className="mt-8 border-t border-line pt-4 text-sm">
              <h2 className="font-semibold">{t('sources')}</h2>
              <ul className="mt-1 grid gap-1 text-muted">
                {n.sources.map((s) => (
                  <li key={s.id}>{s.url && /^https?:\/\//.test(s.url) ? <a href={s.url} className="underline underline-offset-2" rel="noopener noreferrer" target="_blank">{s.label}</a> : s.label}</li>
                ))}
              </ul>
            </section>
          )}
          {n.corrections && n.corrections.length > 0 && (
            <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
              <h2 className="font-semibold">{t('corrections')}</h2>
              <ul className="mt-1 grid gap-1">
                {n.corrections.map((c) => (
                  <li key={c.id}>
                    <time dateTime={c.at} className="font-medium">{fmtDate(c.at, locale, { dateStyle: 'medium' })}</time>: {c.note}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="mt-8 border-t border-line pt-4">
            <ReportButton target="news" id={n.id} label={tr('newsButton')} />
          </div>
        </Container>
      </article>

      {related.length > 0 && (
        <aside className="border-t border-line bg-white">
          <Container className="max-w-5xl py-8">
            <h2 className="text-lg font-bold">{t('related', { section: t(`sections.${n.section ?? 'local'}` as 'sections.local') })}</h2>
            <ul className="mt-2 grid md:grid-cols-2 md:gap-x-8">
              {related.map((r) => <Brief key={r.id} n={r} locale={locale} />)}
            </ul>
          </Container>
        </aside>
      )}
    </>
  )
}
