import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import type { Category, Locality, Provider } from '@/payload-types'

const VERIF_STYLE: Record<string, string> = {
  none: 'bg-slate-100 text-slate-700',
  phone: 'bg-sky-100 text-sky-900',
  identity: 'bg-emerald-100 text-emerald-900',
  credential: 'bg-emerald-200 text-emerald-950',
}

export async function VerificationBadge({ level }: { level?: string | null }) {
  const t = await getTranslations('provider.verification')
  const l = (level ?? 'none') as 'none' | 'phone' | 'identity' | 'credential'
  return (
    <span className={`pill ${VERIF_STYLE[l]}`}>
      {l !== 'none' && <span aria-hidden>✓&nbsp;</span>}
      {t(l)}
    </span>
  )
}

const names = <T extends { name?: string | null }>(xs: (number | T)[] | null | undefined) =>
  (xs ?? []).filter((x): x is T => typeof x === 'object').map((x) => x.name ?? '')

export async function ProviderCard({ p, locale }: { p: Provider; locale: string }) {
  const t = await getTranslations('provider')
  const base = typeof p.baseLocality === 'object' ? (p.baseLocality as Locality) : null
  const cats = names<Category>(p.categories as (number | Category)[])
  const displayName = locale === 'bn' && p.nameBn ? p.nameBn : p.name
  return (
    <li className="card">
      <Link href={`/p/${p.id}`} className="block">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-ink">{displayName}</h3>
          <VerificationBadge level={p.verification} />
        </div>
        <p className="mt-0.5 text-sm text-muted">{[cats.slice(0, 2).join(', '), base?.name].filter(Boolean).join(' · ')}</p>
        {p.summary && <p className="mt-2 line-clamp-2 text-sm text-ink">{p.summary}</p>}
      </Link>
      <div className="mt-3 flex gap-2">
        <a className="btn-secondary flex-1 py-2" href={`tel:${p.phone}`}>
          📞 {t('call')}
        </a>
        <Link className="btn-primary flex-1 py-2" href={`/p/${p.id}`}>
          {t('request')}
        </Link>
      </div>
    </li>
  )
}

export async function BottomNav() {
  const t = await getTranslations('nav')
  const items = [
    { href: '/', icon: '🏠', label: t('home') },
    { href: '/explore', icon: '🔎', label: t('explore') },
    { href: '/news', icon: '📰', label: t('news') },
    { href: '/saved', icon: '★', label: t('saved') },
    { href: '/me', icon: '👤', label: t('me') },
  ]
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs text-muted">
              <span aria-hidden className="text-lg leading-none">
                {i.icon}
              </span>
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function PageHeader({ title, back }: { title: string; back?: string }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
      {back && (
        <Link href={back} aria-label="Back" className="-ml-1 px-1 text-xl text-brand-navy">
          ←
        </Link>
      )}
      <h1 className="truncate text-lg font-semibold">{title}</h1>
    </header>
  )
}

export const VERTICAL_ICON: Record<string, string> = {
  services: '🛠️',
  health: '🩺',
  business: '🏪',
  market: '🛒',
  education: '🎓',
  fitness: '💪',
  travel: '🚌',
}
