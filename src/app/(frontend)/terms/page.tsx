import { getTranslations } from 'next-intl/server'

import { Container, PageTitle } from '@/components/ui'

export async function generateMetadata() {
  const t = await getTranslations('legal')
  return { title: t('termsTitle') }
}

// Placeholder until the reviewed text is ready (see README launch checklist).
export default async function Page() {
  const t = await getTranslations('legal')
  return (
    <>
      <PageTitle title={t('termsTitle')} />
      <Container className="max-w-3xl py-8">
        <p className="card text-muted">{t('pending')}</p>
      </Container>
    </>
  )
}
