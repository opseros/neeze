import { startOAuth } from '@/lib/auth/server'
import { safeReturnTo } from '@/lib/auth/logic'

// GET /auth/google?next=/request/12  →  redirect to Google / Microsoft
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  const url = new URL(req.url)
  const next = safeReturnTo(url.searchParams.get('next'))
  if (provider !== 'google' && provider !== 'microsoft') return new Response('Not found', { status: 404 })
  const started = startOAuth(provider, next)
  if (!started) return Response.redirect(new URL(`/signin?error=disabled&next=${encodeURIComponent(next)}`, url), 302)
  return new Response(null, { status: 302, headers: { Location: started.url, 'Set-Cookie': started.cookie, 'Cache-Control': 'no-store' } })
}
