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
| `OTP_PROVIDER` | `msg91` (only after TRAI DLT approval) |
| `MSG91_AUTH_KEY` | from MSG91 |
| `MSG91_TEMPLATE_ID` | from MSG91 (DLT-approved OTP template) |
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

## Until DLT is approved

In production, `OTP_PROVIDER=console` refuses to run, so customer sign-in (and therefore sending requests) is blocked until SMS works. Vercel builds every deployment, previews included, with `NODE_ENV=production`, so previews behave the same. Directory, search, provider pages, saved providers, emergency numbers and the admin panel all work.

So start TRAI DLT registration first; it's on the critical path. Test the request flow locally (`npm run dev`, where the code is shown on screen) until then.

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
