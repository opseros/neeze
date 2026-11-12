import type { Access, CollectionConfig, Where } from 'payload'

import { adminsOnly, isStaff, staffFieldOnly } from '../access/roles'
import { audit } from '../hooks/audit'
import { buildSearchText, normalizeIndianMobile } from '../lib/text'

export const PROVIDER_TYPES = [
  { label: 'Service professional', value: 'service-professional' },
  { label: 'Business / shop', value: 'business' },
  { label: 'Doctor', value: 'doctor' },
  { label: 'Clinic', value: 'clinic' },
  { label: 'Hospital', value: 'hospital' },
  { label: 'Diagnostic centre', value: 'diagnostic' },
] as const

/**
 * Verification levels say exactly what was checked (blueprint principle "Trust-first").
 * Never show a higher label than the evidence supports.
 */
export const VERIFICATION_LEVELS = [
  { label: 'Not verified', value: 'none' },
  { label: 'Phone checked', value: 'phone' },
  { label: 'Identity checked', value: 'identity' },
  { label: 'Licence / credential checked', value: 'credential' },
] as const

const ownedOrPublished: Access = ({ req }) => {
  if (isStaff(req.user)) return true
  const published: Where = { status: { equals: 'published' } }
  if (!req.user) return published
  return { or: [published, { owners: { contains: req.user.id } }] }
}

const ownerOrStaff: Access = ({ req }) => {
  if (isStaff(req.user)) return true
  if (!req.user) return false
  return { owners: { contains: req.user.id } }
}

export const Providers: CollectionConfig = {
  slug: 'providers',
  labels: { singular: 'Provider / business', plural: 'Providers & businesses' },
  admin: {
    useAsTitle: 'name',
    group: 'Directory',
    defaultColumns: ['name', 'type', 'status', 'verification', 'baseLocality', 'updatedAt'],
    listSearchableFields: ['name', 'nameBn', 'phone'],
  },
  access: {
    read: ownedOrPublished,
    // Providers self-onboard as "pending review"; admins publish.
    create: ({ req }) => Boolean(req.user),
    update: ownerOrStaff,
    delete: adminsOnly,
  },
  versions: { maxPerDoc: 20 },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', required: true, maxLength: 120 },
        { name: 'nameBn', label: 'Name in Bengali', type: 'text', maxLength: 120 },
      ],
    },
    { name: 'type', type: 'select', required: true, index: true, options: [...PROVIDER_TYPES] },
    { name: 'categories', type: 'relationship', relationTo: 'categories', hasMany: true, required: true, index: true },
    { name: 'summary', type: 'textarea', localized: true, maxLength: 300 },
    {
      name: 'services',
      type: 'array',
      admin: { description: 'What they actually offer, e.g. "Ceiling fan installation".' },
      fields: [
        { name: 'title', type: 'text', required: true, localized: true },
        { name: 'pricingType', type: 'select', defaultValue: 'quote', options: ['fixed', 'from', 'quote'] },
        { name: 'price', type: 'number', min: 0, admin: { condition: (_, s) => s?.pricingType !== 'quote' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'phone', type: 'text', required: true },
        { name: 'whatsapp', type: 'text' },
      ],
    },
    { name: 'baseLocality', type: 'relationship', relationTo: 'localities', required: true, index: true },
    {
      name: 'serviceLocalities',
      type: 'relationship',
      relationTo: 'localities',
      hasMany: true,
      index: true,
      admin: { description: 'Where they will travel to. Leave empty for walk-in businesses.' },
    },
    { name: 'address', type: 'textarea', maxLength: 300 },
    {
      // Plain numbers, not a PostGIS point: no extension needed on managed Postgres.
      type: 'row',
      fields: [
        { name: 'lat', type: 'number', min: 6, max: 37, admin: { description: 'Optional. For "Open in Google Maps" only.' } },
        { name: 'lng', type: 'number', min: 68, max: 98 },
      ],
    },
    {
      name: 'hours',
      type: 'array',
      admin: { description: 'Only enter hours the provider has confirmed.' },
      fields: [
        { name: 'days', type: 'text', required: true, localized: true },
        { name: 'time', type: 'text', required: true },
      ],
    },
    { name: 'photos', type: 'upload', relationTo: 'media', hasMany: true, maxRows: 8 },
    { name: 'acceptsRequests', type: 'checkbox', defaultValue: true, admin: { position: 'sidebar' } },
    {
      name: 'owners',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      index: true,
      admin: { position: 'sidebar', description: 'Accounts allowed to manage this listing and see its requests.' },
      access: { update: staffFieldOnly },
    },
    // ----- Fields only staff can set -----
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending-review',
      index: true,
      options: ['draft', 'pending-review', 'published', 'suspended'],
      admin: { position: 'sidebar' },
      access: { create: staffFieldOnly, update: staffFieldOnly },
    },
    {
      name: 'verification',
      type: 'select',
      defaultValue: 'none',
      options: [...VERIFICATION_LEVELS],
      admin: { position: 'sidebar' },
      access: { create: staffFieldOnly, update: staffFieldOnly },
    },
    {
      name: 'verificationNotes',
      type: 'textarea',
      admin: { position: 'sidebar', description: 'What evidence was checked, by whom. Never shown publicly.' },
      access: { read: staffFieldOnly, create: staffFieldOnly, update: staffFieldOnly },
    },
    {
      name: 'lastConfirmedAt',
      type: 'date',
      admin: { position: 'sidebar', description: 'When contact details were last confirmed.' },
      access: { create: staffFieldOnly, update: staffFieldOnly },
    },
    { name: 'searchText', type: 'text', index: true, admin: { hidden: true }, access: { update: () => false, create: () => false } },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data
        for (const key of ['phone', 'whatsapp'] as const) {
          if (data[key]) {
            const n = normalizeIndianMobile(String(data[key]))
            // Landlines are allowed for businesses; keep them as typed if they are not mobiles.
            if (n) data[key] = n
          }
        }
        return data
      },
    ],
    beforeChange: [
      async ({ data, req, operation }) => {
        // A non-staff creator becomes an owner of the listing they create.
        if (operation === 'create' && req.user && !isStaff(req.user)) {
          const owners = new Set<number>(((data.owners as number[]) ?? []).map(Number))
          owners.add(Number(req.user.id))
          data.owners = [...owners]
          data.status = 'pending-review'
          data.verification = 'none'
        }
        const catIds = ((data.categories as (number | { id: number })[]) ?? []).map((c) => (typeof c === 'object' ? c.id : c))
        const cats = catIds.length
          ? await req.payload.find({ collection: 'categories', where: { id: { in: catIds } }, locale: 'all', depth: 0, limit: 50, overrideAccess: true })
          : { docs: [] }
        const catWords = cats.docs.flatMap((c) => {
          const names = typeof c.name === 'object' && c.name ? Object.values(c.name as Record<string, string>) : [c.name as string]
          return [...names, c.slug ?? '', ...(c.keywords ?? '').split(',')]
        })
        data.searchText = buildSearchText([
          data.name as string,
          data.nameBn as string,
          ...catWords,
          ...((data.services as { title?: string }[] | undefined)?.map((s) => s.title) ?? []),
        ])
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
        if (operation === 'update' && (previousDoc?.status !== doc.status || previousDoc?.verification !== doc.verification)) {
          await audit(req, 'provider.status-or-verification', 'providers', doc.id, {
            before: { status: previousDoc?.status, verification: previousDoc?.verification },
            after: { status: doc.status, verification: doc.verification },
          })
        }
        return doc
      },
    ],
  },
}

