'use client'

import { ChevronDown, House, Languages, Newspaper, Search, User, Users } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useTransition } from 'react'

import { setLocaleAction } from '@/app/(frontend)/actions'
import { LANGUAGES } from '@/i18n/locales'

type NavItem = { href: string; label: string; match: string }

function isActive(match: string, pathname: string, vertical: string | null) {
  if (match.startsWith('/')) return pathname.startsWith(match)
  return pathname === '/explore' && vertical === match
}

function HeaderNavInner({ links }: { links: NavItem[] }) {
  const pathname = usePathname()
  const vertical = useSearchParams().get('vertical')
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {links.map((l) => {
          const active = isActive(l.match, pathname, vertical)
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${active ? 'bg-brand-blue/10 text-brand-navy' : 'text-muted hover:bg-surface hover:text-ink'}`}
              >
                {l.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function HeaderNav({ links }: { links: NavItem[] }) {
  return (
    <Suspense fallback={<div className="hidden md:block" />}>
      <HeaderNavInner links={links} />
    </Suspense>
  )
}

export function LanguageToggle({ current, label }: { current: string; label: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <label className={`relative flex h-10 w-[5.75rem] shrink-0 items-center rounded-lg border border-line text-sm hover:border-brand-blue/40 sm:w-28 ${pending ? 'opacity-60' : ''}`}>
      <Languages className="pointer-events-none absolute left-2.5 size-4 text-muted" aria-hidden />
      <span className="sr-only">{label}</span>
      <select
        value={current}
        disabled={pending}
        onChange={(e) => {
          const code = e.target.value
          start(async () => {
            await setLocaleAction(code)
            router.refresh()
          })
        }}
        className="h-full w-full min-w-0 cursor-pointer appearance-none truncate rounded-lg bg-transparent pl-8 pr-6 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
      >
        {LANGUAGES.map((o) => (
          <option key={o.code} value={o.code} lang={o.code}>
            {o.code === current ? o.short : `${o.label} · ${o.hint}`}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-4 text-muted" aria-hidden />
    </label>
  )
}

export function MobileTabBar({ labels }: { labels: { home: string; explore: string; community: string; news: string; me: string } }) {
  const pathname = usePathname()
  const items = [
    { href: '/', icon: House, label: labels.home, active: pathname === '/' },
    { href: '/explore', icon: Search, label: labels.explore, active: pathname.startsWith('/explore') || pathname.startsWith('/p/') },
    { href: '/community', icon: Users, label: labels.community, active: pathname.startsWith('/community') },
    { href: '/news', icon: Newspaper, label: labels.news, active: pathname.startsWith('/news') },
    { href: '/me', icon: User, label: labels.me, active: pathname.startsWith('/me') || pathname.startsWith('/saved') },
  ]
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {items.map(({ href, icon: Icon, label, active }) => (
          <li key={href}>
            <Link href={href} aria-current={active ? 'page' : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${active ? 'font-semibold text-brand-navy' : 'text-muted'}`}>
              <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
