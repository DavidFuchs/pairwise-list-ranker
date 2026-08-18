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
  /* Channels, so the flame can vary its own alpha per layer. */
  --accent-rgb: 69 209 36;
  --accent-strong: #2FA318;
  --accent-contrast: #06170A;
  --accent-soft: #E7FBDA;
  --accent-soft-border: #B3EE8E;
  --violet: #A6D608;
  --accent-gradient-end: #7BDE1A;
  --surplus: #C98A0B;
  --surplus-strong: #E0A93A;
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
  --border-strong: #3B3D42;
  --text-primary: #EDEDEF;
  --text-secondary: #A2A4AA;
  --text-faint: #77797F;
  --accent: #39FF14;
  --accent-rgb: 57 255 20;
  --accent-strong: #7CFF5C;
  --accent-contrast: #051A08;
  --accent-soft: #16280F;
  --accent-soft-border: #2C5A1B;
  --violet: #C6FF00;
  --accent-gradient-end: #8CFF3E;
  --surplus: #FFC53D;
  --surplus-strong: #FFA71A;
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

/*
 * The one deliberate exception to the single-accent rule, and only here: past
 * the estimate the meter plates itself in gold, so surplus comparisons read as
 * earned rather than as a bar stuck at full.
 */
[data-fill='surplus'] {
  background-image:
    linear-gradient(100deg, transparent 38%, rgba(255, 255, 255, 0.75) 50%, transparent 62%),
    linear-gradient(90deg, var(--surplus-strong) 0%, var(--surplus) 100%);
  background-size: 260% 100%, 100% 100%;
  background-repeat: no-repeat;
  animation: surplus-sheen 2600ms linear infinite;
}

/*
 * Ambient, not feedback: the sheen says the gold is still live rather than
 * marking a change, so it runs far slower than the 120-180ms state
 * transitions and never coincides with a user action.
 */
@keyframes surplus-sheen {
  from { background-position: -160% 0, 0 0; }
  to { background-position: 260% 0, 0 0; }
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

/*
 * The emphasis action firms up as you approach it, and catches fire. Pure
 * decoration, spent deliberately on the most emphatic verdict the app offers -
 * and only while the pointer is on it, so nothing burns unattended.
 *
 * Two parts, because a fire is two things: the light it throws, and the fire
 * itself.
 *
 * 1. strong-flame is the heat bloom - stacked shadows on uneven beats (13,
 *    27, 41, 58, 69, 84) so the flicker never resolves into a countable pulse.
 *    Linear, not eased: easing swells and settles at every keyframe, which is
 *    what turns a drifting glow into a throb. Slow, too - a light breathing
 *    over seconds reads as burning, where a second-long cycle reads as a
 *    blinking indicator demanding attention.
 *
 * 2. strong-flame-licks is the fire, and it is what makes this a flame
 *    rather than a neon sign. Three tongues rise off the top edge, each a
 *    gradient anchored at its own base: a near-white core where it is hottest,
 *    cooling through accent green, transparent at the tip. They grow and
 *    collapse out of phase with each other and wander sideways, because
 *    tongues that rise in unison read as a bar chart. Direction is the whole
 *    trick - a symmetric halo has no up, and fire always has an up.
 */
[data-strong] {
  transition: transform 160ms ease, filter 160ms ease, border-color 160ms ease,
    box-shadow 160ms ease;
}
[data-strong]:hover {
  transform: translateY(-1px);
  filter: saturate(1.3) brightness(1.04);
  border-color: var(--accent) !important;
  animation: strong-flame 3400ms linear infinite;
}

/*
 * The fire sits above the button rather than over it, overlapping the top edge
 * by a few pixels so the tongues emerge from the surface instead of hovering
 * over it. It never reaches the label, and it never takes a click.
 */
[data-strong]::after {
  content: '';
  position: absolute;
  left: 2%;
  right: 2%;
  bottom: calc(100% - 6px);
  height: 42px;
  pointer-events: none;
  opacity: 0;
  filter: blur(1.8px);
  transition: opacity 220ms ease;
  background-repeat: no-repeat;
  /*
   * Narrow and tall. A tongue is roughly twice as high as it is wide; at the
   * squat proportions of a wide gradient it reads as a dome sitting on the
   * edge, which is a lamp, not a flame.
   */
  /*
   * The last layer is the ember bed: a wide, low band of heat along the edge
   * that the tongues rise out of. Without it four separate gradients read as
   * four separate lights rather than as one fire.
   */
  background-size: 17% 92%, 14% 68%, 20% 100%, 11% 56%, 100% 26%;
  background-position: 14% 100%, 37% 100%, 61% 100%, 85% 100%, 50% 100%;
  /*
   * The long tail from 55% to transparent is the taper. Stopping the colour
   * abruptly gives a rounded cap; letting it thin out over most of the tongue
   * is what draws a point.
   */
  background-image:
    radial-gradient(50% 100% at 50% 100%, rgb(240 255 228 / 0.95) 0%,
      rgb(var(--accent-rgb) / 0.9) 26%, rgb(var(--accent-rgb) / 0.34) 55%,
      rgb(var(--accent-rgb) / 0) 90%),
    radial-gradient(50% 100% at 50% 100%, rgb(232 255 214 / 0.9) 0%,
      rgb(var(--accent-rgb) / 0.84) 28%, rgb(var(--accent-rgb) / 0.3) 57%,
      rgb(var(--accent-rgb) / 0) 92%),
    radial-gradient(50% 100% at 50% 100%, rgb(240 255 228 / 0.95) 0%,
      rgb(var(--accent-rgb) / 0.88) 25%, rgb(var(--accent-rgb) / 0.32) 54%,
      rgb(var(--accent-rgb) / 0) 90%),
    radial-gradient(50% 100% at 50% 100%, rgb(226 255 206 / 0.85) 0%,
      rgb(var(--accent-rgb) / 0.78) 30%, rgb(var(--accent-rgb) / 0.26) 60%,
      rgb(var(--accent-rgb) / 0) 94%),
    radial-gradient(62% 100% at 50% 100%, rgb(240 255 228 / 0.7) 0%,
      rgb(var(--accent-rgb) / 0.6) 40%, rgb(var(--accent-rgb) / 0) 100%);
}

[data-strong]:hover::after {
  opacity: 1;
  animation: strong-flame-licks 1900ms linear infinite;
}

@keyframes strong-flame-licks {
  0% {
    background-size: 17% 92%, 14% 68%, 20% 100%, 11% 56%, 100% 26%;
    background-position: 14% 100%, 37% 100%, 61% 100%, 85% 100%, 50% 100%;
  }
  22% {
    background-size: 15% 62%, 16% 96%, 17% 72%, 12% 84%, 100% 23%;
    background-position: 17% 100%, 34% 100%, 64% 100%, 82% 100%, 50% 100%;
  }
  47% {
    background-size: 19% 100%, 13% 58%, 15% 90%, 10% 50%, 100% 28%;
    background-position: 11% 100%, 40% 100%, 58% 100%, 88% 100%, 50% 100%;
  }
  71% {
    background-size: 14% 70%, 17% 86%, 21% 60%, 13% 92%, 100% 24%;
    background-position: 16% 100%, 35% 100%, 63% 100%, 83% 100%, 50% 100%;
  }
  88% {
    background-size: 18% 84%, 12% 74%, 16% 96%, 11% 64%, 100% 26%;
    background-position: 13% 100%, 39% 100%, 60% 100%, 86% 100%, 50% 100%;
  }
  100% {
    background-size: 17% 92%, 14% 68%, 20% 100%, 11% 56%, 100% 26%;
    background-position: 14% 100%, 37% 100%, 61% 100%, 85% 100%, 50% 100%;
  }
}

@keyframes strong-flame {
  0% {
    box-shadow: 0 0 6px rgb(var(--accent-rgb) / 0.55), 0 0 14px rgb(var(--accent-rgb) / 0.28),
      0 0 20px rgb(var(--accent-rgb) / 0.10);
  }
  13% {
    box-shadow: 0 0 9px rgb(var(--accent-rgb) / 0.75), 0 0 20px rgb(var(--accent-rgb) / 0.4),
      0 0 26px rgb(var(--accent-rgb) / 0.15);
  }
  27% {
    box-shadow: 0 0 5px rgb(var(--accent-rgb) / 0.5), 0 0 12px rgb(var(--accent-rgb) / 0.24),
      0 0 18px rgb(var(--accent-rgb) / 0.08);
  }
  41% {
    box-shadow: 0 0 12px rgb(var(--accent-rgb) / 0.88), 0 0 25px rgb(var(--accent-rgb) / 0.48),
      0 0 30px rgb(var(--accent-rgb) / 0.18);
  }
  58% {
    box-shadow: 0 0 7px rgb(var(--accent-rgb) / 0.6), 0 0 15px rgb(var(--accent-rgb) / 0.3),
      0 0 21px rgb(var(--accent-rgb) / 0.11);
  }
  69% {
    box-shadow: 0 0 10px rgb(var(--accent-rgb) / 0.8), 0 0 22px rgb(var(--accent-rgb) / 0.44),
      0 0 28px rgb(var(--accent-rgb) / 0.16);
  }
  84% {
    box-shadow: 0 0 6px rgb(var(--accent-rgb) / 0.52), 0 0 13px rgb(var(--accent-rgb) / 0.26),
      0 0 19px rgb(var(--accent-rgb) / 0.09);
  }
  100% {
    box-shadow: 0 0 6px rgb(var(--accent-rgb) / 0.55), 0 0 14px rgb(var(--accent-rgb) / 0.28),
      0 0 20px rgb(var(--accent-rgb) / 0.10);
  }
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
  /* The gold still reads as gold standing still. */
  [data-fill='surplus'] { animation: none; background-position: 200% 0, 0 0; }
  /* Still alight, just not moving: the tongues hold their opening shape. */
  [data-strong]:hover {
    animation: none;
    box-shadow: 0 0 8px rgb(var(--accent-rgb) / 0.65), 0 0 18px rgb(var(--accent-rgb) / 0.32),
      0 0 30px rgb(var(--accent-rgb) / 0.14);
  }
  [data-strong]:hover::after { animation: none; }
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
