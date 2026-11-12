'use client'

import { Bookmark, House, Newspaper, Search, User } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useTransition } from 'react'

import { setLocaleAction } from '@/app/(frontend)/actions'

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
  const opts = [
    { code: 'bn' as const, label: 'বাংলা' },
    { code: 'en' as const, label: 'EN' },
  ]
  return (
    <div role="group" aria-label={label} className={`flex h-10 items-center rounded-lg border border-line p-0.5 text-sm ${pending ? 'opacity-60' : ''}`}>
      {opts.map((o) => (
        <button
          key={o.code}
          type="button"
          lang={o.code}
          disabled={pending}
          aria-pressed={current === o.code}
          onClick={() =>
            start(async () => {
              await setLocaleAction(o.code)
              router.refresh()
            })
          }
          className={`h-full rounded-md px-2.5 font-semibold ${current === o.code ? 'bg-brand-navy text-white' : 'text-muted hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function MobileTabBar({ labels }: { labels: { home: string; explore: string; news: string; saved: string; me: string } }) {
  const pathname = usePathname()
  const items = [
    { href: '/', icon: House, label: labels.home, active: pathname === '/' },
    { href: '/explore', icon: Search, label: labels.explore, active: pathname.startsWith('/explore') || pathname.startsWith('/p/') },
    { href: '/news', icon: Newspaper, label: labels.news, active: pathname.startsWith('/news') },
    { href: '/saved', icon: Bookmark, label: labels.saved, active: pathname.startsWith('/saved') },
    { href: '/me', icon: User, label: labels.me, active: pathname.startsWith('/me') },
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
