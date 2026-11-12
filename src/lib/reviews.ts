/** Rules for verified reviews. Pure functions so they can be unit tested. */

export const REVIEW_WINDOW_DAYS = 60
/** Below this, no star average is shown: one or two opinions shouldn't define a provider. */
export const MIN_REVIEWS_FOR_AVERAGE = 3
/** Distinct reports that hide a review until an admin looks at it. */
export const AUTO_HIDE_REPORTS = 3

export type ReviewBlock = 'not_yours' | 'not_completed' | 'too_late' | 'already_reviewed'

export function canReview(opts: {
  isCustomer: boolean
  status: string | null | undefined
  completedAt: string | null | undefined
  alreadyReviewed: boolean
  now?: number
}): { ok: true } | { ok: false; reason: ReviewBlock } {
  if (!opts.isCustomer) return { ok: false, reason: 'not_yours' }
  if (opts.status !== 'completed' || !opts.completedAt) return { ok: false, reason: 'not_completed' }
  if (opts.alreadyReviewed) return { ok: false, reason: 'already_reviewed' }
  const age = (opts.now ?? Date.now()) - new Date(opts.completedAt).getTime()
  if (age > REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000) return { ok: false, reason: 'too_late' }
  return { ok: true }
}

/** "Asha Das" → "Asha D." ; "asha" → "Asha" ; nothing → "Neeze customer" */
export function publicName(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'Neeze customer'
  const cap = (w: string) => w.charAt(0).toLocaleUpperCase() + w.slice(1)
  const first = cap(parts[0])
  return parts.length > 1 ? `${first} ${parts[parts.length - 1].charAt(0).toLocaleUpperCase()}.` : first
}

export function summarize(ratings: number[]): { count: number; average: number | null; showAverage: boolean } {
  const valid = ratings.filter((r) => Number.isInteger(r) && r >= 1 && r <= 5)
  const count = valid.length
  const average = count ? Math.round((valid.reduce((a, b) => a + b, 0) / count) * 10) / 10 : null
  return { count, average, showAverage: count >= MIN_REVIEWS_FOR_AVERAGE }
}
