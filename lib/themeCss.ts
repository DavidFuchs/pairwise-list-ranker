/**
 * Theme tokens as CSS custom properties, plus the few effects React Native
 * styles cannot express: gradients, layered shadows, and focus rings.
 *
 * Components reference these through `lib/theme.ts` (e.g. `var(--surface)`),
 * and opt into gradient treatments with `dataSet={{ surface: 'card' }}`, which
 * react-native-web renders as a `data-surface` attribute.
 *
 * The palette is grayscale everywhere except one accent family: panels,
 * canvas, borders, and text are true neutrals, and the accent (plus its
 * gradient partner) is the only saturated colour of the app's own. Pills are
 * the exception, colouring the user's data.
 *
 * The whole family comes from ACCENT alone. Each theme derives its shades
 * with relative colours: text and fills sit at a fixed OKLCH lightness, so
 * they keep their contrast whatever the accent is, and the gradient partner
 * is the accent turned a little round the hue wheel. Changing ACCENT is the
 * one edit a new accent needs.
 */

/** The one accent colour everything accented is derived from. */
export const ACCENT = '#25AFF3';

/** The accent at an opacity, for tints, glows and shadows. */
const accentAlpha = (alpha: number) => `rgb(from var(--accent) r g b / ${alpha})`;

const LIGHT_TOKENS = `
  --canvas: #F6F6F7;
  --canvas-tint-a: ${accentAlpha(0.08)};
  --canvas-tint-b: rgb(from var(--violet) r g b / 0.06);
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
  /* Deep enough to read as text on white and on the soft fill (AA). */
  --accent-strong: oklch(from var(--accent) 0.5 c h);
  --accent-contrast: oklch(from var(--accent) 0.2 calc(c * 0.4) h);
  --accent-soft: oklch(from var(--accent) 0.96 calc(c * 0.25) h);
  --accent-soft-border: oklch(from var(--accent) 0.86 calc(c * 0.6) h);
  --violet: oklch(from var(--accent) l c calc(h - 25));
  --accent-gradient-end: oklch(from var(--accent) calc(l + 0.04) c calc(h - 10));
  --surplus: #C98A0B;
  --surplus-strong: #E0A93A;
  /* Star ratings. Not the surplus gold, which belongs to the meter alone. */
  --star: #E8B100;
  --star-empty: #D9D9D3;
  /*
   * Metal at temperature, for the much-better button on hover. The body goes
   * dark and the rim runs bright, which is both how hot metal actually reads
   * and the only way the pale label clears WCAG AA on it: white on the
   * lighter accent shades comes in well short, and 12px bold is not large text.
   */
  --heat-core: oklch(from var(--accent) 0.45 c h);
  --heat-edge: oklch(from var(--accent) 0.38 c h);
  --heat-rim: var(--accent);
  --heat-label: #FFFFFF;
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
  --shadow-lift: 0 2px 4px rgba(16, 17, 20, 0.06), 0 22px 40px -18px rgb(from var(--accent-strong) r g b / 0.4);
  --shadow-inset-top: inset 0 1px 0 rgba(255, 255, 255, 0.9);
  --ring: ${accentAlpha(0.45)};
  --overlay: rgba(22, 23, 26, 0.45);
  /*
   * Pills, the one place data brings its own colours. Each tone is a
   * pale fill, a border and text dark enough to read on that fill.
   */
  --tone-red-bg: #FDECEC; --tone-red-border: #F5C2C2; --tone-red-text: #A3271F;
  --tone-amber-bg: #FDF3DC; --tone-amber-border: #F1D58F; --tone-amber-text: #7F520A;
  --tone-green-bg: #E5F6EC; --tone-green-border: #A9DDBD; --tone-green-text: #17703F;
  --tone-teal-bg: #E0F5F4; --tone-teal-border: #9FD9D5; --tone-teal-text: #0F6B66;
  --tone-blue-bg: #E6F0FD; --tone-blue-border: #AFCBF3; --tone-blue-text: #1F5AA8;
  --tone-violet-bg: #F0EAFD; --tone-violet-border: #CDBBF3; --tone-violet-text: #5B3AA6;
  --tone-pink-bg: #FCE9F3; --tone-pink-border: #F0B8D6; --tone-pink-text: #A3245F;
  --tone-slate-bg: #ECEEF1; --tone-slate-border: #C9CED6; --tone-slate-text: #454B55;
`;

const DARK_TOKENS = `
  --canvas: #0A0A0B;
  --canvas-tint-a: ${accentAlpha(0.12)};
  --canvas-tint-b: rgb(from var(--violet) r g b / 0.08);
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
  --accent-strong: oklch(from var(--accent) 0.85 calc(c * 0.7) h);
  --accent-contrast: oklch(from var(--accent) 0.2 calc(c * 0.4) h);
  --accent-soft: oklch(from var(--accent) 0.25 calc(c * 0.3) h);
  --accent-soft-border: oklch(from var(--accent) 0.38 calc(c * 0.5) h);
  --violet: oklch(from var(--accent) calc(l + 0.06) c calc(h - 25));
  --accent-gradient-end: oklch(from var(--accent) calc(l + 0.04) c calc(h - 10));
  --surplus: #FFC53D;
  --surplus-strong: #FFA71A;
  --star: #FFD23F;
  --star-empty: #3A3D42;
  /* On black the rim can go white-hot, which is where most of the heat reads. */
  --heat-core: oklch(from var(--accent) 0.45 c h);
  --heat-edge: oklch(from var(--accent) 0.27 calc(c * 0.6) h);
  --heat-rim: oklch(from var(--accent) 0.9 calc(c * 0.5) h);
  --heat-label: oklch(from var(--accent) 0.98 0.02 h);
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
  --shadow-lift: 0 2px 6px rgba(0, 0, 0, 0.55), 0 26px 48px -20px ${accentAlpha(0.45)};
  --shadow-inset-top: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  --ring: ${accentAlpha(0.5)};
  --overlay: rgba(0, 0, 0, 0.65);
  --tone-red-bg: #2E1515; --tone-red-border: #5C2626; --tone-red-text: #FF9C94;
  --tone-amber-bg: #2E2310; --tone-amber-border: #5E4618; --tone-amber-text: #EFC078;
  --tone-green-bg: #10281A; --tone-green-border: #1F5233; --tone-green-text: #6FD69A;
  --tone-teal-bg: #0E2827; --tone-teal-border: #1E504D; --tone-teal-text: #6ED6CF;
  --tone-blue-bg: #111F33; --tone-blue-border: #24406B; --tone-blue-text: #8DB8F5;
  --tone-violet-bg: #1E1733; --tone-violet-border: #3E2F6B; --tone-violet-text: #BCA5F5;
  --tone-pink-bg: #2E1322; --tone-pink-border: #5E2745; --tone-pink-text: #F59CC8;
  --tone-slate-bg: #1D2024; --tone-slate-border: #3A3F46; --tone-slate-text: #B5BCC6;
`;

export const themeCss = `
:root { color-scheme: light; --accent: ${ACCENT}; ${LIGHT_TOKENS} }
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
 * The stretch of the meter an already-ranked import was credited without
 * earning. Hatched rather than tinted a second colour: the accent is still the
 * accent, so the run reads as the same progress in a less settled state, and
 * the track showing through says plainly that nothing has filled it in yet.
 * Every comparison turns a little of it solid.
 */
[data-fill='claimed'] {
  background-image: repeating-linear-gradient(
    -90deg,
    var(--accent) 0 2px,
    var(--surface-muted) 2px 10px
  );
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

/*
 * The remove control keeps out of the way until it is aimed at, then it turns
 * the colour of what it does. The --trash-ink variable is read by the icon
 * inside it, which is drawn from borders rather than a glyph.
 */
[data-remove] {
  --trash-ink: var(--text-faint);
  transition: background-color 140ms ease;
}
[data-remove]:hover,
[data-remove]:focus-visible {
  --trash-ink: var(--danger);
  background-color: var(--danger-soft);
}

/* Header extras that give way on a phone, so the actions fit on one row. */
@media (max-width: 479px) {
  [data-wide-only] { display: none !important; }
}

/*
 * A sample button stays quiet beside the editor, then wears the accent a
 * selected format tab does once it is hovered or focused.
 */
[data-sample] {
  transition: background-color 140ms ease, border-color 140ms ease;
}
[data-sample]:hover,
[data-sample]:focus-visible {
  border-color: var(--accent-soft-border) !important;
  background-color: var(--accent-soft) !important;
}

/*
 * Dragging a ranked row: the grip is the only draggable part.
 * touch-action: none stops the browser from treating the drag as a page
 * scroll, which on touch devices otherwise cancels the pointer sequence
 * (a pointercancel) the instant the finger moves.
 */
[data-grip] { cursor: grab; touch-action: none; }
[data-grip]:active { cursor: grabbing; }

/*
 * The header's GitHub link stays as quiet as the rest of the toolbar until
 * it is aimed at, same convention as the remove/sample icons above.
 */
[data-github] {
  --github-ink: var(--text-faint);
  transition: background-color 140ms ease;
}
[data-github]:hover,
[data-github]:focus-visible {
  --github-ink: var(--accent-strong);
  background-color: var(--accent-soft);
}

/*
 * The emphasis action comes up to temperature.
 *
 * An earlier version drew literal flames here - tongues of gradient licking
 * off the top edge - and it looked cheap, for a reason worth keeping: fire is
 * high-detail imagery, and at 110x34px there is no room for detail, so any
 * flame collapses into a few blurred blobs. Every other surface in this app is
 * flat and precise; a small illustrated fire on the most important control
 * fights that.
 *
 * So this draws the light rather than the object. The button behaves like
 * metal being heated: the fill glows from within, the rim runs hot, the label
 * goes pale, and the whole thing throws a tight bloom. Nothing is illustrated,
 * which is what keeps it from looking drawn.
 *
 * Three moments:
 *
 * 1. strong-ignite - a single overshoot on hover-in, ~260ms. One-shot effects
 *    read as expensive and looping ones read as cheap, so the drama lives here
 *    rather than in a cycle that repeats forever.
 * 2. The steady hot state, held by the rule itself.
 * 3. strong-heat - a breath so slow and so shallow it should never be caught
 *    in the act: ~5.2s, and about a tenth the swing of the flicker it
 *    replaced. Anything livelier reads as a pulsing indicator.
 */
[data-strong] {
  transition: transform 160ms ease, filter 160ms ease, border-color 160ms ease,
    background-color 160ms ease, box-shadow 160ms ease;
}

[data-strong] [data-strong-label] { transition: color 160ms ease; }

[data-strong]:hover {
  transform: translateY(-1px);
  border-color: var(--heat-rim) !important;
  background-image: radial-gradient(130% 165% at 50% 135%, var(--heat-core) 0%,
    var(--heat-edge) 72%);
  box-shadow: 0 0 10px rgb(from var(--accent) r g b / 0.5), 0 0 22px rgb(from var(--accent) r g b / 0.22);
  animation: strong-ignite 260ms ease-out, strong-heat 5200ms linear 260ms infinite;
}

[data-strong]:hover [data-strong-label] { color: var(--heat-label); }

@keyframes strong-ignite {
  0% {
    box-shadow: 0 0 0 rgb(from var(--accent) r g b / 0), 0 0 0 rgb(from var(--accent) r g b / 0);
    filter: brightness(1);
  }
  38% {
    box-shadow: 0 0 16px rgb(from var(--accent) r g b / 0.85), 0 0 34px rgb(from var(--accent) r g b / 0.4);
    filter: brightness(1.3);
  }
  100% {
    box-shadow: 0 0 10px rgb(from var(--accent) r g b / 0.5), 0 0 22px rgb(from var(--accent) r g b / 0.22);
    filter: brightness(1);
  }
}

@keyframes strong-heat {
  0%, 100% {
    box-shadow: 0 0 10px rgb(from var(--accent) r g b / 0.5), 0 0 22px rgb(from var(--accent) r g b / 0.22);
  }
  50% {
    box-shadow: 0 0 13px rgb(from var(--accent) r g b / 0.6), 0 0 27px rgb(from var(--accent) r g b / 0.28);
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
  /* The gold still reads as gold standing still. */
  [data-fill='surplus'] { animation: none; background-position: 200% 0, 0 0; }
  /* Still hot, it just arrives there rather than igniting. */
  [data-strong]:hover {
    animation: none;
    box-shadow: 0 0 11px rgb(from var(--accent) r g b / 0.55), 0 0 24px rgb(from var(--accent) r g b / 0.25);
  }
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
