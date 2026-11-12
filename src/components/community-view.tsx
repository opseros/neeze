import { MapPin, MessageCircle, ThumbsUp } from 'lucide-react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'

import { relativeTime } from '@/lib/format'
import type { PostView } from '@/lib/cache'

const TOPIC_TONE: Record<string, string> = {
  question: 'bg-sky-100 text-sky-900',
  recommendation: 'bg-emerald-100 text-emerald-900',
  announcement: 'bg-amber-100 text-amber-950',
  'lost-found': 'bg-rose-100 text-rose-900',
  general: 'bg-slate-100 text-slate-800',
}

export async function TopicChip({ topic }: { topic: string }) {
  const t = await getTranslations('community.topics')
  return <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${TOPIC_TONE[topic] ?? TOPIC_TONE.general}`}>{t(topic as 'general')}</span>
}

export async function PostMeta({ post }: { post: PostView }) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations('community')])
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
      <span className="font-semibold text-ink">{post.authorName}</span>
      <span aria-hidden>·</span>
      <time dateTime={post.createdAt}>{relativeTime(post.createdAt, locale)}</time>
      {post.editedAt && <span>· {t('edited')}</span>}
      {post.localityName && (
        <span className="inline-flex items-center gap-1">
          <span aria-hidden>·</span>
          <MapPin className="size-3.5" aria-hidden /> {post.localityName}
        </span>
      )}
    </p>
  )
}

/** Feed card. The whole card links to the post; counts are read-only here. */
export async function PostCard({ post, note }: { post: PostView; note?: string }) {
  const t = await getTranslations('community')
  return (
    <li className="lift relative rounded-2xl border border-line bg-white p-4 shadow-card md:p-5">
      <div className="flex items-start justify-between gap-3">
        <PostMeta post={post} />
        <TopicChip topic={post.topic} />
      </div>
      {note && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-950">{note}</p>}
      <div className={`mt-3 grid gap-3 ${post.image ? 'sm:grid-cols-[1fr_160px]' : ''}`}>
        <p className="line-clamp-6 whitespace-pre-line text-ink">{post.body}</p>
        {post.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.image.card} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-xl object-cover sm:w-40" />
        )}
      </div>
      <p className="mt-3 flex items-center gap-4 text-sm text-muted">
        <span className="inline-flex items-center gap-1">
          <ThumbsUp className="size-4" aria-hidden /> {post.helpfulCount}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="size-4" aria-hidden /> {t('comments', { count: post.commentCount })}
        </span>
      </p>
      <Link href={`/community/${post.id}`} className="absolute inset-0 rounded-2xl" aria-label={post.body.slice(0, 80)} />
    </li>
  )
}
