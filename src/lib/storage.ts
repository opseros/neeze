import { s3Storage } from '@payloadcms/storage-s3'
import type { Plugin } from 'payload'

/**
 * Cloudflare R2 (S3-compatible) for uploaded photos.
 * Active only when R2_BUCKET is set, so local dev keeps saving to ./media. The plugin's
 * `prefix` column is always added, so dev and production share one database schema.
 *
 * With R2_PUBLIC_URL set (an R2 custom domain such as https://neeze-media.opseros.com),
 * images are served straight from Cloudflare's CDN instead of through the app,
 * which keeps Vercel bandwidth and function time down. Media is public in Neeze,
 * so skipping Payload's access check on file reads is safe.
 */
export function r2StoragePlugin(): Plugin {
  const bucket = process.env.R2_BUCKET ?? ''
  const enabled = Boolean(bucket)
  const accountId = process.env.R2_ACCOUNT_ID ?? 'disabled'
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? ''
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? ''
  if (enabled && (accountId === 'disabled' || !accessKeyId || !secretAccessKey)) {
    throw new Error('R2_BUCKET is set, so R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required')
  }
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '')

  return s3Storage({
    enabled,
    alwaysInsertFields: true,
    bucket: bucket || 'disabled',
    config: {
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      region: 'auto',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    },
    // Phones upload big photos; Vercel caps request bodies at about 4.5 MB,
    // so the browser uploads straight to R2 with a short-lived signed URL.
    clientUploads: true,
    collections: {
      media: {
        prefix: 'media',
        ...(publicUrl
          ? {
              disablePayloadAccessControl: true as const,
              generateFileURL: ({ filename, prefix }: { filename: string; prefix?: string }) =>
                `${publicUrl}/${prefix ? `${prefix}/` : ''}${filename}`,
            }
          : {}),
      },
    },
  })
}
