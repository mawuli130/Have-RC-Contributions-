/**
 * Generates the PWA app icons from the Have R/C JHS 2022 crest artwork
 * (same design as src/components/Crest.tsx: navy shield, gold laurels,
 * open book, 2022 banner — a recreation, not official school artwork).
 *
 * Run:  npm run icons
 * Output: public/icons/{crest.svg, icon-192.png, icon-512.png,
 *         maskable-512.png, apple-touch-icon.png}
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
const NAVY_DEEP = '#071F42';

/* Crest artwork in its native 100x112 box (mirrors Crest.tsx). */
const crestInner = `
  <defs>
    <linearGradient id="crestShield" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#144582"/>
      <stop offset="100%" stopColor="#071F42"/>
    </linearGradient>
  </defs>
  <g fill="none" stroke="#FFC400" stroke-width="2.4" stroke-linecap="round">
    <path d="M22 88 C10 76 10 52 20 38"/>
    <path d="M78 88 C90 76 90 52 80 38"/>
  </g>
  <g fill="#FFC400">
    <ellipse cx="17" cy="78" rx="3.2" ry="5" transform="rotate(-28 17 78)"/>
    <ellipse cx="16.4" cy="69" rx="3.2" ry="5" transform="rotate(-28 16.4 69)"/>
    <ellipse cx="15.8" cy="60" rx="3.2" ry="5" transform="rotate(-28 15.8 60)"/>
    <ellipse cx="15.2" cy="51" rx="3.2" ry="5" transform="rotate(-28 15.2 51)"/>
    <ellipse cx="14.6" cy="42" rx="3.2" ry="5" transform="rotate(-28 14.6 42)"/>
    <ellipse cx="83" cy="78" rx="3.2" ry="5" transform="rotate(28 83 78)"/>
    <ellipse cx="83.6" cy="69" rx="3.2" ry="5" transform="rotate(28 83.6 69)"/>
    <ellipse cx="84.2" cy="60" rx="3.2" ry="5" transform="rotate(28 84.2 60)"/>
    <ellipse cx="84.8" cy="51" rx="3.2" ry="5" transform="rotate(28 84.8 51)"/>
    <ellipse cx="85.4" cy="42" rx="3.2" ry="5" transform="rotate(28 85.4 42)"/>
  </g>
  <path d="M50 6 L86 14 V52 C86 78 70 96 50 106 C30 96 14 78 14 52 V14 Z" fill="url(#crestShield)" stroke="#FFC400" stroke-width="3"/>
  <path d="M50 12 L80 19 V52 C80 73 67 88 50 97 C33 88 20 73 20 52 V19 Z" fill="none" stroke="#FFC400" stroke-width="1" opacity="0.65"/>
  <text x="50" y="30" text-anchor="middle" fill="#FFC400" font-size="10.5" font-weight="800" letter-spacing="0.5" font-family="Arial, Helvetica, sans-serif">HAVE R/C</text>
  <text x="50" y="42" text-anchor="middle" fill="#FFFFFF" font-size="11" font-weight="800" letter-spacing="2" font-family="Arial, Helvetica, sans-serif">JHS</text>
  <g>
    <path d="M50 50 C42 45 33 45 27 47 V66 C33 64 42 64 50 69 C58 64 67 64 73 66 V47 C67 45 58 45 50 50 Z" fill="#FFFFFF" stroke="#FFC400" stroke-width="1.6"/>
    <path d="M50 50 V69" stroke="#0B3570" stroke-width="1.6"/>
    <path d="M32 52 C38 50.5 43 51 47 53 M32 58 C38 56.5 43 57 47 59 M53 53 C57 51 62 50.5 68 52 M53 59 C57 57 62 56.5 68 58" stroke="#8AB0E2" stroke-width="1.3" fill="none"/>
  </g>
  <rect x="34" y="76" width="32" height="11" rx="2" fill="#FFC400"/>
  <text x="50" y="84.5" text-anchor="middle" fill="#071F42" font-size="8.5" font-weight="900" letter-spacing="1" font-family="Arial, Helvetica, sans-serif">2022</text>`;

function iconSvg(size, scale, { bg = true } = {}) {
  const w = 100 * scale;
  const h = 112 * scale;
  const x = ((size - w) / 2).toFixed(1);
  const y = ((size - h) / 2).toFixed(1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg ? `<rect width="${size}" height="${size}" fill="${NAVY_DEEP}"/>` : ''}
  <g transform="translate(${x} ${y}) scale(${scale})">${crestInner}
  </g>
</svg>`;
}

const targets = [
  // Standard icons: crest large on deep navy.
  { file: 'icon-512.png', size: 512, scale: 3.9 },
  { file: 'icon-192.png', size: 192, scale: 1.4625 },
  // Maskable: crest inside the safe zone so Android can crop any shape.
  { file: 'maskable-512.png', size: 512, scale: 3.0 },
  // Apple touch icon: full-bleed navy (iOS applies its own rounding).
  { file: 'apple-touch-icon.png', size: 180, scale: 1.35 },
];

await mkdir(outDir, { recursive: true });

// Standalone crest for the browser favicon (transparent background).
await writeFile(
  join(outDir, 'crest.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="112" viewBox="0 0 100 112">${crestInner}\n</svg>\n`,
  'utf8'
);

for (const t of targets) {
  const svg = iconSvg(t.size, t.scale);
  await sharp(Buffer.from(svg)).png().toFile(join(outDir, t.file));
  console.log(`public/icons/${t.file} (${t.size}x${t.size})`);
}
console.log('public/icons/crest.svg');
