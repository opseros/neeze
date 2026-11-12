import { createCode, payloadClient } from '@/lib/auth/server'
import { normalizeEmail } from '@/lib/auth/logic'
import { shouldEchoOtp } from '@/lib/otp'
import { readCookie } from '@/lib/session'

const TEXT = {
  en: { subject: (c: string) => `${c} is your Neeze sign-in code`, line: 'Your Neeze sign-in code is', expiry: 'It expires in 5 minutes. If you did not ask for it, ignore this email.' },
  bn: { subject: (c: string) => `${c} — আপনার নিজি সাইন-ইন কোড`, line: 'আপনার নিজি সাইন-ইন কোড', expiry: 'কোডটি ৫ মিনিট বৈধ। আপনি না চাইলে এই ইমেলটি উপেক্ষা করুন।' },
}

// POST /auth/email/start { email }
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string }
  const email = normalizeEmail(body.email)
  if (!email) return Response.json({ error: 'invalid_email' }, { status: 400 })
  if (process.env.NODE_ENV === 'production' && !process.env.RESEND_API_KEY) {
    return Response.json({ error: 'email_not_configured' }, { status: 503 })
  }
  const payload = await payloadClient()
  const r = await createCode(payload, email, 'email-login')
  if ('error' in r) return Response.json({ error: r.error }, { status: 429 })

  const t = readCookie(req.headers.get('cookie'), 'NEXT_LOCALE') === 'en' ? TEXT.en : TEXT.bn
  try {
    await payload.sendEmail({
      to: email,
      subject: t.subject(r.code),
      text: `${t.line}: ${r.code}\n\n${t.expiry}`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:16px;color:#14212e"><p>${t.line}:</p><p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#173B62">${r.code}</p><p style="color:#5a6b7b">${t.expiry}</p><p style="color:#5a6b7b">Neeze · Silchar</p></div>`,
    })
  } catch (err) {
    payload.logger.error({ err }, 'sign-in email failed')
    return Response.json({ error: 'send_failed' }, { status: 502 })
  }
  return Response.json({ ok: true, ...(shouldEchoOtp() ? { devCode: r.code } : {}) })
}
