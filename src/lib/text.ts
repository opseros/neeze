/**
 * Normalise text for search so "Taraapur", "tarapur " and "TARAPUR" match,
 * and Bengali/Assamese input is compared in a consistent Unicode form.
 */
export function normalizeForSearch(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[̀-ͯ]/g, '') // Latin diacritics
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ') // keep letters (incl. Bengali vowel signs), digits, spaces
    .replace(/(.)\1+/gu, '$1') // collapse doubled letters: "taraapur" → "tarapur"
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildSearchText(parts: Array<string | null | undefined>): string {
  return Array.from(new Set(parts.map(normalizeForSearch).filter(Boolean))).join(' ')
}

/** Indian mobile number → E.164 (+91XXXXXXXXXX), or null if it is not a valid mobile number. */
export function normalizeIndianMobile(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits
  if (!/^[6-9]\d{9}$/.test(local)) return null
  return `+91${local}`
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
