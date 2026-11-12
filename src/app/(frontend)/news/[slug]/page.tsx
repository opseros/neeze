import { RichText } from '@payloadcms/richtext-lexical/react'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'

import { Container } from '@/components/ui'
import type { News } from '@/payload-types'
import { getNewsBySlugCached } from '@/lib/cache'
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
  const t = await getTranslations('news')
  const locale = await getLocale()
  const fmt = (d: string) => fmtDate(d, locale, { dateStyle: 'medium' })
  return (
    <>
      <Container className="max-w-3xl py-8 md:py-12">
      <article className="grid gap-4">
        <a href="/news" className="text-sm font-medium text-brand-blue">← {t('title')}</a>
        <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-4xl">{n.title}</h1>
        {n.summary && <p className="text-lg text-muted">{n.summary}</p>}
        <p className="text-sm text-muted">
          {n.publishedAt && fmt(n.publishedAt)}
          {n.updatedAt && n.publishedAt && n.updatedAt > n.publishedAt && ` · ${t('updated', { date: fmt(n.updatedAt) })}`}
        </p>
        {n.body && <RichText data={n.body} className="article-body" />}
        {n.sources && n.sources.length > 0 && (
          <ul className="text-sm text-muted">
            {n.sources.map((s) => (
              <li key={s.id}>{s.url ? <a href={s.url} className="underline" rel="noopener noreferrer">{s.label}</a> : s.label}</li>
            ))}
          </ul>
        )}
        {n.corrections && n.corrections.length > 0 && (
          <section className="card border-amber-300 bg-amber-50 text-sm">
            <h3 className="font-semibold">{t('corrections')}</h3>
            <ul className="mt-1 grid gap-1">
              {n.corrections.map((c) => (
                <li key={c.id}>
                  {fmt(c.at)}: {c.note}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
      </Container>
    </>
  )
}
