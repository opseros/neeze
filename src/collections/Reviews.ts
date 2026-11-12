import type { Access, CollectionConfig, PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'

import { adminsOnly, hasRole, isAdmin, staffFieldOnly } from '../access/roles'
import { revalidate } from '../hooks/revalidate'
import { AUTO_HIDE_REPORTS, canReview, publicName, summarize } from '../lib/reviews'
import type { Provider, Request as Req, User } from '../payload-types'

const isMod = (u: unknown) => isAdmin(u as never) || hasRole(u as never, 'moderator')
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number))

/** Public sees published reviews; moderators see everything; a customer also sees their own hidden one. */
const readable: Access = ({ req }) => {
  if (isMod(req.user)) return true
  const published: Where = { status: { equals: 'published' } }
  if (!req.user) return published
  return { or: [published, { customer: { equals: req.user.id } }] }
}

async function ownsProvider(req: PayloadRequest, providerId: number) {
  if (!req.user) return false
  const p = (await req.payload.findByID({ collection: 'providers', id: providerId, depth: 0, overrideAccess: true }).catch(() => null)) as Provider | null
  return ((p?.owners ?? []) as unknown[]).map(idOf).includes(req.user.id as number)
}

/** Keep the provider's rating summary in step with its published reviews. */
async function refreshProviderRating(req: PayloadRequest, providerId: number) {
  const { docs } = await req.payload.find({
    collection: 'reviews',
    where: { and: [{ provider: { equals: providerId } }, { status: { equals: 'published' } }] },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
    req,
    select: { rating: true },
  })
  const s = summarize(docs.map((d) => d.rating as number))
  await req.payload.update({ collection: 'providers', id: providerId, overrideAccess: true, req, data: { ratingCount: s.count, ratingAvg: s.average } as never })
  revalidate('providers', 'reviews')
}

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: { group: 'Directory', useAsTitle: 'authorName', defaultColumns: ['provider', 'rating', 'status', 'reportCount', 'createdAt'] },
  access: {
    read: readable,
    create: ({ req }) => Boolean(req.user),
    // Moderators edit anything; provider owners may add one reply (checked in the hook).
    update: ({ req }) => Boolean(req.user),
    delete: adminsOnly,
  },
  defaultSort: '-createdAt',
  fields: [
    { name: 'request', type: 'relationship', relationTo: 'requests', required: true, unique: true, index: true, admin: { readOnly: true } },
    { name: 'provider', type: 'relationship', relationTo: 'providers', required: true, index: true, admin: { readOnly: true } },
    { name: 'customer', type: 'relationship', relationTo: 'users', index: true, admin: { readOnly: true }, access: { read: ({ req, doc }) => isMod(req.user) || idOf(doc?.customer) === req.user?.id } },
    { name: 'authorName', type: 'text', admin: { readOnly: true } },
    { name: 'rating', type: 'number', required: true, min: 1, max: 5 },
    { name: 'comment', type: 'textarea', maxLength: 500 },
    { name: 'reply', type: 'textarea', maxLength: 500, admin: { description: "The provider's public reply (one per review)." } },
    { name: 'repliedAt', type: 'date', admin: { readOnly: true } },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'published',
      index: true,
      options: ['published', 'hidden'],
      access: { create: staffFieldOnly, update: staffFieldOnly },
      admin: { position: 'sidebar', description: 'Hide reviews that break the content rules.' },
    },
    { name: 'reportCount', type: 'number', defaultValue: 0, admin: { position: 'sidebar', readOnly: true }, access: { read: staffFieldOnly, update: staffFieldOnly, create: staffFieldOnly } },
    {
      name: 'reporters',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      admin: { position: 'sidebar', readOnly: true },
      access: { read: staffFieldOnly, update: staffFieldOnly, create: staffFieldOnly },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc, context }) => {
        if (context?.system) return data // server-side updates (reports) skip the user rules
        if (operation === 'create') {
          if (!req.user) throw new APIError('Sign in to write a review.', 401)
          const request = (await req.payload.findByID({ collection: 'requests', id: idOf(data.request), depth: 0, overrideAccess: true }).catch(() => null)) as Req | null
          if (!request) throw new APIError('Request not found.', 404)
          const completedAt = (request.history ?? []).filter((h) => h.status === 'completed').at(-1)?.at
          const existing = await req.payload.count({ collection: 'reviews', where: { request: { equals: request.id } }, overrideAccess: true })
          const check = canReview({ isCustomer: idOf(request.customer) === req.user.id, status: request.status, completedAt, alreadyReviewed: existing.totalDocs > 0 })
          if (!check.ok) throw new APIError(check.reason, check.reason === 'not_yours' ? 403 : 400)
          const rating = Number(data.rating)
          if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new APIError('Choose 1 to 5 stars.', 400)
          return {
            request: request.id,
            provider: idOf(request.provider),
            customer: req.user.id,
            authorName: publicName((req.user as User).name),
            rating,
            comment: typeof data.comment === 'string' ? data.comment.trim().slice(0, 500) || undefined : undefined,
            status: 'published',
            reportCount: 0,
            reporters: [],
          }
        }

        // update
        if (isMod(req.user)) return data
        const prev = originalDoc as Record<string, unknown>
        if (!(await ownsProvider(req, idOf(prev.provider)))) throw new APIError('Not allowed.', 403)
        if (prev.reply) throw new APIError('You have already replied to this review.', 400)
        const reply = typeof data.reply === 'string' ? data.reply.trim().slice(0, 500) : ''
        if (!reply) throw new APIError('Write a reply.', 400)
        return { ...prev, reply, repliedAt: new Date().toISOString() }
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
        if (operation === 'create' || previousDoc?.status !== doc.status) await refreshProviderRating(req, idOf(doc.provider))
        else revalidate('reviews')
        if (operation === 'create') {
          const p = (await req.payload.findByID({ collection: 'providers', id: idOf(doc.provider), depth: 0, overrideAccess: true }).catch(() => null)) as Provider | null
          for (const o of (p?.owners ?? []) as unknown[]) {
            await req.payload
              .create({ collection: 'notifications', overrideAccess: true, req, data: { user: idOf(o), kind: 'new-review', data: { providerName: p?.name ?? '', rating: doc.rating, author: doc.authorName }, link: '/provider?tab=reviews' } })
              .catch(() => null)
          }
        }
        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        await refreshProviderRating(req, idOf(doc.provider))
        return doc
      },
    ],
  },
  endpoints: [
    {
      // POST /api/reviews/:id/report — anyone signed in; hidden automatically after several distinct reports.
      path: '/:id/report',
      method: 'post',
      handler: async (req) => {
        if (!req.user) return Response.json({ error: 'signin_required' }, { status: 401 })
        const id = Number(req.routeParams?.id)
        const review = await req.payload.findByID({ collection: 'reviews', id, depth: 0, overrideAccess: true }).catch(() => null)
        if (!review || review.status !== 'published') return Response.json({ error: 'not_found' }, { status: 404 })
        const reporters = ((review.reporters ?? []) as unknown[]).map(idOf)
        if (reporters.includes(req.user.id as number)) return Response.json({ ok: true, already: true })
        const count = reporters.length + 1
        await req.payload.update({
          collection: 'reviews',
          id,
          overrideAccess: true,
          req,
          context: { system: true },
          data: { reporters: [...reporters, req.user.id], reportCount: count, ...(count >= AUTO_HIDE_REPORTS ? { status: 'hidden' } : {}) } as never,
        })
        return Response.json({ ok: true })
      },
    },
  ],
}
