/// <reference lib="webworker" />
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist'
import { CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist, StaleWhileRevalidate } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const DAY = 24 * 60 * 60

/**
 * Caching rules from the blueprint review:
 *  - never cache admin, auth, requests or anything personal
 *  - pages the user opened: network-first with a short timeout, so weak signal still shows something
 *  - reference data (categories, localities): stale-while-revalidate
 *  - images: cache-first, capped
 */
const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ url, sameOrigin }) =>
      sameOrigin && (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/users') || url.pathname.startsWith('/api/requests') || url.pathname.startsWith('/me')),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ request, url, sameOrigin }) => sameOrigin && request.method === 'GET' && (url.pathname.startsWith('/api/categories') || url.pathname.startsWith('/api/localities') || url.pathname.startsWith('/api/globals')),
    handler: new StaleWhileRevalidate({
      cacheName: 'reference-data',
      plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * DAY })],
    }),
  },
  {
    matcher: ({ request }) => request.destination === 'image',
    handler: new CacheFirst({
      cacheName: 'images',
      plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * DAY })],
    }),
  },
  {
    matcher: ({ request }) => request.destination === 'font',
    handler: new CacheFirst({ cacheName: 'fonts', plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 365 * DAY })] }),
  },
  {
    // Pages and RSC payloads: provider profiles, explore, news, emergency.
    matcher: ({ request, sameOrigin }) => sameOrigin && request.method === 'GET' && (request.mode === 'navigate' || request.headers.get('RSC') === '1'),
    handler: new NetworkFirst({
      cacheName: 'pages',
      networkTimeoutSeconds: 4,
      plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * DAY })],
    }),
  },
  {
    matcher: ({ request, sameOrigin }) => sameOrigin && ['script', 'style'].includes(request.destination),
    handler: new StaleWhileRevalidate({ cacheName: 'static', plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * DAY })] }),
  },
]

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // No silent skipWaiting: the page shows "New version — Refresh" so half-filled forms are not lost.
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [{ url: '/~offline', matcher: ({ request }) => request.destination === 'document' }],
  },
})

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') self.skipWaiting()
})

serwist.addEventListeners()
