import { createHmac, randomInt, timingSafeEqual } from 'crypto'

export const OTP_TTL_MS = 5 * 60 * 1000
export const OTP_MAX_ATTEMPTS = 5
export const OTP_RESEND_GAP_MS = 60 * 1000
export const OTP_MAX_PER_HOUR = 5

export const generateOtp = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

/** Only a keyed hash is stored, never the code itself (blueprint section 11). */
export function hashOtp(phone: string, code: string): string {
  const key = process.env.SESSION_SECRET ?? ''
  return createHmac('sha256', key).update(`${phone}:${code}`).digest('hex')
}

export function otpMatches(phone: string, code: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtp(phone, code), 'hex')
  const b = Buffer.from(storedHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export type OtpChannel = 'whatsapp' | 'sms' | 'console'
export type OtpSender = (phone: string, code: string) => Promise<void>

/** Console sender for development only. */
const consoleSender: OtpSender = async (phone, code) => {
  console.info(`[otp] ${phone} → ${code}`)
}

/**
 * WhatsApp via Meta's Cloud API, using an approved *authentication* template with a
 * "copy code" button. No TRAI DLT registration needed. Requires a Meta-verified business,
 * a WhatsApp Business phone number, and the template approved in WhatsApp Manager.
 */
export const whatsappSender: OtpSender = async (phone, code) => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const template = process.env.WHATSAPP_OTP_TEMPLATE
  if (!token || !phoneNumberId || !template) {
    throw new Error('WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_OTP_TEMPLATE must be set')
  }
  const version = process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0'
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone.replace('+', ''),
      type: 'template',
      template: {
        name: template,
        language: { code: process.env.WHATSAPP_OTP_TEMPLATE_LANG ?? 'en' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
        ],
      },
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`WhatsApp OTP send failed: ${res.status} ${detail.slice(0, 300)}`)
  }
}

/**
 * MSG91 SMS OTP. Requires TRAI DLT registration of the entity, sender header and the
 * OTP template before messages deliver.
 */
export const msg91Sender: OtpSender = async (phone, code) => {
  const authkey = process.env.MSG91_AUTH_KEY
  const template = process.env.MSG91_TEMPLATE_ID
  if (!authkey || !template) throw new Error('MSG91_AUTH_KEY and MSG91_TEMPLATE_ID must be set')
  const res = await fetch('https://control.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: { authkey, 'content-type': 'application/json' },
    body: JSON.stringify({ template_id: template, mobile: phone.replace('+', ''), otp: code }),
  })
  if (!res.ok) throw new Error(`SMS OTP send failed: ${res.status}`)
}

const SENDERS: Record<string, { channel: OtpChannel; send: OtpSender }> = {
  whatsapp: { channel: 'whatsapp', send: whatsappSender },
  msg91: { channel: 'sms', send: msg91Sender },
  console: { channel: 'console', send: consoleSender },
}

/**
 * OTP_PROVIDER picks the main channel (whatsapp | msg91 | console).
 * OTP_FALLBACK (optional) is tried if the main one fails, e.g. whatsapp → msg91 once DLT is approved.
 * Returns the channel that actually delivered, so the UI can say "sent on WhatsApp" or "sent by SMS".
 */
export async function sendOtp(phone: string, code: string): Promise<OtpChannel> {
  const primary = process.env.OTP_PROVIDER ?? 'console'
  const fallback = process.env.OTP_FALLBACK
  if (process.env.NODE_ENV === 'production' && (primary === 'console' || fallback === 'console')) {
    throw new Error('OTP_PROVIDER=console is not allowed in production')
  }
  const main = SENDERS[primary]
  if (!main) throw new Error(`Unknown OTP_PROVIDER "${primary}"`)
  try {
    await main.send(phone, code)
    return main.channel
  } catch (err) {
    const backup = fallback ? SENDERS[fallback] : undefined
    if (!backup || backup === main) throw err
    console.warn(`[otp] ${primary} failed, trying ${fallback}:`, (err as Error).message)
    await backup.send(phone, code)
    return backup.channel
  }
}

export const shouldEchoOtp = () => process.env.NODE_ENV !== 'production' && process.env.OTP_DEV_ECHO === 'true'
