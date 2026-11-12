'use client'

import { ArrowLeft, Mail, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { flushOutbox } from '@/lib/idb'

export type Providers = { google: boolean; microsoft: boolean }
export type AuthUser = { id: number; name: string | null; email: string | null; phone: string | null; needsPhone: boolean }

const KNOWN_ERRORS = [
  'invalid_email', 'invalid_phone', 'name_required', 'phone_taken', 'too_soon', 'too_many', 'wrong_code', 'expired',
  'too_many_attempts', 'send_failed', 'email_not_configured', 'cancelled', 'state', 'exchange', 'claims', 'disabled', 'suspended',
]

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 21 21" className="size-[18px]" aria-hidden>
      <path fill="#F25022" d="M1 1h9v9H1z" />
      <path fill="#7FBA00" d="M11 1h9v9h-9z" />
      <path fill="#00A4EF" d="M1 11h9v9H1z" />
      <path fill="#FFB900" d="M11 11h9v9h-9z" />
    </svg>
  )
}

/* ---------- Mobile number step (mandatory) ---------- */

export function ProfileStep({ initialName, onDone }: { initialName?: string | null; onDone: (u: AuthUser) => void }) {
  const t = useTranslations('auth')
  const [name, setName] = useState(initialName ?? '')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [codeStep, setCodeStep] = useState<null | { channel: string; devCode?: string }>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const err = (k?: string) => setError(t(`errors.${KNOWN_ERRORS.includes(k ?? '') ? k : 'generic'}` as 'errors.generic'))

  const save = async () => {
    setBusy(true)
    setError(null)
    const r = await post('/auth/phone', { name, phone }).catch(() => null)
    setBusy(false)
    if (!r) return err()
    if (!r.ok) return err(r.data.error)
    if (r.data.needsCode) return setCodeStep({ channel: r.data.channel, devCode: r.data.devCode })
    onDone(r.data.user)
  }
  const verify = async () => {
    setBusy(true)
    setError(null)
    const r = await post('/auth/phone/verify', { phone, code }).catch(() => null)
    setBusy(false)
    if (!r) return err()
    if (!r.ok) return err(r.data.error)
    onDone(r.data.user)
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (codeStep) verify()
        else save()
      }}
    >
      <div className="text-center">
        <h2 className="text-xl font-bold text-ink">{t('profileTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t('profileBody')}</p>
      </div>
      {!codeStep ? (
        <>
          <label className="field">
            <span>{t('nameLabel')}</span>
            <input className="input" required maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>{t('phoneLabel')}</span>
            <div className="flex items-center gap-2">
              <span className="rounded-xl border border-line bg-surface px-3 py-2.5 text-muted">+91</span>
              <input className="input flex-1" required inputMode="numeric" autoComplete="tel-national" maxLength={14} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </label>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">{codeStep.channel === 'sms' ? t('codeSentSms', { phone }) : t('codeSentWhatsapp', { phone })}</p>
          {codeStep.devCode && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{t('devCode', { code: codeStep.devCode })}</p>}
          <label className="field">
            <span>{t('code')}</span>
            <input className="input text-center text-lg tracking-[0.5em]" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          </label>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={busy}>
        {codeStep ? t('verify') : t('continue')}
      </button>
      {codeStep && (
        <button type="button" className="text-sm text-muted underline" onClick={() => setCodeStep(null)}>
          {t('back')}
        </button>
      )}
    </form>
  )
}

/* ---------- Login / Sign up ---------- */

type PanelProps = {
  providers: Providers
  next?: string
  initialStep?: 'choose' | 'email' | 'phone'
  initialEmail?: string
  reason?: 'verify'
  error?: string
  initialName?: string | null
  /** Called before leaving the page for Google/Microsoft (e.g. to save a half-filled form). */
  beforeRedirect?: () => void
  onDone?: (u: AuthUser) => void
}

export function AuthPanel({ providers, next, initialStep = 'choose', initialEmail = '', reason, error: initialError, initialName, beforeRedirect, onDone }: PanelProps) {
  const t = useTranslations('auth')
  const router = useRouter()
  const pathname = usePathname()
  const [step, setStep] = useState<'choose' | 'email' | 'code' | 'phone'>(initialStep)
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialError ? t(`errors.${KNOWN_ERRORS.includes(initialError) ? initialError : 'generic'}` as 'errors.generic') : null)
  const [name, setName] = useState<string | null>(initialName ?? null)
  const err = (k?: string) => setError(t(`errors.${KNOWN_ERRORS.includes(k ?? '') ? k : 'generic'}` as 'errors.generic'))
  const returnTo = next ?? pathname ?? '/'

  const finish = (u: AuthUser) => {
    flushOutbox().catch(() => 0) // send any requests queued while signed out
    if (onDone) onDone(u)
    else {
      router.replace(returnTo)
      router.refresh()
    }
  }

  const social = (p: 'google' | 'microsoft') => {
    beforeRedirect?.()
    window.location.href = `/auth/${p}?next=${encodeURIComponent(returnTo)}`
  }

  const sendCode = async () => {
    setBusy(true)
    setError(null)
    const r = await post('/auth/email/start', { email }).catch(() => null)
    setBusy(false)
    if (!r) return err()
    if (!r.ok) return err(r.data.error)
    setDevCode(r.data.devCode ?? null)
    setCode('')
    setStep('code')
  }

  const verify = async () => {
    setBusy(true)
    setError(null)
    const r = await post('/auth/email/verify', { email, code }).catch(() => null)
    setBusy(false)
    if (!r) return err()
    if (!r.ok) return err(r.data.error)
    const u = r.data.user as AuthUser
    if (u.needsPhone) {
      setName(u.name)
      setStep('phone')
    } else finish(u)
  }

  if (step === 'phone') return <ProfileStep initialName={name} onDone={finish} />

  return (
    <div className="grid gap-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-ink">{t('title')}</h2>
        <p className="mt-1 text-sm text-muted">{reason === 'verify' ? t('verifyEmailReason') : t('subtitle')}</p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {step === 'choose' && (
        <>
          <div className="grid gap-2.5">
            {providers.google && (
              <button type="button" className="auth-btn" onClick={() => social('google')}>
                <GoogleLogo /> {t('google')}
              </button>
            )}
            {providers.microsoft && (
              <button type="button" className="auth-btn" onClick={() => social('microsoft')}>
                <MicrosoftLogo /> {t('microsoft')}
              </button>
            )}
          </div>
          {(providers.google || providers.microsoft) && (
            <div className="flex items-center gap-3 text-sm text-muted" aria-hidden>
              <span className="h-px flex-1 bg-line" /> {t('or')} <span className="h-px flex-1 bg-line" />
            </div>
          )}
          <button type="button" className="auth-btn" onClick={() => setStep('email')}>
            <Mail className="size-5" aria-hidden /> {t('email')}
          </button>
        </>
      )}

      {step === 'email' && (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            sendCode()
          }}
        >
          <label className="field">
            <span>{t('emailLabel')}</span>
            <input className="input" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </label>
          <button type="submit" className="btn-primary" disabled={busy}>
            {t('sendCode')}
          </button>
          {reason !== 'verify' && (
            <button type="button" className="inline-flex items-center justify-center gap-1 text-sm text-muted" onClick={() => setStep('choose')}>
              <ArrowLeft className="size-4" aria-hidden /> {t('back')}
            </button>
          )}
        </form>
      )}

      {step === 'code' && (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            verify()
          }}
        >
          <p className="text-sm text-muted">{t('codeSentEmail', { email })}</p>
          {devCode && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{t('devCode', { code: devCode })}</p>}
          <label className="field">
            <span>{t('code')}</span>
            <input className="input text-center text-lg tracking-[0.5em]" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          </label>
          <button type="submit" className="btn-primary" disabled={busy}>
            {t('verify')}
          </button>
          <div className="flex justify-between text-sm">
            <button type="button" className="text-muted underline" onClick={() => setStep('email')}>
              {t('back')}
            </button>
            <button type="button" className="text-muted underline" disabled={busy} onClick={sendCode}>
              {t('resend')}
            </button>
          </div>
        </form>
      )}

      <p className="border-t border-line pt-3 text-xs leading-relaxed text-muted">
        {t.rich('terms', {
          terms: (c) => (
            <a href="/terms" className="font-medium text-ink underline">
              {c}
            </a>
          ),
          privacy: (c) => (
            <a href="/privacy" className="font-medium text-ink underline">
              {c}
            </a>
          ),
        })}
      </p>
    </div>
  )
}

/* ---------- Modal ---------- */

export function AuthModal({ open, onClose, ...panel }: PanelProps & { open: boolean; onClose: () => void }) {
  const t = useTranslations('auth')
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose() // click on the backdrop
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-ink/50 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="relative p-6 sm:p-7">
          <button type="button" onClick={onClose} aria-label={t('close')} className="absolute right-3 top-3 rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink">
            <X className="size-5" />
          </button>
          <AuthPanel {...panel} />
        </div>
      )}
    </dialog>
  )
}

export function SignInButton({ label, providers, className }: { label: string; providers: Providers; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      <AuthModal open={open} onClose={() => setOpen(false)} providers={providers} />
    </>
  )
}

export function SignOutButton() {
  const t = useTranslations('auth')
  const router = useRouter()
  return (
    <button
      type="button"
      className="btn-secondary shrink-0 whitespace-nowrap px-3 text-sm"
      onClick={async () => {
        await fetch('/auth/logout', { method: 'POST' })
        router.replace('/')
        router.refresh()
      }}
    >
      {t('signOut')}
    </button>
  )
}
