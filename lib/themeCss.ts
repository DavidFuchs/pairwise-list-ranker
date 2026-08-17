/**
 * Theme tokens as CSS custom properties, plus the few effects React Native
 * styles cannot express: gradients, layered shadows, and focus rings.
 *
 * Components reference these through `lib/theme.ts` (e.g. `var(--surface)`),
 * and opt into gradient treatments with `dataSet={{ surface: 'card' }}`, which
 * react-native-web renders as a `data-surface` attribute.
 *
 * The palette is grayscale everywhere except one neon poison-green/yellow
 * accent family: panels, canvas, borders, and text are true neutrals, and
 * the accent (plus its gradient partner) is the only saturated colour.
 */

const LIGHT_TOKENS = `
  --canvas: #F6F6F7;
  --canvas-tint-a: rgba(57, 219, 31, 0.08);
  --canvas-tint-b: rgba(182, 240, 30, 0.06);
  --surface: #FFFFFF;
  --surface-muted: #EEEEF0;
  --surface-sunken: #F2F2F4;
  --surface-card-top: #FFFFFF;
  --surface-card-bottom: #FAFAFB;
  --border: #DFE0E3;
  --border-strong: #C8CACE;
  --text-primary: #16171A;
  --text-secondary: #595B61;
  --text-faint: #86888E;
  --accent: #45D124;
  --accent-strong: #2FA318;
  --accent-contrast: #06170A;
  --accent-soft: #E7FBDA;
  --accent-soft-border: #B3EE8E;
  --violet: #A6D608;
  --accent-gradient-end: #7BDE1A;
  --success: #0F9F6E;
  --success-text: #0A7350;
  --warning: #D28A12;
  --warning-text: #8A5A0B;
  --danger: #D14343;
  --danger-text: #B02A2A;
  --danger-on-fill: #FFFFFF;
  --danger-soft: #FEF5F5;
  --danger-soft-border: #F2D6D6;
  --shadow-card: 0 1px 2px rgba(16, 17, 20, 0.05), 0 12px 24px -12px rgba(16, 17, 20, 0.16);
  --shadow-lift: 0 2px 4px rgba(16, 17, 20, 0.06), 0 22px 40px -18px rgba(47, 163, 24, 0.4);
  --shadow-inset-top: inset 0 1px 0 rgba(255, 255, 255, 0.9);
  --ring: rgba(69, 209, 36, 0.4);
  --overlay: rgba(22, 23, 26, 0.45);
`;

const DARK_TOKENS = `
  --canvas: #0A0A0B;
  --canvas-tint-a: rgba(57, 255, 20, 0.12);
  --canvas-tint-b: rgba(182, 240, 30, 0.08);
  --surface: #17181A;
  --surface-muted: #1F2023;
  --surface-sunken: #121315;
  --surface-card-top: #1B1C1F;
  --surface-card-bottom: #16171A;
  --border: #2B2C30;
  --border-strong: #3B3D4200;
  --text-primary: #EDEDEF;
  --text-secondary: #A2A4AA;
  --text-faint: #77797F;
  --accent: #39FF14;
  --accent-strong: #7CFF5C;
  --accent-contrast: #051A08;
  --accent-soft: #16280F;
  --accent-soft-border: #2C5A1B;
  --violet: #C6FF00;
  --accent-gradient-end: #8CFF3E;
  --success: #35C08D;
  --success-text: #5FD3A9;
  --warning: #E0A64A;
  --warning-text: #EFC078;
  --danger: #EE7168;
  --danger-text: #FF9C94;
  --danger-on-fill: #1A0F10;
  --danger-soft: #241619;
  --danger-soft-border: #4A2A2C;
  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.5), 0 14px 28px -14px rgba(0, 0, 0, 0.7);
  --shadow-lift: 0 2px 6px rgba(0, 0, 0, 0.55), 0 26px 48px -20px rgba(57, 255, 20, 0.45);
  --shadow-inset-top: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  --ring: rgba(57, 255, 20, 0.5);
  --overlay: rgba(0, 0, 0, 0.65);
`;

export const themeCss = `
:root { color-scheme: light; ${LIGHT_TOKENS} }
:root[data-theme='dark'] { color-scheme: dark; ${DARK_TOKENS} }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) { color-scheme: dark; ${DARK_TOKENS} }
}

html, body { background-color: var(--canvas); }

/* A single wash of colour behind the whole app, strongest at the top. */
[data-surface='canvas'] {
  background-image:
    radial-gradient(120% 70% at 50% -20%, var(--canvas-tint-a) 0%, transparent 60%),
    radial-gradient(90% 60% at 85% 0%, var(--canvas-tint-b) 0%, transparent 55%);
  background-attachment: fixed;
}

/* Panels and cards get a barely-there vertical gradient plus a top highlight. */
[data-surface='panel'],
[data-surface='card'] {
  background-image: linear-gradient(180deg, var(--surface-card-top) 0%, var(--surface-card-bottom) 100%);
  box-shadow: var(--shadow-card), var(--shadow-inset-top);
}

[data-surface='card'] {
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}

[data-surface='card']:hover {
  transform: translateY(-2px);
  border-color: var(--accent-soft-border) !important;
  box-shadow: var(--shadow-lift), var(--shadow-inset-top);
}

/* The one saturated moment in the interface. */
[data-fill='accent'] {
  background-image: linear-gradient(140deg, var(--accent) 0%, var(--accent-gradient-end) 100%);
  border-color: transparent !important;
}

[data-fill='accent']:hover { filter: saturate(1.1) brightness(1.06); }

[data-fill='meter'] {
  background-image: linear-gradient(90deg, var(--accent) 0%, var(--violet) 100%);
}

[data-surface='sunken'] {
  background-image: linear-gradient(180deg, var(--surface-sunken) 0%, var(--surface) 140%);
}

/* Dragging a ranked row: the grip is the only draggable part. */
[data-grip] { cursor: grab; }
[data-grip]:active { cursor: grabbing; }

/*
 * The card is the choice, so it says so on hover rather than carrying a
 * permanent button. Touch devices never hover, which is why Much better stays
 * visible and this is only ever a hint.
 */
[data-hint='choose'] { transition: opacity 160ms ease; }
[data-surface='card']:hover [data-hint='choose'] { opacity: 1; }

/* The emphasis action firms up as you approach it. */
[data-strong] { transition: transform 160ms ease, filter 160ms ease, border-color 160ms ease; }
[data-strong]:hover {
  transform: translateY(-1px);
  filter: saturate(1.15) brightness(0.99);
  border-color: var(--accent) !important;
}

/* The row being dragged lifts off the list it is moving through. */
[data-dragging] {
  box-shadow: var(--shadow-lift);
  cursor: grabbing;
}

/* Keyboard focus stays obvious in both themes. */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 10px;
}

@media (prefers-reduced-motion: reduce) {
  [data-surface='card'] { transition: none; }
  [data-surface='card']:hover { transform: none; }
  [data-hint='choose'] { opacity: 1; transition: none; }
}
`;

export const THEME_STORAGE_KEY = 'pairwise-list-ranker:theme';

/**
 * Runs before first paint: promotes a saved preference to `data-theme` so the
 * page never flashes the wrong palette. Anything unexpected is ignored, since a
 * broken preference must not stop the app from rendering.
 */
export const themeBootScript = `
(function () {
  try {
    var saved = window.localStorage.getItem('${THEME_STORAGE_KEY}');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (error) {}
})();
`;
