import { randomBytes } from 'crypto'
import type { CollectionConfig, PayloadRequest } from 'payload'
import { APIError } from 'payload'

import { ROLES, adminFieldOnly, isAdmin, isRoleEscalation, isStaff, selfOrAdmin, superAdminsOnly } from '../access/roles'
import { OTP_MAX_ATTEMPTS, OTP_MAX_PER_HOUR, OTP_RESEND_GAP_MS, OTP_TTL_MS, generateOtp, getOtpSender, hashOtp, otpMatches, shouldEchoOtp } from '../lib/otp'
import { SESSION_COOKIE, readCookie, sessionCookieHeader, signSession, verifySession } from '../lib/session'
import { normalizeIndianMobile } from '../lib/text'
import { audit } from '../hooks/audit'

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, { status, headers })

async function readBody(req: PayloadRequest): Promise<Record<string, unknown>> {
  try {
    return (req.json ? await req.json() : {}) as Record<string, unknown>
  } catch {
    return {}
  }
}

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'username', 'email', 'roles'],
    group: 'People',
  },
  auth: {
    // Staff sign in to /admin with email + password; customers and providers use phone OTP.
    loginWithUsername: { allowEmailLogin: true, requireEmail: false, requireUsername: false },
    tokenExpiration: 60 * 60 * 8,
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    cookies: { sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' },
    strategies: [
      {
        name: 'otp-session',
        authenticate: async ({ headers, payload }) => {
          const session = verifySession(readCookie(headers.get('cookie'), SESSION_COOKIE))
          if (!session) return { user: null }
          try {
            const user = await payload.findByID({ collection: 'users', id: session.uid, depth: 0, overrideAccess: true })
            if (!user || user.suspended) return { user: null }
            return { user: { ...user, collection: 'users', _strategy: 'otp-session' } }
          } catch {
            return { user: null }
          }
        },
      },
    ],
  },
  access: {
    admin: ({ req }) => isStaff(req.user),
    create: ({ req }) => isAdmin(req.user), // customers are created by the OTP endpoint, not the open API
    read: selfOrAdmin,
    update: selfOrAdmin,
    delete: superAdminsOnly,
  },
  fields: [
    { name: 'name', type: 'text', maxLength: 80 },
    {
      name: 'phone',
      type: 'text',
      unique: true,
      index: true,
      admin: { description: 'E.164, e.g. +919876543210. Set by OTP sign-in.' },
      access: { update: adminFieldOnly },
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      options: ROLES.map((r) => ({ label: r, value: r })),
      defaultValue: ['customer'],
      required: true,
      saveToJWT: true,
      access: { update: adminFieldOnly, create: adminFieldOnly },
      hooks: {
        beforeChange: [
          ({ req, value, originalDoc, operation }) => {
            if (!req.user) return value // seed / local API
            const prev = operation === 'update' ? ((originalDoc?.roles as string[]) ?? []) : []
            if (isRoleEscalation(req.user, prev, (value as string[]) ?? [])) {
              throw new APIError('You are not allowed to grant or remove these roles.', 403)
            }
            return value
          },
        ],
      },
    },
    { name: 'preferredLanguage', type: 'select', options: ['en', 'bn', 'as'], defaultValue: 'bn' },
    { name: 'locality', type: 'relationship', relationTo: 'localities' },
    {
      name: 'suspended',
      type: 'checkbox',
      defaultValue: false,
      access: { update: adminFieldOnly, create: adminFieldOnly },
    },
    { name: 'suspensionReason', type: 'text', access: { read: adminFieldOnly, update: adminFieldOnly } },
  ],
  hooks: {
    afterChange: [
      ({ doc, previousDoc, req, operation }) => {
        const before = JSON.stringify([previousDoc?.roles, previousDoc?.suspended])
        const after = JSON.stringify([doc.roles, doc.suspended])
        if (operation === 'update' && before !== after) {
          return audit(req, 'user.roles-or-suspension', 'users', doc.id, { before: previousDoc && { roles: previousDoc.roles, suspended: previousDoc.suspended }, after: { roles: doc.roles, suspended: doc.suspended } }).then(() => doc)
        }
        return doc
      },
    ],
  },
  endpoints: [
    {
      path: '/otp/request',
      method: 'post',
      handler: async (req) => {
        const body = await readBody(req)
        const phone = normalizeIndianMobile(String(body.phone ?? ''))
        if (!phone) return json({ error: 'invalid_phone' }, 400)

        const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
        const recent = await req.payload.find({
          collection: 'otp-challenges',
          where: { and: [{ phone: { equals: phone } }, { createdAt: { greater_than: since } }] },
          sort: '-createdAt',
          limit: OTP_MAX_PER_HOUR,
          depth: 0,
          overrideAccess: true,
        })
        const last = recent.docs[0]
        if (last && Date.now() - new Date(last.createdAt).getTime() < OTP_RESEND_GAP_MS) {
          return json({ error: 'too_soon', retryAfterSeconds: 60 }, 429)
        }
        if (recent.totalDocs >= OTP_MAX_PER_HOUR) return json({ error: 'too_many' }, 429)

        const code = generateOtp()
        await req.payload.create({
          collection: 'otp-challenges',
          overrideAccess: true,
          data: { phone, codeHash: hashOtp(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(), attempts: 0, consumed: false },
        })
        try {
          await getOtpSender()(phone, code)
        } catch (err) {
          req.payload.logger.error({ err }, 'OTP send failed')
          return json({ error: 'send_failed' }, 502)
        }
        return json({ ok: true, ...(shouldEchoOtp() ? { devCode: code } : {}) })
      },
    },
    {
      path: '/otp/verify',
      method: 'post',
      handler: async (req) => {
        const body = await readBody(req)
        const phone = normalizeIndianMobile(String(body.phone ?? ''))
        const code = String(body.code ?? '').trim()
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : undefined
        if (!phone || !/^\d{6}$/.test(code)) return json({ error: 'invalid_input' }, 400)

        const { docs } = await req.payload.find({
          collection: 'otp-challenges',
          where: { and: [{ phone: { equals: phone } }, { consumed: { equals: false } }] },
          sort: '-createdAt',
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const ch = docs[0]
        if (!ch || new Date(ch.expiresAt).getTime() < Date.now()) return json({ error: 'expired' }, 400)
        if ((ch.attempts ?? 0) >= OTP_MAX_ATTEMPTS) return json({ error: 'too_many_attempts' }, 429)

        if (!otpMatches(phone, code, ch.codeHash)) {
          await req.payload.update({ collection: 'otp-challenges', id: ch.id, overrideAccess: true, data: { attempts: (ch.attempts ?? 0) + 1 } })
          return json({ error: 'wrong_code' }, 400)
        }
        await req.payload.update({ collection: 'otp-challenges', id: ch.id, overrideAccess: true, data: { consumed: true } })

        const existing = await req.payload.find({ collection: 'users', where: { phone: { equals: phone } }, limit: 1, depth: 0, overrideAccess: true })
        let user = existing.docs[0]
        if (user?.suspended) return json({ error: 'suspended' }, 403)
        if (!user) {
          user = await req.payload.create({
            collection: 'users',
            overrideAccess: true,
            data: {
              phone,
              username: phone.replace('+', ''),
              name: name || undefined,
              roles: ['customer'],
              // Local strategy needs a password; OTP users never use it.
              password: randomBytes(24).toString('base64url'),
            },
          })
        } else if (name && !user.name) {
          user = await req.payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { name } })
        }

        return json(
          { ok: true, user: { id: user.id, name: user.name, roles: user.roles } },
          200,
          { 'Set-Cookie': sessionCookieHeader(signSession(user.id)) },
        )
      },
    },
    {
      path: '/otp/logout',
      method: 'post',
      handler: async () => json({ ok: true }, 200, { 'Set-Cookie': sessionCookieHeader(null) }),
    },
  ],
}
