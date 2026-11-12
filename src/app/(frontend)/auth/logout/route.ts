import { sessionCookieHeader } from '@/lib/session'

export async function POST() {
  const h = new Headers({ 'content-type': 'application/json' })
  h.append('Set-Cookie', sessionCookieHeader(null))
  h.append('Set-Cookie', 'payload-token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: h })
}
