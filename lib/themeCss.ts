/**
 * Theme tokens as CSS custom properties, plus the few effects React Native
 * styles cannot express: gradients, layered shadows, and focus rings.
 *
 * Components reference these through `lib/theme.ts` (e.g. `var(--surface)`),
 * and opt into gradient treatments with `dataSet={{ surface: 'card' }}`, which
 * react-native-web renders as a `data-surface` attribute.
 *
 * The palette is deliberately mostly neutral: one indigo accent, warmed towards
 * violet in gradients, over a near-neutral ground in both modes.
 */

const LIGHT_TOKENS = `
  --canvas: #F6F7FB;
  --canvas-tint-a: rgba(76, 99, 245, 0.10);
  --canvas-tint-b: rgba(124, 92, 255, 0.07);
  --surface: #FFFFFF;
  --surface-muted: #EEF1F8;
  --surface-sunken: #F3F5FA;
  --surface-card-top: #FFFFFF;
  --surface-card-bottom: #FAFBFE;
  --border: #DEE3EC;
  --border-strong: #C7D0DF;
  --text-primary: #131722;
  --text-secondary: #58627A;
  --text-faint: #838DA3;
  --accent: #4C63F5;
  --accent-strong: #3244D4;
  --accent-contrast: #FFFFFF;
  --accent-soft: #EEF1FE;
  --accent-soft-border: #CBD4FD;
  --violet: #7C5CFF;
  --accent-gradient-end: #6A5AF0;
  --success: #0F9F6E;
  --success-text: #0A7350;
  --warning: #D28A12;
  --warning-text: #8A5A0B;
  --danger: #D14343;
  --danger-text: #B02A2A;
  --danger-on-fill: #FFFFFF;
  --danger-soft: #FEF5F5;
  --danger-soft-border: #F2D6D6;
  --shadow-card: 0 1px 2px rgba(19, 23, 34, 0.04), 0 12px 24px -12px rgba(19, 23, 34, 0.14);
  --shadow-lift: 0 2px 4px rgba(19, 23, 34, 0.06), 0 22px 40px -18px rgba(50, 68, 212, 0.35);
  --shadow-inset-top: inset 0 1px 0 rgba(255, 255, 255, 0.9);
  --ring: rgba(76, 99, 245, 0.35);
`;

const DARK_TOKENS = `
  --canvas: #0D1016;
  --canvas-tint-a: rgba(108, 128, 255, 0.16);
  --canvas-tint-b: rgba(124, 92, 255, 0.12);
  --surface: #161A23;
  --surface-muted: #1E2430;
  --surface-sunken: #11151D;
  --surface-card-top: #1A1F2A;
  --surface-card-bottom: #151922;
  --border: #262D3B;
  --border-strong: #38425600;
  --text-primary: #E9EDF6;
  --text-secondary: #9AA5BC;
  --text-faint: #74809A;
  --accent: #7C8CFF;
  --accent-strong: #A0ABFF;
  --accent-contrast: #0D1016;
  --accent-soft: #1A2036;
  --accent-soft-border: #2E3866;
  --violet: #9E7BFF;
  --accent-gradient-end: #8E85FF;
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
  --shadow-lift: 0 2px 6px rgba(0, 0, 0, 0.55), 0 26px 48px -20px rgba(124, 140, 255, 0.4);
  --shadow-inset-top: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  --ring: rgba(124, 140, 255, 0.45);
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
 * permanent button. Touch devices never hover, which is why the flame stays
 * visible and this is only ever a hint.
 */
[data-hint='choose'] { transition: opacity 160ms ease; }
[data-surface='card']:hover [data-hint='choose'] { opacity: 1; }

/* The emphasis action warms up as you approach it. */
[data-strong] { transition: transform 160ms ease, background-color 160ms ease, border-color 160ms ease; }
[data-strong]:hover {
  transform: scale(1.08);
  background-color: var(--accent-soft);
  border-color: var(--accent-soft-border);
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
