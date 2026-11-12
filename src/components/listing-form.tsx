'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Opt = { id: number; name: string }
type Initial = {
  id?: number
  name?: string
  nameBn?: string | null
  type?: string
  category?: number
  summary?: string | null
  baseLocality?: number
  serviceLocalities?: number[]
  phone?: string
  whatsapp?: string | null
  address?: string | null
  acceptsRequests?: boolean | null
}

const TYPES = ['service-professional', 'business', 'doctor', 'clinic', 'hospital', 'diagnostic', 'school', 'gym', 'hotel', 'bus-operator'] as const

export function ListingForm({ categories, localities, initial }: { categories: (Opt & { group: string })[]; localities: Opt[]; initial?: Initial }) {
  const t = useTranslations('listing')
  const router = useRouter()
  const editing = Boolean(initial?.id)
  const [f, setF] = useState({
    name: initial?.name ?? '',
    nameBn: initial?.nameBn ?? '',
    type: initial?.type ?? 'service-professional',
    category: initial?.category ? String(initial.category) : '',
    summary: initial?.summary ?? '',
    baseLocality: initial?.baseLocality ? String(initial.baseLocality) : '',
    serviceLocalities: new Set<number>(initial?.serviceLocalities ?? []),
    phone: (initial?.phone ?? '').replace('+91', ''),
    whatsapp: (initial?.whatsapp ?? '').replace('+91', ''),
    address: initial?.address ?? '',
    acceptsRequests: initial?.acceptsRequests ?? true,
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const groups = [...new Set(categories.map((c) => c.group))]

  const submit = async () => {
    setBusy(true)
    setMsg(null)
    const body = {
      name: f.name,
      nameBn: f.nameBn || null,
      type: f.type,
      categories: [Number(f.category)],
      summary: f.summary || null,
      baseLocality: Number(f.baseLocality),
      serviceLocalities: [...f.serviceLocalities],
      phone: f.phone,
      whatsapp: f.whatsapp || null,
      address: f.address || null,
      acceptsRequests: f.acceptsRequests,
    }
    const res = await fetch(editing ? `/api/providers/${initial!.id}` : '/api/providers', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    }).catch(() => null)
    setBusy(false)
    const data = await res?.json().catch(() => ({}))
    if (!res?.ok) return setMsg({ ok: false, text: data?.errors?.[0]?.data?.errors?.[0]?.message ?? data?.errors?.[0]?.message ?? 'Error' })
    setMsg({ ok: true, text: editing ? t('savedEdit') : t('submitted') })
    if (!editing) setTimeout(() => router.push('/provider'), 1200)
    else router.refresh()
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field sm:col-span-2">
          <span>{t('name')}</span>
          <input className="input" required maxLength={120} value={f.name} onChange={set('name')} />
        </label>
        <label className="field">
          <span>{t('nameBn')}</span>
          <input className="input" maxLength={120} lang="bn" value={f.nameBn} onChange={set('nameBn')} />
        </label>
        <label className="field">
          <span>{t('type')}</span>
          <select className="input" value={f.type} onChange={set('type')}>
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`types.${ty}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field sm:col-span-2">
          <span>{t('category')}</span>
          <select className="input" required value={f.category} onChange={set('category')}>
            <option value="" disabled>
              —
            </option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {categories
                  .filter((c) => c.group === g)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="field sm:col-span-2">
          <span>{t('summary')}</span>
          <textarea className="input" rows={3} maxLength={300} value={f.summary} onChange={set('summary')} placeholder={t('summaryHint')} />
        </label>
        <label className="field">
          <span>{t('phone')}</span>
          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-line bg-surface px-3 py-2.5 text-muted">+91</span>
            <input className="input flex-1" required inputMode="numeric" maxLength={14} value={f.phone} onChange={set('phone')} />
          </div>
        </label>
        <label className="field">
          <span>{t('whatsapp')}</span>
          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-line bg-surface px-3 py-2.5 text-muted">+91</span>
            <input className="input flex-1" inputMode="numeric" maxLength={14} value={f.whatsapp} onChange={set('whatsapp')} />
          </div>
        </label>
        <label className="field sm:col-span-2">
          <span>{t('baseArea')}</span>
          <select className="input" required value={f.baseLocality} onChange={set('baseLocality')}>
            <option value="" disabled>
              —
            </option>
            {localities.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">{t('serviceAreas')}</legend>
        <div className="flex flex-wrap gap-2">
          {localities.map((l) => {
            const on = f.serviceLocalities.has(l.id)
            return (
              <label key={l.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition ${on ? 'border-brand-blue bg-brand-blue/10 font-medium text-brand-navy' : 'border-line bg-white text-ink hover:bg-surface'}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() => {
                    const s = new Set(f.serviceLocalities)
                    if (on) s.delete(l.id)
                    else s.add(l.id)
                    setF({ ...f, serviceLocalities: s })
                  }}
                />
                {l.name}
              </label>
            )
          })}
        </div>
      </fieldset>

      <label className="field">
        <span>{t('address')}</span>
        <textarea className="input" rows={2} maxLength={300} value={f.address} onChange={set('address')} />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" className="size-4 accent-brand-navy" checked={f.acceptsRequests} onChange={(e) => setF({ ...f, acceptsRequests: e.target.checked })} />
        {t('acceptsRequests')}
      </label>
      {msg && (
        <p role="status" className={`rounded-lg p-3 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>
          {msg.text}
        </p>
      )}
      <button type="submit" className="btn-primary sm:justify-self-start sm:px-8" disabled={busy}>
        {editing ? t('submitEdit') : t('submitNew')}
      </button>
    </form>
  )
}
