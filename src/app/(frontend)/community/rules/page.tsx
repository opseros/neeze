import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Container, PageTitle } from '@/components/ui'
import { getSiteSettings } from '@/lib/server'

export async function generateMetadata() {
  const t = await getTranslations('community')
  return { title: t('rulesTitle') }
}

const RULES = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'] as const

export default async function RulesPage() {
  const [t, settings] = await Promise.all([getTranslations('community'), getSiteSettings().catch(() => null)])
  const email = settings?.grievanceEmail
  return (
    <>
      <PageTitle title={t('rulesTitle')} crumbs={[{ href: '/community', label: t('title') }]} />
      <Container className="max-w-2xl py-6 md:py-10">
        <p className="text-lg">{t('rulesIntro')}</p>
        <ol className="mt-6 grid gap-3">
          {RULES.map((r, i) => (
            <li key={r} className="flex gap-3 rounded-xl border border-line bg-white p-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-navy text-sm font-bold text-white">{i + 1}</span>
              <span>{t(`rulesList.${r}`)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-muted">
          {email ? (
            t.rich('rulesContact', { email, mail: (c) => <a href={`mailto:${email}`} className="font-semibold text-brand-blue">{c}</a> })
          ) : (
            t('rulesContactNoEmail')
          )}
        </p>
        <Link href="/community/new" className="btn-primary mt-6 h-12 px-6">{t('write')}</Link>
      </Container>
    </>
  )
}
