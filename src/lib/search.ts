import type { Where } from 'payload'

import type { Provider } from '@/payload-types'
import { normalizeForSearch } from './text'
import { getContentLocale, getPayloadClient } from './server'

export type SearchParams = {
  q?: string
  category?: string // slug
  vertical?: string
  locality?: number
  page?: number
}

const PAGE_SIZE = 20

/**
 * P0 search: normalised text match on names, Bengali names, category names/keywords and services,
 * plus locality-alias matching ("taraapur" → Tarapur). Swap for pg_trgm ranking when volume grows.
 */
export async function searchProviders(params: SearchParams) {
  const payload = await getPayloadClient()
  const locale = await getContentLocale()
  const and: Where[] = [{ status: { equals: 'published' } }]

  let localityFromQuery: number | undefined
  const q = normalizeForSearch(params.q).slice(0, 80)
  if (q) {
    // Any word (or the whole query) that names a locality becomes an area filter: "taraapur electrician".
    const words = q.split(' ').slice(0, 6)
    const areaMatch = await payload.find({
      collection: 'localities',
      where: { or: [{ searchText: { like: q } }, ...words.filter((w) => w.length > 2).map((w) => ({ searchText: { like: w } }))] },
      limit: 5,
      depth: 0,
    })
    let rest = words
    for (const area of areaMatch.docs) {
      const areaWords = new Set(normalizeForSearch(area.searchText).split(' '))
      const remaining = words.filter((w) => !areaWords.has(w))
      if (remaining.length < words.length) {
        localityFromQuery = area.id
        rest = remaining
        break
      }
    }
    if (rest.length) and.push({ searchText: { like: rest.join(' ') } })
  }

  const localityId = params.locality ?? localityFromQuery
  if (localityId) {
    and.push({ or: [{ serviceLocalities: { contains: localityId } }, { baseLocality: { equals: localityId } }] })
  }
  if (params.category) and.push({ 'categories.slug': { equals: params.category } })
  if (params.vertical) and.push({ 'categories.vertical': { equals: params.vertical } })

  const result = await payload.find({
    collection: 'providers',
    where: { and },
    sort: 'name',
    limit: PAGE_SIZE,
    page: Math.max(1, params.page ?? 1),
    depth: 1,
    locale,
  })
  return { ...result, docs: result.docs as Provider[], localityId }
}
