/**
 * Base visual tokens for the app, following the palette and type scale in UX.md.
 *
 * Fonts use platform stacks rather than bundled webfonts so the static build has
 * no network dependency; swap `fonts` for loaded families if that changes.
 */

export const colors = {
  canvas: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F7',
  textPrimary: '#111827',
  textSecondary: '#5B6474',
  border: '#D9DFEA',
  accent: '#345CFF',
  accentStrong: '#2446D8',
  success: '#0F9F6E',
  warning: '#D28A12',
  danger: '#D14343',
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
