import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { AuthPanel } from '@/components/auth'
import { Container } from '@/components/ui'
import { enabledProviders } from '@/lib/auth/server'
import { safeReturnTo } from '@/lib/auth/logic'
import { getCurrentUser } from '@/lib/server'

export async function generateMetadata() {
  const t = await getTranslations('auth')
  return { title: t('title'), robots: { index: false } }
}

type SP = Promise<{ next?: string; error?: string; step?: string; email?: string; reason?: string }>

export default async function SignInPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const next = safeReturnTo(sp.next)
  const user = await getCurrentUser()
  if (user) redirect(user.phone ? next : `/account/complete?next=${encodeURIComponent(next)}`)
  return (
    <Container className="grid max-w-md place-items-center py-10 md:py-16">
      <div className="w-full rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
        <AuthPanel
          providers={enabledProviders()}
          next={next}
          error={sp.error}
          initialStep={sp.step === 'email' ? 'email' : 'choose'}
          initialEmail={sp.email}
          reason={sp.reason === 'verify' ? 'verify' : undefined}
        />
      </div>
    </Container>
  )
}
