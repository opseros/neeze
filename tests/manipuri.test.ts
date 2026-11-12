import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { mapMessages, toBengaliManipuri, toMeiteiMayek } from '../src/lib/meitei'

const msg = (f: string) => JSON.parse(readFileSync(path.resolve(__dirname, '../messages', f), 'utf8'))
const keys = (o: unknown, p = ''): string[] =>
  o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k)) : [p]
const placeholders = (s: string) => (s.match(/\{\w+(?=[},])|<\/?\w+>/g) ?? []).sort()

describe('Meitei Mayek conversion', () => {
  it.each([
    ['মণিপুর', 'ꯃꯅꯤꯄꯨꯔ'],
    ['মৈতৈলোন', 'ꯃꯩꯇꯩꯂꯣꯟ'],
    ['কাংলৈপাক', 'ꯀꯥꯡꯂꯩꯄꯥꯛ'],
    ['থাগৎচরি', 'ꯊꯥꯒꯠꯆꯔꯤ'],
    ['ওইবা', 'ꯑꯣꯢꯕꯥ'],
    ['নহাক্কী', 'ꯅꯍꯥꯛꯀꯤ'],
    ['থম্লবা', 'ꯊꯝꯂꯕꯥ'],
    ['প্রাইভেসি', 'ꯄ꯭ꯔꯥꯢꯚꯦꯁꯤ'],
    ['য়ুম', 'ꯌꯨꯝ'],
    ['ক্লিনিক', 'ꯀ꯭ꯂꯤꯅꯤꯛ'],
    ['গাড়ি', 'ꯒꯥꯔꯤ'],
    ['গা\u09DCি', 'ꯒꯥꯔꯤ'],
    ['১০', '꯱꯰'],
    ['শিল\u200Cচর।', 'ꯁꯤꯜꯆꯔ꯫'],
    ['ফোন\u200Cদা', 'ꯐꯣꯟꯗꯥ'],
  ])('%s → %s', (bn, mtei) => expect(toMeiteiMayek(bn)).toBe(mtei))

  it('leaves Latin text, ICU syntax and tags alone', () => {
    expect(toMeiteiMayek('Google-গা {count, plural, other {স্টার {count}}} <terms>x</terms>')).toBe(
      'Google-ꯒꯥ {count, plural, other {ꯁ꯭ꯇꯥꯔ {count}}} <terms>x</terms>',
    )
  })

  it('drops only word-final hasanta for Bengali-script readers', () => {
    expect(toBengaliManipuri('থম্লবা হন্বা নহাক্ শিল\u200Cচর')).toBe('থম্লবা হন্বা নহাক শিলচর')
  })
})

describe('Manipuri message files', () => {
  const en = msg('en.json')
  const src = msg('source/mni.json')

  it('source has exactly the English keys', () => expect(keys(src).sort()).toEqual(keys(en).sort()))

  it('keeps every placeholder and tag of the English string', () => {
    const flat = (o: Record<string, unknown>) => Object.fromEntries(keys(o).map((k) => [k, k.split('.').reduce<any>((a, p) => a[p], o)]))
    const e = flat(en)
    const m = flat(src)
    for (const k of Object.keys(e)) {
      for (const p of new Set(placeholders(e[k]))) expect(m[k], k).toContain(p)
    }
  })

  it('generated files are up to date (run: npx tsx scripts/gen-manipuri.ts)', () => {
    expect(msg('mni-Beng.json')).toEqual(mapMessages(src, toBengaliManipuri))
    expect(msg('mni-Mtei.json')).toEqual(mapMessages(src, toMeiteiMayek))
  })

  it('Meitei Mayek file has no Bengali letters left', () => {
    expect(JSON.stringify(msg('mni-Mtei.json'))).not.toMatch(/[ঀ-৿]/)
  })
})
