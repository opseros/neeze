import { postgresAdapter } from '@payloadcms/db-postgres'
import { resendAdapter } from '@payloadcms/email-resend'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Categories, Localities } from './collections/Places'
import { Media, News, SiteSettings } from './collections/Content'
import { Providers } from './collections/Providers'
import { Requests } from './collections/Requests'
import { AuditLogs, Notifications, OtpChallenges } from './collections/System'
import { Users } from './collections/Users'
import { r2StoragePlugin } from './lib/storage'
import { migrations } from './migrations'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Production domain, plus Vercel preview URLs so /admin works on preview deployments.
const allowedOrigins = [
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ...(process.env.VERCEL_BRANCH_URL ? [`https://${process.env.VERCEL_BRANCH_URL}`] : []),
]

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SITE_URL,
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: ' · Neeze Admin' },
  },
  collections: [Providers, Requests, Categories, Localities, News, Media, Users, Notifications, AuditLogs, OtpChallenges],
  globals: [SiteSettings],
  localization: {
    // Assamese ('as') is added in P1; the data model is ready for it.
    locales: [
      { label: 'English', code: 'en' },
      { label: 'বাংলা', code: 'bn' },
    ],
    defaultLocale: 'en',
    fallback: true,
  },
  i18n: { fallbackLanguage: 'en' },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    // On Vercel use Neon's *pooled* connection string; keep each function's pool small.
    pool: { connectionString: process.env.DATABASE_URL || '', max: process.env.VERCEL ? 3 : 10 },
    // Dev pushes schema changes automatically; production runs checked-in migrations.
    push: process.env.NODE_ENV !== 'production',
    // Vercel runs migrations once in the build (`vercel-build`); elsewhere they run on server start.
    prodMigrations: process.env.VERCEL ? undefined : migrations,
  }),
  // Sign-in codes and admin password resets. Without RESEND_API_KEY (local dev) emails print to the console.
  email: process.env.RESEND_API_KEY
    ? resendAdapter({
        apiKey: process.env.RESEND_API_KEY,
        defaultFromAddress: process.env.EMAIL_FROM ?? 'no-reply@opseros.com',
        defaultFromName: 'Neeze',
      })
    : undefined,
  sharp,
  plugins: [r2StoragePlugin()],
  graphQL: { disable: true },
  cors: allowedOrigins,
  csrf: allowedOrigins,
})
