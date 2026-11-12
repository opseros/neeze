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
