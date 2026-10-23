/**
 * Derives the web favicon and the Android adaptive icon layers
 * (foreground/background/monochrome) from assets/icon.png, the app's single
 * source-of-truth icon.
 *
 * The favicon is a plain downscale of icon.png.
 *
 * The Android foreground is icon.png itself, shrunk and centered on a
 * transparent canvas so Android's own mask has room to crop it without
 * clipping content. The background is a solid fill sampled from icon.png's
 * own edge color, so there's no seam between the two layers. The monochrome
 * layer (used for Android 13+ themed icons) reuses the foreground's
 * silhouette, filled solid, since a themed icon can only show one color
 * anyway.
 *
 * Requires GraphicsMagick (`brew install graphicsmagick`). Run with `npm run
 * icons` whenever assets/icon.png changes.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets');
const iconPath = join(assets, 'icon.png');

const GM = 'gm';
const SIZE = 512;
const FAVICON_SIZE = 48;
/** Keeps content clear of Android's mask (circle, squircle, rounded square, ...). */
const INSET_SCALE = 0.72;

function gm(...args) {
  try {
    execFileSync(GM, args, { stdio: ['ignore', 'ignore', 'inherit'] });
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('GraphicsMagick is required: brew install graphicsmagick');
    }
    throw err;
  }
}

function gmOut(...args) {
  return execFileSync(GM, args, { encoding: 'utf8' });
}

const work = mkdtempSync(join(tmpdir(), 'pwlr-icons-'));
try {
  const iconW = Number(gmOut('identify', '-format', '%w', iconPath).trim());

  // Sample the icon's own background from a patch near the top edge, well
  // clear of its rounded corners.
  const sample = 60;
  const sampleX = Math.round((iconW - sample) / 2);
  const pixel = gmOut(
    'convert',
    iconPath,
    '-crop',
    `${sample}x${sample}+${sampleX}+8`,
    '+repage',
    '-resize',
    '1x1!',
    '-depth',
    '8',
    'txt:-',
  );
  const backgroundColor = `#${pixel.match(/#([0-9A-Fa-f]{6})/)[1]}`;

  const favicon = join(assets, 'favicon.png');
  gm('convert', iconPath, '-resize', `${FAVICON_SIZE}x${FAVICON_SIZE}`, favicon);
  console.log(`favicon.png  ${FAVICON_SIZE}x${FAVICON_SIZE}`);

  const inset = Math.round(SIZE * INSET_SCALE);
  const scaledIcon = join(work, 'icon-scaled.png');
  const transparentCanvas = join(work, 'transparent.png');
  const blackCanvas = join(work, 'black.png');
  const foreground = join(assets, 'android-icon-foreground.png');
  const background = join(assets, 'android-icon-background.png');
  const monochrome = join(assets, 'android-icon-monochrome.png');

  gm('convert', iconPath, '-resize', `${inset}x${inset}`, scaledIcon);
  gm('convert', '-size', `${SIZE}x${SIZE}`, 'xc:none', transparentCanvas);
  gm('composite', '-gravity', 'center', scaledIcon, transparentCanvas, foreground);
  console.log(`android-icon-foreground.png  ${SIZE}x${SIZE}`);

  gm('convert', '-size', `${SIZE}x${SIZE}`, `xc:${backgroundColor}`, background);
  console.log(`android-icon-background.png  ${SIZE}x${SIZE}  ${backgroundColor}`);

  gm('convert', '-size', `${SIZE}x${SIZE}`, 'xc:black', blackCanvas);
  gm('composite', '-compose', 'CopyOpacity', foreground, blackCanvas, monochrome);
  console.log(`android-icon-monochrome.png  ${SIZE}x${SIZE}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
