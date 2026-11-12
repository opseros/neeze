'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Next = 'contacted' | 'quoted' | 'accepted' | 'in-progress' | 'completed' | 'rejected'

/** Provider's buttons for moving a request forward; the server re-checks every transition. */
export function ProviderActions({ id, allowed }: { id: number; allowed: Next[] }) {
  const t = useTranslations('dash')
  const router = useRouter()
  const [mode, setMode] = useState<null | 'quoted' | 'rejected'>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const update = async (status: Next, extra: Record<string, string> = {}) => {
    setBusy(true)
    setMsg(null)
    const res = await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ status, ...extra }),
    }).catch(() => null)
    setBusy(false)
    if (!res?.ok) {
      const data = await res?.json().catch(() => ({}))
      return setMsg({ ok: false, text: data?.errors?.[0]?.message ?? 'Error' })
    }
    setMode(null)
    setText('')
    setMsg({ ok: true, text: t('saved') })
    router.refresh()
  }

  if (!allowed.length) return <p className="text-sm text-muted">{t('notAllowed')}</p>

  if (mode) {
    return (
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (mode === 'quoted') update('quoted', { quoteNote: text })
          else update('rejected', { statusReason: text })
        }}
      >
        <label className="field">
          <span>{t(`act.${mode}`)}</span>
          <textarea className="input" rows={3} required maxLength={mode === 'quoted' ? 500 : 200} value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === 'quoted' ? t('quotePlaceholder') : t('reasonPlaceholder')} autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-secondary" onClick={() => setMode(null)}>
            {t('cancel')}
          </button>
          <button type="submit" className={mode === 'rejected' ? 'btn-danger' : 'btn-primary'} disabled={busy}>
            {t('send')}
          </button>
        </div>
      </form>
    )
  }

  const primary = allowed.filter((s) => s !== 'rejected')
  return (
    <div className="grid gap-2">
      {primary.map((s, i) => (
        <button
          key={s}
          type="button"
          disabled={busy}
          className={i === 0 ? 'btn-primary' : 'btn-secondary'}
          onClick={() => (s === 'quoted' ? setMode('quoted') : update(s))}
        >
          {t(`act.${s}`)}
        </button>
      ))}
      {allowed.includes('rejected') && (
        <button type="button" disabled={busy} className="mt-1 text-sm font-medium text-red-700 underline-offset-2 hover:underline" onClick={() => setMode('rejected')}>
          {t('act.rejected')}
        </button>
      )}
      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>
          {msg.text}
        </p>
      )}
    </div>
  )
}
