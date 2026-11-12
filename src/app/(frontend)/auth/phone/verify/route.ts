import { checkCode, payloadClient, publicUser, userFromRequest } from '@/lib/auth/server'
import { decidePhone } from '@/lib/auth/logic'
import { normalizeIndianMobile } from '@/lib/text'
import type { User } from '@/payload-types'

// POST /auth/phone/verify { phone, code }
export async function POST(req: Request) {
  const user = await userFromRequest(req)
  if (!user) return Response.json({ error: 'signin_required' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { phone?: string; code?: string }
  const phone = normalizeIndianMobile(body.phone)
  const code = String(body.code ?? '').trim()
  if (!phone || !/^\d{6}$/.test(code)) return Response.json({ error: 'invalid_input' }, { status: 400 })

  const payload = await payloadClient()
  const r = await checkCode(payload, phone, 'verify-phone', code, user.id)
  if ('error' in r) return Response.json({ error: r.error }, { status: r.error === 'too_many_attempts' ? 429 : 400 })

  const holder = (await payload.find({ collection: 'users', where: { phone: { equals: phone } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as User | undefined
  const decision = decidePhone(user.id, holder ? { id: holder.id, phoneVerified: holder.phoneVerified } : null, true)
  if (decision.action === 'conflict') return Response.json({ error: 'phone_taken' }, { status: 409 })
  if (decision.action === 'take-over') {
    // The other account only typed this number and never proved it; the person who proves it keeps it.
    await payload.update({ collection: 'users', id: decision.fromUserId, overrideAccess: true, data: { phone: null, phoneVerified: false } as never })
  }
  const updated = (await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { phone, phoneVerified: true } as never })) as User
  return Response.json({ ok: true, user: publicUser(updated) })
}
