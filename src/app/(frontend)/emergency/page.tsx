import { getTranslations } from 'next-intl/server'

import { Container, PageTitle } from '@/components/ui'
import { getSiteSettings } from '@/lib/server'

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
      <PageTitle title={t('title')} subtitle={t('body')} back="/" />
      <Container className="grid gap-4 py-6 md:py-8">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((c) => (
            <li key={c.id}>
              <a href={`tel:${c.phone}`} className="card flex h-full items-center justify-between gap-3 transition hover:border-red-300">
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
      </Container>
    </>
  )
}
