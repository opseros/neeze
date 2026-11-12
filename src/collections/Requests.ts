import { randomBytes } from 'crypto'
import type { Access, CollectionConfig, PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'

import { hasRole, isAdmin, isStaff, superAdminsOnly } from '../access/roles'
import { audit } from '../hooks/audit'
import { notifyNewRequest, notifyStatusChange } from '../lib/notify'
import { REQUEST_STATUSES, type Actor, type RequestStatus, canTransition, needsReason } from '../lib/requestStatus'
import { normalizeIndianMobile } from '../lib/text'
import { requestKindFor } from '../lib/kinds'

const MAX_REQUESTS_PER_DAY = 10

const isOps = (user: Parameters<typeof isStaff>[0]) => isAdmin(user) || hasRole(user, 'moderator')

/** Customer sees own; provider owners see requests routed to their listing; ops staff see all. */
const partiesOnly: Access = ({ req }) => {
  if (isOps(req.user)) return true
  if (!req.user) return false
  const where: Where = {
    or: [{ customer: { equals: req.user.id } }, { 'provider.owners': { contains: req.user.id } }],
  }
  return where
}

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number))

async function actorFor(req: PayloadRequest, doc: Record<string, unknown>): Promise<Actor | null> {
  if (!req.user) return 'system'
  if (isOps(req.user)) return 'staff'
  if (idOf(doc.customer) === req.user.id) return 'customer'
  const provider = await req.payload.findByID({ collection: 'providers', id: idOf(doc.provider), depth: 0, overrideAccess: true }).catch(() => null)
  const owners = ((provider?.owners as unknown[]) ?? []).map(idOf)
  return owners.includes(req.user.id as number) ? 'provider' : null
}

const requestCode = () => `NZ-${randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}`

export const Requests: CollectionConfig = {
  slug: 'requests',
  labels: { singular: 'Request', plural: 'Requests' },
  admin: {
    useAsTitle: 'code',
    group: 'Operations',
    defaultColumns: ['code', 'kind', 'status', 'provider', 'locality', 'createdAt'],
  },
  access: {
    read: partiesOnly,
    create: ({ req }) => Boolean(req.user),
    update: partiesOnly,
    delete: superAdminsOnly,
  },
  fields: [
    { name: 'code', type: 'text', unique: true, index: true, admin: { readOnly: true } },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'service',
      options: [
        { label: 'Service request', value: 'service' },
        { label: 'Appointment request', value: 'appointment' },
        { label: 'Enquiry', value: 'enquiry' },
      ],
    },
    { name: 'provider', type: 'relationship', relationTo: 'providers', required: true, index: true },
    { name: 'category', type: 'relationship', relationTo: 'categories' },
    { name: 'customer', type: 'relationship', relationTo: 'users', index: true, admin: { readOnly: true } },
    { name: 'contactName', type: 'text', required: true, maxLength: 80 },
    { name: 'contactPhone', type: 'text', required: true },
    { name: 'locality', type: 'relationship', relationTo: 'localities', required: true },
    { name: 'address', type: 'textarea', maxLength: 300, admin: { description: 'Shown only to the chosen provider and support staff.' } },
    { name: 'description', type: 'textarea', required: true, minLength: 5, maxLength: 1000 },
    { name: 'preferredDate', type: 'date', admin: { date: { pickerAppearance: 'dayOnly' } } },
    { name: 'preferredWindow', type: 'select', options: ['morning', 'afternoon', 'evening', 'any'], defaultValue: 'any' },
    { name: 'urgency', type: 'select', options: ['normal', 'urgent'], defaultValue: 'normal' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'submitted',
      index: true,
      options: REQUEST_STATUSES.map((s) => ({ label: s, value: s })),
    },
    { name: 'statusReason', type: 'text', maxLength: 200 },
    { name: 'quoteNote', type: 'textarea', maxLength: 500 },
    {
      name: 'history',
      type: 'array',
      admin: { readOnly: true },
      fields: [
        { name: 'status', type: 'text' },
        { name: 'at', type: 'date' },
        { name: 'by', type: 'text' },
        { name: 'note', type: 'text' },
      ],
    },
    { name: 'idempotencyKey', type: 'text', unique: true, index: true, admin: { hidden: true } },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        const now = new Date().toISOString()

        if (operation === 'create') {
          if (!req.user) throw new APIError('Sign in to send a request.', 401)
          // Every account needs a mobile number before sending a request: the provider calls it.
          if (!isOps(req.user) && !(req.user as { phone?: string | null }).phone) {
            throw new APIError('phone_required', 428)
          }
          const phone = normalizeIndianMobile(String(data.contactPhone ?? ''))
          if (!phone) throw new APIError('Enter a valid 10-digit mobile number.', 400)
          const provider = await req.payload.findByID({ collection: 'providers', id: idOf(data.provider), depth: 0, overrideAccess: true }).catch(() => null)
          if (!provider || provider.status !== 'published' || provider.acceptsRequests === false) {
            throw new APIError('This provider is not accepting requests right now.', 400)
          }
          if (!isOps(req.user)) {
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            const { totalDocs } = await req.payload.count({
              collection: 'requests',
              where: { and: [{ customer: { equals: req.user.id } }, { createdAt: { greater_than: since } }] },
              overrideAccess: true,
            })
            if (totalDocs >= MAX_REQUESTS_PER_DAY) throw new APIError('Daily request limit reached. Please try tomorrow.', 429)
          }
          return {
            ...data,
            kind: requestKindFor(provider.type), // decided by the listing, not the browser
            contactPhone: phone,
            customer: req.user.id,
            code: requestCode(),
            status: 'submitted',
            quoteNote: undefined,
            history: [{ status: 'submitted', at: now, by: 'customer' }],
          }
        }

        // ----- update -----
        const prev = originalDoc as Record<string, unknown>
        const actor = await actorFor(req, prev)
        if (!actor) throw new APIError('Not allowed.', 403)

        const from = prev.status as RequestStatus
        const to = (data.status ?? from) as RequestStatus
        if (!canTransition(actor, from, to)) {
          throw new APIError(`A ${actor} cannot move a request from ${from} to ${to}.`, 403)
        }
        if (to !== from && needsReason(to) && !data.statusReason) {
          throw new APIError('Please give a reason.', 400)
        }

        // Each party may only change its own fields; everything else is restored.
        const editable: Record<Actor, string[]> = {
          customer: ['status', 'statusReason'],
          provider: ['status', 'statusReason', 'quoteNote'],
          staff: Object.keys(data),
          system: ['status'],
        }
        const next: Record<string, unknown> = { ...prev }
        for (const k of editable[actor]) if (k in data) next[k] = data[k]
        next.customer = prev.customer
        next.code = prev.code
        next.idempotencyKey = prev.idempotencyKey

        if (to !== from) {
          next.history = [
            ...((prev.history as unknown[]) ?? []),
            { status: to, at: now, by: actor, note: (data.statusReason as string) ?? undefined },
          ]
        } else {
          next.history = prev.history
        }
        return next
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
        if (operation === 'create') {
          await notifyNewRequest(req, doc)
          return doc
        }
        if (previousDoc?.status !== doc.status) {
          if (isOps(req.user)) await audit(req, 'request.staff-status-change', 'requests', doc.id, { from: previousDoc?.status, to: doc.status })
          const last = (doc.history ?? []).at(-1) as { by?: string } | undefined
          const actor = (last?.by ?? (isOps(req.user) ? 'staff' : 'system')) as 'customer' | 'provider' | 'staff' | 'system'
          await notifyStatusChange(req, doc, previousDoc?.status ?? '', actor)
        }
        return doc
      },
    ],
  },
  endpoints: [
    {
      // Idempotent submit used by the PWA's offline queue: a retried request never creates a duplicate.
      path: '/submit',
      method: 'post',
      handler: async (req) => {
        if (!req.user) return Response.json({ error: 'signin_required' }, { status: 401 })
        if (!isOps(req.user) && !(req.user as { phone?: string | null }).phone) {
          return Response.json({ error: 'phone_required' }, { status: 428 })
        }
        let body: Record<string, unknown> = {}
        try {
          body = (await req.json?.()) ?? {}
        } catch {
          return Response.json({ error: 'invalid_json' }, { status: 400 })
        }
        const key = typeof body.idempotencyKey === 'string' && /^[\w-]{16,64}$/.test(body.idempotencyKey) ? body.idempotencyKey : null
        if (!key) return Response.json({ error: 'idempotency_key_required' }, { status: 400 })

        const existing = await req.payload.find({
          collection: 'requests',
          where: { and: [{ idempotencyKey: { equals: key } }, { customer: { equals: req.user.id } }] },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (existing.docs[0]) {
          const d = existing.docs[0]
          return Response.json({ ok: true, duplicate: true, id: d.id, code: d.code, status: d.status })
        }
        const allowed = ['kind', 'provider', 'category', 'contactName', 'contactPhone', 'locality', 'address', 'description', 'preferredDate', 'preferredWindow', 'urgency']
        const data: Record<string, unknown> = { idempotencyKey: key }
        for (const k of allowed) if (body[k] !== undefined && body[k] !== '') data[k] = body[k]
        try {
          const doc = await req.payload.create({ collection: 'requests', data: data as never, req, overrideAccess: false, user: req.user })
          return Response.json({ ok: true, id: doc.id, code: doc.code, status: doc.status }, { status: 201 })
        } catch (err) {
          const e = err as { status?: number; message?: string; data?: unknown }
          return Response.json({ error: e.message ?? 'failed', details: e.data }, { status: e.status ?? 400 })
        }
      },
    },
  ],
}
