'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { OUTBOX_EVENT, flushOutbox, newIdempotencyKey, outboxStore, submitRequest } from '@/lib/idb'

type AuthUser = { id: number; name?: string | null; phone?: string | null } | null

/* ---------- Phone OTP sign-in ---------- */

export function SignInForm({ onSignedIn, defaultName }: { onSignedIn?: (u: NonNullable<AuthUser>) => void; defaultName?: string }) {
  const t = useTranslations('auth')
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [devCode, setDevCode] = useState<string | null>(null)

  const errorText = (key?: string) => {
    const known = ['invalid_phone', 'too_soon', 'too_many', 'wrong_code', 'expired', 'too_many_attempts']
    return t(`errors.${known.includes(key ?? '') ? key : 'generic'}` as 'errors.generic')
  }

  const requestCode = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/users/otp/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }) })
      const data = await res.json()
      if (!res.ok) return setError(errorText(data.error))
      setDevCode(data.devCode ?? null)
      setStep('code')
    } catch {
      setError(errorText())
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/users/otp/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code, name: defaultName }) })
      const data = await res.json()
      if (!res.ok) return setError(errorText(data.error))
      await flushOutbox().catch(() => 0)
      if (onSignedIn) onSignedIn(data.user)
      else router.refresh()
    } catch {
      setError(errorText())
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (step === 'phone') requestCode()
        else verify()
      }}
    >
      <p className="font-semibold text-ink">{t('title')}</p>
      {step === 'phone' ? (
        <label className="field">
          <span>{t('phone')}</span>
          <div className="flex items-center gap-2">
            <span className="text-muted">+91</span>
            <input inputMode="numeric" autoComplete="tel-national" required maxLength={14} value={phone} onChange={(e) => setPhone(e.target.value)} className="input flex-1" />
          </div>
        </label>
      ) : (
        <>
          <p className="text-sm text-muted">{t('codeSent', { phone })}</p>
          {devCode && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{t('devCode', { code: devCode })}</p>}
          <label className="field">
            <span>{t('code')}</span>
            <input inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} className="input tracking-[0.4em]" />
          </label>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={busy}>
        {step === 'phone' ? t('sendCode') : t('verify')}
      </button>
      {step === 'code' && (
        <button type="button" className="text-sm text-muted underline" onClick={() => setStep('phone')}>
          {t('resend')}
        </button>
      )}
    </form>
  )
}

export function SignOutButton() {
  const t = useTranslations('auth')
  const router = useRouter()
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={async () => {
        await fetch('/api/users/otp/logout', { method: 'POST' })
        await fetch('/api/users/logout', { method: 'POST' }).catch(() => {})
        router.refresh()
      }}
    >
      {t('signOut')}
    </button>
  )
}

/* ---------- Service / appointment request ---------- */

type RequestFormProps = {
  provider: { id: number; name: string; categoryId?: number }
  kind: 'service' | 'appointment'
  localities: { id: number; name: string }[]
  defaultLocality?: number
  user: AuthUser
}

export function RequestForm({ provider, kind, localities, defaultLocality, user: initialUser }: RequestFormProps) {
  const t = useTranslations('request')
  const [user, setUser] = useState<AuthUser>(initialUser)
  const [state, setState] = useState<'form' | 'signin' | 'sending' | 'sent' | 'queued' | 'error'>('form')
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
      window.dispatchEvent(new Event(OUTBOX_EVENT))
      localStorage.setItem('neeze:engaged', '1')
      setState('queued')
    }
    if (!navigator.onLine) return queue()
    try {
      const r = await submitRequest(b)
      if (r.ok) {
        setCode(r.data.code ?? null)
        localStorage.setItem('neeze:engaged', '1')
        window.dispatchEvent(new Event('neeze:engaged'))
        return setState('sent')
      }
      if (r.status === 401) return setState('signin')
      setErrorMsg(r.data.error ?? null)
      setState('error')
    } catch {
      await queue() // network dropped mid-request: keep it and retry later with the same key
    }
  }

  if (state === 'sent' || state === 'queued') {
    return (
      <div className="card grid gap-3 text-center" role="status">
        <div className="text-4xl" aria-hidden>
          {state === 'sent' ? '✅' : '📥'}
        </div>
        <p className="text-lg font-semibold">{state === 'sent' ? t('sent') : t('queued')}</p>
        {state === 'sent' && <p className="text-muted">{t('sentBody', { code: code ?? '', name: provider.name })}</p>}
        <a href="/me" className="btn-primary">
          {t('track')}
        </a>
      </div>
    )
  }

  if (state === 'signin' || (!user && state !== 'form')) {
    return (
      <div className="card">
        <SignInForm
          defaultName={form.contactName}
          onSignedIn={(u) => {
            setUser(u)
            send()
          }}
        />
      </div>
    )
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!user) setState('signin')
        else send()
      }}
    >
      {kind === 'appointment' && <p className="rounded-lg bg-brand-teal/10 p-3 text-sm text-ink">{t('appointmentNote')}</p>}
      <label className="field">
        <span>{t('describe')}</span>
        <textarea required minLength={5} maxLength={1000} rows={4} placeholder={t('describeHint')} value={form.description} onChange={set('description')} className="input" />
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
