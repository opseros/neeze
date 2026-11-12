import type { PayloadRequest } from 'payload'

import type { Provider, Request as Req, User } from '@/payload-types'
import { sendWhatsappTemplate, whatsappConfigured } from './whatsapp'

const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

const STATUS_TEXT: Record<string, { en: string; bn: string }> = {
  contacted: { en: 'The provider has contacted you', bn: 'পরিষেবাদাতা আপনার সঙ্গে যোগাযোগ করেছেন' },
  quoted: { en: 'You have a quote', bn: 'আপনি দাম জানতে পেরেছেন' },
  accepted: { en: 'Agreed: work is confirmed', bn: 'সম্মত: কাজ নিশ্চিত হয়েছে' },
  'in-progress': { en: 'Work has started', bn: 'কাজ শুরু হয়েছে' },
  completed: { en: 'Marked as completed', bn: 'সম্পন্ন হিসেবে চিহ্নিত' },
  rejected: { en: 'The provider declined this request', bn: 'পরিষেবাদাতা অনুরোধটি গ্রহণ করেননি' },
  cancelled: { en: 'The request was cancelled', bn: 'অনুরোধটি বাতিল হয়েছে' },
}

function email(subject: string, lines: string[], link: string, linkLabel: string) {
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#14212e;max-width:520px">${lines
    .map((l) => `<p>${l}</p>`)
    .join('')}<p><a href="${link}" style="display:inline-block;background:#173B62;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:600">${linkLabel}</a></p><p style="color:#5a6b7b;font-size:13px">Neeze · Silchar</p></div>`
  return { subject, html, text: `${lines.join('\n\n')}\n\n${link}` }
}

async function safe(label: string, req: PayloadRequest, fn: () => Promise<unknown>) {
  try {
    await fn()
  } catch (err) {
    req.payload.logger.warn({ err }, `notify: ${label} failed`)
  }
}

/** New request → every owner of the listing: in-app + email, and WhatsApp to the listing's number if configured. */
export async function notifyNewRequest(req: PayloadRequest, doc: Req) {
  const provider = (await req.payload.findByID({ collection: 'providers', id: typeof doc.provider === 'object' ? doc.provider.id : doc.provider, depth: 0, overrideAccess: true }).catch(() => null)) as Provider | null
  if (!provider) return
  const ownerIds = ((provider.owners ?? []) as (number | User)[]).map((o) => (typeof o === 'object' ? o.id : o))
  const link = `/provider/requests/${doc.id}`
  const data = { code: doc.code, providerName: provider.name, contactName: doc.contactName, urgent: doc.urgency === 'urgent' }

  for (const userId of ownerIds) {
    await safe('in-app', req, () =>
      req.payload.create({ collection: 'notifications', overrideAccess: true, req, data: { user: userId, kind: 'new-request', request: doc.id, data, link } }),
    )
    const owner = (await req.payload.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true }).catch(() => null)) as User | null
    if (owner?.email) {
      const e = email(
        `${doc.urgency === 'urgent' ? 'URGENT · ' : ''}New request ${doc.code} · নতুন অনুরোধ`,
        [
          `<b>${doc.contactName}</b> sent a request to <b>${provider.name}</b>: “${String(doc.description).slice(0, 200)}”`,
          `${doc.contactName} ${provider.name}-কে একটি অনুরোধ পাঠিয়েছেন। দয়া করে তাড়াতাড়ি কল করুন।`,
        ],
        `${site()}${link}`,
        'Open request · অনুরোধ খুলুন',
      )
      await safe('email', req, () => req.payload.sendEmail({ to: owner.email!, ...e }))
    }
  }

  const template = process.env.WHATSAPP_ALERT_TEMPLATE
  const to = provider.whatsapp || provider.phone
  if (template && whatsappConfigured() && to?.startsWith('+91')) {
    await safe('whatsapp', req, () =>
      sendWhatsappTemplate({
        to,
        template,
        lang: process.env.WHATSAPP_ALERT_TEMPLATE_LANG ?? 'en',
        // Template body e.g. "New Neeze request {{1}} from {{2}}: {{3}}"
        body: [String(doc.code), String(doc.contactName), String(doc.description).slice(0, 120).replace(/\s+/g, ' ')],
        buttonParam: String(doc.id), // URL button: https://neeze.opseros.com/provider/requests/{{1}}
      }),
    )
  }
}

/** Status changed → the other party: customer hears about provider updates; owners hear about customer cancellations/acceptances. */
export async function notifyStatusChange(req: PayloadRequest, doc: Req, from: string, actor: 'customer' | 'provider' | 'staff' | 'system') {
  const to = doc.status ?? ''
  const providerId = typeof doc.provider === 'object' ? doc.provider.id : doc.provider
  const provider = (await req.payload.findByID({ collection: 'providers', id: providerId, depth: 0, overrideAccess: true }).catch(() => null)) as Provider | null
  const data = { code: doc.code, providerName: provider?.name ?? '', from, status: to, quote: doc.quoteNote ?? null }

  if (actor !== 'customer' && doc.customer) {
    const customerId = typeof doc.customer === 'object' ? doc.customer.id : doc.customer
    await safe('in-app', req, () =>
      req.payload.create({ collection: 'notifications', overrideAccess: true, req, data: { user: customerId, kind: 'request-update', request: doc.id, data, link: '/me' } }),
    )
    const customer = (await req.payload.findByID({ collection: 'users', id: customerId, depth: 0, overrideAccess: true }).catch(() => null)) as User | null
    const txt = STATUS_TEXT[to]
    if (customer?.email && txt) {
      const e = email(
        `${txt.en} · ${doc.code}`,
        [`<b>${provider?.name ?? 'Your provider'}</b>: ${txt.en}.${doc.quoteNote && to === 'quoted' ? `<br>“${doc.quoteNote}”` : ''}`, `${txt.bn}।`],
        `${site()}/me`,
        'View request · অনুরোধ দেখুন',
      )
      await safe('email', req, () => req.payload.sendEmail({ to: customer.email!, ...e }))
    }
  }

  if (actor === 'customer' && provider) {
    for (const o of (provider.owners ?? []) as (number | User)[]) {
      const ownerId = typeof o === 'object' ? o.id : o
      await safe('in-app', req, () =>
        req.payload.create({ collection: 'notifications', overrideAccess: true, req, data: { user: ownerId, kind: 'request-update', request: doc.id, data, link: `/provider/requests/${doc.id}` } }),
      )
    }
  }
}
