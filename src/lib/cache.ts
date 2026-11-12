import 'server-only'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Where } from 'payload'

import type { Category, Comment, Locality, Media, News, Post, Provider, Review, SiteSetting } from '@/payload-types'
import { normalizeForSearch } from './text'

/**
 * Cached reads for everything public. On Vercel each database query is a round trip to Neon,
 * so pages read from Next's data cache instead and only hit the database when something changed.
 * Payload hooks call `revalidateTag` (see hooks/revalidate.ts) the moment an admin edits data.
 */
export const TAGS = {
  providers: 'providers',
  categories: 'categories',
  localities: 'localities',
  news: 'news',
  settings: 'settings',
  reviews: 'reviews',
  community: 'community',
} as const

import type { Locale } from '@/i18n/locales'
const HOUR = 3600
const payload = () => getPayload({ config })

export const getLocalitiesCached = unstable_cache(
  async (locale: Locale): Promise<Locality[]> =>
    (await (await payload()).find({ collection: 'localities', where: { active: { equals: true } }, sort: 'sortOrder', limit: 300, depth: 0, locale })).docs,
  ['localities-v1'],
  { tags: [TAGS.localities], revalidate: 24 * HOUR },
)

export const getCategoriesCached = unstable_cache(
  async (locale: Locale): Promise<Category[]> =>
    (await (await payload()).find({ collection: 'categories', where: { active: { equals: true } }, sort: 'sortOrder', limit: 300, depth: 0, locale })).docs,
  ['categories-v1'],
  { tags: [TAGS.categories], revalidate: 24 * HOUR },
)

/** True when at least one category in a P1 vertical has been switched on. */
export const getActiveVerticals = unstable_cache(
  async (): Promise<string[]> => {
    const { docs } = await (await payload()).find({ collection: 'categories', where: { active: { equals: true } }, limit: 300, depth: 0, select: { vertical: true } })
    return [...new Set(docs.map((d) => d.vertical))]
  },
  ['active-verticals-v1'],
  { tags: [TAGS.categories], revalidate: 24 * HOUR },
)

export const getSettingsCached = unstable_cache(
  async (locale: Locale): Promise<SiteSetting> => (await payload()).findGlobal({ slug: 'site-settings', locale, depth: 0 }),
  ['settings-v1'],
  { tags: [TAGS.settings], revalidate: 24 * HOUR },
)

export const getProviderCached = unstable_cache(
  async (id: number, locale: Locale): Promise<Provider | null> => {
    const { docs } = await (await payload()).find({
      collection: 'providers',
      where: { and: [{ id: { equals: id } }, { status: { equals: 'published' } }] },
      depth: 1,
      limit: 1,
      locale,
    })
    return (docs[0] as Provider) ?? null
  },
  ['provider-v1'],
  { tags: [TAGS.providers], revalidate: HOUR },
)

export const getFeaturedProvidersCached = unstable_cache(
  async (locale: Locale, limit: number): Promise<Provider[]> => {
    const { docs } = await (await payload()).find({
      collection: 'providers',
      where: { status: { equals: 'published' } },
      sort: '-lastConfirmedAt',
      limit,
      depth: 1,
      locale,
    })
    return docs as Provider[]
  },
  ['featured-providers-v1'],
  { tags: [TAGS.providers], revalidate: HOUR },
)

export const getNewsListCached = unstable_cache(
  async (locale: Locale, limit: number): Promise<News[]> => {
    const { docs } = await (await payload()).find({
      collection: 'news',
      where: { _status: { equals: 'published' } },
      sort: '-publishedAt',
      limit,
      depth: 1,
      locale,
      draft: false,
    })
    return docs as News[]
  },
  ['news-list-v1'],
  { tags: [TAGS.news], revalidate: HOUR },
)

export const getNewsBySlugCached = unstable_cache(
  async (slug: string, locale: Locale): Promise<News | null> => {
    const { docs } = await (await payload()).find({
      collection: 'news',
      where: { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] },
      limit: 1,
      depth: 1,
      locale,
      draft: false,
    })
    return (docs[0] as News) ?? null
  },
  ['news-slug-v1'],
  { tags: [TAGS.news], revalidate: HOUR },
)

export type SearchInput = { q?: string; category?: string; vertical?: string; locality?: number; page?: number }
export type SearchResult = {
  docs: Provider[]
  totalDocs: number
  totalPages: number
  page: number
  localityId?: number
}

const PAGE_SIZE = 18

/**
 * P0 search: normalised text match on names, Bengali names, category names/keywords and services,
 * plus locality-alias matching ("taraapur electrician" → electricians serving Tarapur).
 * Category and locality lookups use the cached lists, so a search costs one query on a cache miss.
 */
export const searchProvidersCached = unstable_cache(
  async (input: SearchInput, locale: Locale): Promise<SearchResult> => {
    const and: Where[] = [{ status: { equals: 'published' } }]
    let localityFromQuery: number | undefined

    const q = normalizeForSearch(input.q).slice(0, 80)
    if (q) {
      const words = q.split(' ').slice(0, 6)
      let rest = words
      for (const area of await getLocalitiesCached(locale)) {
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

    const localityId = input.locality ?? localityFromQuery
    if (localityId) and.push({ or: [{ serviceLocalities: { contains: localityId } }, { baseLocality: { equals: localityId } }] })

    if (input.category || input.vertical) {
      const cats = (await getCategoriesCached(locale)).filter((c) => (input.category ? c.slug === input.category : c.vertical === input.vertical))
      if (!cats.length) return { docs: [], totalDocs: 0, totalPages: 0, page: 1, localityId }
      and.push({ categories: { in: cats.map((c) => c.id) } })
    }

    const r = await (await payload()).find({
      collection: 'providers',
      where: { and },
      sort: 'name',
      limit: PAGE_SIZE,
      page: Math.max(1, input.page ?? 1),
      depth: 1,
      locale,
    })
    return { docs: r.docs as Provider[], totalDocs: r.totalDocs, totalPages: r.totalPages, page: r.page ?? 1, localityId }
  },
  ['search-v1'],
  { tags: [TAGS.providers, TAGS.categories, TAGS.localities], revalidate: 10 * 60 },
)

/** Real counts for the home page. Never shown as a made-up number. */
export const getSiteStatsCached = unstable_cache(
  async (): Promise<{ providers: number; categories: number; localities: number }> => {
    const p = await payload()
    const [providers, categories, localities] = await Promise.all([
      p.count({ collection: 'providers', where: { status: { equals: 'published' } } }),
      p.count({ collection: 'categories', where: { active: { equals: true } } }),
      p.count({ collection: 'localities', where: { active: { equals: true } } }),
    ])
    return { providers: providers.totalDocs, categories: categories.totalDocs, localities: localities.totalDocs }
  },
  ['site-stats-v1'],
  { tags: [TAGS.providers, TAGS.categories, TAGS.localities], revalidate: HOUR },
)

export const getProviderReviewsCached = unstable_cache(
  async (providerId: number, limit: number): Promise<Review[]> => {
    const { docs } = await (await payload()).find({
      collection: 'reviews',
      where: { and: [{ provider: { equals: providerId } }, { status: { equals: 'published' } }] },
      sort: '-createdAt',
      limit,
      depth: 0,
      overrideAccess: false,
    })
    return docs as Review[]
  },
  ['provider-reviews-v1'],
  { tags: [TAGS.reviews], revalidate: HOUR },
)

/* ---------- Community ---------- */

/** What pages need from a post. `authorId` never leaves the server: it is used to filter blocks and spot "mine". */
export type PostView = {
  id: number
  authorId: number | null
  authorName: string
  body: string
  topic: string
  localityId: number | null
  localityName: string | null
  image: { url: string; card: string } | null
  commentCount: number
  helpfulCount: number
  helpfulBy: number[]
  status: string
  commentsLocked: boolean
  createdAt: string
  editedAt: string | null
}
export type CommentView = { id: number; authorId: number | null; authorName: string; body: string; status: string; createdAt: string }

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : ((v as number) ?? null))

export function toPostView(p: Post): PostView {
  const img = typeof p.image === 'object' && p.image ? (p.image as Media) : null
  const loc = typeof p.locality === 'object' && p.locality ? (p.locality as Locality) : null
  return {
    id: p.id,
    authorId: idOf(p.author),
    authorName: p.authorName ?? '',
    body: p.body,
    topic: p.topic,
    localityId: idOf(p.locality),
    localityName: loc?.name ?? null,
    image: img?.url ? { url: img.url, card: img.sizes?.card?.url ?? img.url } : null,
    commentCount: p.commentCount ?? 0,
    helpfulCount: p.helpfulCount ?? 0,
    helpfulBy: ((p.helpfulBy ?? []) as unknown[]).map(idOf).filter(Boolean) as number[],
    status: p.status ?? 'published',
    commentsLocked: Boolean(p.commentsLocked),
    createdAt: p.createdAt,
    editedAt: p.editedAt ?? null,
  }
}

export const toCommentView = (c: Comment): CommentView => ({ id: c.id, authorId: idOf(c.author), authorName: c.authorName ?? '', body: c.body, status: c.status ?? 'published', createdAt: c.createdAt })

export type FeedInput = { topic?: string; locality?: number; page?: number }

export const getCommunityFeedCached = unstable_cache(
  async (input: FeedInput, locale: Locale): Promise<{ docs: PostView[]; totalPages: number; page: number }> => {
    const and: Where[] = [{ status: { equals: 'published' } }]
    if (input.topic) and.push({ topic: { equals: input.topic } })
    if (input.locality) and.push({ locality: { equals: input.locality } })
    const r = await (await payload()).find({ collection: 'posts', where: { and }, sort: '-createdAt', limit: 20, page: input.page ?? 1, depth: 1, locale })
    return { docs: (r.docs as Post[]).map(toPostView), totalPages: r.totalPages, page: r.page ?? 1 }
  },
  ['community-feed-v1'],
  { tags: [TAGS.community, TAGS.localities], revalidate: HOUR },
)

export const getPostCached = unstable_cache(
  async (id: number, locale: Locale): Promise<PostView | null> => {
    const p = await (await payload()).findByID({ collection: 'posts', id, depth: 1, locale }).catch(() => null)
    return p && p.status === 'published' ? toPostView(p as Post) : null
  },
  ['community-post-v1'],
  { tags: [TAGS.community], revalidate: HOUR },
)

export const getCommentsCached = unstable_cache(
  async (postId: number): Promise<CommentView[]> => {
    const { docs } = await (await payload()).find({ collection: 'comments', where: { and: [{ post: { equals: postId } }, { status: { equals: 'published' } }] }, sort: 'createdAt', limit: 300, depth: 0 })
    return (docs as Comment[]).map(toCommentView)
  },
  ['community-comments-v1'],
  { tags: [TAGS.community], revalidate: HOUR },
)
