import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { PostForm } from '@/components/community'
import { Container, PageTitle } from '@/components/ui'
import { TOPICS, canEditPost } from '@/lib/community'
import { requireUser } from '@/lib/account'
import { toPostView } from '@/lib/cache'
import { getContentLocale, getLocalities, getPayloadClient } from '@/lib/server'
import type { Post } from '@/payload-types'

export const metadata = { robots: { index: false } }

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  const user = await requireUser(`/community/${id}/edit`)
  const payload = await getPayloadClient()
  const p = await payload.findByID({ collection: 'posts', id, depth: 1, locale: await getContentLocale(), overrideAccess: true }).catch(() => null)
  if (!p) notFound()
  const post = toPostView(p as Post)
  if (post.authorId !== user.id) notFound()
  if (!canEditPost(post)) redirect(`/community/${id}`)
  const [t, localities] = await Promise.all([getTranslations('community'), getLocalities()])
  const imageId = typeof p.image === 'object' && p.image ? p.image.id : (p.image as number | null)
  return (
    <>
      <PageTitle title={t('editTitle')} crumbs={[{ href: '/community', label: t('title') }]} />
      <Container className="max-w-2xl py-6 md:py-8">
        <PostForm
          localities={localities.map((l) => ({ id: l.id, name: l.name }))}
          topics={TOPICS.map((k) => ({ value: k, label: t(`topics.${k}`) }))}
          initial={{ id: post.id, body: post.body, topic: post.topic, locality: post.localityId, image: post.image && imageId ? { id: imageId, url: post.image.card } : null }}
        />
      </Container>
    </>
  )
}
