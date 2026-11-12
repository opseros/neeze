import { getTranslations } from 'next-intl/server'

import { SavedList } from '@/components/client'
import { Container, PageTitle } from '@/components/ui'

export async function generateMetadata() {
  const t = await getTranslations('saved')
  return { title: t('title') }
}

// Static shell: the list itself comes from IndexedDB, so it works offline.
export default async function SavedPage() {
  const t = await getTranslations('saved')
  return (
    <>
      <PageTitle title={t('title')} />
      <Container className="py-6 md:py-8">
        <SavedList />
      </Container>
    </>
  )
}
