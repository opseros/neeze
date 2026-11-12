// Builds PWA icons and the welcome/OG images. Run: node scripts/make-icons.mjs <photo>
import sharp from 'sharp'

const mark = (size, pad) => {
  const r = size * 0.22
  const inner = size - pad * 2
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${pad ? 0 : r}" fill="#173B62"/>
  <g transform="translate(${pad} ${pad}) scale(${inner / 100})">
    <path d="M24 74V26h9l26 33V26h9v48h-9L33 41v33z" fill="#fff"/>
    <circle cx="74" cy="72" r="7" fill="#20A486"/>
  </g></svg>`)
}

await sharp(mark(192, 0)).png().toFile('public/icons/icon-192.png')
await sharp(mark(512, 0)).png().toFile('public/icons/icon-512.png')
await sharp(mark(512, 80)).png().toFile('public/icons/maskable-512.png') // safe zone for Android masks
await sharp(mark(180, 0)).flatten({ background: '#173B62' }).png().toFile('public/icons/apple-touch-icon.png')

const photo = process.argv[2]
if (photo) {
  await sharp(photo).resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 72 }).toFile('public/images/silchar-hero.webp')
  await sharp(photo).resize(1200, 630, { fit: 'cover', position: 'centre' }).jpeg({ quality: 78, mozjpeg: true }).toFile('public/images/og.jpg')
}
console.log('icons done')
