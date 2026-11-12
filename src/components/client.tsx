'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { OUTBOX_EVENT, type OutboxItem, type SavedProvider, flushOutbox, outboxStore, savedStore } from '@/lib/idb'
import { setLocaleAction, setLocalityAction } from '@/app/(frontend)/actions'

/* ---------- Language ---------- */

export function LanguagePicker({ current, compact = false }: { current?: string; compact?: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const choose = (l: 'bn' | 'en') =>
    start(async () => {
      await setLocaleAction(l)
      router.refresh()
    })
  const opts = [
    { code: 'bn' as const, label: 'বাংলা' },
    { code: 'en' as const, label: 'English' },
  ]
  return (
    <div className={compact ? 'flex gap-2' : 'grid gap-3'} role="group" aria-label="Language">
      {opts.map((o) => (
        <button
          key={o.code}
          type="button"
          disabled={pending}
          onClick={() => choose(o.code)}
          aria-pressed={current === o.code}
          className={`rounded-xl border px-4 ${compact ? 'py-1.5 text-sm' : 'py-4 text-lg'} font-semibold ${current === o.code ? 'border-brand-blue bg-brand-blue/10 text-brand-navy' : 'border-line bg-white text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Locality ---------- */

export function LocalitySelect({ localities, current, label, allLabel }: { localities: { id: number; name: string }[]; current?: number; label: string; allLabel: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span aria-hidden>📍</span>
      <span className="sr-only">{label}</span>
      <select
        className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2 py-1.5 font-medium text-ink"
        value={current ?? ''}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await setLocalityAction(e.target.value ? Number(e.target.value) : null)
            router.refresh()
          })
        }
      >
        <option value="">{allLabel}</option>
        {localities.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  )
}

/* ---------- Save provider (offline) ---------- */

export function SaveButton({ provider }: { provider: Omit<SavedProvider, 'savedAt'> }) {
  const t = useTranslations('provider')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    savedStore.get(provider.id).then((p) => setSaved(Boolean(p))).catch(() => {})
  }, [provider.id])
  const toggle = async () => {
    if (saved) await savedStore.remove(provider.id)
    else {
      await savedStore.put({ ...provider, savedAt: Date.now() })
      localStorage.setItem('neeze:engaged', '1')
      window.dispatchEvent(new Event('neeze:engaged'))
    }
    setSaved(!saved)
  }
  return (
    <button type="button" onClick={toggle} aria-pressed={saved} className="btn-secondary">
      <span aria-hidden>{saved ? '★' : '☆'}</span> {saved ? t('saved') : t('save')}
    </button>
  )
}

export function SavedList() {
  const t = useTranslations()
  const [items, setItems] = useState<SavedProvider[] | null>(null)
  const load = () => savedStore.all().then((a) => setItems(a.sort((x, y) => y.savedAt - x.savedAt))).catch(() => setItems([]))
  useEffect(() => {
    load()
  }, [])
  if (items === null) return null
  if (!items.length) return <p className="card text-muted">{t('saved.empty')}</p>
  return (
    <ul className="grid gap-3">
      {items.map((p) => (
        <li key={p.id} className="card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <a href={`/p/${p.id}`} className="font-semibold text-ink">
                {p.name}
              </a>
              {p.nameBn && <div className="text-sm text-muted">{p.nameBn}</div>}
              <div className="text-sm text-muted">{[p.categories?.join(', '), p.locality].filter(Boolean).join(' · ')}</div>
            </div>
            <button type="button" className="text-sm text-muted underline" onClick={() => savedStore.remove(p.id).then(load)}>
              {t('saved.remove')}
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <a className="btn-primary flex-1" href={`tel:${p.phone}`}>
              📞 {t('provider.call')}
            </a>
            {p.whatsapp && (
              <a className="btn-whatsapp flex-1" href={`https://wa.me/${p.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                {t('provider.whatsapp')}
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

/* ---------- Outbox: queued requests ---------- */

export function OutboxList() {
  const t = useTranslations('me')
  const [items, setItems] = useState<OutboxItem[]>([])
  useEffect(() => {
    const load = () => outboxStore.all().then(setItems).catch(() => {})
    load()
    window.addEventListener(OUTBOX_EVENT, load)
    return () => window.removeEventListener(OUTBOX_EVENT, load)
  }, [])
  if (!items.length) return null
  return (
    <ul className="grid gap-2">
      {items.map((i) => (
        <li key={i.idempotencyKey} className="card flex items-center justify-between gap-2 border-dashed">
          <span className="min-w-0 truncate font-medium">{i.providerName}</span>
          <span className="pill bg-amber-100 text-amber-900">{i.lastError ?? t('waiting')}</span>
        </li>
      ))}
    </ul>
  )
}

/* ---------- App-wide PWA behaviour ---------- */

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export function PwaChrome() {
  const t = useTranslations('pwa')
  const [online, setOnline] = useState(true)
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [engaged, setEngaged] = useState(false)
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setOnline(navigator.onLine)
    setEngaged(localStorage.getItem('neeze:engaged') === '1' && localStorage.getItem('neeze:install-dismissed') !== '1')
    const onEngaged = () => setEngaged(localStorage.getItem('neeze:install-dismissed') !== '1')
    const sync = async () => {
      setSyncing(true)
      await flushOutbox().catch(() => 0)
      setSyncing(false)
    }
    const goOnline = () => {
      setOnline(true)
      sync()
    }
    const goOffline = () => setOnline(false)
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('neeze:engaged', onEngaged)
    sync()

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone
    setShowIosHint(isIos && !standalone)

    // Show "new version" instead of reloading under the user (could lose a half-filled form).
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return
        if (reg.waiting) setWaiting(reg.waiting)
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) setWaiting(sw)
          })
        })
      })
      let reloaded = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return
        reloaded = true
        window.location.reload()
      })
    }
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('neeze:engaged', onEngaged)
    }
  }, [])

  const dismissInstall = () => {
    localStorage.setItem('neeze:install-dismissed', '1')
    setEngaged(false)
  }

  return (
    <>
      {!online && (
        <div role="status" className="sticky top-0 z-40 bg-ink px-4 py-1.5 text-center text-sm text-white">
          {t('offlineBar')}
        </div>
      )}
      {syncing && (
        <div role="status" className="sticky top-0 z-40 bg-brand-blue px-4 py-1.5 text-center text-sm text-white">
          {t('syncing')}
        </div>
      )}
      {waiting && (
        <div role="status" className="fixed inset-x-3 bottom-20 z-50 flex items-center justify-between gap-3 rounded-xl bg-brand-navy p-3 text-sm text-white shadow-lg">
          <span>{t('update')}</span>
          <button type="button" className="rounded-lg bg-white px-3 py-1.5 font-semibold text-brand-navy" onClick={() => waiting.postMessage({ type: 'SKIP_WAITING' })}>
            {t('refresh')}
          </button>
        </div>
      )}
      {engaged && !waiting && (installEvt || showIosHint) && (
        <div className="fixed inset-x-3 bottom-20 z-40 rounded-xl border border-line bg-white p-4 shadow-lg">
          <p className="font-semibold text-ink">{t('install')}</p>
          <p className="text-sm text-muted">{installEvt ? t('installBody') : t('iosHint')}</p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="px-3 py-1.5 text-sm text-muted" onClick={dismissInstall}>
              {t('dismiss')}
            </button>
            {installEvt && (
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  await installEvt.prompt()
                  setInstallEvt(null)
                  dismissInstall()
                }}
              >
                {t('installButton')}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
