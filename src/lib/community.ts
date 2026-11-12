/**
 * Community rules shared by the API hooks and the pages. Pure functions: unit-tested in tests/community.test.ts.
 */

export const TOPICS = ['question', 'recommendation', 'announcement', 'lost-found', 'general'] as const
export type Topic = (typeof TOPICS)[number]

/** Who gets reviewed before their post is public. Set in Admin → Site settings → Community. */
export const POSTING_MODES = ['open', 'first-post', 'all'] as const
export type PostingMode = (typeof POSTING_MODES)[number]
export const DEFAULT_POSTING_MODE: PostingMode = 'first-post'

export const LIMITS = {
  postBody: 1000,
  commentBody: 500,
  reportNote: 500,
  postsPerDay: 5,
  commentsPerDay: 30,
  reportsPerDay: 20,
  /** Authors can fix typos for a day; after that the post stands as written. */
  editHours: 24,
  /** Distinct reports that hide a post or comment until a moderator looks. */
  autoHideReports: 3,
  /** More links than this and the post waits for review whatever the mode (spam). */
  maxLinks: 1,
} as const

export const REPORT_REASONS = {
  post: ['spam', 'abuse', 'false-info', 'privacy', 'other'],
  comment: ['spam', 'abuse', 'false-info', 'privacy', 'other'],
  news: ['correction', 'false-info', 'other'],
  provider: ['wrong-info', 'closed', 'fraud', 'other'],
} as const
export type ReportTarget = keyof typeof REPORT_REASONS
export const REPORT_TARGETS = Object.keys(REPORT_REASONS) as ReportTarget[]
export const ALL_REPORT_REASONS = [...new Set(Object.values(REPORT_REASONS).flat())]

export const isReportReason = (target: string, reason: string) =>
  (REPORT_REASONS as Record<string, readonly string[]>)[target]?.includes(reason) ?? false

export function countLinks(text: string): number {
  return (text.match(/(https?:\/\/|www\.)\S+/gi) ?? []).length
}

/** Does a new post (or comment) go live straight away, or wait for a moderator? */
export function initialStatus(input: {
  mode: PostingMode
  isStaff: boolean
  publishedBefore: number
  text: string
  kind?: 'post' | 'comment'
}): 'published' | 'pending' {
  if (input.isStaff) return 'published'
  if (countLinks(input.text) > LIMITS.maxLinks) return 'pending'
  if (input.kind === 'comment') return 'published'
  if (input.mode === 'all') return 'pending'
  if (input.mode === 'first-post' && input.publishedBefore === 0) return 'pending'
  return 'published'
}

export type InteractBlock = 'signin_required' | 'phone_required' | 'suspended' | 'restricted'

/** Can this person post, comment or react? */
export function canInteract(user: { phone?: string | null; suspended?: boolean | null } | null | undefined, restrictedUntil?: string | Date | null, now = new Date()): { ok: true } | { ok: false; reason: InteractBlock } {
  if (!user) return { ok: false, reason: 'signin_required' }
  if (user.suspended) return { ok: false, reason: 'suspended' }
  if (!user.phone) return { ok: false, reason: 'phone_required' }
  if (restrictedUntil && new Date(restrictedUntil) > now) return { ok: false, reason: 'restricted' }
  return { ok: true }
}

export const STATUS_HTTP: Record<InteractBlock, number> = { signin_required: 401, phone_required: 428, suspended: 403, restricted: 403 }

export function canEditPost(post: { createdAt: string; status: string }, now = new Date()) {
  if (post.status === 'removed') return false
  return now.getTime() - new Date(post.createdAt).getTime() < LIMITS.editHours * 3600_000
}

/** Normalise user text: trim, collapse runs of blank lines, cap length. */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== 'string') return ''
  return v.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max)
}

export const dayAgo = (now = new Date()) => new Date(now.getTime() - 86_400_000).toISOString()
