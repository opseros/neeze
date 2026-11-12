import 'server-only'

import type { User } from '@/payload-types'
import { getCurrentUser } from './server'

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number))

/** The reader and the people they've blocked (their posts and comments are left out). */
export async function getViewer(): Promise<{ user: User | null; blocked: Set<number> }> {
  const user = await getCurrentUser().catch(() => null)
  return { user, blocked: new Set(((user?.blockedUsers ?? []) as unknown[]).map(idOf)) }
}
