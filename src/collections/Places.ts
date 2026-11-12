import type { CollectionConfig } from 'payload'

import { adminsOnly, anyone } from '../access/roles'
import { buildSearchText, slugify } from '../lib/text'

/** Towns and localities, with spelling aliases (Tarapur / Taraapur / তারাপুর). */
export const Localities: CollectionConfig = {
  slug: 'localities',
  admin: { useAsTitle: 'name', group: 'Places & categories', defaultColumns: ['name', 'town', 'active'] },
  access: { read: anyone, create: adminsOnly, update: adminsOnly, delete: adminsOnly },
  defaultSort: 'sortOrder',
  fields: [
    { name: 'name', type: 'text', required: true, localized: true },
    { name: 'slug', type: 'text', unique: true, index: true, admin: { position: 'sidebar' } },
    { name: 'town', type: 'text', defaultValue: 'Silchar', index: true },
    { name: 'district', type: 'text', defaultValue: 'Cachar' },
    { name: 'state', type: 'text', defaultValue: 'Assam' },
    {
      name: 'aliases',
      type: 'array',
      admin: { description: 'Other spellings people type, in any script.' },
      fields: [{ name: 'alias', type: 'text', required: true }],
    },
    { name: 'active', type: 'checkbox', defaultValue: true, index: true },
    { name: 'sortOrder', type: 'number', defaultValue: 100 },
    { name: 'searchText', type: 'text', index: true, admin: { hidden: true } },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        if (!data.slug && typeof data.name === 'string') data.slug = slugify(data.name)
        // Combine names from every locale so search works whatever language the user types in.
        let otherNames: string[] = []
        if (originalDoc?.id) {
          const all = await req.payload.findByID({ collection: 'localities', id: originalDoc.id, locale: 'all', depth: 0, overrideAccess: true }).catch(() => null)
          const n = all?.name as unknown
          if (n && typeof n === 'object') otherNames = Object.values(n as Record<string, string>)
        }
        data.searchText = buildSearchText([
          data.name as string,
          data.slug as string,
          ...otherNames,
          ...((data.aliases as { alias: string }[] | undefined)?.map((a) => a.alias) ?? []),
        ])
        return data
      },
    ],
  },
}

export const VERTICALS = ['health', 'services', 'business', 'market', 'education', 'fitness', 'travel'] as const

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: { useAsTitle: 'name', group: 'Places & categories', defaultColumns: ['name', 'vertical', 'parent', 'sortOrder'] },
  access: { read: anyone, create: adminsOnly, update: adminsOnly, delete: adminsOnly },
  defaultSort: 'sortOrder',
  fields: [
    { name: 'name', type: 'text', required: true, localized: true },
    { name: 'slug', type: 'text', unique: true, index: true, admin: { position: 'sidebar' } },
    { name: 'vertical', type: 'select', required: true, index: true, options: VERTICALS.map((v) => ({ label: v, value: v })) },
    { name: 'parent', type: 'relationship', relationTo: 'categories' },
    { name: 'icon', type: 'text', admin: { description: 'Emoji or icon key shown on the tile.' } },
    { name: 'active', type: 'checkbox', defaultValue: true, index: true, admin: { description: 'Untick to hide a P1 category until launch.' } },
    { name: 'sortOrder', type: 'number', defaultValue: 100 },
    {
      name: 'keywords',
      type: 'text',
      admin: { description: 'Extra search words, comma-separated, in any language (e.g. "AC, fridge, ফ্রিজ").' },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (!data.slug && typeof data.name === 'string') data.slug = slugify(data.name)
        return data
      },
    ],
  },
}
