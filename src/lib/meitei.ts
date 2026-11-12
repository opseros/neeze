/**
 * Bengali-script Manipuri → Meitei Mayek.
 *
 * The Manipuri strings are written once in Bengali script (messages/mni-Beng.json) and converted
 * here, so both scripts always say the same thing. Rules follow the usual Bengali↔Mayek
 * correspondence used in Manipur school books:
 *  - a consonant with no vowel sign at the end of a word is closed → lonsum letter (ꯛ ꯜ ꯝ ꯞ ꯟ ꯠ ꯡ ꯢ)
 *  - a consonant with hasanta (্) is closed → lonsum letter, or the letter + apun (꯭) when it has none
 *  - র/য/ৱ after hasanta form a cluster with the consonant before (প্র → ꯄ꯭ꯔ)
 *  - ই after a vowel (the "oi" in ওইবা) → lonsum ꯢ
 * Anything that isn't Bengali script (Latin brand names, ICU placeholders, punctuation) passes through.
 */

const CONS: Record<string, string> = {
  ক: 'ꯀ', খ: 'ꯈ', গ: 'ꯒ', ঘ: 'ꯘ', ঙ: 'ꯉ',
  চ: 'ꯆ', ছ: 'ꯆ', জ: 'ꯖ', ঝ: 'ꯓ', ঞ: 'ꯅ',
  ট: 'ꯇ', ঠ: 'ꯊ', ড: 'ꯗ', ঢ: 'ꯙ', ণ: 'ꯅ',
  ত: 'ꯇ', থ: 'ꯊ', দ: 'ꯗ', ধ: 'ꯙ', ন: 'ꯅ',
  প: 'ꯄ', ফ: 'ꯐ', ব: 'ꯕ', ভ: 'ꯚ', ম: 'ꯃ',
  য: 'ꯌ', য়: 'ꯌ', র: 'ꯔ', ৰ: 'ꯔ', ল: 'ꯂ', ৱ: 'ꯋ',
  শ: 'ꯁ', ষ: 'ꯁ', স: 'ꯁ', হ: 'ꯍ', ড়: 'ꯔ', ঢ়: 'ꯔ',
}

/** Closed (final) forms. Letters missing here take apun when closed mid-word. */
const LONSUM: Record<string, string> = { 'ꯀ': 'ꯛ', 'ꯂ': 'ꯜ', 'ꯃ': 'ꯝ', 'ꯄ': 'ꯞ', 'ꯅ': 'ꯟ', 'ꯇ': 'ꯠ', 'ꯉ': 'ꯡ', 'ꯏ': 'ꯢ' }

const SIGN: Record<string, string> = { 'া': 'ꯥ', 'ি': 'ꯤ', 'ী': 'ꯤ', 'ু': 'ꯨ', 'ূ': 'ꯨ', 'ে': 'ꯦ', 'ৈ': 'ꯩ', 'ো': 'ꯣ', 'ৌ': 'ꯧ', 'ৃ': 'ꯔꯤ' }

const VOWEL: Record<string, string> = { অ: 'ꯑ', আ: 'ꯑꯥ', ই: 'ꯏ', ঈ: 'ꯏ', উ: 'ꯎ', ঊ: 'ꯎ', ঋ: 'ꯔꯤ', এ: 'ꯑꯦ', ঐ: 'ꯑꯩ', ও: 'ꯑꯣ', ঔ: 'ꯑꯧ' }

const ONSET = new Set(['র', 'য', 'ৱ'])
const HASANTA = '্'
const ZWNJ = '\u200C'
const NUKTA = '়'
const APUN = '꯭'
const isBengali = (ch: string | undefined) => !!ch && ch >= 'ঀ' && ch <= '৿'

export function toMeiteiMayek(input: string): string {
  // ড়/ঢ় (r) and য় (y) come in composed or ড + nukta forms; NFC keeps them decomposed. Fold both to plain letters.
  const s = input
    .normalize('NFC')
    .replace(/[\u09A1\u09A2]\u09BC|[\u09DC\u09DD]/g, 'র')
    .replace(/\u09AF\u09BC|\u09DF/g, 'য')
  const chars = Array.from(s)
  let out = ''
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const next = chars[i + 1]
    if (ch === NUKTA) continue

    const cons = CONS[ch]
    if (cons) {
      if (next === HASANTA) {
        const after = chars[i + 2]
        // Word-initial clusters (ক্লিনিক) and র/য/ৱ after hasanta (প্র → ꯄ꯭ꯔ) are onsets: join with apun.
        // Otherwise the consonant is closed: lonsum when it has one, else apun before the next consonant.
        const wordStart = !isBengali(chars[i - 1])
        if (wordStart || (after && ONSET.has(after))) out += cons + APUN
        else out += LONSUM[cons] ?? (CONS[after ?? ''] ? cons + APUN : cons)
        i++
        continue
      }
      // A ZWNJ after a consonant marks it closed without changing how the Bengali spelling looks
      // (শিল\u200Cচর → ꯁꯤꯜꯆꯔ). A bare consonant at the end of a word is closed too.
      if (next === ZWNJ) {
        out += LONSUM[cons] ?? cons
        i++
        continue
      }
      if (!isBengali(next) || next === '।') {
        out += LONSUM[cons] ?? cons
        continue
      }
      out += cons
      continue
    }

    if (ch === 'ৎ') { out += 'ꯠ'; continue }
    if (ch === 'ং') { out += 'ꯡ'; continue }
    if (ch === 'ঁ') { out += 'ꯪ'; continue }
    if (ch === 'ঃ') continue
    if (ch === HASANTA) continue
    if (ch === '।' || ch === '॥') { out += '꯫'; continue }

    const sign = SIGN[ch]
    if (sign) { out += sign; continue }

    const vowel = VOWEL[ch]
    if (vowel) {
      const prev = chars[i - 1]
      const afterVowel = !!prev && (SIGN[prev] !== undefined || VOWEL[prev] !== undefined)
      out += ch === 'ই' && afterVowel ? 'ꯢ' : vowel
      continue
    }

    const d = ch.charCodeAt(0) - 0x09e6
    if (d >= 0 && d <= 9) { out += String.fromCharCode(0xabf0 + d); continue }

    out += ch
  }
  return out
}

/** Bengali-script source → the form shown to Bengali-script readers (no word-final hasanta, no closure marks). */
export function toBengaliManipuri(input: string): string {
  return input.normalize('NFC').replace(/\u200C/g, '').replace(/্(?=$|[^\u0980-\u09FF])/g, '')
}

/** Convert every string in a nested messages object. */
export function mapMessages<T>(obj: T, fn: (s: string) => string): T {
  if (typeof obj === 'string') return fn(obj) as T
  if (Array.isArray(obj)) return obj.map((v) => mapMessages(v, fn)) as T
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, mapMessages(v, fn)])) as T
  }
  return obj
}
