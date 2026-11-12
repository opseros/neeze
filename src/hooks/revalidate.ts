import { revalidateTag } from 'next/cache'

/**
 * Clear cached public data when an admin edits it. Outside a Next.js request
 * (seed script, CLI) there is no cache to clear, so errors are ignored.
 */
export function revalidate(...tags: string[]) {
  for (const tag of tags) {
    try {
      revalidateTag(tag, { expire: 0 })
    } catch {
      // not running inside Next.js
    }
  }
}

export const revalidateHooks = (...tags: string[]) => ({
  afterChange: [
    ({ doc }: { doc: unknown }) => {
      revalidate(...tags)
      return doc
    },
  ],
  afterDelete: [
    ({ doc }: { doc: unknown }) => {
      revalidate(...tags)
      return doc
    },
  ],
})
