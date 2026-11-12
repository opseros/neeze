import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'

import { Container, PageTitle } from '@/components/ui'
import type { Media } from '@/payload-types'
import { getNewsListCached } from '@/lib/cache'
import { getContentLocale } from '@/lib/server'

export async function generateMetadata() {
  const t = await getTranslations('news')
  return { title: t('title') }
}

export default async function NewsList() {
  const [t, locale, contentLocale] = await Promise.all([getTranslations('news'), getLocale(), getContentLocale()])
  const docs = await getNewsListCached(contentLocale, 30)
  const fmt = (d: string) => new Date(d).toLocaleDateString(locale === 'bn' ? 'bn-IN' : 'en-IN', { dateStyle: 'medium' })
  return (
    <>
      <PageTitle title={t('title')} />
      <Container className="py-6 md:py-8">
        {docs.length === 0 ? (
          <p className="card text-muted">{t('empty')}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((n) => {
              const img = typeof n.image === 'object' ? (n.image as Media) : null
              return (
                <li key={n.id}>
                  <Link href={`/news/${n.slug}`} className="block h-full overflow-hidden rounded-2xl border border-line bg-white transition hover:border-brand-blue/40 hover:shadow-sm">
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.sizes?.card?.url ?? img.url ?? ''} alt={img.alt} loading="lazy" className="aspect-[16/9] w-full object-cover" />
                    )}
                    <div className="p-4">
                      <p className="font-semibold leading-snug">{n.title}</p>
                      {n.summary && <p className="mt-1 line-clamp-3 text-sm text-muted">{n.summary}</p>}
                      {n.publishedAt && <p className="mt-2 text-xs text-muted">{fmt(n.publishedAt)}</p>}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Container>
    </>
  )
}
