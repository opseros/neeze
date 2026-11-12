/**
 * Builds the two Manipuri message files from one source:
 *   messages/source/mni.json  (Bengali script, written by hand)
 *     → messages/mni-Beng.json (Bengali script, as readers expect it)
 *     → messages/mni-Mtei.json (Meitei Mayek, converted)
 * Run after editing the source:  npx tsx scripts/gen-manipuri.ts
 * A unit test fails if the generated files are out of date.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { mapMessages, toBengaliManipuri, toMeiteiMayek } from '../src/lib/meitei'

const dir = path.resolve(import.meta.dirname, '../messages')
const src = JSON.parse(readFileSync(path.join(dir, 'source/mni.json'), 'utf8'))
writeFileSync(path.join(dir, 'mni-Beng.json'), JSON.stringify(mapMessages(src, toBengaliManipuri), null, 2) + '\n')
writeFileSync(path.join(dir, 'mni-Mtei.json'), JSON.stringify(mapMessages(src, toMeiteiMayek), null, 2) + '\n')
console.log('Wrote messages/mni-Beng.json and messages/mni-Mtei.json')
