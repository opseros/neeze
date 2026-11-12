import type { Access, CollectionConfig, Field, FieldAccess, PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'

import { hasRole, isAdmin, isStaff, staffFieldOnly } from '../access/roles'
import { audit } from '../hooks/audit'
import { revalidate } from '../hooks/revalidate'
import {
  ALL_REPORT_REASONS,
  DEFAULT_POSTING_MODE,
  LIMITS,
  type PostingMode,
  REPORT_TARGETS,
  STATUS_HTTP,
  TOPICS,
  canEditPost,
  canInteract,
  cleanText,
  dayAgo,
  initialStatus,
  isReportReason,
} from '../lib/community'
import { publicName } from '../lib/reviews'
import type { User } from '../payload-types'

const isMod = (u: unknown) => isAdmin(u as never) || hasRole(u as never, 'moderator')
const isEditor = (u: unknown) => isAdmin(u as never) || hasRole(u as never, 'editor')
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number))
const modField = ({ req }: { req: PayloadRequest }) => isMod(req.user)
const nobody: Access = () => false

/* ---------- shared helpers ---------- */

export async function postingMode(req: PayloadRequest): Promise<PostingMode> {
  const s = (await req.payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true, req }).catch(() => null)) as { community?: { postingMode?: PostingMode } } | null
  return s?.community?.postingMode ?? DEFAULT_POSTING_MODE
}

export async function restrictionFor(req: PayloadRequest, userId: number) {
  const { docs } = await req.payload.find({ collection: 'community-restrictions', where: { user: { equals: userId } }, limit: 1, depth: 0, overrideAccess: true, req })
  return (docs[0] as { until?: string } | undefined)?.until ?? null
}

/** Throws the right HTTP error when this user may not post, comment, react or report. */
export async function assertCanInteract(req: PayloadRequest) {
  const user = req.user as User | null
  // Staff sign in with a password and may have no mobile number on file.
  const check = user && isStaff(user) && !user.suspended ? ({ ok: true } as const) : canInteract(user, user ? await restrictionFor(req, user.id) : null)
  if (!check.ok) throw new APIError(check.reason, STATUS_HTTP[check.reason])
  return user!
}

async function assertUnderLimit(req: PayloadRequest, collection: 'posts' | 'comments' | 'content-reports', field: string, max: number) {
  const { totalDocs } = await req.payload.count({
    collection,
    where: { and: [{ [field]: { equals: req.user!.id } }, { createdAt: { greater_than: dayAgo() } }] },
    overrideAccess: true,
    req,
  })
  if (totalDocs >= max) throw new APIError('too_many', 429)
}

async function notify(req: PayloadRequest, user: number, kind: string, data: Record<string, unknown>, link: string) {
  await req.payload.create({ collection: 'notifications', overrideAccess: true, req, data: { user, kind: kind as never, data, link } }).catch(() => null)
}

/**
 * Readers see published items; moderators see everything. Authors see their own pending posts
 * through the site's pages (server-side, ownership checked), because `author` is a private field
 * and can't be used in an access query.
 */
const publishedOrMod: Access = ({ req }) => (isMod(req.user) ? true : { status: { equals: 'published' } })

/** Authors may delete their own items; moderators any. Checked here because `author` is private. */
const deleteOwnOrMod =
  (collection: 'posts' | 'comments') =>
  async ({ req, id }: { req: PayloadRequest; id?: number | string }) => {
    if (isMod(req.user)) return
    const doc = await req.payload.findByID({ collection, id: id as number, depth: 0, overrideAccess: true, req }).catch(() => null)
    if (!doc || !req.user || idOf(doc.author) !== req.user.id) throw new APIError('Not allowed.', 403)
  }

const authorRead =
  (name: string): FieldAccess =>
  ({ req, doc }) =>
    isMod(req.user) || (Boolean(req.user) && idOf(doc?.[name]) === req.user?.id)

const authorField = (name = 'author'): Field => ({
    name,
    type: 'relationship',
    relationTo: 'users',
    index: true,
    admin: { readOnly: true },
    // Who wrote it stays private; the public sees the display name only.
    access: { read: authorRead(name) },
  })

const moderationFields: Field[] = [
  { name: 'reportCount', type: 'number', defaultValue: 0, index: true, admin: { position: 'sidebar', readOnly: true }, access: { read: modField, update: modField, create: modField } },
  { name: 'reporters', type: 'relationship', relationTo: 'users', hasMany: true, admin: { position: 'sidebar', readOnly: true }, access: { read: modField, update: modField, create: modField } },
  { name: 'moderationNote', type: 'text', admin: { position: 'sidebar', description: 'Why it was hidden or removed. Shown to the author.' }, access: { read: modField, update: modField, create: modField } },
]

/** Moderator status changes: audit, tell the author, close the reports about this item. */
async function afterModeration(req: PayloadRequest, target: 'post' | 'comment', doc: Record<string, unknown>, prev: Record<string, unknown> | undefined) {
  if (!prev || prev.status === doc.status || !isMod(req.user)) return
  await audit(req, `${target}.status`, `${target}s`, doc.id as number, { from: prev.status, to: doc.status, note: doc.moderationNote })
  const author = idOf(doc.author)
  const link = target === 'post' ? `/community/${doc.id}` : `/community/${idOf(doc.post)}`
  if (author && author !== req.user?.id) {
    if (prev.status === 'pending' && doc.status === 'published') await notify(req, author, 'post-approved', { target }, link)
    if (doc.status === 'hidden' || doc.status === 'removed') await notify(req, author, 'post-removed', { target, note: doc.moderationNote ?? '' }, link)
  }
  if (doc.status === 'hidden' || doc.status === 'removed') {
    const { docs } = await req.payload.find({ collection: 'content-reports', where: { and: [{ targetType: { equals: target } }, { targetId: { equals: doc.id } }, { status: { equals: 'open' } }] }, limit: 200, depth: 0, overrideAccess: true, req })
    for (const r of docs) {
      await req.payload.update({ collection: 'content-reports', id: r.id, overrideAccess: true, req, data: { status: 'resolved', resolution: `Content ${doc.status}`, resolvedBy: req.user?.id, resolvedAt: new Date().toISOString() } as never })
    }
  }
}

/* ---------- Posts ---------- */

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: { group: 'Community', useAsTitle: 'body', defaultColumns: ['body', 'authorName', 'topic', 'status', 'reportCount', 'createdAt'], listSearchableFields: ['body', 'authorName'] },
  access: {
    read: publishedOrMod,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user), // checked in beforeChange
    delete: ({ req }) => Boolean(req.user), // checked in beforeDelete
  },
  defaultSort: '-createdAt',
  fields: [
    authorField(),
    { name: 'authorName', type: 'text', admin: { readOnly: true } },
    { name: 'body', type: 'textarea', required: true, maxLength: LIMITS.postBody },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'topic', type: 'select', required: true, defaultValue: 'general', index: true, options: [...TOPICS] },
    { name: 'locality', type: 'relationship', relationTo: 'localities', index: true },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'published',
      index: true,
      options: ['pending', 'published', 'hidden', 'removed'],
      admin: { position: 'sidebar', description: 'pending = waiting for review · hidden = reported or held · removed = breaks the rules' },
    },
    { name: 'commentsLocked', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' }, access: { create: modField, update: modField } },
    { name: 'commentCount', type: 'number', defaultValue: 0, admin: { position: 'sidebar', readOnly: true } },
    { name: 'helpfulCount', type: 'number', defaultValue: 0, admin: { position: 'sidebar', readOnly: true } },
    { name: 'helpfulBy', type: 'relationship', relationTo: 'users', hasMany: true, admin: { readOnly: true, position: 'sidebar' }, access: { read: modField, update: modField, create: modField } },
    { name: 'editedAt', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
    ...moderationFields,
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc, context }) => {
        if (context?.system) return data
        if (operation === 'create') {
          const user = await assertCanInteract(req)
          const staff = isStaff(user)
          if (!staff) await assertUnderLimit(req, 'posts', 'author', LIMITS.postsPerDay)
          const body = cleanText(data.body, LIMITS.postBody)
          if (body.length < 3) throw new APIError('body_required', 400)
          if (data.image) await assertOwnImage(req, idOf(data.image))
          const { totalDocs } = await req.payload.count({ collection: 'posts', where: { and: [{ author: { equals: user.id } }, { status: { equals: 'published' } }] }, overrideAccess: true, req })
          return {
            author: user.id,
            authorName: publicName(user.name),
            body,
            image: data.image ? idOf(data.image) : undefined,
            topic: TOPICS.includes(data.topic) ? data.topic : 'general',
            locality: data.locality ? idOf(data.locality) : undefined,
            status: initialStatus({ mode: await postingMode(req), isStaff: staff, publishedBefore: totalDocs, text: body }),
            commentCount: 0,
            helpfulCount: 0,
            reportCount: 0,
          }
        }
        // update
        if (isMod(req.user)) return data
        const prev = originalDoc as Record<string, unknown>
        if (!req.user || idOf(prev.author) !== req.user.id) throw new APIError('Not allowed.', 403)
        if (!canEditPost(prev as never)) throw new APIError('edit_window_closed', 400)
        await assertCanInteract(req)
        const body = data.body === undefined ? (prev.body as string) : cleanText(data.body, LIMITS.postBody)
        if (body.length < 3) throw new APIError('body_required', 400)
        if (data.image && idOf(data.image) !== idOf(prev.image)) await assertOwnImage(req, idOf(data.image))
        // A post held for review stays held; an edit that adds links goes back to review.
        const status = prev.status === 'published' && initialStatus({ mode: 'open', isStaff: false, publishedBefore: 1, text: body }) === 'pending' ? 'pending' : prev.status
        return {
          ...prev,
          body,
          topic: data.topic && TOPICS.includes(data.topic) ? data.topic : prev.topic,
          locality: data.locality === undefined ? prev.locality : data.locality ? idOf(data.locality) : null,
          image: data.image === undefined ? prev.image : data.image ? idOf(data.image) : null,
          status,
          editedAt: new Date().toISOString(),
        }
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
        revalidate('community')
        if (operation === 'update') await afterModeration(req, 'post', doc, previousDoc)
        return doc
      },
    ],
    beforeDelete: [deleteOwnOrMod('posts')],
    afterDelete: [
      async ({ doc, req }) => {
        await req.payload.delete({ collection: 'comments', where: { post: { equals: doc.id } }, overrideAccess: true, req }).catch(() => null)
        if (isMod(req.user)) await audit(req, 'post.delete', 'posts', doc.id, { author: idOf(doc.author) })
        revalidate('community')
        return doc
      },
    ],
  },
  endpoints: [
    {
      // POST /api/posts/:id/helpful — toggle "helpful" for the signed-in user.
      path: '/:id/helpful',
      method: 'post',
      handler: async (req) => {
        try {
          await assertCanInteract(req)
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: (e as APIError).status ?? 403 })
        }
        const id = Number(req.routeParams?.id)
        const post = await req.payload.findByID({ collection: 'posts', id, depth: 0, overrideAccess: true }).catch(() => null)
        if (!post || post.status !== 'published') return Response.json({ error: 'not_found' }, { status: 404 })
        const by = ((post.helpfulBy ?? []) as unknown[]).map(idOf)
        const me = req.user!.id as number
        const on = !by.includes(me)
        const next = on ? [...by, me] : by.filter((u) => u !== me)
        await req.payload.update({ collection: 'posts', id, overrideAccess: true, req, context: { system: true }, data: { helpfulBy: next, helpfulCount: next.length } as never })
        return Response.json({ helpful: on, count: next.length })
      },
    },
  ],
}

async function assertOwnImage(req: PayloadRequest, mediaId: number) {
  const m = (await req.payload.findByID({ collection: 'media', id: mediaId, depth: 0, overrideAccess: true, req }).catch(() => null)) as { uploadedBy?: unknown } | null
  if (!m) throw new APIError('image_not_found', 400)
  if (!isStaff(req.user) && idOf(m.uploadedBy) !== req.user?.id) throw new APIError('Not allowed.', 403)
}

/* ---------- Comments ---------- */

async function refreshCommentCount(req: PayloadRequest, postId: number) {
  const { totalDocs } = await req.payload.count({ collection: 'comments', where: { and: [{ post: { equals: postId } }, { status: { equals: 'published' } }] }, overrideAccess: true, req })
  await req.payload.update({ collection: 'posts', id: postId, overrideAccess: true, req, context: { system: true }, data: { commentCount: totalDocs } as never }).catch(() => null)
}

export const Comments: CollectionConfig = {
  slug: 'comments',
  admin: { group: 'Community', useAsTitle: 'body', defaultColumns: ['body', 'authorName', 'post', 'status', 'reportCount', 'createdAt'] },
  access: {
    read: publishedOrMod,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => isMod(req.user),
    delete: ({ req }) => Boolean(req.user), // checked in beforeDelete
  },
  defaultSort: 'createdAt',
  fields: [
    { name: 'post', type: 'relationship', relationTo: 'posts', required: true, index: true, admin: { readOnly: true } },
    authorField(),
    { name: 'authorName', type: 'text', admin: { readOnly: true } },
    { name: 'body', type: 'textarea', required: true, maxLength: LIMITS.commentBody },
    { name: 'status', type: 'select', defaultValue: 'published', index: true, options: ['pending', 'published', 'hidden', 'removed'], admin: { position: 'sidebar' } },
    ...moderationFields,
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        if (operation !== 'create' || isMod(req.user)) return data
        const user = await assertCanInteract(req)
        if (!isStaff(user)) await assertUnderLimit(req, 'comments', 'author', LIMITS.commentsPerDay)
        const post = await req.payload.findByID({ collection: 'posts', id: idOf(data.post), depth: 0, overrideAccess: true, req }).catch(() => null)
        if (!post || post.status !== 'published') throw new APIError('not_found', 404)
        if (post.commentsLocked) throw new APIError('comments_locked', 400)
        const body = cleanText(data.body, LIMITS.commentBody)
        if (!body) throw new APIError('body_required', 400)
        return {
          post: post.id,
          author: user.id,
          authorName: publicName(user.name),
          body,
          status: initialStatus({ mode: 'open', isStaff: isStaff(user), publishedBefore: 1, text: body, kind: 'comment' }),
          reportCount: 0,
        }
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
        const postId = idOf(doc.post)
        if (operation === 'create' || previousDoc?.status !== doc.status) await refreshCommentCount(req, postId)
        revalidate('community')
        if (operation === 'create' && doc.status === 'published') {
          const post = await req.payload.findByID({ collection: 'posts', id: postId, depth: 0, overrideAccess: true, req }).catch(() => null)
          const author = idOf(post?.author)
          if (author && author !== idOf(doc.author)) await notify(req, author, 'new-comment', { author: doc.authorName }, `/community/${postId}#comments`)
        }
        if (operation === 'update') await afterModeration(req, 'comment', doc, previousDoc)
        return doc
      },
    ],
    beforeDelete: [deleteOwnOrMod('comments')],
    afterDelete: [
      async ({ doc, req }) => {
        await refreshCommentCount(req, idOf(doc.post))
        if (isMod(req.user)) await audit(req, 'comment.delete', 'comments', doc.id, { author: idOf(doc.author) })
        revalidate('community')
        return doc
      },
    ],
  },
}

/* ---------- Reports: one queue for posts, comments, news corrections and wrong listing details ---------- */

const reportReaders: Access = ({ req }) => {
  if (isAdmin(req.user)) return true
  const or: Where[] = []
  if (hasRole(req.user, 'moderator')) or.push({ targetType: { in: ['post', 'comment', 'provider'] } })
  if (hasRole(req.user, 'editor')) or.push({ targetType: { in: ['news', 'provider'] } })
  if (req.user) or.push({ reporter: { equals: req.user.id } })
  return or.length ? { or } : false
}

const COUNTED = { post: 'posts', comment: 'comments' } as const

export const ContentReports: CollectionConfig = {
  slug: 'content-reports',
  labels: { singular: 'Report', plural: 'Reports & corrections' },
  admin: { group: 'Community', useAsTitle: 'reason', defaultColumns: ['targetType', 'targetId', 'reason', 'status', 'createdAt'], description: 'Reports on community posts and comments, news corrections and wrong listing details. Resolve or dismiss each one; the reporter is told.' },
  access: {
    read: reportReaders,
    create: nobody, // POST /api/content-reports/submit
    update: ({ req }) => isMod(req.user) || isEditor(req.user),
    delete: ({ req }) => isAdmin(req.user),
  },
  defaultSort: '-createdAt',
  fields: [
    { name: 'targetType', type: 'select', required: true, index: true, options: [...REPORT_TARGETS], admin: { readOnly: true } },
    { name: 'targetId', type: 'number', required: true, index: true, admin: { readOnly: true } },
    { name: 'link', type: 'text', admin: { readOnly: true, description: 'Open the reported item.' } },
    { name: 'excerpt', type: 'text', admin: { readOnly: true } },
    { name: 'reporter', type: 'relationship', relationTo: 'users', index: true, admin: { readOnly: true } },
    { name: 'reason', type: 'select', required: true, options: ALL_REPORT_REASONS, admin: { readOnly: true } },
    { name: 'note', type: 'textarea', maxLength: LIMITS.reportNote, admin: { readOnly: true } },
    { name: 'status', type: 'select', defaultValue: 'open', index: true, options: ['open', 'resolved', 'dismissed'], admin: { position: 'sidebar' } },
    { name: 'resolution', type: 'textarea', admin: { position: 'sidebar', description: 'What was done. The reporter sees this.' } },
    { name: 'resolvedBy', type: 'relationship', relationTo: 'users', admin: { position: 'sidebar', readOnly: true }, access: { read: staffFieldOnly } },
    { name: 'resolvedAt', type: 'date', admin: { position: 'sidebar', readOnly: true } },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation, req }) => {
        if (operation !== 'update' || !req.user) return data
        // Staff may only change the outcome; what was reported stays as submitted.
        const prev = originalDoc as Record<string, unknown>
        const closing = data.status !== 'open' && prev.status === 'open'
        return { ...prev, status: data.status, resolution: data.resolution, resolvedBy: closing ? req.user.id : prev.resolvedBy, resolvedAt: closing ? new Date().toISOString() : prev.resolvedAt }
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
        if (operation !== 'update' || previousDoc?.status !== 'open' || doc.status === 'open') return doc
        await audit(req, 'report.' + doc.status, 'content-reports', doc.id, { targetType: doc.targetType, targetId: doc.targetId, resolution: doc.resolution })
        const reporter = idOf(doc.reporter)
        if (reporter) await notify(req, reporter, 'report-outcome', { outcome: doc.status, targetType: doc.targetType, resolution: doc.resolution ?? '' }, doc.link || '/notifications')
        return doc
      },
    ],
  },
  endpoints: [
    {
      // POST /api/content-reports/submit {targetType, targetId, reason, note?}
      path: '/submit',
      method: 'post',
      handler: async (req) => {
        try {
          await assertCanInteract(req)
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: (e as APIError).status ?? 403 })
        }
        const body = (await req.json?.().catch(() => null)) as { targetType?: string; targetId?: number; reason?: string; note?: string } | null
        const type = body?.targetType as (typeof REPORT_TARGETS)[number]
        const id = Number(body?.targetId)
        if (!REPORT_TARGETS.includes(type) || !Number.isInteger(id) || !isReportReason(type, String(body?.reason))) return Response.json({ error: 'invalid' }, { status: 400 })
        const me = req.user!.id as number

        const target = await loadTarget(req, type, id)
        if (!target) return Response.json({ error: 'not_found' }, { status: 404 })

        const dup = await req.payload.count({ collection: 'content-reports', where: { and: [{ targetType: { equals: type } }, { targetId: { equals: id } }, { reporter: { equals: me } }, { status: { equals: 'open' } }] }, overrideAccess: true })
        if (dup.totalDocs) return Response.json({ ok: true, already: true })
        try {
          if (!isStaff(req.user)) await assertUnderLimit(req, 'content-reports', 'reporter', LIMITS.reportsPerDay)
        } catch {
          return Response.json({ error: 'too_many' }, { status: 429 })
        }

        await req.payload.create({
          collection: 'content-reports',
          overrideAccess: true,
          data: { targetType: type, targetId: id, link: target.link, excerpt: target.excerpt.slice(0, 140), reporter: me, reason: body!.reason as never, note: cleanText(body?.note, LIMITS.reportNote) || undefined, status: 'open' },
        })

        // Posts and comments hide themselves after several different people report them.
        if (type === 'post' || type === 'comment') {
          const doc = target.doc as { reporters?: unknown[]; status?: string }
          const reporters = (doc.reporters ?? []).map(idOf)
          if (!reporters.includes(me)) {
            const count = reporters.length + 1
            await req.payload.update({
              collection: COUNTED[type],
              id,
              overrideAccess: true,
              context: { system: true },
              data: { reporters: [...reporters, me], reportCount: count, ...(count >= LIMITS.autoHideReports && doc.status === 'published' ? { status: 'hidden' } : {}) } as never,
            })
            if (count >= LIMITS.autoHideReports && type === 'comment') await refreshCommentCount(req, idOf((target.doc as { post: unknown }).post))
            revalidate('community')
          }
        }
        return Response.json({ ok: true })
      },
    },
  ],
}

async function loadTarget(req: PayloadRequest, type: string, id: number): Promise<{ doc: unknown; link: string; excerpt: string } | null> {
  type Doc = Record<string, unknown> & { status?: string; body?: string; post?: unknown; name?: string }
  const find = (collection: 'posts' | 'comments' | 'news' | 'providers') => req.payload.findByID({ collection, id, depth: 0, overrideAccess: true }).catch(() => null) as Promise<Doc | null>
  if (type === 'post') {
    const d = await find('posts')
    return d && d.status === 'published' ? { doc: d, link: `/community/${id}`, excerpt: String(d.body) } : null
  }
  if (type === 'comment') {
    const d = await find('comments')
    return d && d.status === 'published' ? { doc: d, link: `/community/${idOf(d.post)}#c${id}`, excerpt: String(d.body) } : null
  }
  if (type === 'news') {
    const d = await find('news')
    return d && (d as { _status?: string })._status !== 'draft' ? { doc: d, link: `/news/${(d as { slug?: string }).slug}`, excerpt: String((d as { title?: string }).title ?? '') } : null
  }
  const d = await find('providers')
  return d && d.status === 'published' ? { doc: d, link: `/p/${id}`, excerpt: String(d.name) } : null
}

/* ---------- Moderator restrictions (no posting/commenting until a date) ---------- */

export const CommunityRestrictions: CollectionConfig = {
  slug: 'community-restrictions',
  labels: { singular: 'Restriction', plural: 'Restricted accounts' },
  admin: { group: 'Community', useAsTitle: 'reason', defaultColumns: ['user', 'until', 'reason', 'updatedAt'], description: 'Stop someone posting, commenting and reporting until a date. For serious cases suspend the account in People → Users (admins).' },
  access: {
    read: ({ req }) => isMod(req.user),
    create: ({ req }) => isMod(req.user),
    update: ({ req }) => isMod(req.user),
    delete: ({ req }) => isMod(req.user),
  },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, unique: true, index: true },
    { name: 'until', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'reason', type: 'text', required: true },
    { name: 'by', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
  ],
  hooks: {
    beforeChange: [({ data, req }) => ({ ...data, by: req.user?.id })],
    afterChange: [
      async ({ doc, req, operation }) => {
        await audit(req, `restriction.${operation}`, 'community-restrictions', doc.id, { user: idOf(doc.user), until: doc.until, reason: doc.reason })
        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        await audit(req, 'restriction.delete', 'community-restrictions', doc.id, { user: idOf(doc.user) })
        return doc
      },
    ],
  },
}
