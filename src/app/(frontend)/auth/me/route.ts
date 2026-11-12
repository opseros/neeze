import { enabledProviders, publicUser, userFromRequest } from '@/lib/auth/server'

export async function GET(req: Request) {
  const user = await userFromRequest(req)
  return Response.json({ user: user ? publicUser(user) : null, providers: enabledProviders() }, { headers: { 'Cache-Control': 'no-store' } })
}
