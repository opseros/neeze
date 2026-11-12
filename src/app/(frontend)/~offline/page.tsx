import { WifiOff } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-static'

export default async function Offline() {
  const t = await getTranslations('offline')
  return (
    <div className="mx-auto grid max-w-md gap-4 px-4 py-16 text-center">
      <WifiOff className="mx-auto size-12 text-muted" aria-hidden />
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <p className="text-muted">{t('body')}</p>
      <a href="/saved" className="btn-primary">
        {t('saved')}
      </a>
      <a href="/emergency" className="btn-secondary">
        {t('emergency')}
      </a>
    </div>
  )
}
