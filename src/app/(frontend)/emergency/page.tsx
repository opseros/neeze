import { getTranslations } from 'next-intl/server'

import { PageHeader } from '@/components/ui'
import { getSiteSettings } from '@/lib/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const t = await getTranslations('emergency')
  return { title: t('title') }
}

export default async function EmergencyPage() {
  const t = await getTranslations('emergency')
  const settings = await getSiteSettings().catch(() => null)
  const contacts = settings?.emergencyContacts ?? []
  return (
    <>
      <PageHeader title={t('title')} back="/" />
      <div className="grid gap-3 px-4 pt-4">
        <p className="text-sm text-muted">{t('body')}</p>
        <ul className="grid gap-2">
          {contacts.map((c) => (
            <li key={c.id}>
              <a href={`tel:${c.phone}`} className="card flex items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold">{c.label}</span>
                  {c.note && <span className="block text-sm text-muted">{c.note}</span>}
                </span>
                <span className="rounded-xl bg-red-700 px-4 py-2 text-lg font-bold text-white">{c.phone}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">{t('verifyNote')}</p>
      </div>
    </>
  )
}
