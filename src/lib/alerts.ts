/**
 * Server error alerts by email (Resend), so the team hears about crashes without another vendor.
 * Set ALERT_EMAIL to turn on. Each distinct error is mailed at most once an hour per server instance.
 */

const sent = new Map<string, number>()
const HOUR = 3600_000

export function alertKey(message: string, path: string) {
  // Group "same error, different id" together: strip numbers and long hex.
  return `${path.replace(/\d+/g, ':n')}|${message.replace(/[0-9a-f]{8,}/gi, '…').replace(/\d+/g, 'n')}`.slice(0, 300)
}

export function shouldSend(key: string, now = Date.now()) {
  for (const [k, t] of sent) if (now - t > HOUR) sent.delete(k)
  if (sent.has(key) || sent.size > 200) return false
  sent.set(key, now)
  return true
}

export async function sendErrorAlert(err: unknown, info: { path: string; method: string; kind?: string }) {
  const to = process.env.ALERT_EMAIL
  const key = process.env.RESEND_API_KEY
  if (!to || !key || process.env.NODE_ENV !== 'production') return
  const e = err instanceof Error ? err : new Error(String(err))
  const digest = (err as { digest?: string })?.digest
  if (!shouldSend(alertKey(e.message, info.path))) return
  const host = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ?? 'neeze'
  // Path only, never the query string: it can carry search text or codes.
  const text = [
    `${info.method} ${info.path}${info.kind ? ` (${info.kind})` : ''}`,
    `Error: ${e.message}`,
    digest ? `Digest: ${digest} (search Vercel → Logs for it)` : '',
    `Deployment: ${process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local'} · ${new Date().toISOString()}`,
    '',
    (e.stack ?? '').split('\n').slice(0, 12).join('\n'),
  ]
    .filter(Boolean)
    .join('\n')
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: `Neeze alerts <${process.env.EMAIL_FROM ?? 'no-reply@opseros.com'}>`, to: to.split(',').map((s) => s.trim()), subject: `[Neeze] ${e.message.slice(0, 80)} — ${host}`, text }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => null)
}
