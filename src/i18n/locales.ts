/** Languages the site offers. Safe to import from client components. */
export const LANGUAGES = [
  { code: 'bn', label: 'বাংলা', short: 'বাংলা', hint: 'Bengali', intl: 'bn-IN' },
  { code: 'en', label: 'English', short: 'EN', hint: 'English', intl: 'en-IN' },
  // Manipuri (Meitei). Same text in two scripts: messages/source/mni.json → scripts/gen-manipuri.ts.
  { code: 'mni-Mtei', label: 'ꯃꯩꯇꯩꯂꯣꯟ', short: 'ꯃꯩꯇꯩ', hint: 'Manipuri · Meitei Mayek', intl: 'mni-Beng-IN' },
  { code: 'mni-Beng', label: 'মৈতৈলোন', short: 'মৈতৈ', hint: 'Manipuri · Bengali script', intl: 'mni-Beng-IN' },
] as const

export type Locale = (typeof LANGUAGES)[number]['code']
export const LOCALES = LANGUAGES.map((l) => l.code) as Locale[]
export const DEFAULT_LOCALE: Locale = 'bn'
export const LOCALE_COOKIE = 'NEXT_LOCALE'

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale)
export const language = (code: string) => LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[1]

/** Readers of Bengali script see a provider's Bengali name when it has one. */
export const usesBengaliNames = (code: string) => code === 'bn' || code === 'mni-Beng'
export const isMayek = (code: string) => code === 'mni-Mtei'
