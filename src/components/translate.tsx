'use client'

import { Languages } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { type ReactNode, useState } from 'react'

/**
 * Shows the original content with a "Translate" link under it. When used, the content is replaced by
 * Google's translation (fetched once per paragraph site-wide and cached), with "Show original".
 * The server decides whether to offer it (`offer`): only when the text isn't already in the reader's language.
 */
export function Translatable({ kind, id, offer, children, headingFirst = false, className = '' }: { kind: string; id: number; offer: boolean; children: ReactNode; headingFirst?: boolean; className?: string }) {
  const t = useTranslations('translate')
  const locale = useLocale()
  const [state, setState] = useState<'original' | 'busy' | 'translated' | 'error'>('original')
  const [paragraphs, setParagraphs] = useState<string[]>([])
  const [error, setError] = useState('')

  if (!offer) return <>{children}</>

  const translate = async () => {
    if (paragraphs.length) return setState('translated')
    setState('busy')
    const res = await fetch('/api/translation-cache/translate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, id, locale }) }).catch(() => null)
    const data = await res?.json().catch(() => null)
    if (res?.ok && Array.isArray(data?.paragraphs)) {
      setParagraphs(data.paragraphs)
      setState('translated')
    } else {
      setError(data?.error === 'daily_limit' || data?.error === 'too_many' ? t('busyToday') : t('failed'))
      setState('error')
    }
  }

  return (
    <div className={className}>
      {state === 'translated' ? (
        <div lang={locale} className="grid gap-3">
          {paragraphs.map((p, i) =>
            headingFirst && i === 0 ? (
              <p key={i} className="font-news text-xl font-bold leading-snug text-ink md:text-2xl">
                {p}
              </p>
            ) : (
              <p key={i} className="whitespace-pre-line leading-relaxed">
                {p}
              </p>
            ),
          )}
        </div>
      ) : (
        children
      )}
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
        <button
          type="button"
          data-translate-button
          onClick={state === 'translated' ? () => setState('original') : translate}
          disabled={state === 'busy'}
          className="inline-flex items-center gap-1 font-semibold text-brand-blue hover:underline disabled:opacity-60"
        >
          <Languages className="size-4" aria-hidden />
          {state === 'translated' ? t('showOriginal') : state === 'busy' ? t('busy') : t('button')}
        </button>
        {state === 'translated' && <span>{t('by')}</span>}
        {state === 'error' && <span role="status">{error}</span>}
      </p>
    </div>
  )
}
