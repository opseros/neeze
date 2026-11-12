import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Categories, Localities } from './collections/Places'
import { Media, News, SiteSettings } from './collections/Content'
import { Providers } from './collections/Providers'
import { Requests } from './collections/Requests'
import { AuditLogs, OtpChallenges } from './collections/System'
import { Users } from './collections/Users'
import { migrations } from './migrations'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SITE_URL,
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: ' · Neeze Admin' },
  },
  collections: [Providers, Requests, Categories, Localities, News, Media, Users, AuditLogs, OtpChallenges],
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
    pool: { connectionString: process.env.DATABASE_URL || '' },
    // Dev pushes schema changes automatically; production runs checked-in migrations.
    push: process.env.NODE_ENV !== 'production',
    prodMigrations: migrations,
  }),
  sharp,
  graphQL: { disable: true },
  cors: [process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'],
  csrf: [process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'],
})
