import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'

import { CommentForm, HelpfulButton, ItemMenu, ReportButton } from '@/components/community'
import { PostMeta, TopicChip } from '@/components/community-view'
import { Container } from '@/components/ui'
import { canEditPost } from '@/lib/community'
import { getCommentsCached, getPostCached, type PostView, toPostView } from '@/lib/cache'
import { getViewer } from '@/lib/community-server'
import { relativeTime } from '@/lib/format'
import { getContentLocale, getPayloadClient } from '@/lib/server'
import type { Post } from '@/payload-types'

async function load(id: number): Promise<PostView | null> {
  if (!Number.isInteger(id) || id < 1) return null
  const locale = await getContentLocale()
  const cached = await getPostCached(id, locale)
  if (cached) return cached
  // Not public: the author may still look at their own post while it waits for review.
  const { user } = await getViewer()
  if (!user) return null
  const payload = await getPayloadClient()
  const p = await payload.findByID({ collection: 'posts', id, depth: 1, locale, overrideAccess: true }).catch(() => null)
  const view = p ? toPostView(p as Post) : null
  return view && view.authorId === user.id && view.status !== 'removed' ? view : null
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const p = await getPostCached(Number((await params).id), await getContentLocale())
  return p ? { title: p.body.slice(0, 60), description: p.body.slice(0, 160) } : { robots: { index: false } }
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  const [post, viewer, t, locale] = await Promise.all([load(id), getViewer(), getTranslations('community'), getLocale()])
  if (!post || (post.authorId && viewer.blocked.has(post.authorId))) notFound()
  const comments = (post.status === 'published' ? await getCommentsCached(post.id) : []).filter((c) => !c.authorId || !viewer.blocked.has(c.authorId))
  const me = viewer.user?.id
  const signedIn = Boolean(viewer.user)
  const mine = Boolean(me && post.authorId === me)

  return (
    <Container className="max-w-3xl py-6 md:py-10">
      <Link href="/community" className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue">
        <ArrowLeft className="size-4" aria-hidden /> {t('title')}
      </Link>

      <article className="card mt-4 grid gap-4 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-2">
            <TopicChip topic={post.topic} />
            <PostMeta post={post} />
          </div>
          <ItemMenu kind="post" id={post.id} mine={mine} canEdit={canEditPost(post)} signedIn={signedIn} />
        </div>
        {post.status === 'pending' && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">{t('pending')} · {t('pendingNote')}</p>}
        {post.status === 'hidden' && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">{t('hiddenNote')}</p>}
        <p className="whitespace-pre-line text-lg leading-relaxed text-ink">{post.body}</p>
        {post.image && (
          <a href={post.image.url} target="_blank" rel="noopener">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.image.card} alt="" className="max-h-[480px] w-full rounded-xl object-cover" />
          </a>
        )}
        {post.status === 'published' && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <HelpfulButton postId={post.id} initial={Boolean(me && post.helpfulBy.includes(me))} count={post.helpfulCount} signedIn={signedIn} />
            {!mine && <ReportButton target="post" id={post.id} signedIn={signedIn} />}
          </div>
        )}
      </article>

      {post.status === 'published' && (
        <section id="comments" className="mt-6 grid gap-4" aria-labelledby="comments-title">
          <h2 id="comments-title" className="text-lg font-semibold">
            {t('commentsTitle')} <span className="font-normal text-muted">· {comments.length}</span>
          </h2>
          {comments.length > 0 && (
            <ul className="grid gap-3">
              {comments.map((c) => (
                <li key={c.id} id={`c${c.id}`} className="rounded-xl border border-line bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-muted">
                      <span className="font-semibold text-ink">{c.authorName}</span> · {relativeTime(c.createdAt, locale)}
                    </p>
                    <ItemMenu kind="comment" id={c.id} mine={Boolean(me && c.authorId === me)} signedIn={signedIn} />
                  </div>
                  <p className="mt-1 whitespace-pre-line">{c.body}</p>
                  {me && c.authorId !== me && (
                    <div className="mt-2">
                      <ReportButton target="comment" id={c.id} signedIn={signedIn} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {post.commentsLocked ? (
            <p className="text-sm text-muted">{t('commentsLocked')}</p>
          ) : signedIn ? (
            <CommentForm postId={post.id} />
          ) : (
            <p className="card text-sm">
              <Link href={`/signin?next=/community/${post.id}`} className="font-semibold text-brand-blue">{t('signInToJoin')}</Link>
            </p>
          )}
        </section>
      )}
    </Container>
  )
}
