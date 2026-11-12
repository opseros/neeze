import { getTranslations } from 'next-intl/server'

import { PostForm } from '@/components/community'
import { Container, PageTitle } from '@/components/ui'
import { DEFAULT_POSTING_MODE, TOPICS } from '@/lib/community'
import { requireUser } from '@/lib/account'
import { getLocalities, getPayloadClient, getSelectedLocality, getSiteSettings } from '@/lib/server'

export async function generateMetadata() {
  const t = await getTranslations('community')
  return { title: t('newTitle'), robots: { index: false } }
}

export default async function NewPostPage() {
  const user = await requireUser('/community/new')
  const [t, localities, selected, settings] = await Promise.all([getTranslations('community'), getLocalities(), getSelectedLocality(), getSiteSettings().catch(() => null)])
  const mode = (settings as { community?: { postingMode?: string } } | null)?.community?.postingMode ?? DEFAULT_POSTING_MODE
  let notice: string | undefined
  if (mode === 'all') notice = t('reviewNoticeAll')
  else if (mode === 'first-post') {
    const payload = await getPayloadClient()
    const { totalDocs } = await payload.count({ collection: 'posts', where: { and: [{ author: { equals: user.id } }, { status: { equals: 'published' } }] }, overrideAccess: true })
    if (totalDocs === 0) notice = t('reviewNoticeFirst')
  }
  return (
    <>
      <PageTitle title={t('newTitle')} crumbs={[{ href: '/community', label: t('title') }]} />
      <Container className="max-w-2xl py-6 md:py-8">
        <PostForm
          localities={localities.map((l) => ({ id: l.id, name: l.name }))}
          topics={TOPICS.map((k) => ({ value: k, label: t(`topics.${k}`) }))}
          reviewNotice={notice}
          defaultLocality={selected?.id ?? null}
        />
      </Container>
    </>
  )
}
