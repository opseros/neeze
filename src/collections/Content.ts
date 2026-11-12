import type { CollectionConfig, GlobalConfig } from 'payload'

import { adminsOnly, anyone, hasRole, isAdmin, isStaff, signedIn } from '../access/roles'
import { revalidate, revalidateHooks } from '../hooks/revalidate'
import { slugify } from '../lib/text'

const editors = ({ req }: { req: { user?: unknown } }) =>
  isAdmin(req.user as never) || hasRole(req.user as never, 'editor')

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { group: 'Content' },
  access: {
    read: anyone,
    create: signedIn,
    update: ({ req }) => isStaff(req.user),
    delete: adminsOnly,
  },
  upload: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    // Phones upload big photos; keep a small, fast version for slow networks.
    resizeOptions: { width: 1280, withoutEnlargement: true },
    formatOptions: { format: 'webp', options: { quality: 78 } },
    imageSizes: [
      { name: 'thumb', width: 320, formatOptions: { format: 'webp', options: { quality: 70 } } },
      { name: 'card', width: 640, formatOptions: { format: 'webp', options: { quality: 75 } } },
    ],
  },
  fields: [{ name: 'alt', type: 'text', required: true, localized: true }],
  // Photos appear on provider pages and news.
  hooks: revalidateHooks('providers', 'news'),
}

/**
 * Editor-only news for P0: published by Neeze's own editors, with a visible correction log.
 * Community posting is deferred to P1.
 */
export const News: CollectionConfig = {
  slug: 'news',
  labels: { singular: 'News article', plural: 'News' },
  admin: { useAsTitle: 'title', group: 'Content', defaultColumns: ['title', '_status', 'publishedAt'] },
  versions: { drafts: true, maxPerDoc: 50 },
  access: {
    read: ({ req }) => (isStaff(req.user) ? true : { _status: { equals: 'published' } }),
    create: editors,
    update: editors,
    delete: adminsOnly,
  },
  defaultSort: '-publishedAt',
  fields: [
    { name: 'title', type: 'text', required: true, localized: true, maxLength: 160 },
    { name: 'slug', type: 'text', unique: true, index: true, admin: { position: 'sidebar' } },
    { name: 'summary', type: 'textarea', localized: true, maxLength: 300 },
    { name: 'body', type: 'richText', localized: true },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'publishedAt', type: 'date', index: true, admin: { position: 'sidebar' } },
    { name: 'sources', type: 'array', fields: [{ name: 'label', type: 'text', required: true }, { name: 'url', type: 'text' }] },
    {
      name: 'corrections',
      type: 'array',
      admin: { description: 'Every correction stays visible under the article.' },
      fields: [
        { name: 'at', type: 'date', required: true },
        { name: 'note', type: 'text', required: true, localized: true },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (!data.slug && typeof data.title === 'string') data.slug = `${slugify(data.title)}-${Date.now().toString(36)}`
        if (data._status === 'published' && !data.publishedAt) data.publishedAt = new Date().toISOString()
        return data
      },
    ],
    ...revalidateHooks('news'),
  },
}

/** Emergency numbers and the flood/helpline banner. Cached offline by the PWA. */
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  admin: { group: 'Operations' },
  access: { read: anyone, update: adminsOnly },
  hooks: {
    afterChange: [
      ({ doc }) => {
        revalidate('settings')
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'alertBanner',
      type: 'group',
      admin: { description: 'Pinned at the top of every page, e.g. during floods.' },
      fields: [
        { name: 'enabled', type: 'checkbox', defaultValue: false },
        { name: 'message', type: 'text', localized: true },
        { name: 'tone', type: 'select', options: ['info', 'warning', 'critical'], defaultValue: 'warning' },
      ],
    },
    {
      name: 'emergencyContacts',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true, localized: true },
        { name: 'phone', type: 'text', required: true },
        { name: 'note', type: 'text', localized: true },
      ],
    },
    { name: 'supportPhone', type: 'text' },
    { name: 'grievanceEmail', type: 'email' },
  ],
}
