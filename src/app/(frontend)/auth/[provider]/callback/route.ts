import { LINK_COOKIE, OAUTH_COOKIE, finishOAuth, sessionCookieFor, signInWithIdentity } from '@/lib/auth/server'
import { cookieHeader } from '@/lib/session'

// GET /auth/google/callback?code=…&state=…
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  const url = new URL(req.url)
  if (provider !== 'google' && provider !== 'microsoft') return new Response('Not found', { status: 404 })
  const clearState = cookieHeader(OAUTH_COOKIE, null, 0)
  const redirect = (to: string, cookies: string[] = []) => {
    const h = new Headers({ Location: new URL(to, url).toString(), 'Cache-Control': 'no-store' })
    for (const c of [clearState, ...cookies]) h.append('Set-Cookie', c)
    return new Response(null, { status: 302, headers: h })
  }

  // User pressed "cancel" at Google/Microsoft
  if (url.searchParams.get('error')) return redirect('/signin?error=cancelled')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return redirect('/signin?error=state')

  const result = await finishOAuth(provider, code, state, req.headers.get('cookie'))
  if ('error' in result) return redirect(`/signin?error=${result.error}`)

  const outcome = await signInWithIdentity(result.identity)
  if ('verifyEmail' in outcome) {
    const q = new URLSearchParams({ step: 'email', reason: 'verify', next: result.returnTo, ...(outcome.email ? { email: outcome.email } : {}) })
    return redirect(`/signin?${q}`, [outcome.linkCookie])
  }
  const user = outcome.user
  if (user.suspended) return redirect('/signin?error=suspended')
  const next = user.phone ? result.returnTo : `/account/complete?next=${encodeURIComponent(result.returnTo)}`
  return redirect(next, [sessionCookieFor(user), cookieHeader(LINK_COOKIE, null, 0)])
}
