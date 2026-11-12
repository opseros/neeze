import { SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'

import { Container, PageTitle, ProviderCard } from '@/components/ui'
import { VERTICALS } from '@/collections/Places'
import { getCategoriesCached, searchProvidersCached } from '@/lib/cache'
import { getContentLocale, getLocalities, getSelectedLocality } from '@/lib/server'

type SP = Promise<{ q?: string; category?: string; vertical?: string; locality?: string; page?: string }>

export async function generateMetadata({ searchParams }: { searchParams: SP }) {
  const t = await getTranslations()
  const sp = await searchParams
  const vertical = VERTICALS.includes(sp.vertical as never) ? sp.vertical : undefined
  return { title: vertical ? t(`verticals.${vertical}` as 'verticals.services') : t('explore.title') }
}

export default async function Explore({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const [t, locale, contentLocale] = await Promise.all([getTranslations(), getLocale(), getContentLocale()])
  const [localities, selected, categories] = await Promise.all([getLocalities(), getSelectedLocality(), getCategoriesCached(contentLocale)])
  const vertical = VERTICALS.includes(sp.vertical as never) ? sp.vertical : undefined
  const localityParam = sp.locality === 'all' ? undefined : Number(sp.locality) || selected?.id
  const q = sp.q?.trim().slice(0, 80) || undefined
  const page = Math.max(1, Number(sp.page) || 1)

  const results = await searchProvidersCached({ q, category: sp.category, vertical, locality: localityParam, page }, contentLocale)
  const shownCats = vertical ? categories.filter((c) => c.vertical === vertical) : categories
  const activeArea = localities.find((l) => l.id === results.localityId)
  const activeCat = categories.find((c) => c.slug === sp.category)
  const title = activeCat?.name ?? (vertical ? t(`verticals.${vertical}` as 'verticals.services') : q ? `“${q}”` : t('explore.title'))
  const hasFilters = Boolean(q || sp.category || sp.locality)
  const pageSize = 18
  const from = results.totalDocs ? (results.page - 1) * pageSize + 1 : 0
  const to = Math.min(results.page * pageSize, results.totalDocs)

  return (
    <>
      <PageTitle
        title={title}
        subtitle={vertical ? t(`verticalsDesc.${vertical}` as 'verticalsDesc.services') : undefined}
        back="/"
        crumbs={[{ href: '/', label: t('provider.breadcrumbHome') }, ...(activeCat || vertical || q ? [{ href: '/explore', label: t('explore.title') }] : [])]}
      />
      <Container className="grid gap-6 py-6 md:grid-cols-[260px_1fr] md:py-8 lg:gap-10">
        <aside className="md:sticky md:top-24 md:self-start">
          <form role="search" className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-white p-3 md:grid-cols-1 md:gap-4 md:p-4">
            <p className="hidden items-center gap-2 font-semibold md:flex">
              <SlidersHorizontal className="size-4" aria-hidden /> {t('explore.filters')}
            </p>
            {vertical && <input type="hidden" name="vertical" value={vertical} />}
            <label className="field col-span-2 md:col-span-1">
              <span className="sr-only">{t('home.search')}</span>
              <input name="q" type="search" defaultValue={q} placeholder={t('home.searchPlaceholder')} className="input" enterKeyHint="search" />
            </label>
            <label className="field">
              <span>{t('explore.filterCategory')}</span>
              <select name="category" defaultValue={sp.category ?? ''} className="input">
                <option value="">{t('explore.any')}</option>
                {shownCats.map((c) => (
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
            <button className="btn-primary col-span-2 md:col-span-1" type="submit">
              {t('explore.apply')}
            </button>
            {hasFilters && (
              <Link href={vertical ? `/explore?vertical=${vertical}&locality=all` : '/explore?locality=all'} className="col-span-2 text-center text-sm text-muted underline-offset-2 hover:underline md:col-span-1">
                {t('explore.clear')}
              </Link>
            )}
          </form>
        </aside>

        <section aria-live="polite">
          <p className="mb-4 text-sm text-muted">
            {results.totalDocs > 0 ? t('explore.showing', { from, to, total: results.totalDocs }) : t('explore.results', { count: 0 })}
            {activeArea && ` · ${t('explore.serves', { area: activeArea.name })}`}
          </p>
          {results.docs.length ? (
            <ul className="grid gap-4 sm:grid-cols-2">
              {results.docs.map((p) => (
                <ProviderCard key={p.id} p={p} locale={locale} />
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
              <p className="font-semibold">{t('explore.noResultsTitle')}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">{t('explore.noResultsBody')}</p>
            </div>
          )}

          {results.totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-between" aria-label="Pages">
              {results.page > 1 ? <PageLink sp={sp} page={results.page - 1} label="←" /> : <span />}
              <span className="text-sm text-muted">
                {results.page} / {results.totalPages}
              </span>
              {results.page < results.totalPages ? <PageLink sp={sp} page={results.page + 1} label="→" /> : <span />}
            </nav>
          )}
        </section>
      </Container>
    </>
  )
}

function PageLink({ sp, page, label }: { sp: Record<string, string | undefined>; page: number; label: string }) {
  const qs = new URLSearchParams(Object.entries({ ...sp, page: String(page) }).filter(([, v]) => v) as [string, string][])
  return (
    <Link className="btn-secondary px-4" href={`/explore?${qs}`}>
      {label}
    </Link>
  )
}
