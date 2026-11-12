import type { CollectionConfig } from 'payload'

import { adminsOnly } from '../access/roles'

const nobody = () => false

/** Hashed one-time codes for email sign-in and phone verification. Never readable through the API. */
export const OtpChallenges: CollectionConfig = {
  slug: 'otp-challenges',
  admin: { hidden: true },
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'target', type: 'text', required: true, index: true }, // email address or E.164 phone
    { name: 'purpose', type: 'select', required: true, index: true, options: ['email-login', 'verify-phone'] },
    { name: 'user', type: 'relationship', relationTo: 'users', index: true },
    { name: 'codeHash', type: 'text', required: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'attempts', type: 'number', defaultValue: 0 },
    { name: 'consumed', type: 'checkbox', defaultValue: false, index: true },
  ],
}

/** Append-only log of privileged actions. Written only by server hooks. */
export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  admin: { group: 'Operations', useAsTitle: 'action', defaultColumns: ['action', 'targetCollection', 'targetId', 'actor', 'createdAt'] },
  access: { read: adminsOnly, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'action', type: 'text', required: true, index: true },
    { name: 'targetCollection', type: 'text', required: true },
    { name: 'targetId', type: 'text', required: true, index: true },
    { name: 'actor', type: 'relationship', relationTo: 'users' },
    { name: 'detail', type: 'json' },
  ],
}

/**
 * In-app notifications. Text is rendered from `kind` + `data` in the reader's language,
 * so one record works in Bengali and English.
 */
export const Notifications: CollectionConfig = {
  slug: 'notifications',
  admin: { group: 'Operations', defaultColumns: ['user', 'kind', 'read', 'createdAt'] },
  access: {
    read: ({ req }) => (req.user ? { user: { equals: req.user.id } } : false),
    update: ({ req }) => (req.user ? { user: { equals: req.user.id } } : false),
    create: nobody,
    delete: adminsOnly,
  },
  defaultSort: '-createdAt',
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'kind', type: 'select', required: true, options: ['new-request', 'request-update', 'new-review'] },
    { name: 'request', type: 'relationship', relationTo: 'requests' },
    { name: 'data', type: 'json' },
    { name: 'link', type: 'text' },
    { name: 'read', type: 'checkbox', defaultValue: false, index: true },
  ],
  hooks: {
    // Owners may only flip `read`; everything else stays as written by the server.
    beforeChange: [
      ({ data, originalDoc, operation, req }) => {
        if (operation !== 'update' || !req.user || (req.user.roles as string[] | undefined)?.includes('super-admin')) return data
        return { ...originalDoc, read: Boolean(data.read) }
      },
    ],
  },
}
