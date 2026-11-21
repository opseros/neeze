import { MapPin, MessageCircle, ThumbsUp } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Avatar, PostCard, TOPIC_ICON } from '@/components/community-view'
import { Container } from '@/components/ui'
import { TOPICS } from '@/lib/community'
import { getCommunityFeedCached, getPopularPostsCached, toPostView } from '@/lib/cache'
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
  const [feed, popular] = await Promise.all([getCommunityFeedCached({ topic, locality: area, page }, locale), getPopularPostsCached(locale)])
  const notBlocked = (p: { authorId: number | null }) => !p.authorId || !viewer.blocked.has(p.authorId)
  const posts = feed.docs.filter(notBlocked)
  const trending = popular.filter(notBlocked)
  const me = viewer.user?.id ?? null

  // The author's own posts that others can't see yet.
  let mine: ReturnType<typeof toPostView>[] = []
  if (viewer.user && page === 1) {
    const payload = await getPayloadClient()
    const { docs } = await payload.find({ collection: 'posts', where: { and: [{ author: { equals: viewer.user.id } }, { status: { in: ['pending', 'hidden'] } }] }, sort: '-createdAt', limit: 5, depth: 1, locale, overrideAccess: true })
    mine = (docs as Post[]).map((d) => toPostView(d, locale))
  }

  const href = (q: Partial<Search>) => {
    const p = new URLSearchParams()
    const next = { topic, area: area ? String(area) : undefined, ...q }
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, String(v))
    const s = p.toString()
    return s ? `/community?${s}` : '/community'
  }
  const tab = (active: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 border-b-2 px-1 pb-2.5 pt-1 text-sm font-semibold ${active ? 'border-brand-navy text-ink' : 'border-transparent text-muted hover:text-ink'}`

  const areaForm = (id: string) => (
    <form action="/community" className="flex gap-2">
      {topic && <input type="hidden" name="topic" value={topic} />}
      <label htmlFor={id} className="sr-only">
        {te('filterArea')}
      </label>
      <div className="relative min-w-0 flex-1">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <select id={id} name="area" defaultValue={area ?? ''} className="input h-10 w-full pl-9 text-sm">
          <option value="">{t('allAreas')}</option>
          {localities.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <button className="h-10 shrink-0 rounded-lg border border-line bg-white px-3 text-sm font-semibold hover:bg-surface">{te('apply')}</button>
    </form>
  )

  return (
    <Container className="grid gap-6 py-5 md:grid-cols-[minmax(0,1fr)_300px] md:py-8 lg:gap-10">
      <div className="min-w-0">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
            <p className="mt-0.5 text-sm text-muted md:text-base">{t('subtitle')}</p>
          </div>
        </div>

        {/* Composer: the way in to writing, not a banner. */}
        <div className="mt-5 rounded-2xl border border-line bg-white p-3 md:p-4">
          <Link href="/community/new" className="flex items-center gap-3">
            <Avatar name={viewer.user?.name} />
            <span className="flex h-11 flex-1 items-center rounded-full bg-surface px-4 text-[15px] text-muted ring-1 ring-inset ring-line hover:ring-slate-300">{t('composerPrompt')}</span>
          </Link>
          <div className="mt-2 flex gap-1 overflow-x-auto md:pl-[52px]">
            {(
              [
                ['question', t('quickAsk')],
                ['recommendation', t('quickRecommend')],
                ['lost-found', t('quickLost')],
              ] as const
            ).map(([k, label]) => {
              const Icon = TOPIC_ICON[k]
              return (
                <Link key={k} href={`/community/new?topic=${k}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted hover:bg-surface hover:text-ink">
                  <Icon className="size-4" aria-hidden /> {label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Topics */}
        <nav aria-label={t('topic')} className="-mx-4 mt-5 flex gap-5 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
          <Link href={href({ topic: undefined, page: undefined })} className={tab(!topic)} aria-current={!topic ? 'page' : undefined}>
            {t('allTopics')}
          </Link>
          {TOPICS.map((k) => {
            const Icon = TOPIC_ICON[k]
            return (
              <Link key={k} href={href({ topic: k, page: undefined })} className={tab(topic === k)} aria-current={topic === k ? 'page' : undefined}>
                <Icon className="size-4" aria-hidden /> {t(`topics.${k}`)}
              </Link>
            )
          })}
        </nav>

        <div className="mt-4 md:hidden">{areaForm('area-m')}</div>

        {mine.length > 0 && (
          <ul className="mt-4 grid gap-3">
            {mine.map((p) => (
              <PostCard key={p.id} post={p} note={p.status === 'pending' ? `${t('pending')} · ${t('pendingNote')}` : t('hiddenNote')} />
            ))}
          </ul>
        )}

        {posts.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-line bg-white p-10 text-center">
            <p className="text-muted">{t('empty')}</p>
            <Link href="/community/new" className="btn-primary mt-4 inline-flex h-11 px-5">
              {t('write')}
            </Link>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} viewerId={me} signedIn={Boolean(viewer.user)} />
            ))}
          </ul>
        )}

        {feed.totalPages > 1 && (
          <nav className="mt-6 flex items-center justify-between text-sm font-semibold" aria-label="Pages">
            {page > 1 ? (
              <Link href={href({ page: String(page - 1) })} className="text-brand-blue">
                ← {page - 1}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted tabular-nums">
              {page} / {feed.totalPages}
            </span>
            {page < feed.totalPages ? (
              <Link href={href({ page: String(page + 1) })} className="text-brand-blue">
                {page + 1} →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>

      <aside className="hidden content-start gap-5 md:grid">
        <section className="rounded-2xl border border-line bg-white p-4">
          <h2 className="text-sm font-semibold">{te('filterArea')}</h2>
          <div className="mt-2">{areaForm('area')}</div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-4">
          <h2 className="text-sm font-semibold">{t('popularTitle')}</h2>
          {trending.length ? (
            <ol className="mt-2">
              {trending.map((p) => (
                <li key={p.id} className="border-t border-line py-2.5 first:border-t-0">
                  <Link href={`/community/${p.id}`} className="group block">
                    <p className="line-clamp-2 text-sm text-ink group-hover:underline">{p.body}</p>
                    <p className="mt-1 flex items-center gap-3 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <ThumbsUp className="size-3.5" aria-hidden /> {p.helpfulCount}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="size-3.5" aria-hidden /> {p.commentCount}
                      </span>
                    </p>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted">{t('popularEmpty')}</p>
          )}
        </section>

        <section className="rounded-2xl bg-brand-navy/5 p-4 text-sm">
          <h2 className="font-semibold">{t('rules')}</h2>
          <p className="mt-1 text-muted">{t('rulesIntro')}</p>
          <Link href="/community/rules" className="mt-2 inline-block font-semibold text-brand-blue hover:underline">
            {t('rules')}
          </Link>
        </section>
      </aside>
    </Container>
  )
}
