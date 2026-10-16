/**
 * Visual tokens for the app, following UX.md.
 *
 * Colours resolve to the CSS custom properties defined in `lib/themeCss.ts`, so
 * light and dark are handled by the stylesheet rather than by React state. That
 * keeps the static export and the hydrated page rendering identical markup.
 *
 * Fonts use platform stacks so the static build has no network dependency.
 */

export const colors = {
  canvas: 'var(--canvas)',
  surface: 'var(--surface)',
  surfaceMuted: 'var(--surface-muted)',
  surfaceSunken: 'var(--surface-sunken)',
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textFaint: 'var(--text-faint)',
  border: 'var(--border)',
  borderStrong: 'var(--border-strong)',
  overlay: 'var(--overlay)',
  accent: 'var(--accent)',
  accentStrong: 'var(--accent-strong)',
  accentContrast: 'var(--accent-contrast)',
  accentSoft: 'var(--accent-soft)',
  accentSoftBorder: 'var(--accent-soft-border)',
  violet: 'var(--violet)',
  surplus: 'var(--surplus)',
  surplusStrong: 'var(--surplus-strong)',
  star: 'var(--star)',
  starEmpty: 'var(--star-empty)',
  success: 'var(--success)',
  successText: 'var(--success-text)',
  warning: 'var(--warning)',
  warningText: 'var(--warning-text)',
  danger: 'var(--danger)',
  dangerText: 'var(--danger-text)',
  dangerOnFill: 'var(--danger-on-fill)',
  dangerSoft: 'var(--danger-soft)',
  dangerSoftBorder: 'var(--danger-soft-border)',
} as const;

export const fonts = {
  body: 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif',
  heading: 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif',
  mono: '"JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

export const typeScale = {
  appTitle: { fontSize: 30, lineHeight: 33 },
  sectionTitle: { fontSize: 22, lineHeight: 26 },
  cardTitle: { fontSize: 24, lineHeight: 29 },
  body: { fontSize: 16, lineHeight: 24 },
  meta: { fontSize: 13, lineHeight: 18 },
  code: { fontSize: 14, lineHeight: 22 },
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
} as const;

export const motion = {
  tapMs: 150,
  cardSwapMs: 210,
} as const;

export const theme = { colors, fonts, typeScale, space, radius, motion } as const;

export type Theme = typeof theme;
