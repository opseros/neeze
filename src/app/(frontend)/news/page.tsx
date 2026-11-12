import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'

import { PageHeader } from '@/components/ui'
import { getContentLocale, getPayloadClient } from '@/lib/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const t = await getTranslations('news')
  return { title: t('title') }
}

export default async function NewsList() {
  const t = await getTranslations('news')
  const locale = await getLocale()
  const payload = await getPayloadClient()
  const { docs } = await payload.find({ collection: 'news', where: { _status: { equals: 'published' } }, sort: '-publishedAt', limit: 30, depth: 0, locale: await getContentLocale(), overrideAccess: false })
  return (
    <>
      <PageHeader title={t('title')} />
      <div className="grid gap-2 px-4 pt-4">
        {docs.length === 0 && <p className="card text-muted">{t('empty')}</p>}
        {docs.map((n) => (
          <Link key={n.id} href={`/news/${n.slug}`} className="card block">
            <p className="font-semibold">{n.title}</p>
            {n.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{n.summary}</p>}
            {n.publishedAt && <p className="mt-1 text-xs text-muted">{new Date(n.publishedAt).toLocaleDateString(locale === 'bn' ? 'bn-IN' : 'en-IN', { dateStyle: 'medium' })}</p>}
          </Link>
        ))}
      </div>
    </>
  )
}
