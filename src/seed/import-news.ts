/**
 * Import drafted news stories as DRAFTS (nothing goes live until an editor publishes in Admin → News).
 *   npm run import-news                      → every data/news-drafts-*.json
 *   NEWS_FILE=data/news-drafts-x.json npm run import-news
 * Stories whose slug already exists are skipped, so it is safe to run twice.
 */
import config from '@payload-config'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

type Draft = {
  slug: string
  section: string
  featured?: boolean
  byline?: string
  title: Record<string, string>
  summary: Record<string, string>
  body: Record<string, string[]>
  sources?: { label: string; url?: string }[]
}

const LOCALES = ['en', 'bn', 'mni-Beng', 'mni-Mtei'] as const

/** Plain paragraphs → the rich-text format the editor uses. */
const lexical = (paras: string[]) => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: paras.map((text) => ({
      type: 'paragraph',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      textFormat: 0,
      children: [{ type: 'text', text, format: 0, mode: 'normal', style: '', detail: 0, version: 1 }],
    })),
  },
})

const payload = await getPayload({ config })
const dir = path.resolve(process.cwd(), 'data')
const files = process.env.NEWS_FILE ? [path.resolve(process.cwd(), process.env.NEWS_FILE)] : readdirSync(dir).filter((f) => /^news-drafts-.*\.json$/.test(f)).map((f) => path.join(dir, f))

let created = 0
for (const file of files) {
  const drafts = JSON.parse(readFileSync(file, 'utf8')) as Draft[]
  for (const d of drafts) {
    const exists = await payload.find({ collection: 'news', where: { slug: { equals: d.slug } }, limit: 1, depth: 0, draft: true })
    if (exists.docs[0]) {
      payload.logger.info(`skip (exists): ${d.slug}`)
      continue
    }
    const doc = await payload.create({
      collection: 'news',
      locale: 'en',
      draft: true,
      data: {
        slug: d.slug,
        section: d.section as never,
        featured: Boolean(d.featured),
        byline: d.byline ?? 'Neeze Editor',
        title: d.title.en,
        summary: d.summary.en,
        body: lexical(d.body.en) as never,
        sources: d.sources ?? [],
        publishedAt: new Date().toISOString(),
        _status: 'draft',
      },
    })
    for (const l of LOCALES.slice(1)) {
      if (!d.title[l]) continue
      await payload.update({ collection: 'news', id: doc.id, locale: l, draft: true, data: { title: d.title[l], summary: d.summary[l], body: lexical(d.body[l] ?? []) as never } })
    }
    created++
    payload.logger.info(`draft: ${d.title.en}`)
  }
}
payload.logger.info(`Imported ${created} draft stories. Review and publish them in Admin → News.`)
process.exit(0)
