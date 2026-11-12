import { getTranslations } from 'next-intl/server'

import { SavedList } from '@/components/client'
import { PageHeader } from '@/components/ui'

export async function generateMetadata() {
  const t = await getTranslations('saved')
  return { title: t('title') }
}

// Static shell: the list itself comes from IndexedDB, so it works offline.
export default async function SavedPage() {
  const t = await getTranslations('saved')
  return (
    <>
      <PageHeader title={t('title')} />
      <div className="px-4 pt-4">
        <SavedList />
      </div>
    </>
  )
}
