import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Neeze App',
    short_name: 'Neeze',
    description: 'Everything local, connected. Find trusted local services, doctors and businesses in Silchar.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#173B62',
    background_color: '#F2F5F8',
    lang: 'bn',
    categories: ['lifestyle', 'business', 'utilities'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Find a service', short_name: 'Services', url: '/explore?vertical=services', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'My requests', short_name: 'Requests', url: '/me', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Emergency numbers', short_name: 'Emergency', url: '/emergency', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
