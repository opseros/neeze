'use client'

import { useLocale } from 'next-intl'
import { useEffect, useRef } from 'react'

type Event = { type: string; q?: string; results?: number; provider?: number; locality?: number; category?: string }

/** Anonymous, cookie-free usage beacon. Respects Do Not Track and Global Privacy Control. */
export function track(e: Event, locale?: string) {
  if (typeof navigator === 'undefined') return
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  if (nav.doNotTrack === '1' || nav.globalPrivacyControl) return
  const body = JSON.stringify({ ...e, locale, mobile: window.matchMedia('(max-width: 767px)').matches })
  try {
    if (!nav.sendBeacon?.('/api/analytics-events/track', new Blob([body], { type: 'text/plain' }))) {
      fetch('/api/analytics-events/track', { method: 'POST', body, keepalive: true }).catch(() => null)
    }
  } catch {
    /* never let analytics break the page */
  }
}

/** Mounted once in the layout: call/WhatsApp taps (links with data-track) and PWA installs. */
export function Tracker() {
  const locale = useLocale()
  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      const a = (ev.target as Element | null)?.closest?.('[data-track]') as HTMLElement | null
      if (!a) return
      track({ type: a.dataset.track!, provider: Number(a.dataset.provider) || undefined }, locale)
    }
    const onInstall = () => track({ type: 'install' }, locale)
    document.addEventListener('click', onClick, { capture: true })
    window.addEventListener('appinstalled', onInstall)
    return () => {
      document.removeEventListener('click', onClick, { capture: true })
      window.removeEventListener('appinstalled', onInstall)
    }
  }, [locale])
  return null
}

/** Sends one event when the page shows (again only if the event changes). */
export function TrackOnce({ event }: { event: Event }) {
  const locale = useLocale()
  const sent = useRef('')
  const key = JSON.stringify(event)
  useEffect(() => {
    if (sent.current === key) return
    sent.current = key
    track(JSON.parse(key), locale)
  }, [key, locale])
  return null
}
