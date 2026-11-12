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

export type OtpSender = (phone: string, code: string) => Promise<void>

/** Console sender for development. Production must use a DLT-registered SMS provider. */
const consoleSender: OtpSender = async (phone, code) => {
  console.info(`[otp] ${phone} → ${code}`)
}

/**
 * MSG91 OTP sender. Requires TRAI DLT registration of the entity, sender header and the
 * OTP template before messages deliver. Kept as a thin adapter so the provider can change.
 */
const msg91Sender: OtpSender = async (phone, code) => {
  const authkey = process.env.MSG91_AUTH_KEY
  const template = process.env.MSG91_TEMPLATE_ID
  if (!authkey || !template) throw new Error('MSG91_AUTH_KEY and MSG91_TEMPLATE_ID must be set')
  const res = await fetch('https://control.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: { authkey, 'content-type': 'application/json' },
    body: JSON.stringify({ template_id: template, mobile: phone.replace('+', ''), otp: code }),
  })
  if (!res.ok) throw new Error(`OTP send failed: ${res.status}`)
}

export function getOtpSender(): OtpSender {
  const provider = process.env.OTP_PROVIDER ?? 'console'
  if (provider === 'msg91') return msg91Sender
  if (process.env.NODE_ENV === 'production') throw new Error('OTP_PROVIDER=console is not allowed in production')
  return consoleSender
}

export const shouldEchoOtp = () => process.env.NODE_ENV !== 'production' && process.env.OTP_DEV_ECHO === 'true'
