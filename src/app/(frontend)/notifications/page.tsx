import { Bell, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'

import { MarkAllRead } from '@/components/notifications'
import { Container, PageTitle } from '@/components/ui'
import type { Notification } from '@/payload-types'
import { relativeTime, requireUser } from '@/lib/account'
import { getPayloadClient } from '@/lib/server'

export async function generateMetadata() {
  const t = await getTranslations('notif')
  return { title: t('title'), robots: { index: false } }
}

export default async function NotificationsPage() {
  const user = await requireUser('/notifications')
  const [t, locale] = await Promise.all([getTranslations('notif'), getLocale()])
  const payload = await getPayloadClient()
  const { docs } = await payload.find({ collection: 'notifications', where: { user: { equals: user.id } }, sort: '-createdAt', limit: 50, depth: 0, user, overrideAccess: false })
  const items = docs as Notification[]
  const text = (n: Notification) => {
    const d = (n.data ?? {}) as Record<string, string | boolean | null>
    if (n.kind === 'new-review') return t('newReview', { author: String(d.author ?? ''), provider: String(d.providerName ?? ''), rating: String(d.rating ?? '') })
    if (n.kind === 'new-request') return t(d.urgent ? 'newRequestUrgent' : 'newRequest', { code: String(d.code ?? ''), name: String(d.contactName ?? '') })
    return t(`update.${String(d.status ?? 'submitted')}` as 'update.submitted', { code: String(d.code ?? ''), provider: String(d.providerName ?? '') })
  }
  return (
    <>
      <PageTitle title={t('title')} />
      <Container className="max-w-2xl py-6 md:py-8">
        <div className="mb-3 flex justify-end">
          <MarkAllRead ids={items.filter((n) => !n.read).map((n) => n.id)} />
        </div>
        {items.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-white p-10 text-center">
            <Bell className="size-10 text-muted" aria-hidden />
            <p className="mt-3 text-muted">{t('empty')}</p>
          </div>
        ) : (
          <ul className="grid divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {items.map((n) => (
              <li key={n.id}>
                <Link href={n.link ?? '/me'} className={`flex items-center gap-3 px-4 py-3.5 hover:bg-surface ${n.read ? '' : 'bg-brand-blue/5'}`}>
                  <span className={`size-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-brand-blue'}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={`block ${n.read ? 'text-ink/80' : 'font-semibold text-ink'}`}>{text(n)}</span>
                    <span className="text-xs text-muted">{relativeTime(n.createdAt, locale)}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  )
}
