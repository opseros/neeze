import { getTranslations } from 'next-intl/server'

import CommunityPage from './community/page'
import { DirectoryHome } from '@/components/directory-home'
import { NewsFront, SpotlightBand } from '@/components/news-front'
import { resolveLanding } from '@/lib/landing'
import { getSiteSettings } from '@/lib/server'

export async function generateMetadata() {
  const t = await getTranslations('app')
  return { title: { absolute: `Neeze · ${t('tagline')}` } }
}

/** "/" shows what Admin → Site settings → Landing page says, including any temporary change in its dates. */
export default async function Landing() {
  const settings = await getSiteSettings().catch(() => null)
  const { page, spotlight } = resolveLanding((settings as { landing?: Parameters<typeof resolveLanding>[0] } | null)?.landing)
  return (
    <>
      {spotlight && <SpotlightBand s={spotlight} />}
      {page === 'directory' ? <DirectoryHome /> : page === 'community' ? <CommunityPage searchParams={Promise.resolve({})} /> : <NewsFront />}
    </>
  )
}
