# Deploying Neeze: Vercel + Neon + Cloudflare R2

One Vercel project runs everything (screens, API, admin). Neon holds the data. R2 holds photos.

**Initial domain: `https://neeze.opseros.com`.** Photos: `https://neeze-media.opseros.com`.

| Piece | Service | Region |
| --- | --- | --- |
| App (Next.js + Payload) | Vercel | Mumbai `bom1` (set in `vercel.json`) |
| Database | Neon Postgres | Closest available to India. Check the list when creating the project; the region can't be changed later |
| Photos | Cloudflare R2 | Automatic; served from Cloudflare's CDN |

## 1. Neon

1. Create a project in the region closest to Mumbai.
2. Copy the **pooled** connection string (host contains `-pooler`). It looks like
   `postgresql://user:pass@ep-xxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require`.
3. Optional: create a `dev` branch in Neon for testing, so you never point local dev at production data.

## 2. Cloudflare R2

1. **R2 → Create bucket**, e.g. `neeze-media`.
2. **Bucket → Settings → Custom domain**: connect `neeze-media.opseros.com`. This needs `opseros.com` to be a zone in the same Cloudflare account. If its DNS is elsewhere, either move the DNS to Cloudflare or use a different domain that is on Cloudflare. Don't use the `r2.dev` URL in production; Cloudflare rate-limits it.
3. **R2 → Manage API tokens → Create token** with *Object Read & Write* on that bucket only. Note the Access Key ID, Secret Access Key and your Account ID.
4. **Bucket → Settings → CORS policy**. Phones upload straight to R2 (Vercel limits request bodies to about 4.5 MB), so allow your site:

```json
[
  {
    "AllowedOrigins": ["https://neeze.opseros.com", "https://*.vercel.app"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

Remove the `*.vercel.app` line if you don't need uploads on preview deployments.

## 3. Vercel

1. Push this repo to GitHub, then **Vercel → Add New → Project → Import**. Framework: Next.js. Vercel automatically uses the `vercel-build` script (`payload migrate && next build --webpack`), so migrations run once per deploy.
2. **Settings → Environment Variables** (Production; copy to Preview with a Neon branch URL if you use previews). Names are exactly as below: capital letters, digits and underscores only.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string |
| `PAYLOAD_SECRET` | `openssl rand -hex 32` |
| `SESSION_SECRET` | another `openssl rand -hex 32` |
| `NEXT_PUBLIC_SITE_URL` | `https://neeze.opseros.com` (no trailing slash) |
| `GOOGLE_CLIENT_ID` | see "Sign-in" below |
| `GOOGLE_CLIENT_SECRET` | see "Sign-in" below |
| `MICROSOFT_CLIENT_ID` | see "Sign-in" below |
| `MICROSOFT_CLIENT_SECRET` | see "Sign-in" below |
| `RESEND_API_KEY` | for email codes, see "Sign-in" below |
| `EMAIL_FROM` | `neeze@opseros.com` |
| `PHONE_VERIFICATION` | `off` for now (see "Mobile number check") |
| `OTP_PROVIDER` | leave unset for now; `whatsapp` later, for the mobile check |
| `WHATSAPP_ALERT_TEMPLATE` | `neeze_new_request` (optional provider alerts, see below) |
| `R2_BUCKET` | `neeze-media` |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | from the R2 token |
| `R2_SECRET_ACCESS_KEY` | from the R2 token |
| `R2_PUBLIC_URL` | `https://neeze-media.opseros.com` |

Do **not** set `OTP_DEV_ECHO` in production (it's ignored there anyway).

3. Deploy. Then **Settings → Domains** → add `neeze.opseros.com`, and in your DNS add the record Vercel shows (usually `CNAME neeze → cname.vercel-dns.com`).
   If `opseros.com` DNS is on Cloudflare, set that record to **DNS only (grey cloud)**. Proxying through Cloudflare in front of Vercel breaks Vercel's SSL certificate issuance and adds a second cache.
4. Seed once from your machine against production (localities, categories, emergency numbers, first admin). **No `SEED_DEMO` in production**:

```bash
DATABASE_URL='<neon pooled url>' PAYLOAD_SECRET='<same as Vercel>' SESSION_SECRET='<same>' \
NODE_ENV=production SEED_ADMIN_EMAIL=you@opseros.com SEED_ADMIN_PASSWORD='<strong password>' npm run seed
```

5. Open `https://neeze.opseros.com/admin`, sign in and change the password.

   If that email already signed in on the site (Google, Microsoft or email code), the seed keeps the account and its history, adds the super-admin role and sets the `/admin` password. Running it again with a new password resets the admin password.

## Sign-in: Google, Microsoft and email

People sign in with **Google**, **Microsoft** or **an emailed 6-digit code**. Every account must add a **mobile number** before sending a request. The number is unique, so one number can't be on two accounts. The same verified email always lands in the same account, whichever way the person signs in.

Only the buttons you configure are shown; email works on its own.

### Google

1. console.cloud.google.com → create a project "Neeze".
2. **APIs & Services → OAuth consent screen**: External; app name *Neeze*; support email; authorised domain `opseros.com`; scopes `openid`, `email`, `profile`. Then **Publish app**. These basic scopes don't need Google's security review. Adding a logo does trigger a brand check.
3. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorised JavaScript origin: `https://neeze.opseros.com`
   - Authorised redirect URI: `https://neeze.opseros.com/auth/google/callback`
   - For local testing, also add `http://localhost:3000/auth/google/callback`.
4. Copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### Microsoft

1. entra.microsoft.com → **App registrations → New registration**: name *Neeze*; account types **"Accounts in any organizational directory and personal Microsoft accounts"**; redirect URI (Web) `https://neeze.opseros.com/auth/microsoft/callback`.
2. **Certificates & secrets → New client secret**. Note the expiry date and put a reminder in the calendar: sign-in stops when it expires.
3. **Token configuration → Add optional claim → ID**: tick `email` and `xms_edov`.
4. Copy *Application (client) ID* → `MICROSOFT_CLIENT_ID` and the secret *value* → `MICROSOFT_CLIENT_SECRET`. Leave `MICROSOFT_TENANT` unset (it defaults to `common`).
5. Optional: Microsoft *publisher verification*. Without it, the consent screen says "unverified".

For work and school Microsoft accounts whose email domain Microsoft hasn't verified, Neeze asks for an email code once before linking. This stops anyone claiming someone else's email address through a self-made tenant.

### Email codes (Resend)

1. resend.com → **Domains → Add** `opseros.com` → add the DNS records it shows (SPF, DKIM) → wait for *Verified*.
2. **API keys → Create** → `RESEND_API_KEY`.
3. `EMAIL_FROM` = an address on that domain, e.g. `neeze@opseros.com`.

Resend has a free tier; check its current monthly limit against your expected sign-ins. Without `RESEND_API_KEY`, production refuses email sign-in instead of failing silently.

### Mobile number check

**Off by default.** Accounts are already proven through Google, Microsoft or an email code. The mobile number is required and unique (one number per account), but it isn't confirmed by a code.

If a number is already on another account, the second person sees "This number is already linked to another account". If that's a genuine mix-up, an admin can clear the number from the wrong account in Admin → Users.

To confirm numbers by WhatsApp/SMS code later, set up `OTP_PROVIDER` (below) and add `PHONE_VERIFICATION=on`.

## Mobile verification codes: WhatsApp

Only needed if you turn on the mobile number check (`PHONE_VERIFICATION=on`). WhatsApp needs no TRAI DLT registration: you need a verified Meta business and one approved template.

1. **Meta Business verification**: business.facebook.com → Security Centre → Start verification. Have the company PAN/GST and a website on the same name ready. Register under the Indian entity so India's domestic authentication rate applies.
2. **WhatsApp Business Account + phone number**: developers.facebook.com → Create app (Business) → add *WhatsApp*. Add a phone number that is **not** already on the WhatsApp app (a new SIM or landline works), and verify it.
3. **Authentication template**: WhatsApp Manager → Message templates → Create → category **Authentication** → *Copy code* button → name it `neeze_login_code`, language English. Meta generates the wording; approval is usually quick.
4. **Permanent token**: Business settings → Users → System users → add one with *Admin* role → assign the WhatsApp app and account → Generate token with `whatsapp_business_messaging` and `whatsapp_business_management`. Temporary tokens from the app dashboard expire in 24 hours.
5. **Vercel variables**:

| Variable | Value |
| --- | --- |
| `OTP_PROVIDER` | `whatsapp` |
| `WHATSAPP_ACCESS_TOKEN` | the system user token |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp → API setup → *Phone number ID* (not the phone number itself) |
| `WHATSAPP_OTP_TEMPLATE` | `neeze_login_code` |
| `WHATSAPP_OTP_TEMPLATE_LANG` | `en` |

6. Add a payment method in WhatsApp Manager. Until business verification is done, Meta caps new accounts at a low daily message limit.

**New-request alerts to providers (optional, recommended).** Create a second template in WhatsApp Manager:

- Category **Utility**, name `neeze_new_request`, language English.
- Body: `New Neeze request {{1}} from {{2}}: {{3}}`.
- Button: *Visit website*, dynamic URL `https://neeze.opseros.com/provider/requests/{{1}}`.

Then set `WHATSAPP_ALERT_TEMPLATE=neeze_new_request`. Each new request then also goes to the listing's WhatsApp number (or its phone if that's a mobile). Owners always get an in-app notification and an email, WhatsApp or not.

**Later, add SMS as a backup** for people without WhatsApp: finish DLT, set the MSG91 variables and `OTP_FALLBACK=msg91`. If WhatsApp can't deliver, the same code goes by SMS, and the screen says which.

`OTP_PROVIDER=console` refuses to run in production. Leave `OTP_PROVIDER` unset until WhatsApp is ready; numbers are then saved without a code.

## Speed

Public pages read from Next.js's data cache, not the database. A warm page makes zero database queries; an admin save clears the affected cache straight away. What's left:

- **Neon free tier pauses after a few idle minutes.** The first visit afterwards waits for it to wake (often about a second). On a paid plan you can turn off scale-to-zero for the production branch.
- **Database distance.** Vercel runs in Mumbai; Neon's nearest region may be Singapore. Only cache misses and signed-in pages (requests, My account) pay that round trip.
- **Cold starts.** The first request to a new serverless instance starts the app; later ones are fast.

## Schema changes

```bash
npm run migrate:create <name>     # against your dev database
git add src/migrations && git commit
```

The next deploy applies it automatically.

## Checks after the first deploy

- [ ] Admin → Providers → a listing → *Owners*: add your own account, send yourself a request, check the alert email and /provider
- [ ] Sign in with Google, then Microsoft, then an email code using the same address: all three land in one account
- [ ] `/manifest.webmanifest` loads, and Chrome on Android offers "Add to Home screen"
- [ ] Upload a photo in Admin → Media; its URL starts with `https://neeze-media.opseros.com/media/`
- [ ] Turn on airplane mode after visiting a provider: Saved and Emergency pages still open
- [ ] Neon dashboard → Backups: confirm point-in-time restore is on for your plan; do one test restore

## Moving to a different domain later (e.g. neeze.in)

The browser ties a PWA to its exact domain. When you move:

- People who installed the app from `neeze.opseros.com` must install it again from the new domain.
- Saved providers and any queued requests are stored on the phone per domain, so they don't carry over. Sign-in cookies don't either, so users sign in again.
- Keep `neeze.opseros.com` running with a permanent (308) redirect to the new domain for a few months, and show a "We've moved" banner (Admin → Site settings → Alert banner) for a while before you switch.
- Update `NEXT_PUBLIC_SITE_URL`, the R2 CORS origin and, if you like, `R2_PUBLIC_URL`. Old photo URLs keep working as long as the old media domain stays connected to the bucket.

Moving early, before many installs, costs much less than moving later.
