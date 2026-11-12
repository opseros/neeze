'use client'

import { Star } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function Stars({ value, size = 'size-4' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-line text-line'}`} aria-hidden />
      ))}
    </span>
  )
}

const KNOWN = ['not_completed', 'already_reviewed', 'too_late', 'not_yours']

export function ReviewForm({ requestId }: { requestId: number }) {
  const t = useTranslations('reviews')
  const router = useRouter()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<null | { ok: boolean; text: string }>(null)

  const submit = async () => {
    setBusy(true)
    setState(null)
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ request: requestId, rating, comment }),
    }).catch(() => null)
    setBusy(false)
    if (res?.ok) {
      setState({ ok: true, text: t('thanks') })
      router.refresh()
      return
    }
    const data = await res?.json().catch(() => ({}))
    const code = data?.errors?.[0]?.message
    setState({ ok: false, text: t(`errors.${KNOWN.includes(code) ? code : 'generic'}` as 'errors.generic') })
  }

  if (state?.ok) return <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{state.text}</p>

  return (
    <form
      className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (rating) submit()
      }}
    >
      <div>
        <p className="font-semibold">{t('rateTitle')}</p>
        <p className="text-xs text-muted">{t('rateBody')}</p>
      </div>
      <div className="flex gap-1" role="radiogroup" aria-label={t('rateTitle')} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={rating === i}
            aria-label={t('stars', { count: i })}
            onMouseEnter={() => setHover(i)}
            onClick={() => setRating(i)}
            className="rounded p-0.5 transition hover:scale-110"
          >
            <Star className={`size-8 ${i <= (hover || rating) ? 'fill-amber-400 text-amber-400' : 'fill-white text-amber-300'}`} aria-hidden />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <label className="field">
            <span>{t('commentLabel')}</span>
            <textarea className="input bg-white" rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('commentHint')} />
          </label>
          <p className="text-xs text-muted">{t('rules')}</p>
          <button type="submit" className="btn-primary" disabled={busy}>
            {t('submit')}
          </button>
        </>
      )}
      {state && !state.ok && (
        <p role="alert" className="text-sm text-red-700">
          {state.text}
        </p>
      )}
    </form>
  )
}

export function ReplyForm({ reviewId }: { reviewId: number }) {
  const t = useTranslations('reviews')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  if (!open)
    return (
      <button type="button" className="text-sm font-medium text-brand-blue" onClick={() => setOpen(true)}>
        {t('replySubmit')}
      </button>
    )
  return (
    <form
      className="grid gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setErr(null)
        const res = await fetch(`/api/reviews/${reviewId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ reply: text }) }).catch(() => null)
        setBusy(false)
        if (!res?.ok) return setErr(t('errors.generic'))
        router.refresh()
      }}
    >
      <label className="field">
        <span>{t('replyLabel')}</span>
        <textarea className="input" rows={2} maxLength={500} required value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      </label>
      <button type="submit" className="btn-primary justify-self-start px-6" disabled={busy}>
        {t('replySubmit')}
      </button>
      {err && <p className="text-sm text-red-700">{err}</p>}
    </form>
  )
}

export function ReportButton({ reviewId }: { reviewId: number }) {
  const t = useTranslations('reviews')
  const [done, setDone] = useState(false)
  if (done) return <span className="text-xs text-muted">{t('reported')}</span>
  return (
    <button
      type="button"
      className="text-xs text-muted underline-offset-2 hover:underline"
      onClick={async () => {
        const res = await fetch(`/api/reviews/${reviewId}/report`, { method: 'POST', credentials: 'same-origin' }).catch(() => null)
        if (res?.status === 401) window.location.href = `/signin?next=${encodeURIComponent(window.location.pathname)}`
        else setDone(true)
      }}
    >
      {t('report')}
    </button>
  )
}
