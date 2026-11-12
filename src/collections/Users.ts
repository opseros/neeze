import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { ROLES, adminFieldOnly, isAdmin, isRoleEscalation, isStaff, selfOrAdmin, superAdminsOnly } from '../access/roles'
import { SESSION_COOKIE, readCookie, verifySession } from '../lib/session'
import { audit } from '../hooks/audit'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'username', 'email', 'roles'],
    group: 'People',
  },
  auth: {
    // Staff sign in to /admin with email + password. Everyone else signs in with Google,
    // Microsoft or an emailed code (src/app/(frontend)/auth/*), which sets the neeze_session cookie.
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
      admin: { description: 'Mobile in E.164, e.g. +919876543210. Required before sending requests; providers use it to call.' },
      access: { update: adminFieldOnly },
    },
    { name: 'phoneVerified', type: 'checkbox', defaultValue: false, access: { update: adminFieldOnly, create: adminFieldOnly } },
    { name: 'emailVerified', type: 'checkbox', defaultValue: false, access: { update: adminFieldOnly, create: adminFieldOnly } },
    {
      name: 'identities',
      type: 'array',
      admin: { readOnly: true, description: 'Google / Microsoft accounts linked to this user.' },
      access: { read: adminFieldOnly, create: adminFieldOnly, update: adminFieldOnly },
      fields: [
        { name: 'provider', type: 'text', required: true, index: true },
        { name: 'subject', type: 'text', required: true, index: true },
      ],
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
}
