import { sql } from '@payloadcms/db-postgres'

import { getPayloadClient } from '@/lib/server'

export const dynamic = 'force-dynamic'

/** For uptime monitors: 200 when the app and database answer, 503 otherwise. Reveals nothing else. */
export async function GET() {
  const started = Date.now()
  try {
    const payload = await getPayloadClient()
    await payload.db.drizzle.execute(sql`select 1`)
    return Response.json({ ok: true, ms: Date.now() - started }, { headers: { 'cache-control': 'no-store' } })
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
}
