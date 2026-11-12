import { withPayload } from '@payloadcms/next/withPayload'
import withSerwistInit from '@serwist/next'
import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'
import { randomUUID } from 'crypto'

const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? randomUUID()

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  additionalPrecacheEntries: [
    { url: '/~offline', revision },
    { url: '/emergency', revision },
    { url: '/saved', revision },
  ],
  // Users see a "new version" bar instead of a silent reload that could lose a half-filled form.
  reloadOnOnline: false,
  disable: process.env.NODE_ENV === 'development',
})

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  images: {
    localPatterns: [{ pathname: '/api/media/file/**' }, { pathname: '/images/**' }],
    formats: ['image/avif', 'image/webp'],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return webpackConfig
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ]
  },
}

export default withPayload(withSerwist(withNextIntl(nextConfig)), { devBundleServerPackages: false })
