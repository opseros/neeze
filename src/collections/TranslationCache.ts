import { createHash } from 'node:crypto'
import type { CollectionConfig, PayloadRequest } from 'payload'

import { isAdmin } from '../access/roles'
import { MAX_TRANSLATE_CHARS, TRANSLATE_KINDS, TRANSLATE_TARGET, type TranslateKind, dailyCharLimit, lexicalParagraphs, translateEnabled } from '../lib/translate'
import { isLocale } from '../i18n/locales'

/**
 * Machine translations already paid for, one row per paragraph and target language, so each text is
 * sent to Google once. Written only by POST /api/translation-cache/translate.
 */

const recent = new Map<string, { n: number; t: number }>()
function allow(ip: string) {
  const now = Date.now()
  if (recent.size > 5000) for (const [k, v] of recent) if (now - v.t > 60_000) recent.delete(k)
  const r = recent.get(ip)
  if (!r || now - r.t > 60_000) return recent.set(ip, { n: 1, t: now }), true
  return ++r.n <= 30
}

const keyOf = (text: string, target: string) => createHash('sha256').update(`${target}\n${text}`).digest('hex')

async function callGoogle(texts: string[], target: string): Promise<{ text: string; source: string }[]> {
  if (process.env.TRANSLATE_PROVIDER === 'mock') return texts.map((t) => ({ text: `[${target}] ${t}`, source: 'xx' }))
  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(process.env.GOOGLE_TRANSLATE_API_KEY ?? '')}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ q: texts, target, format: 'text', model: 'nmt' }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`translate ${res.status}`)
  const data = (await res.json()) as { data: { translations: { translatedText: string; detectedSourceLanguage?: string }[] } }
  return data.data.translations.map((t) => ({ text: t.translatedText, source: t.detectedSourceLanguage ?? '' }))
}

/** What the reader sees, loaded by the server: published content only, never text sent by the browser. */
async function loadParagraphs(req: PayloadRequest, kind: TranslateKind, id: number, locale: string): Promise<string[] | null> {
  const find = (collection: 'posts' | 'comments' | 'reviews' | 'news' | 'providers') =>
    req.payload.findByID({ collection, id, depth: 0, overrideAccess: true, locale: locale as never, draft: false }).catch(() => null) as Promise<Record<string, unknown> | null>
  const split = (s: unknown) => (typeof s === 'string' ? s.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean) : [])
  if (kind === 'post') {
    const d = await find('posts')
    return d?.status === 'published' ? split(d.body) : null
  }
  if (kind === 'comment') {
    const d = await find('comments')
    return d?.status === 'published' ? split(d.body) : null
  }
  if (kind === 'review') {
    const d = await find('reviews')
    return d?.status === 'published' ? split(d.comment) : null
  }
  if (kind === 'news') {
    const d = await find('news')
    return d && d._status !== 'draft' ? [d.title as string, ...split(d.summary), ...lexicalParagraphs(d.body)].filter(Boolean) : null
  }
  const d = await find('providers')
  return d?.status === 'published' ? split(d.summary) : null
}

export const TranslationCache: CollectionConfig = {
  slug: 'translation-cache',
  admin: { hidden: true },
  access: { read: ({ req }) => isAdmin(req.user), create: () => false, update: () => false, delete: ({ req }) => isAdmin(req.user) },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true },
    { name: 'target', type: 'text', required: true },
    { name: 'source', type: 'text' },
    { name: 'text', type: 'textarea', required: true },
    { name: 'chars', type: 'number', required: true },
  ],
  endpoints: [
    {
      // POST /api/translation-cache/translate {kind, id, locale} → { paragraphs: string[], source }
      path: '/translate',
      method: 'post',
      handler: async (req) => {
        if (!translateEnabled()) return Response.json({ error: 'disabled' }, { status: 404 })
        const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local'
        if (!allow(ip)) return Response.json({ error: 'too_many' }, { status: 429 })
        const body = (await req.json?.().catch(() => null)) as { kind?: string; id?: number; locale?: string } | null
        const kind = body?.kind as TranslateKind
        const id = Number(body?.id)
        if (!TRANSLATE_KINDS.includes(kind) || !Number.isInteger(id) || !isLocale(body?.locale)) return Response.json({ error: 'invalid' }, { status: 400 })
        const target = TRANSLATE_TARGET[body!.locale!]

        const paragraphs = await loadParagraphs(req, kind, id, body!.locale!)
        if (!paragraphs?.length) return Response.json({ error: 'not_found' }, { status: 404 })
        if (paragraphs.join('').length > MAX_TRANSLATE_CHARS) return Response.json({ error: 'too_long' }, { status: 413 })

        const keys = paragraphs.map((p) => keyOf(p, target))
        const { docs } = await req.payload.find({ collection: 'translation-cache', where: { key: { in: keys } }, limit: keys.length, depth: 0, overrideAccess: true })
        const cached = new Map(docs.map((d) => [d.key, d]))
        const missing = paragraphs.filter((_, i) => !cached.has(keys[i]))

        if (missing.length) {
          // Site-wide daily budget, counted from what was actually sent to Google today.
          const since = new Date()
          since.setUTCHours(0, 0, 0, 0)
          const today = await req.payload.find({ collection: 'translation-cache', where: { createdAt: { greater_than_equal: since.toISOString() } }, limit: 0, depth: 0, overrideAccess: true, pagination: false, select: { chars: true } })
          const used = today.docs.reduce((s, d) => s + (d.chars ?? 0), 0)
          const need = missing.reduce((s, p) => s + p.length, 0)
          if (used + need > dailyCharLimit()) return Response.json({ error: 'daily_limit' }, { status: 429 })
          let results: { text: string; source: string }[]
          try {
            results = await callGoogle(missing, target)
          } catch (e) {
            req.payload.logger.error({ msg: 'translation failed', err: e })
            return Response.json({ error: 'failed' }, { status: 502 })
          }
          for (let i = 0; i < missing.length; i++) {
            const doc = await req.payload
              .create({ collection: 'translation-cache', overrideAccess: true, data: { key: keyOf(missing[i], target), target, source: results[i].source, text: results[i].text, chars: missing[i].length } })
              .catch(() => null) // another reader may have just saved the same paragraph
            if (doc) cached.set(doc.key, doc)
            else cached.set(keyOf(missing[i], target), { key: keyOf(missing[i], target), text: results[i].text, source: results[i].source } as never)
          }
        }
        const out = keys.map((k) => cached.get(k)!)
        const source = out.find((d) => d.source)?.source ?? null
        return Response.json({ paragraphs: out.map((d) => d.text), source, target })
      },
    },
  ],
}
