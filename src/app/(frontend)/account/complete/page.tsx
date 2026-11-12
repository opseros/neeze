import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { CompleteProfile } from '@/components/complete-profile'
import { Container } from '@/components/ui'
import { safeReturnTo } from '@/lib/auth/logic'
import { getCurrentUser } from '@/lib/server'

export async function generateMetadata() {
  const t = await getTranslations('auth')
  return { title: t('profileTitle'), robots: { index: false } }
}

export default async function CompletePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeReturnTo((await searchParams).next)
  const user = await getCurrentUser()
  if (!user) redirect(`/signin?next=${encodeURIComponent(`/account/complete?next=${next}`)}`)
  if (user.phone) redirect(next)
  return (
    <Container className="grid max-w-md place-items-center py-10 md:py-16">
      <div className="w-full rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
        <CompleteProfile initialName={user.name} next={next} />
      </div>
    </Container>
  )
}
