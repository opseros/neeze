import { BadgeCheck, UserRound, CircleHelp, Megaphone, MessageCircle, MessagesSquare, Pin, Search, ThumbsUp } from 'lucide-react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'

import { HelpfulButton, ShareButton } from '@/components/community'
import { relativeTime } from '@/lib/format'
import type { PostView } from '@/lib/cache'

/* ---------- identity ---------- */

// Avatar colours: muted, readable with white initials, never reused for meaning elsewhere.
const AVATAR = ['bg-[#2f6f8f]', 'bg-[#7a5c99]', 'bg-[#3f7d5c]', 'bg-[#9a5b3c]', 'bg-[#5b6b8c]', 'bg-[#8c4f6b]', 'bg-[#4f7a7a]', 'bg-[#7d6a3a]']

function initials(name: string) {
  const parts = name.replace(/[^\p{L}\p{N}\s.]/gu, '').split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

function hash(s: string) {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.codePointAt(0)!) >>> 0
  return h
}

export function Avatar({ name, official = false, size = 'md' }: { name?: string | null; official?: boolean; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'size-8 text-xs' : 'size-10 text-sm'
  if (!name)
    return (
      <span className={`grid ${dim} shrink-0 place-items-center rounded-full bg-slate-200 text-slate-500`} aria-hidden>
        <UserRound className="size-1/2" />
      </span>
    )
  if (official)
    return (
      <span className={`grid ${dim} shrink-0 place-items-center rounded-full bg-brand-navy font-bold text-white`} aria-hidden>
        N
      </span>
    )
  return (
    <span className={`grid ${dim} shrink-0 place-items-center rounded-full font-semibold text-white ${AVATAR[hash(name) % AVATAR.length]}`} aria-hidden>
      {initials(name)}
    </span>
  )
}

/* ---------- topics ---------- */

export const TOPIC_ICON = { question: CircleHelp, recommendation: ThumbsUp, announcement: Megaphone, 'lost-found': Search, general: MessagesSquare } as const

const TOPIC_TONE: Record<string, string> = {
  question: 'text-sky-800 bg-sky-50 ring-sky-200',
  recommendation: 'text-emerald-800 bg-emerald-50 ring-emerald-200',
  announcement: 'text-amber-900 bg-amber-50 ring-amber-200',
  'lost-found': 'text-rose-800 bg-rose-50 ring-rose-200',
  general: 'text-slate-700 bg-slate-50 ring-slate-200',
}

export async function TopicChip({ topic }: { topic: string }) {
  const t = await getTranslations('community.topics')
  const Icon = TOPIC_ICON[topic as keyof typeof TOPIC_ICON] ?? MessagesSquare
  return (
    <span className={`inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TOPIC_TONE[topic] ?? TOPIC_TONE.general}`}>
      <Icon className="size-3.5" aria-hidden /> {t(topic as 'general')}
    </span>
  )
}

/* ---------- header line: who, where, when ---------- */

export async function PostMeta({ post }: { post: PostView }) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations('community')])
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={post.authorName} official={post.official} />
      <div className="min-w-0 leading-tight">
        <p className="flex items-center gap-1 truncate font-semibold text-ink">
          {post.authorName}
          {post.official && <BadgeCheck className="size-4 shrink-0 text-brand-teal" aria-label={t('official')} />}
        </p>
        <p className="mt-0.5 truncate text-[13px] text-muted">
          {post.localityName && <span>{post.localityName} · </span>}
          <time dateTime={post.createdAt}>{relativeTime(post.createdAt, locale)}</time>
          {post.editedAt && <span> · {t('edited')}</span>}
        </p>
      </div>
    </div>
  )
}

/* ---------- feed card ---------- */

export async function PostCard({ post, note, viewerId, signedIn = false }: { post: PostView; note?: string; viewerId?: number | null; signedIn?: boolean }) {
  const t = await getTranslations('community')
  const long = post.body.length > 320 || post.body.split('\n').length > 6
  const published = post.status === 'published'
  return (
    <li className="group/card relative rounded-2xl border border-line bg-white transition-colors hover:border-slate-300">
      <div className="flex items-start justify-between gap-3 p-4 pb-0 md:p-5 md:pb-0">
        <PostMeta post={post} />
        <TopicChip topic={post.topic} />
      </div>
      {(post.pinned || note) && (
        <div className="px-4 pt-3 md:px-5">
          {post.pinned && (
            <p className="inline-flex items-center gap-1 text-xs font-semibold text-brand-navy">
              <Pin className="size-3.5" aria-hidden /> {t('pinned')}
            </p>
          )}
          {note && <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-950">{note}</p>}
        </div>
      )}
      <Link href={`/community/${post.id}`} className="block px-4 pt-3 md:px-5" aria-label={post.body.slice(0, 80)}>
        <p className={`whitespace-pre-line text-[15px] leading-relaxed text-ink md:text-base ${long ? 'line-clamp-5' : ''}`}>{post.body}</p>
        {long && <span className="mt-1 inline-block text-sm font-semibold text-brand-blue">{t('seeMore')}</span>}
        {post.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.image.card} alt="" loading="lazy" className="mt-3 max-h-[420px] w-full rounded-xl object-cover" />
        )}
      </Link>
      <div className="mt-3 flex items-center gap-1 border-t border-line px-2 py-1.5 md:px-3">
        {published ? (
          <HelpfulButton postId={post.id} initial={Boolean(viewerId && post.helpfulBy.includes(viewerId))} count={post.helpfulCount} signedIn={signedIn} compact />
        ) : (
          <span className="inline-flex h-9 items-center gap-1.5 px-3 text-sm text-muted">
            <ThumbsUp className="size-4" aria-hidden /> {post.helpfulCount}
          </span>
        )}
        <Link href={`/community/${post.id}#comments`} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted hover:bg-surface hover:text-ink">
          <MessageCircle className="size-4" aria-hidden /> {post.commentCount > 0 ? t('comments', { count: post.commentCount }) : t('commentSubmit')}
        </Link>
        {published && <ShareButton path={`/community/${post.id}`} title={post.body.slice(0, 80)} className="ml-auto" />}
      </div>
    </li>
  )
}
