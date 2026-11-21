#!/usr/bin/env node
/**
 * Post the Neeze Team's starter community posts through the live site's API.
 * Sign in with a moderator or admin account; posts appear as "Neeze Team" with the official badge.
 *
 *   node scripts/import-posts-web.mjs
 *   node scripts/import-posts-web.mjs data/community-posts-starter.json https://neeze.opseros.com
 *
 * A post whose text is already on the site is skipped, so it is safe to run twice.
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
for (const p of posts) {
  const firstLine = p.body.split('\n')[0].slice(0, 60)
  const found = await api('GET', `/api/posts?where[body][like]=${encodeURIComponent(firstLine)}&limit=1&depth=0`, token)
  if (found.totalDocs) {
    console.log(`skip (already posted): ${p.key}`)
    continue
  }
  const { doc } = await api('POST', '/api/posts', token, { body: p.body, topic: p.topic, pinned: Boolean(p.pinned) })
  created++
  console.log(`posted: ${p.key} → ${site}/community/${doc.id}${doc.status === 'published' ? '' : ` (${doc.status})`}`)
}
console.log(`\nPosted ${created}. See ${site}/community`)
