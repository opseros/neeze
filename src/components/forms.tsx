'use client'

import { CircleCheck, Inbox } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { OUTBOX_EVENT, newIdempotencyKey, outboxStore, submitRequest } from '@/lib/idb'
import { AuthPanel, ProfileStep, type Providers } from './auth'

type AuthUser = { id: number; name?: string | null; phone?: string | null } | null

/* ---------- Service / appointment request ---------- */

type RequestFormProps = {
  provider: { id: number; name: string; categoryId?: number }
  kind: 'service' | 'appointment' | 'enquiry'
  localities: { id: number; name: string }[]
  defaultLocality?: number
  user: AuthUser
  providers: Providers
}

const draftKey = (providerId: number) => `neeze:draft:${providerId}`

export function RequestForm({ provider, kind, localities, defaultLocality, user: initialUser, providers }: RequestFormProps) {
  const t = useTranslations('request')
  const [user, setUser] = useState<AuthUser>(initialUser)
  const [state, setState] = useState<'form' | 'signin' | 'phone' | 'sending' | 'sent' | 'queued' | 'error'>('form')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [form, setForm] = useState({
    description: '',
    locality: defaultLocality ? String(defaultLocality) : '',
    address: '',
    preferredDate: '',
    preferredWindow: 'any',
    urgency: 'normal',
    contactName: initialUser?.name ?? '',
    contactPhone: initialUser?.phone?.replace('+91', '') ?? '',
  })
  const [key] = useState(newIdempotencyKey)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value })

  // Keep what was typed if the person leaves for Google/Microsoft sign-in and comes back.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(draftKey(provider.id))
      if (saved) {
        const d = JSON.parse(saved) as Partial<typeof form>
        setForm((f) => ({ ...f, ...d, contactName: f.contactName || d.contactName || '', contactPhone: f.contactPhone || d.contactPhone || '' }))
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.id])
  const saveDraft = () => {
    try {
      sessionStorage.setItem(draftKey(provider.id), JSON.stringify(form))
    } catch {}
  }
  // Bring the sign-in / mobile step into view (on phones the button that triggered it is far down the page).
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (state === 'signin' || state === 'phone' || state === 'sent' || state === 'queued') {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [state])
  const clearDraft = () => {
    try {
      sessionStorage.removeItem(draftKey(provider.id))
    } catch {}
  }

  const body = () => ({
    idempotencyKey: key,
    kind,
    provider: provider.id,
    category: provider.categoryId,
    ...form,
    locality: Number(form.locality),
    preferredDate: form.preferredDate || undefined,
  })

  const send = async () => {
    setState('sending')
    setErrorMsg(null)
    const b = body()
    const queue = async () => {
      await outboxStore.put({ idempotencyKey: key, body: b, providerName: provider.name, createdAt: Date.now(), attempts: 0 })
      clearDraft()
      window.dispatchEvent(new Event(OUTBOX_EVENT))
      localStorage.setItem('neeze:engaged', '1')
      setState('queued')
    }
    if (!navigator.onLine) return queue()
    try {
      const r = await submitRequest(b)
      if (r.ok) {
        clearDraft()
        setCode(r.data.code ?? null)
        localStorage.setItem('neeze:engaged', '1')
        window.dispatchEvent(new Event('neeze:engaged'))
        return setState('sent')
      }
      if (r.status === 401) return setState('signin')
      if (r.status === 428) return setState('phone')
      setErrorMsg(r.data.error ?? null)
      setState('error')
    } catch {
      await queue() // network dropped mid-request: keep it and retry later with the same key
    }
  }

  if (state === 'sent' || state === 'queued') {
    return (
      <div ref={topRef} className="grid justify-items-center gap-3 py-6 text-center" role="status">
        {state === 'sent' ? <CircleCheck className="size-12 text-brand-teal" aria-hidden /> : <Inbox className="size-12 text-brand-blue" aria-hidden />}
        <p className="text-lg font-semibold">{state === 'sent' ? t('sent') : t('queued')}</p>
        {state === 'sent' && <p className="text-muted">{t('sentBody', { code: code ?? '', name: provider.name })}</p>}
        <a href="/me" className="btn-primary w-full max-w-xs">
          {t('track')}
        </a>
      </div>
    )
  }

  if (state === 'phone') {
    return (
      <div ref={topRef} className="mx-auto max-w-md">
        <ProfileStep
          initialName={user?.name ?? form.contactName}
          onDone={(u) => {
            setUser(u)
            setForm((f) => ({ ...f, contactPhone: f.contactPhone || (u.phone ?? '').replace('+91', '') }))
            send()
          }}
        />
      </div>
    )
  }

  if (state === 'signin' || (!user && state !== 'form')) {
    return (
      <div ref={topRef} className="mx-auto max-w-md">
        <AuthPanel
          providers={providers}
          next={`/request/${provider.id}`}
          beforeRedirect={saveDraft}
          onDone={(u) => {
            setUser(u)
            if (u.needsPhone) return setState('phone')
            setForm((f) => ({ ...f, contactName: f.contactName || u.name || '', contactPhone: f.contactPhone || (u.phone ?? '').replace('+91', '') }))
            send()
          }}
        />
      </div>
    )
  }

  return (
    <form
      ref={topRef as unknown as React.Ref<HTMLFormElement>}
      className="grid scroll-mt-24 gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!user) {
          saveDraft()
          setState('signin')
        } else send()
      }}
    >
      {kind === 'appointment' && <p className="rounded-lg bg-brand-teal/10 p-3 text-sm text-ink">{t('appointmentNote')}</p>}
      {kind === 'enquiry' && <p className="rounded-lg bg-brand-blue/10 p-3 text-sm text-ink">{t('enquiryNote')}</p>}
      <label className="field">
        <span>{t('describe')}</span>
        <textarea required minLength={5} maxLength={1000} rows={4} placeholder={kind === 'enquiry' ? t('enquiryHint') : t('describeHint')} value={form.description} onChange={set('description')} className="input" />
      </label>
      <label className="field">
        <span>{t('area')}</span>
        <select required value={form.locality} onChange={set('locality')} className="input">
          <option value="" disabled>
            —
          </option>
          {localities.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('address')}</span>
        <textarea rows={2} maxLength={300} value={form.address} onChange={set('address')} className="input" />
        <small className="text-muted">{t('addressHint')}</small>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">
          <span>{t('date')}</span>
          <input type="date" value={form.preferredDate} onChange={set('preferredDate')} className="input" min={new Date().toISOString().slice(0, 10)} />
        </label>
        <label className="field">
          <span>{t('window')}</span>
          <select value={form.preferredWindow} onChange={set('preferredWindow')} className="input">
            {(['any', 'morning', 'afternoon', 'evening'] as const).map((w) => (
              <option key={w} value={w}>
                {t(`windows.${w}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {kind === 'service' && (
        <fieldset className="field">
          <legend className="mb-1">{t('urgency')}</legend>
          <div className="flex gap-2">
            {(['normal', 'urgent'] as const).map((u) => (
              <label key={u} className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center ${form.urgency === u ? 'border-brand-blue bg-brand-blue/10 font-semibold' : 'border-line'}`}>
                <input type="radio" name="urgency" value={u} checked={form.urgency === u} onChange={set('urgency')} className="sr-only" />
                {t(u)}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="field">
          <span>{t('name')}</span>
          <input required maxLength={80} autoComplete="name" value={form.contactName} onChange={set('contactName')} className="input" />
        </label>
        <label className="field">
          <span>{t('phone')}</span>
          <input required inputMode="numeric" autoComplete="tel-national" maxLength={14} value={form.contactPhone} onChange={set('contactPhone')} className="input" />
        </label>
      </div>
      <p className="text-xs text-muted">{t('privacy')}</p>
      {state === 'error' && (
        <p role="alert" className="text-sm text-red-700">
          {errorMsg ?? t('error')}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={state === 'sending'}>
        {state === 'sending' ? t('sending') : t('submit')}
      </button>
    </form>
  )
}

export function CancelRequestButton({ id }: { id: number }) {
  const t = useTranslations('me')
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      className="text-sm text-red-700 underline"
      onClick={async () => {
        setBusy(true)
        await fetch(`/api/requests/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled', statusReason: t('cancelReason') }),
        })
        setBusy(false)
        router.refresh()
      }}
    >
      {t('cancel')}
    </button>
  )
}
