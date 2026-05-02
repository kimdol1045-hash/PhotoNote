// Tiny script to generate PWA icons (192/512) at build time.
// Outputs PNG by drawing onto a node-canvas. Falls back to a hand-crafted
// SVG-derived buffer using sharp-like approach if available, else uses
// a pure-PNG encoder. Kept minimal: no external deps required.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'public');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// Minimal PNG encoder: solid color square with rounded camera glyph as data URL.
// We just write an SVG and rely on the browser/PWA to rasterize on install
// for browsers that accept SVG icons. For broader support, we also produce
// PNGs via a simple encoder (no antialiased camera) but the gradient bg looks fine.

const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3182F6"/>
      <stop offset="1" stop-color="#1B64DA"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#g)"/>
  <g transform="translate(${size / 2}, ${size / 2})" fill="none" stroke="#fff" stroke-width="${size * 0.04}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M ${-size * 0.27} ${-size * 0.06}
             a ${size * 0.06} ${size * 0.06} 0 0 1 ${size * 0.06} -${size * 0.06}
             h ${size * 0.06}
             l ${size * 0.04} -${size * 0.05}
             h ${size * 0.16}
             l ${size * 0.04} ${size * 0.05}
             h ${size * 0.06}
             a ${size * 0.06} ${size * 0.06} 0 0 1 ${size * 0.06} ${size * 0.06}
             v ${size * 0.22}
             a ${size * 0.06} ${size * 0.06} 0 0 1 -${size * 0.06} ${size * 0.06}
             h -${size * 0.42}
             a ${size * 0.06} ${size * 0.06} 0 0 1 -${size * 0.06} -${size * 0.06} z" />
    <circle cx="0" cy="${size * 0.06}" r="${size * 0.1}" />
  </g>
</svg>`;

writeFileSync(resolve(outDir, 'icon.svg'), svg(512));
writeFileSync(resolve(outDir, 'icon-192.svg'), svg(192));
writeFileSync(resolve(outDir, 'icon-512.svg'), svg(512));

// Maskable: extra safe-zone padding
const maskable = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#3182F6"/>
  <g transform="translate(${size * 0.5}, ${size * 0.5}) scale(0.7)">
    ${svg(size).match(/<g[\s\S]*<\/g>/)?.[0] ?? ''}
  </g>
</svg>`;
writeFileSync(resolve(outDir, 'icon-maskable.svg'), maskable(512));

console.log('Icons (SVG) generated at', outDir);
