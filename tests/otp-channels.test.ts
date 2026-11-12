import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sendOtp } from '../src/lib/otp'

const env = { ...process.env }

beforeEach(() => {
  process.env.WHATSAPP_ACCESS_TOKEN = 'tok'
  process.env.WHATSAPP_PHONE_NUMBER_ID = '123'
  process.env.WHATSAPP_OTP_TEMPLATE = 'neeze_login_code'
  process.env.MSG91_AUTH_KEY = 'k'
  process.env.MSG91_TEMPLATE_ID = 't'
})
afterEach(() => {
  process.env = { ...env }
  vi.unstubAllGlobals()
})

describe('WhatsApp OTP', () => {
  it('sends an authentication template with the code in body and copy-code button', async () => {
    process.env.OTP_PROVIDER = 'whatsapp'
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await sendOtp('+919876543210', '482913')).toBe('whatsapp')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/^https:\/\/graph\.facebook\.com\/v[\d.]+\/123\/messages$/)
    expect(init.headers.authorization).toBe('Bearer tok')
    const body = JSON.parse(init.body)
    expect(body.to).toBe('919876543210')
    expect(body.template.name).toBe('neeze_login_code')
    expect(body.template.components[0].parameters[0].text).toBe('482913')
    expect(body.template.components[1]).toMatchObject({ type: 'button', sub_type: 'url', index: '0' })
  })

  it('falls back to SMS when WhatsApp fails', async () => {
    process.env.OTP_PROVIDER = 'whatsapp'
    process.env.OTP_FALLBACK = 'msg91'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('not on whatsapp', { status: 400 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await sendOtp('+919876543210', '111222')).toBe('sms')
    expect(fetchMock.mock.calls[1][0]).toContain('msg91.com')
  })

  it('throws when WhatsApp fails and there is no fallback', async () => {
    process.env.OTP_PROVIDER = 'whatsapp'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('err', { status: 500 })))
    await expect(sendOtp('+919876543210', '111222')).rejects.toThrow(/WhatsApp send failed/)
  })

  it('refuses the console sender in production', async () => {
    process.env.OTP_PROVIDER = 'console'
    ;(process.env as Record<string, string>).NODE_ENV = 'production'
    await expect(sendOtp('+919876543210', '111222')).rejects.toThrow(/not allowed in production/)
  })
})
