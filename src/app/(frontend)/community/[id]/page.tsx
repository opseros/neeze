import { ArrowLeft, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'

import { CommentForm, HelpfulButton, ItemMenu, ReportButton, ShareButton } from '@/components/community'
import { Avatar, PostMeta, TopicChip } from '@/components/community-view'
import { Container } from '@/components/ui'
import { canEditPost } from '@/lib/community'
import { getCommentsCached, getPostCached, type PostView, toPostView } from '@/lib/cache'
import { getViewer } from '@/lib/community-server'
import { relativeTime } from '@/lib/format'
import { getContentLocale, getPayloadClient } from '@/lib/server'
import type { Post } from '@/payload-types'
import { Translatable } from '@/components/translate'
import { needsTranslation, translateMode } from '@/lib/translate'

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
  const view = p ? toPostView(p as Post, locale) : null
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
  const tmode = translateMode()

  return (
    <Container className="max-w-2xl py-5 md:py-10">
      <Link href="/community" className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> {t('title')}
      </Link>

      <article className="mt-4 rounded-2xl border border-line bg-white">
        <div className="flex items-start justify-between gap-3 p-4 pb-0 md:p-6 md:pb-0">
          <PostMeta post={post} />
          <div className="flex shrink-0 items-center gap-1">
            <TopicChip topic={post.topic} />
            <ItemMenu kind="post" id={post.id} mine={mine} canEdit={canEditPost(post)} signedIn={signedIn} />
          </div>
        </div>
        {post.status === 'pending' && <p className="mx-4 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950 md:mx-6">{t('pending')} · {t('pendingNote')}</p>}
        {post.status === 'hidden' && <p className="mx-4 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950 md:mx-6">{t('hiddenNote')}</p>}
        <div className="px-4 pt-4 md:px-6">
          <Translatable kind="post" id={post.id} mode={tmode} text={post.body} offer={needsTranslation(post.body, locale)} className="text-[17px] text-ink">
            <p className="whitespace-pre-line text-[17px] leading-relaxed text-ink">{post.body}</p>
          </Translatable>
          {post.image && (
            <a href={post.image.url} target="_blank" rel="noopener" className="mt-4 block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.image.card} alt="" className="max-h-[520px] w-full rounded-xl object-cover" />
            </a>
          )}
        </div>
        {post.status === 'published' ? (
          <div className="mt-4 flex items-center gap-1 border-t border-line px-2 py-1.5 md:px-4">
            <HelpfulButton postId={post.id} initial={Boolean(me && post.helpfulBy.includes(me))} count={post.helpfulCount} signedIn={signedIn} compact />
            <a href="#comment" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted hover:bg-surface hover:text-ink">
              <MessageCircle className="size-4" aria-hidden /> {t('commentSubmit')}
            </a>
            <ShareButton path={`/community/${post.id}`} title={post.body.slice(0, 80)} />
            {!mine && <ReportButton target="post" id={post.id} signedIn={signedIn} className="ml-auto h-9 px-3" />}
          </div>
        ) : (
          <div className="h-4" />
        )}
      </article>

      {post.status === 'published' && (
        <section id="comments" className="mt-6" aria-labelledby="comments-title">
          <h2 id="comments-title" className="text-base font-semibold">
            {t('commentsTitle')} <span className="font-normal text-muted">· {comments.length}</span>
          </h2>

          {comments.length === 0 && <p className="mt-2 text-sm text-muted">{t('noComments')}</p>}
          {comments.length > 0 && (
            <ul className="mt-3 grid gap-4">
              {comments.map((c) => (
                <li key={c.id} id={`c${c.id}`} className="flex gap-3">
                  <Avatar name={c.authorName} official={c.authorName === 'Neeze Team'} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="rounded-2xl rounded-tl-md bg-white px-4 py-2.5 ring-1 ring-inset ring-line">
                      <p className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-semibold text-ink">{c.authorName}</span>
                        <time dateTime={c.createdAt} className="shrink-0 text-xs text-muted">
                          {relativeTime(c.createdAt, locale)}
                        </time>
                      </p>
                      <Translatable kind="comment" id={c.id} mode={tmode} text={c.body} offer={needsTranslation(c.body, locale)} className="mt-0.5">
                        <p className="mt-0.5 whitespace-pre-line text-[15px] leading-relaxed">{c.body}</p>
                      </Translatable>
                    </div>
                    {signedIn && (
                      <div className="mt-1 flex items-center gap-3 pl-2">
                        {me && c.authorId !== me && <ReportButton target="comment" id={c.id} signedIn={signedIn} className="text-xs" />}
                        <ItemMenu kind="comment" id={c.id} mine={Boolean(me && c.authorId === me)} signedIn={signedIn} />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div id="comment" className="mt-5 scroll-mt-24">
            {post.commentsLocked ? (
              <p className="text-sm text-muted">{t('commentsLocked')}</p>
            ) : signedIn ? (
              <div className="flex gap-3">
                <Avatar name={viewer.user?.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <CommentForm postId={post.id} />
                </div>
              </div>
            ) : (
              <Link href={`/signin?next=/community/${post.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 text-sm font-semibold text-brand-blue hover:border-slate-300">
                <MessageCircle className="size-5" aria-hidden /> {t('signInToJoin')}
              </Link>
            )}
          </div>
        </section>
      )}
    </Container>
  )
}
