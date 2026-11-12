import { PenSquare } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { PostCard } from '@/components/community-view'
import { Container, PageTitle } from '@/components/ui'
import { TOPICS } from '@/lib/community'
import { getCommunityFeedCached, toPostView } from '@/lib/cache'
import { getViewer } from '@/lib/community-server'
import { getContentLocale, getLocalities, getPayloadClient } from '@/lib/server'
import type { Post } from '@/payload-types'

export async function generateMetadata() {
  const t = await getTranslations('community')
  return { title: t('title'), description: t('subtitle') }
}

type Search = { topic?: string; area?: string; page?: string }

export default async function CommunityPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const topic = TOPICS.includes(sp.topic as never) ? sp.topic : undefined
  const area = Number(sp.area) || undefined
  const page = Math.max(1, Math.min(50, Number(sp.page) || 1))
  const [t, te, locale, localities, viewer] = await Promise.all([getTranslations('community'), getTranslations('explore'), getContentLocale(), getLocalities(), getViewer()])
  const feed = await getCommunityFeedCached({ topic, locality: area, page }, locale)
  const posts = feed.docs.filter((p) => !p.authorId || !viewer.blocked.has(p.authorId))

  // The author's own posts that others can't see yet.
  let mine: ReturnType<typeof toPostView>[] = []
  if (viewer.user && page === 1) {
    const payload = await getPayloadClient()
    const { docs } = await payload.find({ collection: 'posts', where: { and: [{ author: { equals: viewer.user.id } }, { status: { in: ['pending', 'hidden'] } }] }, sort: '-createdAt', limit: 5, depth: 1, locale, overrideAccess: true })
    mine = (docs as Post[]).map(toPostView)
  }

  const href = (q: Partial<Search>) => {
    const p = new URLSearchParams()
    const next = { topic, area: area ? String(area) : undefined, ...q }
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, String(v))
    const s = p.toString()
    return s ? `/community?${s}` : '/community'
  }
  const chip = (active: boolean) => `shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${active ? 'border-brand-navy bg-brand-navy text-white' : 'border-line bg-white text-ink hover:border-brand-blue/40'}`

  return (
    <>
      <PageTitle title={t('title')} subtitle={t('subtitle')} />
      <Container className="grid gap-6 py-6 md:grid-cols-[1fr_280px] md:py-8 lg:gap-10">
        <div className="grid min-w-0 content-start gap-4">
          <nav aria-label={t('topic')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            <Link href={href({ topic: undefined, page: undefined })} className={chip(!topic)} aria-current={!topic ? 'page' : undefined}>
              {t('allTopics')}
            </Link>
            {TOPICS.map((k) => (
              <Link key={k} href={href({ topic: k, page: undefined })} className={chip(topic === k)} aria-current={topic === k ? 'page' : undefined}>
                {t(`topics.${k}`)}
              </Link>
            ))}
          </nav>

          <form action="/community" className="flex gap-2 md:hidden">
            {topic && <input type="hidden" name="topic" value={topic} />}
            <label htmlFor="area-m" className="sr-only">{te('filterArea')}</label>
            <select id="area-m" name="area" defaultValue={area ?? ''} className="input h-11 flex-1">
              <option value="">{t('allAreas')}</option>
              {localities.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <button className="h-11 rounded-lg border border-line px-4 text-sm font-semibold">{te('apply')}</button>
          </form>

          <Link href="/community/new" className="btn-primary h-12 justify-center gap-2 md:hidden">
            <PenSquare className="size-5" aria-hidden /> {t('write')}
          </Link>

          {mine.length > 0 && (
            <ul className="grid gap-3">
              {mine.map((p) => <PostCard key={p.id} post={p} note={p.status === 'pending' ? `${t('pending')} · ${t('pendingNote')}` : t('hiddenNote')} />)}
            </ul>
          )}

          {posts.length === 0 ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-white p-10 text-center">
              <p className="text-muted">{t('empty')}</p>
              <Link href="/community/new" className="mt-4 font-semibold text-brand-blue">{t('write')} →</Link>
            </div>
          ) : (
            <ul className="grid gap-3">{posts.map((p) => <PostCard key={p.id} post={p} />)}</ul>
          )}

          {feed.totalPages > 1 && (
            <nav className="flex items-center justify-between text-sm font-semibold" aria-label="Pages">
              {page > 1 ? <Link href={href({ page: String(page - 1) })} className="text-brand-blue">←</Link> : <span />}
              <span className="text-muted">{page} / {feed.totalPages}</span>
              {page < feed.totalPages ? <Link href={href({ page: String(page + 1) })} className="text-brand-blue">→</Link> : <span />}
            </nav>
          )}
        </div>

        <aside className="hidden content-start gap-4 md:grid">
          <Link href="/community/new" className="btn-primary h-12 justify-center gap-2">
            <PenSquare className="size-5" aria-hidden /> {t('write')}
          </Link>
          <form action="/community" className="card grid gap-2">
            {topic && <input type="hidden" name="topic" value={topic} />}
            <label htmlFor="area" className="text-sm font-semibold">{te('filterArea')}</label>
            <select id="area" name="area" defaultValue={area ?? ''} className="input h-11">
              <option value="">{t('allAreas')}</option>
              {localities.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <button className="h-10 rounded-lg border border-line text-sm font-semibold hover:bg-surface">{te('apply')}</button>
          </form>
          <div className="card text-sm">
            <p className="font-semibold">{t('rules')}</p>
            <p className="mt-1 text-muted">{t('rulesIntro')}</p>
            <Link href="/community/rules" className="mt-2 inline-block font-semibold text-brand-blue">{t('rules')} →</Link>
          </div>
        </aside>
      </Container>
    </>
  )
}
