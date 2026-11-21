import { describe, expect, it } from 'vitest'

import { lexicalParagraphs, needsTranslation } from '../src/lib/translate'

describe('when to offer Translate', () => {
  it('English readers: offered for Bengali or Meitei text only', () => {
    expect(needsTranslation('তারাপুরে ভালো দর্জি কে আছেন?', 'en')).toBe(true)
    expect(needsTranslation('ꯅꯨꯡꯉꯥꯏꯕ ꯅꯨꯃꯤꯠ', 'en')).toBe(true)
    expect(needsTranslation('Any good tailor near Tarapur?', 'en')).toBe(false)
  })
  it('Bengali and Bengali-script Manipuri readers: offered for English or Meitei Mayek', () => {
    expect(needsTranslation('Water supply off on Sunday', 'bn')).toBe(true)
    expect(needsTranslation('রবিবার জল বন্ধ', 'bn')).toBe(false)
    expect(needsTranslation('রবিবার জল বন্ধ', 'mni-Beng')).toBe(false)
    expect(needsTranslation('ꯅꯨꯡꯉꯥꯏꯕ ꯅꯨꯃꯤꯠ', 'mni-Beng')).toBe(true)
  })
  it('Meitei Mayek readers: offered unless the text is in Meitei Mayek', () => {
    expect(needsTranslation('রবিবার জল বন্ধ', 'mni-Mtei')).toBe(true)
    expect(needsTranslation('ꯅꯨꯡꯉꯥꯏꯕ ꯅꯨꯃꯤꯠ', 'mni-Mtei')).toBe(false)
  })
  it('a few brand words or numbers in the other script do not trigger it', () => {
    expect(needsTranslation('Neeze কমিউনিটিতে স্বাগত! শিলচরের প্রতিবেশীদের প্রশ্ন করুন', 'bn')).toBe(false)
    expect(needsTranslation('ok 👍', 'bn')).toBe(false)
    expect(needsTranslation('', 'en')).toBe(false)
  })
})

describe('rich text to paragraphs', () => {
  it('extracts one string per block', () => {
    const doc = { root: { children: [
      { type: 'paragraph', children: [{ text: 'Hello ' }, { text: 'world' }] },
      { type: 'heading', children: [{ text: 'Title' }] },
      { type: 'paragraph', children: [] },
      { type: 'list', children: [{ type: 'listitem', children: [{ text: 'one' }] }, { type: 'listitem', children: [{ text: 'two' }] }] },
    ] } }
    expect(lexicalParagraphs(doc)).toEqual(['Hello world', 'Title', 'one', 'two'])
    expect(lexicalParagraphs(null)).toEqual([])
  })
})
