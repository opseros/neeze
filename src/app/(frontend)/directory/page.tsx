import { getTranslations } from 'next-intl/server'

import { DirectoryHome } from '@/components/directory-home'

export async function generateMetadata() {
  const t = await getTranslations('hero')
  return { title: t('title'), description: t('subtitle') }
}

export default function DirectoryPage() {
  return <DirectoryHome />
}
