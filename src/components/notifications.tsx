'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function MarkAllRead({ ids }: { ids: number[] }) {
  const t = useTranslations('notif')
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  if (!ids.length) return null
  return (
    <button
      type="button"
      disabled={busy}
      className="text-sm font-medium text-brand-blue"
      onClick={async () => {
        setBusy(true)
        await Promise.all(ids.map((id) => fetch(`/api/notifications/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ read: true }) })))
        setBusy(false)
        router.refresh()
      }}
    >
      {t('markAll')}
    </button>
  )
}
