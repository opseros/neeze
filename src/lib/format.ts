import { isMayek, language } from '@/i18n/locales'
import { toMeiteiMayek } from './meitei'

/** Dates in the reader's language and script. Meitei Mayek is converted from Intl's Bengali-script Manipuri. */
export function fmtDate(d: string | number | Date, locale: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) {
  const out = new Date(d).toLocaleString(language(locale).intl, { timeZone: 'Asia/Kolkata', ...opts })
  return isMayek(locale) ? toMeiteiMayek(out) : out
}

// CLDR has no relative-time words for Manipuri, so these are ours (Bengali script, converted for Mayek).
const MNI_AGO = { now: 'হৌজিক', minute: 'মিনিট', hour: 'পুং', day: 'নুমিৎ', ago: 'মমাংদা' }

export function relativeTime(iso: string, locale: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(diff)
  if (abs >= 604800) return fmtDate(iso, locale)
  const [n, unit] =
    abs < 60 ? [Math.round(diff), 'second'] : abs < 3600 ? [Math.round(diff / 60), 'minute'] : abs < 86400 ? [Math.round(diff / 3600), 'hour'] : [Math.round(diff / 86400), 'day']
  if (locale.startsWith('mni')) {
    const s = unit === 'second' ? MNI_AGO.now : diff <= 0 ? `${MNI_AGO[unit as 'minute']} ${Math.abs(n as number)} ${MNI_AGO.ago}` : `${MNI_AGO[unit as 'minute']} ${n}`
    return isMayek(locale) ? toMeiteiMayek(s) : s
  }
  return new Intl.RelativeTimeFormat(language(locale).intl, { numeric: 'auto' }).format(n as number, unit as Intl.RelativeTimeFormatUnit)
}
