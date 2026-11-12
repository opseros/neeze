'use client'

import { useRouter } from 'next/navigation'

import { ProfileStep } from './auth'

export function CompleteProfile({ initialName, next }: { initialName?: string | null; next: string }) {
  const router = useRouter()
  return (
    <ProfileStep
      initialName={initialName}
      onDone={() => {
        router.replace(next)
        router.refresh()
      }}
    />
  )
}
