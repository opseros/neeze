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
      // Lead story and spotlight photos on wide screens.
      { name: 'hero', width: 1280, withoutEnlargement: true, formatOptions: { format: 'webp', options: { quality: 72 } } },
    ],
  },
  fields: [
    { name: 'alt', type: 'text', localized: true, admin: { description: 'Describe the photo for people who cannot see it.' } },
    { name: 'uploadedBy', type: 'relationship', relationTo: 'users', index: true, admin: { readOnly: true, position: 'sidebar' }, access: { read: ({ req }) => isStaff(req.user) } },
  ],
  hooks: {
    ...revalidateHooks('providers', 'news', 'community', 'settings'),
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation === 'create') return { ...data, uploadedBy: req.user?.id, alt: data.alt || 'Photo' }
        return data
      },
    ],
  },
}

/**
 * Editor-only news: published by Neeze's own editors, with a visible correction log.
 * Readers send corrections through the report queue (content-reports).
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
    {
      name: 'section',
      type: 'select',
      defaultValue: 'local',
      index: true,
      options: [
        { label: 'Local', value: 'local' },
        { label: 'Civic & utilities (water, power, roads, municipality)', value: 'civic' },
        { label: 'Health', value: 'health' },
        { label: 'Education', value: 'education' },
        { label: 'Traffic & transport', value: 'transport' },
        { label: 'Events', value: 'events' },
        { label: 'Business', value: 'business' },
        { label: 'Alerts (weather, floods, safety)', value: 'alerts' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'featured',
      label: 'Pin as top story',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: { position: 'sidebar', description: 'Shown as the lead story on the front page. If several are pinned, the newest wins; otherwise the newest story leads.' },
    },
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
    {
      name: 'landing',
      label: 'Landing page',
      type: 'group',
      admin: { description: 'What people see first at neeze.opseros.com.' },
      fields: [
        {
          name: 'defaultPage',
          label: 'Landing page',
          type: 'select',
          defaultValue: 'news',
          options: [
            { label: 'News front page (with services and community alongside)', value: 'news' },
            { label: 'Services directory', value: 'directory' },
            { label: 'Community', value: 'community' },
          ],
        },
        {
          name: 'temporary',
          label: 'Temporary change',
          type: 'group',
          admin: { description: 'For floods, festivals, elections or a campaign. Switches back by itself after "Until".' },
          fields: [
            { name: 'active', label: 'Turn on', type: 'checkbox', defaultValue: false },
            {
              type: 'row',
              admin: { condition: (_, s) => Boolean(s?.active) },
              fields: [
                { name: 'from', type: 'date', admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' }, description: 'Leave empty to start now.' } },
                {
                  name: 'until',
                  type: 'date',
                  admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } },
                  validate: (v: unknown, { siblingData }: { siblingData: { active?: boolean; from?: string } }) => {
                    if (!siblingData?.active) return true
                    if (!v) return 'Set when it ends, so it switches back by itself.'
                    if (siblingData.from && new Date(v as string) <= new Date(siblingData.from)) return 'Must be after "From".'
                    return true
                  },
                },
              ],
            },
            {
              name: 'page',
              label: 'Show this page instead',
              type: 'select',
              options: [
                { label: 'Keep the landing page above', value: 'same' },
                { label: 'News front page', value: 'news' },
                { label: 'Services directory', value: 'directory' },
                { label: 'Community', value: 'community' },
              ],
              defaultValue: 'same',
              admin: { condition: (_, s) => Boolean(s?.active) },
            },
            {
              name: 'showSpotlight',
              label: 'Show a spotlight banner at the top',
              type: 'checkbox',
              defaultValue: true,
              admin: { condition: (_, s) => Boolean(s?.active) },
            },
            {
              type: 'collapsible',
              label: 'Spotlight banner',
              admin: { condition: (_, s) => Boolean(s?.active && s?.showSpotlight) },
              fields: [
                { name: 'headline', type: 'text', localized: true, maxLength: 90 },
                { name: 'text', type: 'textarea', localized: true, maxLength: 240 },
                { name: 'image', type: 'upload', relationTo: 'media', admin: { description: 'Optional. A wide photo works best.' } },
                {
                  type: 'row',
                  fields: [
                    { name: 'buttonLabel', type: 'text', localized: true, maxLength: 40, admin: { width: '50%' } },
                    {
                      name: 'buttonLink',
                      type: 'text',
                      admin: { width: '50%', description: 'A page on this site like /emergency, or an https:// link.' },
                      validate: (v: unknown) => (!v || /^\/(?!\/)\S*$/.test(String(v)) || /^https:\/\/\S+$/i.test(String(v)) ? true : 'Use a path like /emergency or an https:// link.'),
                    },
                  ],
                },
                {
                  name: 'tone',
                  type: 'select',
                  defaultValue: 'navy',
                  options: [
                    { label: 'Neeze blue', value: 'navy' },
                    { label: 'Teal (good news, events)', value: 'teal' },
                    { label: 'Alert (urgent safety information)', value: 'alert' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'community',
      type: 'group',
      fields: [
        {
          name: 'postingMode',
          type: 'select',
          defaultValue: 'first-post',
          options: [
            { label: 'Open: posts go live straight away', value: 'open' },
            { label: "New members' first post is reviewed, then open", value: 'first-post' },
            { label: 'Every post is reviewed before it goes live', value: 'all' },
          ],
          admin: { description: 'Posts with several links always wait for review. Reported posts hide themselves after 3 reports.' },
        },
      ],
    },
  ],
}
