import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

import { toBengaliManipuri, toMeiteiMayek } from '../lib/meitei'

/**
 * Manipuri names for the launch categories, and Meitei Mayek spellings of locality names.
 * (Bengali-script readers already get the Bengali locality names through fallback.)
 * Never overwrites a name an admin has already entered.
 */
const CATEGORY_NAMES: Record<string, string> = {
  'appliance-repair': 'য়ুম‌গী মেসিন শেম্দোক্পা',
  'bus-operator': 'বস সর্ভিস',
  carpenter: 'কার্পেন্টর',
  clinic: 'ক্লিনিক',
  'diagnostic-centre': 'ডাইগ্নোস্টিক সেন্টর',
  doctor: 'ডাক্তর',
  electrician: 'ইলেক্ট্রিসিয়ন',
  grocery: 'গ্রোসরি দুকান',
  gym: 'জিম',
  handyman: 'য়ুম‌গী শেম্দোক্পা',
  hardware: 'হার্ডৱেয়র',
  'home-cleaning': 'য়ুম সেংদোক্পা',
  hospital: 'হোস্পিতাল',
  hotel: 'হোটেল',
  'it-electronics-repair': 'কম্পিউটর অমসুং ইলেক্ট্রোনিক্স শেম্দোক্পা',
  painter: 'পেন্টর',
  'pest-control': 'পেস্ট কন্ট্রোল',
  pharmacy: 'ফার্মেসি',
  plumber: 'প্লম্বর',
  school: 'স্কুল',
  'shops-businesses': 'দুকান অমসুং বিজিনেস',
  'vehicle-mechanic': 'গাড়ি মেকানিক',
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const [slug, name] of Object.entries(CATEGORY_NAMES)) {
    for (const [locale, text] of [
      ['mni-Beng', toBengaliManipuri(name)],
      ['mni-Mtei', toMeiteiMayek(name)],
    ]) {
      await db.execute(sql`
        INSERT INTO "categories_locales" ("name", "_locale", "_parent_id")
        SELECT ${text}, ${locale}::"_locales", "id" FROM "categories" WHERE "slug" = ${slug}
        ON CONFLICT ("_locale", "_parent_id") DO NOTHING`)
    }
  }
  const res = await db.execute(sql`SELECT "_parent_id" AS id, "name" FROM "localities_locales" WHERE "_locale" = 'bn'`)
  for (const row of res.rows as { id: number; name: string }[]) {
    await db.execute(sql`
      INSERT INTO "localities_locales" ("name", "_locale", "_parent_id")
      VALUES (${toMeiteiMayek(row.name)}, 'mni-Mtei', ${row.id})
      ON CONFLICT ("_locale", "_parent_id") DO NOTHING`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DELETE FROM "categories_locales" WHERE "_locale"::text IN ('mni-Mtei', 'mni-Beng')`)
  await db.execute(sql`DELETE FROM "localities_locales" WHERE "_locale"::text = 'mni-Mtei'`)
}
