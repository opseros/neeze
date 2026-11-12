import { LINK_COOKIE, addIdentity, checkCode, createUser, findByEmail, payloadClient, publicUser, sessionCookieFor } from '@/lib/auth/server'
import { normalizeEmail } from '@/lib/auth/logic'
import type { User } from '@/payload-types'
import { cookieHeader, readCookie, verifyValue } from '@/lib/session'

// POST /auth/email/verify { email, code, name? }
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; code?: string; name?: string }
  const email = normalizeEmail(body.email)
  const code = String(body.code ?? '').trim()
  if (!email || !/^\d{6}$/.test(code)) return Response.json({ error: 'invalid_input' }, { status: 400 })

  const payload = await payloadClient()
  const r = await checkCode(payload, email, 'email-login', code)
  if ('error' in r) return Response.json({ error: r.error }, { status: r.error === 'too_many_attempts' ? 429 : 400 })

  let user = (await findByEmail(payload, email)) as User | null
  if (user?.suspended) return Response.json({ error: 'suspended' }, { status: 403 })
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : undefined
  // A Microsoft work account whose email had to be confirmed first: link it now that the email is proven.
  const pending = verifyValue<{ provider: string; subject: string; name: string }>('link', readCookie(req.headers.get('cookie'), LINK_COOKIE))

  if (!user) {
    user = await createUser(payload, { email, name: name || pending?.name || null, identities: pending ? [{ provider: pending.provider, subject: pending.subject }] : [] })
  } else {
    if (!user.emailVerified) user = (await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { emailVerified: true } as never })) as User
    if (pending) user = await addIdentity(payload, user, { provider: pending.provider, subject: pending.subject })
  }

  const h = new Headers({ 'content-type': 'application/json' })
  h.append('Set-Cookie', sessionCookieFor(user))
  if (pending) h.append('Set-Cookie', cookieHeader(LINK_COOKIE, null, 0))
  return new Response(JSON.stringify({ ok: true, user: publicUser(user) }), { status: 200, headers: h })
}
