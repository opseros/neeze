# Neeze App

*Everything local, connected.* A Silchar-first local discovery and services PWA, in Bengali and English.

This repo is **Sprint 1 + the core request flow** from the Neeze blueprint, built on the stack recommended in the blueprint review: **one Next.js app with Payload CMS inside it**, on Postgres, installable as a PWA.

## What works today

| Area | Status |
| --- | --- |
| Languages: বাংলা, English, Manipuri (Meitei) in Meitei Mayek and in Bengali script; picker on first visit, in the header and on My account; saved in a cookie | Done |
| Home: search, area picker, category tiles, Neeze Services, emergency tile | Done |
| Search: names, Bengali names, categories, keywords, misspelt localities ("taraapur electrician") | Done (P0 `ILIKE` search; move to `pg_trgm` ranking later) |
| Provider profile: Call, WhatsApp, verification label, services, areas, hours, map link | Done |
| Service / appointment request form; sign-in asked only when sending, typed details kept across sign-in | Done |
| Sign-in: Google, Microsoft, email code; one account per verified email; mandatory unique mobile number (code check optional: `PHONE_VERIFICATION=on`) | Done |
| My account: my requests with status, cancel with reason | Done |
| Offline: saved providers, emergency numbers, offline page, **queued requests sent on reconnect** (idempotent) | Done |
| Install prompt (after first save/request), iOS hint, "new version, refresh" bar | Done |
| Admin panel at `/admin`: providers, requests, categories, localities, news, media, users, audit log, site settings (alert banner, emergency numbers) | Done (Payload) |
| RBAC + ownership checks on every collection; audit log for role, verification, status overrides | Done |
| Editor-only news with drafts, versions and a visible correction log | Done |
| Provider dashboard at /provider: new / in-progress / finished requests, customer call + WhatsApp, quote, status steps, decline with reason | Done |
| "List your business": providers add and edit their own listings; new ones wait for admin review | Done |
| Notifications: in-app bell + email both ways; WhatsApp alert to providers when a template is set | Done |
| Verified reviews: only after a completed job, one per job, 60-day window; average shown from 3 reviews; provider reply; report + auto-hide at 3 reports | Done |
| P1 listings: schools, gyms, hotels, bus operators with an enquiry flow; switch each category on in Admin → Categories | Done |
| Community: posts with optional photo by topic and area, comments, "helpful", report, block; new members' first post reviewed (Admin setting); rules page; 5 posts / 30 comments / 20 reports a day | Done |
| One report queue (Admin → Community → Reports & corrections) for posts, comments, news corrections and wrong listing details; reporter is told the outcome | Done |
| Assamese | Later: add it to `src/i18n/locales.ts`, `localization.locales` and `messages/as.json` |

## Run it locally

Needs Node 20.9+ and Postgres 16.

```bash
docker compose up -d                      # or use a local Postgres
cp .env.example .env                      # then set PAYLOAD_SECRET and SESSION_SECRET (openssl rand -hex 32)
npm install
SEED_DEMO=true SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='choose-a-strong-one' npm run seed
npm run dev                               # http://localhost:3000, admin at /admin
```

In dev, sign-in and mobile codes are printed in the server log and shown on screen (`OTP_DEV_ECHO=true`). This is ignored when `NODE_ENV=production`.

`SEED_DEMO=true` adds four listings named "Demo … (sample)" with fake `+91 00000…` numbers. **Don't use it in production.**

## Tests

```bash
npm test                                  # unit tests: roles, status transitions, search text, phones, session, OTP
BASE=http://localhost:3000 scripts/smoke-test.sh   # 119 API checks against a running dev server seeded with demo data
```

The smoke test covers community (review queue, privacy of authors, reports, auto-hide, blocks, restrictions, limits, photo ownership), all four languages, reviews (who may write, one per job, privacy, replies, reports), the provider flow (alerts, quote, accept, complete, notifications both ways), email sign-in, the mandatory mobile number, duplicate-account prevention, rate limits, privilege escalation, cross-user access (IDOR), idempotent submits, the request lifecycle, hidden unpublished listings and search.

## Deploy

Vercel + Neon + Cloudflare R2: step-by-step in [DEPLOY.md](DEPLOY.md). Short version:

- Vercel runs the whole app in Mumbai (`vercel.json`), and `vercel-build` runs migrations and then builds.
- `DATABASE_URL` is Neon's pooled connection string.
- Photos go to R2 when `R2_BUCKET` is set and are served from your R2 custom domain. Locally they stay in `./media`.
- Elsewhere (a VM, Render, Railway): `npm run build && npm start`. Migrations run on start.

## Code map

```
src/
  payload.config.ts          collections, locales (en, bn, mni-Mtei, mni-Beng), Postgres
  access/roles.ts            roles, staff check, who may grant which role
  collections/
    Users.ts                 roles, mobile, linked Google/Microsoft identities, session strategy
    Providers.ts             listings for services, businesses, doctors, clinics; owner + staff-only fields
    Requests.ts              service/appointment requests, status rules, idempotent /api/requests/submit
    Places.ts                localities (with aliases) and categories
    Content.ts               media, news, site settings (alert banner, emergency numbers, community posting mode)
    Community.ts             posts, comments, reports queue, moderator restrictions; helpful/report endpoints
    System.ts                OTP challenges (hashed), audit logs
  lib/auth/                  sign-in rules (logic.ts, unit tested) and OAuth/email/phone helpers
  app/(frontend)/auth/       /auth/google, /auth/microsoft, /auth/email/*, /auth/phone/*, /auth/logout
  app/(frontend)/provider/   provider dashboard, request detail, listing form
  lib/notify.ts              in-app, email and WhatsApp alerts for requests
  lib/community.ts           community rules: who goes live, limits, report reasons (unit tested)
  app/(frontend)/community/  feed, post, write/edit, rules
  lib/                       search, text normalisation, session cookie, OTP, status machine, IndexedDB, R2 storage
  app/(frontend)/            the PWA screens
  app/(payload)/             admin panel + REST API (generated by Payload)
  app/sw.ts                  service worker caching rules (Serwist)
  app/manifest.ts            web app manifest
messages/en.json, bn.json    all UI text, by key (Manipuri: messages/source/mni.json)
scripts/                     smoke test, icon generator
```

## How a provider gets access

1. They sign in and use **List your business** (or the admin creates the listing).
2. Admin → Providers → the listing: check details, set *Status* to *published*, set the *Verification* label to match what was checked, and make sure their account is in *Owners*.
3. They see requests at **/provider** and get an email and in-app alert for each one.

## Moderating reviews

Admin → Reviews. Sort by *Report count*. A review reported by 3 different people is hidden automatically until you look at it; set *Status* back to *published* if it's fair. Hiding or deleting a review updates the provider's rating straight away.

## Moderating the community

Admin → **Community**:

- **Posts**: filter *Status* = *pending* for the review queue. Set *published* to approve, or *hidden* / *removed* with a *Moderation note* (the author sees it). Tick *Comments locked* to stop a thread.
- **Reports & corrections**: one queue for posts, comments, news corrections and wrong listing details. Open the *Link*, act on the item, then set *resolved* or *dismissed* with a short *Resolution*; the reporter is notified. Hiding or removing a post closes its open reports automatically.
- **Restricted accounts**: stop someone posting, commenting and reporting until a date. Admins can suspend an account outright in People → Users.

Posts and comments reported by 3 different people hide themselves until a moderator looks. Posts with more than one link always wait for review. Who may post without review: Admin → Site settings → Community (*open*, *first post reviewed* (default), *every post reviewed*). Every moderator action is in the Audit log.

Moderators need the *moderator* role; editors see news corrections and listing reports.

## Switching on P1 categories

Admin → Categories → School / Gym / Hotel / Bus operator → tick *Active*. The category appears on the home page and in search once it's active; list providers with the matching *Type*.

## Manipuri (Meitei)

Manipuri is written once, in Bengali script, in `messages/source/mni.json`. A script makes both files the site uses:

```bash
npx tsx scripts/gen-manipuri.ts   # → messages/mni-Beng.json (Bengali script) + messages/mni-Mtei.json (Meitei Mayek)
```

Edit only the source file, then run the script; `npm test` fails if the two files are out of date. The converter (`src/lib/meitei.ts`) follows the school-book Bengali ↔ Meitei Mayek letter table. One rule to know when editing: a consonant that **closes a syllable in the middle of a word** needs a mark, or Meitei Mayek gets an open syllable. Use hasanta (`থম্লবা`) or, to keep the Bengali spelling unchanged, an invisible ZWNJ (`শিল\u200Cচর` → ꯁꯤꯜꯆꯔ). Word-final consonants are closed automatically.

Content (category names, news, site settings) has a Manipuri field per script in Admin; use the language switch at the top of each document. Blank fields fall back: Bengali-script Manipuri → Bengali → English; Meitei Mayek → English. Launch categories and locality names are filled in by the migration.

## Before launch: checklist

- [ ] Native speaker review of `messages/bn.json` and the brand name in Bengali (নিজি)
- [ ] Moderation rota and response time for community reports; set the grievance email in Admin → Site settings (shown on /community/rules)
- [ ] Legal review of the community rules (`messages/*.json` → `community.rulesList`)
- [ ] Native Meitei speaker review of `messages/source/mni.json` (and both scripts on a phone), category names in Admin, and the emergency-number labels in both Manipuri locales
- [ ] Verify the seeded locality list and Bengali spellings on the ground (`src/seed/index.ts`)
- [ ] Add verified local hospital and helpline numbers in Admin → Site settings
- [ ] Google + Microsoft app registrations and Resend domain (DEPLOY.md → Sign-in)
- [ ] Real Terms of Service and Privacy Policy text on /terms and /privacy (placeholders now)
- [ ] Optional later: WhatsApp template + `OTP_PROVIDER=whatsapp` + `PHONE_VERIFICATION=on` to confirm mobile numbers by code
- [ ] Optional: TRAI DLT + MSG91 as SMS backup (`OTP_FALLBACK=msg91`)
- [ ] R2 bucket, custom domain and CORS (see DEPLOY.md); DB backups with one restore test
- [ ] Privacy policy, terms, grievance contact (see blueprint section 15)
- [ ] Change the default admin password; add 2FA for staff accounts (Payload has no built-in TOTP, so use a plugin or SSO)
