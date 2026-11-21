/**
 * Machine translation for user and editor text (Google Cloud Translation, NMT).
 * Pure helpers are unit-tested in tests/translate.test.ts; the API call and cache live in
 * collections/TranslationCache.ts.
 */

/** Google language code for each reader language. Bengali-script Manipuri readers get Bengali (Google writes Manipuri only in Meitei Mayek). */
export const TRANSLATE_TARGET: Record<string, string> = { en: 'en', bn: 'bn', 'mni-Beng': 'bn', 'mni-Mtei': 'mni-Mtei' }

export const TRANSLATE_KINDS = ['post', 'comment', 'review', 'news', 'provider'] as const
export type TranslateKind = (typeof TRANSLATE_KINDS)[number]

/** In-page translation through the Cloud Translation API (needs a key). */
export const translateEnabled = () => process.env.TRANSLATE_PROVIDER === 'mock' || Boolean(process.env.GOOGLE_TRANSLATE_API_KEY)

/** Without a key, Translate opens Google's free translate.google.com in a new tab instead. */
export type TranslateMode = 'api' | 'link'
export const translateMode = (): TranslateMode => (translateEnabled() ? 'api' : 'link')

/** translate.google.com keeps the text in the address, so keep it well under browser URL limits. */
export function googleTranslateLink(text: string, locale: string): string {
  const tl = TRANSLATE_TARGET[locale] ?? 'en'
  let t = text.trim()
  if (encodeURIComponent(t).length > 4500) {
    while (encodeURIComponent(t).length > 4400) t = t.slice(0, Math.floor(t.length * 0.9))
    t = t.replace(/\s+\S*$/, '') + ' …'
  }
  return `https://translate.google.com/?sl=auto&tl=${encodeURIComponent(tl)}&op=translate&text=${encodeURIComponent(t)}`
}

/** Characters per day across the site before the button pauses (default stays inside Google's free 500k/month). */
export const dailyCharLimit = () => Number(process.env.TRANSLATE_DAILY_CHAR_LIMIT) || 15000

function scriptShare(text: string) {
  let latin = 0, bengali = 0, mayek = 0, letters = 0
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) latin++
    else if (c >= 0x0980 && c <= 0x09ff) bengali++
    else if ((c >= 0xabc0 && c <= 0xabff) || (c >= 0xaae0 && c <= 0xaaff)) mayek++
    else continue
    letters++
  }
  return { latin: latin / (letters || 1), bengali: bengali / (letters || 1), mayek: mayek / (letters || 1), letters }
}

/**
 * Offer "Translate" only when the text isn't already in the reader's script. A good-enough test for
 * Neeze's languages (English, Bengali, Manipuri) without calling the API: Bengali-script Manipuri and
 * Bengali share a script, and readers of one read the other.
 */
export function needsTranslation(text: string | null | undefined, locale: string): boolean {
  if (!text?.trim()) return false
  const s = scriptShare(text)
  if (s.letters < 3) return false
  if (locale === 'en') return s.latin < 0.6
  if (locale === 'mni-Mtei') return s.mayek < 0.5
  return s.bengali < 0.5 // bn, mni-Beng
}

/** Rich-text (Lexical) → plain paragraphs. */
export function lexicalParagraphs(data: unknown): string[] {
  const out: string[] = []
  const walk = (n: { type?: string; text?: string; children?: unknown[] }, acc: string[]) => {
    if (typeof n?.text === 'string') acc.push(n.text)
    for (const c of n?.children ?? []) walk(c as never, acc)
  }
  const root = (data as { root?: { children?: unknown[] } })?.root
  const push = (n: unknown) => {
    const acc: string[] = []
    walk(n as never, acc)
    const t = acc.join('').trim()
    if (t) out.push(t)
  }
  for (const block of (root?.children ?? []) as { type?: string; children?: unknown[] }[]) {
    if (block.type === 'list') (block.children ?? []).forEach(push) // one line per list item
    else push(block)
  }
  return out
}

export const MAX_TRANSLATE_CHARS = 6000
