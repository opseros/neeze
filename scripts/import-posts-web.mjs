#!/usr/bin/env node
/**
 * Post the Neeze Team's starter community posts through the live site's API.
 * Sign in with a moderator or admin account; posts appear as "Neeze Team" with the official badge.
 *
 *   node scripts/import-posts-web.mjs
 *   node scripts/import-posts-web.mjs data/community-posts-starter.json https://neeze.opseros.com
 *
 * Posts already on the site are brought up to date instead of posted again (for example, an older
 * two-language post becomes Bengali text + English translation). Safe to run any number of times.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

const args = process.argv.slice(2)
const site = (args.find((a) => a.startsWith('http')) ?? process.env.NEEZE_SITE ?? 'https://neeze.opseros.com').replace(/\/$/, '')
const file = path.resolve(args.find((a) => a.endsWith('.json')) ?? 'data/community-posts-starter.json')

function ask(q, hidden = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  if (hidden) rl._writeToOutput = (s) => rl.output.write(s.includes(q) ? s : '*')
  return new Promise((ok) => rl.question(q, (a) => (rl.close(), hidden && process.stdout.write('\n'), ok(a.trim()))))
}

async function api(method, url, token, body) {
  const res = await fetch(site + url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `JWT ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${data?.errors?.[0]?.message ?? data?.error ?? ''}`)
  return data
}

console.log(`Posting to ${site} from ${path.basename(file)}`)
const email = process.env.NEEZE_ADMIN_EMAIL || (await ask('Admin or moderator email: '))
const password = process.env.NEEZE_ADMIN_PASSWORD || (await ask('Password: ', true))
const { token } = await api('POST', '/api/users/login', null, { email, password }).catch((e) => {
  console.error(`Sign-in failed: ${e.message}`)
  process.exit(1)
})

// Oldest first, so the welcome post is the first one people ever saw.
const posts = JSON.parse(readFileSync(file, 'utf8'))
let created = 0
let updated = 0
for (const p of posts) {
  // Find the post already on the site by its opening words in any of its languages (the main
  // text may have changed language since it was first posted).
  let existing = null
  for (const text of [p.body, ...(p.translations ?? []).map((t) => t.body)]) {
    const firstLine = text.split('\n')[0].slice(0, 60)
    const found = await api('GET', `/api/posts?where[body][like]=${encodeURIComponent(firstLine)}&where[official][equals]=true&limit=1&depth=0`, token)
    existing = found.docs?.[0] ?? null
    if (existing) break
  }
  if (existing) {
    const same = existing.body === p.body && JSON.stringify((existing.translations ?? []).map((t) => [t.locale, t.body])) === JSON.stringify((p.translations ?? []).map((t) => [t.locale, t.body]))
    if (same) {
      console.log(`up to date: ${p.key}`)
      continue
    }
    await api('PATCH', `/api/posts/${existing.id}`, token, { body: p.body, translations: p.translations ?? [] })
    updated++
    console.log(`updated: ${p.key} → ${site}/community/${existing.id}`)
    continue
  }
  const { doc } = await api('POST', '/api/posts', token, { body: p.body, translations: p.translations ?? [], topic: p.topic, pinned: Boolean(p.pinned) })
  created++
  console.log(`posted: ${p.key} → ${site}/community/${doc.id}${doc.status === 'published' ? '' : ` (${doc.status})`}`)
}
console.log(`\nPosted ${created}, updated ${updated}. See ${site}/community`)
