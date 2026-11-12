'use client'

import { Flag, ImagePlus, MoreHorizontal, Pencil, ThumbsUp, Trash2, UserX, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

type Target = 'post' | 'comment' | 'news' | 'provider'

const REASONS: Record<Target, string[]> = {
  post: ['spam', 'abuse', 'false-info', 'privacy', 'other'],
  comment: ['spam', 'abuse', 'false-info', 'privacy', 'other'],
  news: ['correction', 'false-info', 'other'],
  provider: ['wrong-info', 'closed', 'fraud', 'other'],
}

const KNOWN_ERRORS = ['body_required', 'too_many', 'restricted', 'suspended', 'phone_required', 'edit_window_closed', 'comments_locked']

/** Payload REST errors carry our code as the message; endpoints return { error }. */
async function errorCode(res: Response | null) {
  const data = await res?.json().catch(() => ({}))
  return String(data?.errors?.[0]?.message ?? data?.error ?? 'generic')
}

function useSignInRedirect() {
  const router = useRouter()
  const path = usePathname()
  return (code: string) => {
    if (code === 'signin_required' || code === 'Unauthorized') router.push(`/signin?next=${encodeURIComponent(path)}`)
    else if (code === 'phone_required') router.push(`/account/complete?next=${encodeURIComponent(path)}`)
    else return false
    return true
  }
}

/* ---------- Helpful ---------- */

export function HelpfulButton({ postId, initial, count: initialCount, signedIn }: { postId: number; initial: boolean; count: number; signedIn: boolean }) {
  const t = useTranslations('community')
  const [on, setOn] = useState(initial)
  const [count, setCount] = useState(initialCount)
  const [busy, setBusy] = useState(false)
  const redirect = useSignInRedirect()
  const toggle = async () => {
    if (!signedIn) return redirect('signin_required')
    setBusy(true)
    // Optimistic: flip now, undo if the server says no.
    setOn(!on)
    setCount(count + (on ? -1 : 1))
    const res = await fetch(`/api/posts/${postId}/helpful`, { method: 'POST', credentials: 'same-origin' }).catch(() => null)
    setBusy(false)
    if (res?.ok) {
      const d = await res.json()
      setOn(d.helpful)
      setCount(d.count)
    } else {
      setOn(on)
      setCount(count)
      redirect(await errorCode(res))
    }
  }
  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={on} className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${on ? 'border-brand-teal bg-brand-teal/10 text-brand-navy' : 'border-line text-muted hover:text-ink'}`}>
      <ThumbsUp className={`size-4 ${on ? 'fill-brand-teal/30 text-brand-teal' : ''}`} aria-hidden />
      {count > 0 ? t('helpfulCount', { count }) : t('helpful')}
    </button>
  )
}

/* ---------- Report (posts, comments, news, listings) ---------- */

/** `signedIn` unknown (cached public pages): asks /auth/me when tapped. */
export function ReportButton({ target, id, signedIn, label, className = '' }: { target: Target; id: number; signedIn?: boolean; label?: string; className?: string }) {
  const t = useTranslations('report')
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | string>('idle')
  const redirect = useSignInRedirect()

  const send = async () => {
    setState('busy')
    const res = await fetch('/api/content-reports/submit', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: target, targetId: id, reason, note }),
    }).catch(() => null)
    if (res?.ok) return setState('done')
    const code = await errorCode(res)
    if (redirect(code)) return
    setState(code === 'too_many' ? 'too_many' : 'generic')
  }

  if (state === 'done') return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{t('thanks')}</p>
  if (!open)
    return (
      <button
        type="button"
        onClick={async () => {
          let ok = signedIn
          if (ok === undefined) {
            const me = await fetch('/auth/me', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
            ok = Boolean(me?.user)
            if (ok && me.user.needsPhone) return redirect('phone_required')
          }
          if (ok) setOpen(true)
          else redirect('signin_required')
        }}
        className={`inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink ${className}`}
      >
        <Flag className="size-4" aria-hidden /> {label ?? t('button')}
      </button>
    )
  return (
    <form
      className="grid w-full gap-3 rounded-xl border border-line bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (reason) send()
      }}
    >
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 font-semibold">{t('title')}</legend>
        {REASONS[target].map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm">
            <input type="radio" name={`reason-${target}-${id}`} value={r} checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-brand-navy" />
            {t(`reasons.${r}` as 'reasons.spam')}
          </label>
        ))}
      </fieldset>
      <label className="grid gap-1 text-sm">
        <span>{t('note')}</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder={t('notePlaceholder')} className="input min-h-20" />
      </label>
      {(state === 'too_many' || state === 'generic') && <p className="text-sm text-red-700">{t(`errors.${state}` as 'errors.generic')}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={!reason || state === 'busy'} className="btn-primary h-10 px-4 text-sm disabled:opacity-50">
          {t('send')}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-lg px-4 text-sm text-muted hover:text-ink">
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}

/* ---------- Post / comment menu: edit, delete, block ---------- */

export function ItemMenu({ kind, id, mine, canEdit, signedIn }: { kind: 'post' | 'comment'; id: number; mine: boolean; canEdit?: boolean; signedIn: boolean }) {
  const t = useTranslations('community')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [note, setNote] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])
  if (!signedIn) return null

  const del = async () => {
    if (!confirm) return setConfirm(true)
    const res = await fetch(`/api/${kind === 'post' ? 'posts' : 'comments'}/${id}`, { method: 'DELETE', credentials: 'same-origin' }).catch(() => null)
    if (res?.ok) {
      if (kind === 'post') router.push('/community')
      router.refresh()
    }
  }
  const block = async () => {
    const res = await fetch('/api/users/block', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(kind === 'post' ? { postId: id } : { commentId: id }) }).catch(() => null)
    if (res?.ok) {
      setNote(t('blocked'))
      setOpen(false)
      setTimeout(() => (kind === 'post' ? router.push('/community') : router.refresh()), 900)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="More" aria-expanded={open} onClick={() => setOpen(!open)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink">
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      {note && <p className="absolute right-0 top-10 z-10 w-56 rounded-lg bg-ink px-3 py-2 text-sm text-white">{note}</p>}
      {open && (
        <ul className="absolute right-0 top-10 z-20 w-56 overflow-hidden rounded-xl border border-line bg-white py-1 text-sm shadow-lift">
          {mine && canEdit && kind === 'post' && (
            <li>
              <Link href={`/community/${id}/edit`} className="flex items-center gap-2 px-3 py-2 hover:bg-surface">
                <Pencil className="size-4" aria-hidden /> {t('edit')}
              </Link>
            </li>
          )}
          {mine && (
            <li>
              <button type="button" onClick={del} className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-700 hover:bg-red-50">
                <Trash2 className="size-4" aria-hidden /> {confirm ? t('deleteConfirm') : t('delete')}
              </button>
            </li>
          )}
          {!mine && (
            <li>
              <button type="button" onClick={block} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface">
                <UserX className="size-4" aria-hidden /> {t('block')}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

export function UnblockButton({ userId }: { userId: number }) {
  const t = useTranslations('community')
  const router = useRouter()
  return (
    <button
      type="button"
      className="text-sm font-semibold text-brand-blue"
      onClick={async () => {
        await fetch('/api/users/block', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, unblock: true }) }).catch(() => null)
        router.refresh()
      }}
    >
      {t('unblock')}
    </button>
  )
}

/* ---------- Comment form ---------- */

export function CommentForm({ postId }: { postId: number }) {
  const t = useTranslations('community')
  const router = useRouter()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const redirect = useSignInRedirect()
  return (
    <form
      className="grid gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!body.trim()) return
        setBusy(true)
        setError('')
        const res = await fetch('/api/comments', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ post: postId, body }) }).catch(() => null)
        setBusy(false)
        if (res?.ok) {
          setBody('')
          router.refresh()
          return
        }
        const code = await errorCode(res)
        if (redirect(code)) return
        setError(t(`errors.${KNOWN_ERRORS.includes(code) ? code : 'generic'}` as 'errors.generic'))
      }}
    >
      <label htmlFor="comment" className="sr-only">
        {t('commentPlaceholder')}
      </label>
      <textarea id="comment" value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} rows={3} placeholder={t('commentPlaceholder')} className="input min-h-20" />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div>
        <button type="submit" disabled={busy || !body.trim()} className="btn-primary h-10 px-5 text-sm disabled:opacity-50">
          {t('commentSubmit')}
        </button>
      </div>
    </form>
  )
}

/* ---------- Write / edit a post ---------- */

type Option = { id: number; name: string }
type PostFormProps = {
  localities: Option[]
  topics: { value: string; label: string }[]
  reviewNotice?: string
  initial?: { id: number; body: string; topic: string; locality: number | null; image: { id: number; url: string } | null }
  defaultLocality?: number | null
}

/** Phones take 4–12 MB photos; shrink to ≤1600 px JPEG before upload so it's quick on mobile data. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('encode'))), 'image/jpeg', 0.82))
}

export function PostForm({ localities, topics, reviewNotice, initial, defaultLocality }: PostFormProps) {
  const t = useTranslations('community')
  const router = useRouter()
  const redirect = useSignInRedirect()
  const [topic, setTopic] = useState(initial?.topic ?? 'question')
  const [locality, setLocality] = useState<string>(String(initial?.locality ?? defaultLocality ?? ''))
  const [body, setBody] = useState(initial?.body ?? '')
  const [image, setImage] = useState<{ id?: number; url: string; blob?: Blob } | null>(initial?.image ?? null)
  const [agree, setAgree] = useState(Boolean(initial))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const max = 1000

  const pick = async (f?: File) => {
    if (!f) return
    setError('')
    try {
      const blob = await shrink(f)
      setImage({ url: URL.createObjectURL(blob), blob })
    } catch {
      setError(t('errors.image'))
    }
  }

  const submit = async () => {
    setBusy(true)
    setError('')
    let imageId: number | null = image?.id ?? null
    if (image?.blob) {
      const fd = new FormData()
      fd.append('file', image.blob, 'photo.jpg')
      fd.append('_payload', JSON.stringify({ alt: body.slice(0, 80) || 'Photo' }))
      const up = await fetch('/api/media', { method: 'POST', credentials: 'same-origin', body: fd }).catch(() => null)
      if (!up?.ok) {
        setBusy(false)
        const code = await errorCode(up)
        if (!redirect(code)) setError(t('errors.image'))
        return
      }
      imageId = (await up.json()).doc.id
    }
    const payload = { body, topic, locality: locality ? Number(locality) : null, image: imageId }
    const res = await fetch(initial ? `/api/posts/${initial.id}` : '/api/posts', {
      method: initial ? 'PATCH' : 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => null)
    setBusy(false)
    if (res?.ok) {
      const doc = (await res.json()).doc
      if (doc.status === 'pending' && !initial) return setPending(true)
      router.push(`/community/${doc.id}`)
      router.refresh()
      return
    }
    const code = await errorCode(res)
    if (redirect(code)) return
    setError(t(`errors.${KNOWN_ERRORS.includes(code) ? code : 'generic'}` as 'errors.generic'))
  }

  if (pending)
    return (
      <div className="card grid gap-3">
        <p className="text-emerald-900">{t('postedPending')}</p>
        <Link href="/community" className="font-semibold text-brand-blue">
          ← {t('title')}
        </Link>
      </div>
    )

  return (
    <form
      className="card grid gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (agree && body.trim().length >= 3) submit()
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t('topic')}</legend>
        <div className="flex flex-wrap gap-2">
          {topics.map((o) => (
            <label key={o.value} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-blue ${topic === o.value ? 'border-brand-navy bg-brand-navy text-white' : 'border-line bg-white text-ink'}`}>
              <input type="radio" name="topic" value={o.value} checked={topic === o.value} onChange={() => setTopic(o.value)} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="grid gap-1.5">
        <span className="text-sm font-semibold">{t('body')}</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={max} rows={6} required className="input min-h-36" aria-describedby="body-hint" />
        <span id="body-hint" className="flex justify-between gap-4 text-xs text-muted">
          <span>{t('bodyHint')}</span>
          <span className="shrink-0">{t('charsLeft', { count: max - body.length })}</span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold">{t('area')}</span>
          <select value={locality} onChange={(e) => setLocality(e.target.value)} className="input h-11">
            <option value="">{t('allAreas')}</option>
            {localities.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid content-start gap-1.5">
          <span className="text-sm font-semibold">{t('photo')}</span>
          {image ? (
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" className="h-28 rounded-xl object-cover" />
              <button type="button" onClick={() => setImage(null)} aria-label={t('removePhoto')} className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-ink text-white">
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex h-11 w-fit items-center gap-2 rounded-lg border border-dashed border-line px-4 text-sm font-medium text-ink hover:bg-surface">
              <ImagePlus className="size-4" aria-hidden /> {t('addPhoto')}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
      </div>

      {!initial && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 accent-brand-navy" />
          <span>
            {t.rich('agree', {
              rules: (chunks) => (
                <Link href="/community/rules" target="_blank" className="font-semibold text-brand-blue underline-offset-2 hover:underline">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
      )}
      {reviewNotice && !initial && <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-950">{reviewNotice}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div>
        <button type="submit" disabled={busy || !agree || body.trim().length < 3} className="btn-primary h-12 px-6 disabled:opacity-50">
          {busy ? t('saving') : initial ? t('save') : t('submit')}
        </button>
      </div>
    </form>
  )
}
