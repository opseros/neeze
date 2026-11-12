/**
 * Seed launch reference data. Safe to run repeatedly (upserts by slug).
 *   npm run seed                      → localities, categories, settings, first super-admin
 *   SEED_DEMO=true npm run seed       → also adds clearly-labelled demo providers for testing
 *
 * Locality names and Bengali spellings are a starting list for founders to verify on the ground.
 */
import config from '@payload-config'
import { getPayload } from 'payload'

import { slugify } from '../lib/text'

type L = { en: string; bn: string; aliases?: string[] }

const LOCALITIES: L[] = [
  { en: 'Tarapur', bn: 'তারাপুর', aliases: ['taraapur', 'tarapore'] },
  { en: 'Ambicapatty', bn: 'অম্বিকাপট্টি', aliases: ['ambikapatty', 'ambikapatti', 'ambicapatti'] },
  { en: 'Rangirkhari', bn: 'রাঙ্গিরখাড়ি', aliases: ['rangirkhari point', 'rangir khari'] },
  { en: 'Malugram', bn: 'মালুগ্রাম', aliases: ['malugaon'] },
  { en: 'Meherpur', bn: 'মেহেরপুর' },
  { en: 'Ghungoor', bn: 'ঘুংগুর', aliases: ['ghungur'] },
  { en: 'Link Road', bn: 'লিংক রোড' },
  { en: 'Premtala', bn: 'প্রেমতলা' },
  { en: 'Janiganj', bn: 'জানিগঞ্জ' },
  { en: 'Itkhola', bn: 'ইটখোলা' },
  { en: 'Club Road', bn: 'ক্লাব রোড' },
  { en: 'Sonai Road', bn: 'সোনাই রোড' },
  { en: 'Shillongpatty', bn: 'শিলংপট্টি', aliases: ['shillong patti'] },
]

type C = { en: string; bn: string; vertical: string; icon: string; keywords?: string; active?: boolean }

const CATEGORIES: C[] = [
  // Neeze Services (P0 core)
  { en: 'Electrician', bn: 'ইলেকট্রিশিয়ান', vertical: 'services', icon: '💡', keywords: 'wiring, fan, light, switch, বিদ্যুৎ, মিস্ত্রি' },
  { en: 'Plumber', bn: 'প্লাম্বার', vertical: 'services', icon: '🚰', keywords: 'tap, pipe, leak, bathroom, কল, পাইপ' },
  { en: 'Vehicle mechanic', bn: 'গাড়ির মেকানিক', vertical: 'services', icon: '🔧', keywords: 'car, bike, scooter, garage, গ্যারেজ' },
  { en: 'Home cleaning', bn: 'ঘর পরিষ্কার', vertical: 'services', icon: '🧹', keywords: 'deep cleaning, kitchen, bathroom' },
  { en: 'Appliance repair', bn: 'যন্ত্রপাতি মেরামত', vertical: 'services', icon: '🔌', keywords: 'AC, fridge, refrigerator, washing machine, TV, ফ্রিজ, এসি' },
  { en: 'Carpenter', bn: 'কাঠমিস্ত্রি', vertical: 'services', icon: '🪚', keywords: 'furniture, door, wood' },
  { en: 'Painter', bn: 'রংমিস্ত্রি', vertical: 'services', icon: '🎨', keywords: 'painting, wall, রং' },
  { en: 'Pest control', bn: 'পোকামাকড় দমন', vertical: 'services', icon: '🐜', keywords: 'termite, cockroach, উইপোকা' },
  { en: 'Handyman', bn: 'সাধারণ মেরামত', vertical: 'services', icon: '🧰' },
  { en: 'IT & electronics repair', bn: 'কম্পিউটার ও ইলেকট্রনিক্স মেরামত', vertical: 'services', icon: '💻', keywords: 'computer, laptop, mobile, phone, printer' },
  // Health (P0: appointment requests only)
  { en: 'Doctor', bn: 'ডাক্তার', vertical: 'health', icon: '🩺', keywords: 'physician, ডাক্তারবাবু' },
  { en: 'Clinic', bn: 'ক্লিনিক', vertical: 'health', icon: '🏥' },
  { en: 'Hospital', bn: 'হাসপাতাল', vertical: 'health', icon: '🏨' },
  { en: 'Diagnostic centre', bn: 'ডায়াগনস্টিক সেন্টার', vertical: 'health', icon: '🧪', keywords: 'lab, test, x-ray, blood test, পরীক্ষা' },
  // Business directory (P0)
  { en: 'Shops & businesses', bn: 'দোকান ও ব্যবসা', vertical: 'business', icon: '🏪' },
  // P1+ verticals, created inactive so they stay hidden until launch
  { en: 'Grocery', bn: 'মুদি দোকান', vertical: 'market', icon: '🛒', active: false },
  { en: 'Pharmacy', bn: 'ঔষধের দোকান', vertical: 'market', icon: '💊', active: false },
  { en: 'Hardware', bn: 'হার্ডওয়্যার', vertical: 'market', icon: '🔩', active: false },
  { en: 'School', bn: 'স্কুল', vertical: 'education', icon: '🎓', active: false },
  { en: 'Gym', bn: 'জিম', vertical: 'fitness', icon: '💪', active: false },
  { en: 'Bus operator', bn: 'বাস পরিষেবা', vertical: 'travel', icon: '🚌', active: false },
  { en: 'Hotel', bn: 'হোটেল', vertical: 'travel', icon: '🏨', active: false },
]

async function upsert<T extends 'localities' | 'categories'>(payload: Awaited<ReturnType<typeof getPayload>>, collection: T, slug: string, en: Record<string, unknown>, bn: Record<string, unknown>) {
  const found = await payload.find({ collection, where: { slug: { equals: slug } }, limit: 1, depth: 0 })
  const doc = found.docs[0]
    ? await payload.update({ collection, id: found.docs[0].id, data: { ...en, slug } as never, locale: 'en' })
    : await payload.create({ collection, data: { ...en, slug } as never, locale: 'en' })
  // Second pass in Bengali also refreshes searchText with both scripts.
  await payload.update({ collection, id: doc.id, data: bn as never, locale: 'bn' })
  await payload.update({ collection, id: doc.id, data: {} as never, locale: 'en' })
  return doc
}

async function main() {
  const payload = await getPayload({ config })

  const loc: Record<string, number> = {}
  for (const [i, l] of LOCALITIES.entries()) {
    const slug = slugify(l.en)
    const doc = await upsert(payload, 'localities', slug, { name: l.en, sortOrder: i, aliases: (l.aliases ?? []).map((alias) => ({ alias })) }, { name: l.bn })
    loc[slug] = doc.id as number
  }
  payload.logger.info(`Localities: ${LOCALITIES.length}`)

  const cat: Record<string, number> = {}
  for (const [i, c] of CATEGORIES.entries()) {
    const slug = slugify(c.en)
    const doc = await upsert(payload, 'categories', slug, { name: c.en, vertical: c.vertical, icon: c.icon, keywords: c.keywords, sortOrder: i, active: c.active ?? true }, { name: c.bn })
    cat[slug] = doc.id as number
  }
  payload.logger.info(`Categories: ${CATEGORIES.length}`)

  // National emergency numbers. Founders should add verified local hospital and helpline numbers.
  await payload.updateGlobal({
    slug: 'site-settings',
    locale: 'en',
    data: {
      emergencyContacts: [
        { label: 'National emergency', phone: '112', note: 'Police, fire, ambulance' },
        { label: 'Ambulance', phone: '108' },
        { label: 'Fire', phone: '101' },
      ],
    },
  })
  const s = await payload.findGlobal({ slug: 'site-settings', locale: 'en', depth: 0 })
  const bnLabels = ['জাতীয় জরুরি নম্বর', 'অ্যাম্বুলেন্স', 'দমকল']
  await payload.updateGlobal({
    slug: 'site-settings',
    locale: 'bn',
    data: { emergencyContacts: (s.emergencyContacts ?? []).map((c, i) => ({ ...c, label: bnLabels[i] ?? c.label, note: i === 0 ? 'পুলিশ, দমকল, অ্যাম্বুলেন্স' : c.note })) },
  })

  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD
  if (email && password) {
    const exists = await payload.find({ collection: 'users', where: { email: { equals: email.toLowerCase() } }, limit: 1, depth: 0 })
    const existing = exists.docs[0]
    if (!existing) {
      await payload.create({ collection: 'users', data: { email, password, name: 'Neeze Admin', roles: ['super-admin'] } })
      payload.logger.info(`Created super-admin ${email}`)
    } else {
      // The address already signed in on the site (Google, Microsoft or email code): keep the account,
      // its history and its sign-in methods; add super-admin and set the /admin password.
      const roles = [...new Set([...((existing.roles as string[]) ?? []), 'super-admin'])]
      await payload.update({ collection: 'users', id: existing.id, data: { roles: roles as never, password, suspended: false }, overrideAccess: true })
      payload.logger.info(`Existing account ${email} is now super-admin; /admin password set`)
    }
  }

  if (process.env.SEED_DEMO === 'true') {
    // Fake, obviously-labelled listings for testing only. Numbers are not real (+91 00000…).
    const demo = [
      { name: 'Demo Electrician (sample)', nameBn: 'ডেমো ইলেকট্রিশিয়ান (নমুনা)', type: 'service-professional', cats: ['electrician'], base: 'tarapur', areas: ['tarapur', 'ambicapatty', 'rangirkhari'], phone: '+910000000001', verification: 'phone', services: [{ title: 'Ceiling fan installation', pricingType: 'from', price: 250 }, { title: 'Wiring repair', pricingType: 'quote' }] },
      { name: 'Demo Plumbing Works (sample)', nameBn: 'ডেমো প্লাম্বিং (নমুনা)', type: 'service-professional', cats: ['plumber'], base: 'ambicapatty', areas: ['ambicapatty', 'link-road', 'premtala'], phone: '+910000000002', verification: 'none', services: [{ title: 'Leak repair', pricingType: 'quote' }] },
      { name: 'Demo Cool Care AC Repair (sample)', nameBn: 'ডেমো এসি মেরামত (নমুনা)', type: 'service-professional', cats: ['appliance-repair'], base: 'meherpur', areas: ['meherpur', 'malugram', 'ghungoor'], phone: '+910000000003', verification: 'identity', services: [{ title: 'AC service', pricingType: 'fixed', price: 600 }] },
      { name: 'Demo Family Clinic (sample)', nameBn: 'ডেমো ফ্যামিলি ক্লিনিক (নমুনা)', type: 'clinic', cats: ['clinic', 'doctor'], base: 'club-road', areas: [], phone: '+910000000004', verification: 'credential', services: [] },
    ]
    for (const d of demo) {
      const exists = await payload.find({ collection: 'providers', where: { name: { equals: d.name } }, limit: 1, depth: 0 })
      if (exists.docs[0]) continue
      await payload.create({
        collection: 'providers',
        locale: 'en',
        data: {
          name: d.name,
          nameBn: d.nameBn,
          type: d.type as never,
          categories: d.cats.map((c) => cat[c]).filter(Boolean),
          baseLocality: loc[d.base],
          serviceLocalities: d.areas.map((a) => loc[a]).filter(Boolean),
          phone: d.phone,
          whatsapp: d.phone,
          status: 'published',
          verification: d.verification as never,
          summary: 'Sample listing for testing. Not a real provider.',
          services: d.services as never,
          acceptsRequests: true,
          lastConfirmedAt: new Date().toISOString(),
        },
      })
    }
    payload.logger.info(`Demo providers: ${demo.length}`)
  }

  process.exit(0)
}

// Top-level await: `payload run` exits as soon as the module finishes evaluating.
try {
  await main()
} catch (err) {
  console.error(err)
  process.exit(1)
}
