/**
 * Generates the app icon, favicon, and Android adaptive layers from one vector
 * source, so every size stays in sync with the theme tokens.
 *
 * The mark is the app's core interaction: two cards, one picked. The loser sits
 * on the baseline in neutral grey; the winner is taller, lifted clear of it,
 * and filled with the accent gradient from lib/themeCss.ts.
 *
 * Run with `npm run icons`. Rasterising goes through Playwright's Chromium,
 * already a dev dependency, rather than adding an image library.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets');

/** Light-theme tokens, mirrored from lib/themeCss.ts. */
const token = {
  canvas: '#F6F6F7',
  surface: '#FFFFFF',
  accent: '#45D124',
  accentGradientEnd: '#7BDE1A',
  accentShadow: '#2FA318',
  violet: '#A6D608',
  shadowInk: '#101114',
};

/**
 * Master geometry, in a 1024 square. The pair is centred on both axes: the
 * winner's extra height is paid for by its lift, so the bounding box stays
 * balanced even though the two cards are not.
 */
const mark = {
  loser: { x: 189, y: 401, w: 278, h: 354, r: 54 },
  winner: { x: 557, y: 269, w: 278, h: 439, r: 54 },
};

/**
 * The mark's filled corners reach 39.5% of the canvas from centre, which
 * overruns the 66% safe circle an Android adaptive mask can clip to. Shrinking
 * the adaptive layers by this much brings them back inside it.
 */
const ADAPTIVE_SCALE = 0.835;

const card = ({ x, y, w, h, r }, fill, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${extra}/>`;

const defs = `
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${token.surface}"/>
      <stop offset="1" stop-color="#F0F0F2"/>
    </linearGradient>
    <radialGradient id="washA" cx="0.22" cy="-0.05" r="0.85">
      <stop offset="0" stop-color="${token.accent}" stop-opacity="0.10"/>
      <stop offset="1" stop-color="${token.accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="washB" cx="0.85" cy="-0.10" r="0.80">
      <stop offset="0" stop-color="${token.violet}" stop-opacity="0.09"/>
      <stop offset="1" stop-color="${token.violet}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="loser" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#D3D5D9"/>
      <stop offset="1" stop-color="#BFC1C6"/>
    </linearGradient>
    <linearGradient id="winner" x1="0.05" y1="0" x2="0.78" y2="1">
      <stop offset="0" stop-color="${token.accent}"/>
      <stop offset="1" stop-color="${token.accentGradientEnd}"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.24"/>
      <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <filter id="rest" x="-70%" y="-70%" width="240%" height="240%">
      <feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="${token.shadowInk}" flood-opacity="0.06"/>
      <feDropShadow dx="0" dy="24" stdDeviation="20" flood-color="${token.shadowInk}" flood-opacity="0.13"/>
    </filter>
    <filter id="lift" x="-70%" y="-70%" width="240%" height="240%">
      <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="${token.shadowInk}" flood-opacity="0.08"/>
      <feDropShadow dx="0" dy="46" stdDeviation="32" flood-color="${token.accentShadow}" flood-opacity="0.42"/>
    </filter>`;

const pair = (withShadows) => `
  <g${withShadows ? ' filter="url(#rest)"' : ''}>${card(mark.loser, 'url(#loser)')}</g>
  ${card(mark.loser, 'url(#sheen)')}
  <g${withShadows ? ' filter="url(#lift)"' : ''}>${card(mark.winner, 'url(#winner)')}</g>
  ${card(mark.winner, 'url(#sheen)')}`;

/** Full-detail icon: the mark on the app's own ground, full bleed so iOS can mask it. */
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img" aria-label="Pairwise List Ranker">
  <defs>${defs}
  </defs>
  <rect width="1024" height="1024" fill="url(#ground)"/>
  <rect width="1024" height="1024" fill="url(#washA)"/>
  <rect width="1024" height="1024" fill="url(#washB)"/>
${pair(true)}
</svg>
`;

/**
 * Favicon: a redraw, not a downscale. At 16px the shadows, the sheen, and the
 * gradient all turn to mush, so this variant drops them, widens the gap, and
 * exaggerates the height difference until the silhouette alone carries it.
 */
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Pairwise List Ranker">
  <defs>
    <linearGradient id="winner" x1="0.05" y1="0" x2="0.78" y2="1">
      <stop offset="0" stop-color="${token.accent}"/>
      <stop offset="1" stop-color="${token.accentGradientEnd}"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="12" fill="${token.canvas}"/>
  <rect x="10" y="27" width="18" height="22" rx="4" fill="#8E9096"/>
  <rect x="36" y="15" width="18" height="30" rx="4" fill="url(#winner)"/>
</svg>
`;

/** Adaptive foreground: mark only. Android supplies the ground and the elevation. */
const foregroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>${defs}
  </defs>
  <g transform="translate(512 512) scale(${ADAPTIVE_SCALE}) translate(-512 -512)">
${pair(false)}
  </g>
</svg>
`;

const backgroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="${token.canvas}"/>
</svg>
`;

/**
 * Themed icons get one colour, so the pair has to separate on alpha alone: the
 * winner stays solid while the loser drops back.
 */
const monochromeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <g transform="translate(512 512) scale(${ADAPTIVE_SCALE}) translate(-512 -512)">
    ${card(mark.loser, '#000000', ' fill-opacity="0.45"')}
    ${card(mark.winner, '#000000')}
  </g>
</svg>
`;

const outputs = [
  { file: 'icon.png', svg: iconSvg, size: 1024, transparent: false },
  { file: 'favicon.png', svg: faviconSvg, size: 48, transparent: true },
  { file: 'android-icon-foreground.png', svg: foregroundSvg, size: 512, transparent: true },
  { file: 'android-icon-background.png', svg: backgroundSvg, size: 512, transparent: false },
  { file: 'android-icon-monochrome.png', svg: monochromeSvg, size: 432, transparent: true },
];

/** Rendered for eyeballing only, never committed. Set ICON_PREVIEW_DIR to get them. */
const previewSizes = [16, 32, 48];
const previewDir = process.env.ICON_PREVIEW_DIR;

async function render(page, svg, size, transparent, path) {
  const sized = svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>${sized}`,
  );
  await page.screenshot({
    path,
    omitBackground: transparent,
    clip: { x: 0, y: 0, width: size, height: size },
  });
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

await writeFile(join(assets, 'icon.svg'), iconSvg, 'utf8');
await writeFile(join(assets, 'favicon.svg'), faviconSvg, 'utf8');

for (const { file, svg, size, transparent } of outputs) {
  await render(page, svg, size, transparent, join(assets, file));
  console.log(`${file}  ${size}x${size}`);
}

if (previewDir) {
  await mkdir(previewDir, { recursive: true });
  for (const size of previewSizes) {
    const path = join(previewDir, `favicon-${size}.png`);
    await render(page, faviconSvg, size, true, path);
    console.log(`preview ${path}`);
  }
}

await browser.close();
