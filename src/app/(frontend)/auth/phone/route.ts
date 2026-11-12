import { createCode, payloadClient, phoneVerificationOn, publicUser, userFromRequest } from '@/lib/auth/server'
import { decidePhone } from '@/lib/auth/logic'
import { sendOtp, shouldEchoOtp } from '@/lib/otp'
import { normalizeIndianMobile } from '@/lib/text'
import type { User } from '@/payload-types'

// POST /auth/phone { name, phone } — save the mobile number (mandatory), confirming it by WhatsApp/SMS code when set up.
export async function POST(req: Request) {
  const user = await userFromRequest(req)
  if (!user) return Response.json({ error: 'signin_required' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { name?: string; phone?: string }
  const phone = normalizeIndianMobile(body.phone)
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : ''
  if (!name) return Response.json({ error: 'name_required' }, { status: 400 })
  if (!phone) return Response.json({ error: 'invalid_phone' }, { status: 400 })

  const payload = await payloadClient()
  const holder = (await payload.find({ collection: 'users', where: { phone: { equals: phone } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as User | undefined
  const verify = phoneVerificationOn()
  const decision = decidePhone(user.id, holder ? { id: holder.id, phoneVerified: holder.phoneVerified } : null, verify)
  if (decision.action === 'conflict') return Response.json({ error: 'phone_taken' }, { status: 409 })

  if (!verify) {
    const updated = (await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { name, phone, phoneVerified: false } as never })) as User
    return Response.json({ ok: true, verified: false, user: publicUser(updated) })
  }

  if (name !== user.name) await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { name } as never })
  const r = await createCode(payload, phone, 'verify-phone', user.id)
  if ('error' in r) return Response.json({ error: r.error }, { status: 429 })
  let channel
  try {
    channel = await sendOtp(phone, r.code)
  } catch (err) {
    payload.logger.error({ err }, 'phone verification send failed')
    return Response.json({ error: 'send_failed' }, { status: 502 })
  }
  return Response.json({ ok: true, needsCode: true, channel, ...(shouldEchoOtp() ? { devCode: r.code } : {}) })
}
