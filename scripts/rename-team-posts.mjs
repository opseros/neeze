#!/usr/bin/env node
/**
 * One-off: posts and comments you wrote with your staff account before staff posts became
 * "Neeze Team" still show your own name. This signs in as you and relabels them as Neeze Team.
 *
 *   node scripts/rename-team-posts.mjs [https://neeze.opseros.com]
 *
 * Only your own posts and comments change; nobody else's. Safe to run twice.
 */
import readline from 'node:readline'

const site = (process.argv.find((a) => a.startsWith('http')) ?? process.env.NEEZE_SITE ?? 'https://neeze.opseros.com').replace(/\/$/, '')

function ask(q, hidden = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  if (hidden) rl._writeToOutput = (s) => rl.output.write(s.includes(q) ? s : '*')
  return new Promise((ok) => rl.question(q, (a) => (rl.close(), hidden && process.stdout.write('\n'), ok(a.trim()))))
}
async function api(method, url, token, body) {
  const res = await fetch(site + url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `JWT ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${data?.errors?.[0]?.message ?? ''}`)
  return data
}

const email = process.env.NEEZE_ADMIN_EMAIL || (await ask('Your admin or moderator email: '))
const password = process.env.NEEZE_ADMIN_PASSWORD || (await ask('Password: ', true))
const { token, user } = await api('POST', '/api/users/login', null, { email, password }).catch((e) => {
  console.error(`Sign-in failed: ${e.message}`)
  process.exit(1)
})

let changed = 0
for (const collection of ['posts', 'comments']) {
  const { docs } = await api('GET', `/api/${collection}?where[author][equals]=${user.id}&where[authorName][not_equals]=Neeze%20Team&limit=200&depth=0`, token)
  for (const d of docs) {
    await api('PATCH', `/api/${collection}/${d.id}`, token, collection === 'posts' ? { authorName: 'Neeze Team', official: true } : { authorName: 'Neeze Team' })
    changed++
    console.log(`${collection.slice(0, -1)} ${d.id}: "${d.authorName}" → Neeze Team`)
  }
}
console.log(changed ? `\nRelabelled ${changed}.` : '\nNothing to change: all your posts already show Neeze Team.')
