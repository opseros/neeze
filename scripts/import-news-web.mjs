#!/usr/bin/env node
/**
 * Import drafted news through the live site's API, as DRAFTS. No database access or secrets needed:
 * you sign in with an admin/editor account.
 *
 *   npm run import-news:web
 *   npm run import-news:web -- data/news-drafts-2026-11-21.json https://neeze.opseros.com
 *
 * Asks for the email and password (password is not shown). Stories whose slug already exists are skipped.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

const args = process.argv.slice(2)
const site = (args.find((a) => a.startsWith('http')) ?? process.env.NEEZE_SITE ?? 'https://neeze.opseros.com').replace(/\/$/, '')
const fileArg = args.find((a) => a.endsWith('.json'))
const files = fileArg ? [path.resolve(fileArg)] : readdirSync('data').filter((f) => /^news-drafts-.*\.json$/.test(f)).map((f) => path.resolve('data', f))
const LOCALES = ['en', 'bn', 'mni-Beng', 'mni-Mtei']

function ask(q, hidden = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  if (hidden) rl._writeToOutput = (s) => rl.output.write(s.includes(q) ? s : '*')
  return new Promise((ok) => rl.question(q, (a) => (rl.close(), hidden && process.stdout.write('\n'), ok(a.trim()))))
}

const lexical = (paras) => ({
  root: {
    type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
    children: paras.map((text) => ({
      type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0,
      children: [{ type: 'text', text, format: 0, mode: 'normal', style: '', detail: 0, version: 1 }],
    })),
  },
})

async function api(method, url, token, body) {
  const res = await fetch(site + url, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `JWT ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${data?.errors?.[0]?.message ?? ''}`)
  return data
}

console.log(`Importing to ${site} from ${files.map((f) => path.basename(f)).join(', ')}`)
const email = process.env.NEEZE_ADMIN_EMAIL || (await ask('Admin email: '))
const password = process.env.NEEZE_ADMIN_PASSWORD || (await ask('Password: ', true))
const { token } = await api('POST', '/api/users/login', null, { email, password }).catch((e) => {
  console.error(`Sign-in failed: ${e.message}`)
  process.exit(1)
})

let created = 0
for (const file of files) {
  for (const d of JSON.parse(readFileSync(file, 'utf8'))) {
    const found = await api('GET', `/api/news?where[slug][equals]=${encodeURIComponent(d.slug)}&draft=true&limit=1&depth=0`, token)
    if (found.docs?.[0]?.id) {
      console.log(`skip (exists): ${d.slug}`)
      continue
    }
    const { doc } = await api('POST', '/api/news?locale=en&draft=true', token, {
      slug: d.slug,
      section: d.section,
      featured: Boolean(d.featured),
      byline: d.byline ?? 'Neeze Editor',
      title: d.title.en,
      summary: d.summary.en,
      body: lexical(d.body.en),
      sources: d.sources ?? [],
      publishedAt: new Date().toISOString(),
      _status: 'draft',
    })
    for (const l of LOCALES.slice(1)) {
      if (!d.title[l]) continue
      await api('PATCH', `/api/news/${doc.id}?locale=${encodeURIComponent(l)}&draft=true`, token, { title: d.title[l], summary: d.summary[l], body: lexical(d.body[l] ?? []) })
    }
    created++
    console.log(`draft: ${d.title.en}`)
  }
}
console.log(`\nImported ${created} draft stories. Review and publish them in ${site}/admin/collections/news`)
