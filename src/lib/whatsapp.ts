/**
 * Send an approved WhatsApp template through Meta's Cloud API.
 * Used for sign-in/mobile codes (authentication template) and new-request alerts (utility template).
 */
export const whatsappConfigured = () => Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)

export async function sendWhatsappTemplate(opts: {
  to: string // E.164
  template: string
  lang?: string
  body?: string[] // values for {{1}}, {{2}} … in the template body
  buttonParam?: string // value for a dynamic URL / copy-code button at index 0
}) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) throw new Error('WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be set')
  const version = process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0'
  const components: unknown[] = []
  if (opts.body?.length) components.push({ type: 'body', parameters: opts.body.map((text) => ({ type: 'text', text })) })
  if (opts.buttonParam) components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: opts.buttonParam }] })
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: opts.to.replace('+', ''),
      type: 'template',
      template: { name: opts.template, language: { code: opts.lang ?? 'en' }, components },
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`WhatsApp send failed: ${res.status} ${detail.slice(0, 300)}`)
  }
}
