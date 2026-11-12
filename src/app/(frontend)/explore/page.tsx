import { getLocale, getTranslations } from 'next-intl/server'

import { PageHeader, ProviderCard } from '@/components/ui'
import { VERTICALS } from '@/collections/Places'
import { searchProviders } from '@/lib/search'
import { getContentLocale, getLocalities, getPayloadClient, getSelectedLocality } from '@/lib/server'

export const dynamic = 'force-dynamic'

type SP = Promise<{ q?: string; category?: string; vertical?: string; locality?: string; page?: string }>

export async function generateMetadata() {
  const t = await getTranslations('explore')
  return { title: t('title') }
}

export default async function Explore({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const t = await getTranslations()
  const locale = await getLocale()
  const payload = await getPayloadClient()
  const [localities, selected] = await Promise.all([getLocalities(), getSelectedLocality()])
  const vertical = VERTICALS.includes(sp.vertical as never) ? sp.vertical : undefined
  const localityParam = sp.locality === 'all' ? undefined : Number(sp.locality) || selected?.id

  const [results, categories] = await Promise.all([
    searchProviders({ q: sp.q, category: sp.category, vertical, locality: localityParam, page: Number(sp.page) || 1 }),
    payload.find({
      collection: 'categories',
      where: { and: [{ active: { equals: true } }, ...(vertical ? [{ vertical: { equals: vertical } }] : [])] },
      sort: 'sortOrder',
      limit: 100,
      depth: 0,
      locale: await getContentLocale(),
    }),
  ])
  const activeArea = localities.find((l) => l.id === results.localityId)

  return (
    <>
      <PageHeader title={vertical ? t(`verticals.${vertical}` as 'verticals.services') : t('explore.title')} back="/" />
      <div className="grid gap-4 px-4 pt-4">
        <form role="search" className="card grid gap-3">
          {vertical && <input type="hidden" name="vertical" value={vertical} />}
          <input name="q" type="search" defaultValue={sp.q} placeholder={t('home.searchPlaceholder')} className="input" enterKeyHint="search" />
          <div className="grid grid-cols-2 gap-2">
            <label className="field">
              <span>{t('explore.filterCategory')}</span>
              <select name="category" defaultValue={sp.category ?? ''} className="input">
                <option value="">{t('explore.any')}</option>
                {categories.docs.map((c) => (
                  <option key={c.id} value={c.slug ?? ''}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('explore.filterArea')}</span>
              <select name="locality" defaultValue={localityParam ?? 'all'} className="input">
                <option value="all">{t('home.allSilchar')}</option>
                {localities.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="btn-primary" type="submit">
            {t('explore.apply')}
          </button>
        </form>

        <p className="text-sm text-muted" aria-live="polite">
          {t('explore.results', { count: results.totalDocs })}
          {activeArea && ` · ${t('explore.serves', { area: activeArea.name })}`}
        </p>

        {results.docs.length ? (
          <ul className="grid gap-3">
            {results.docs.map((p) => (
              <ProviderCard key={p.id} p={p} locale={locale} />
            ))}
          </ul>
        ) : (
          <div className="card text-center">
            <p className="font-semibold">{t('explore.noResultsTitle')}</p>
            <p className="mt-1 text-sm text-muted">{t('explore.noResultsBody')}</p>
          </div>
        )}

        {results.totalPages > 1 && (
          <nav className="flex justify-between" aria-label="Pages">
            {results.hasPrevPage ? <PageLink sp={sp} page={results.page! - 1} label="←" /> : <span />}
            <span className="text-sm text-muted">
              {results.page} / {results.totalPages}
            </span>
            {results.hasNextPage ? <PageLink sp={sp} page={results.page! + 1} label="→" /> : <span />}
          </nav>
        )}
      </div>
    </>
  )
}

function PageLink({ sp, page, label }: { sp: Record<string, string | undefined>; page: number; label: string }) {
  const qs = new URLSearchParams(Object.entries({ ...sp, page: String(page) }).filter(([, v]) => v) as [string, string][])
  return (
    <a className="btn-secondary px-4 py-1.5" href={`/explore?${qs}`}>
      {label}
    </a>
  )
}
