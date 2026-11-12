import { Check, X } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'

const FLOW = ['submitted', 'contacted', 'quoted', 'accepted', 'in-progress', 'completed'] as const
const BAD = new Set(['cancelled', 'rejected', 'expired'])

type H = { status?: string | null; at?: string | null }

/** Request progress as a stepper; dates come from the request's own history. */
export async function StatusTimeline({ status, history, compact = false, audience = 'customer' }: { status: string; history?: H[] | null; compact?: boolean; audience?: 'customer' | 'provider' }) {
  const t = await getTranslations(audience === 'provider' ? 'dash.status' : 'me.status')
  const locale = await getLocale()
  const when = (s: string) => (history ?? []).filter((h) => h.status === s).at(-1)?.at
  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString(locale === 'bn' ? 'bn-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : null)
  const reached = new Set((history ?? []).map((h) => h.status ?? ''))
  reached.add('submitted')
  const ended = BAD.has(status)
  const current = FLOW.indexOf(status as (typeof FLOW)[number])
  const lastReached = Math.max(current, ...FLOW.map((s, i) => (reached.has(s) ? i : -1)))
  const steps = ended ? [...FLOW.slice(0, Math.max(1, lastReached + 1)), status] : FLOW

  return (
    <ol className={`grid gap-0 ${compact ? 'text-xs' : 'text-sm'}`}>
      {steps.map((s, i) => {
        const done = ended ? true : i <= lastReached
        const isBad = BAD.has(s)
        const isLast = i === steps.length - 1
        return (
          <li key={s} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast && <span className={`absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-0.5 ${done && !isBad ? 'bg-brand-teal' : 'bg-line'}`} aria-hidden />}
            <span
              className={`relative z-10 grid size-6 shrink-0 place-items-center rounded-full ${isBad ? 'bg-red-600 text-white' : done ? 'bg-brand-teal text-white' : 'border-2 border-line bg-white'}`}
              aria-hidden
            >
              {isBad ? <X className="size-3.5" /> : done ? <Check className="size-3.5" /> : null}
            </span>
            <span className="min-w-0 pt-0.5">
              <span className={`block font-medium ${done ? 'text-ink' : 'text-muted'}`}>{t(s as 'submitted')}</span>
              {fmt(when(s) ?? (s === 'submitted' ? undefined : null)) && <span className="block text-muted">{fmt(when(s))}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
