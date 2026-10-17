import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import { FieldLink } from '@/components/preview/FieldLink';
import {
  formatValue,
  isColor,
  isLink,
  isRating,
  locationText,
  mapUrl,
  pillTone,
  ratingFraction,
  ratingScale,
  ratingText,
} from '@/lib/renderers';
import type { FixedRenderer } from '@/lib/renderers/registry';
import { summaryText } from '@/lib/state/summary';
import { colors, fonts, radius, space } from '@/lib/theme';
import type { FieldRenderer, RatingScale } from '@/types/source';

const STAR_COUNT = 5;

/**
 * Always five stars, filled from the left to the score's share of the scale:
 * 9.2 out of 10 lights 92% of the row. Each star is a grey glyph under a gold
 * one cut to that star's share, so a part-star is drawn as exactly that. Cut
 * star by star because a single glyph only clips, where a cut row of them
 * would wrap or end in an ellipsis.
 */
export function StarRating({
  value,
  scale,
  size = 14,
}: {
  value: number;
  scale: RatingScale;
  size?: number;
}) {
  const lit = (ratingFraction(value, scale) ?? 0) * STAR_COUNT;
  const glyphStyle = { fontSize: size, lineHeight: size + 2 };
  return (
    <View style={styles.rating} accessibilityLabel={ratingText(value, scale)} role="img">
      <View style={styles.starRow}>
        {Array.from({ length: STAR_COUNT }, (_, index) => {
          const share = Math.min(1, Math.max(0, lit - index));
          return (
            <View key={index}>
              <Text style={[styles.star, styles.starEmpty, glyphStyle]}>★</Text>
              {share > 0 && (
                <View style={[styles.starFill, { width: `${share * 100}%` }]}>
                  <Text style={[styles.star, styles.starFull, glyphStyle]}>★</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** A short track filled to the score's share of the scale, with the score beside it. */
export function RatingBar({ value, scale }: { value: number; scale: RatingScale }) {
  const fraction = ratingFraction(value, scale) ?? 0;
  return (
    <View style={styles.rating} accessibilityLabel={ratingText(value, scale)} role="img">
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${fraction * 100}%` }]} />
      </View>
      <Text style={styles.barText}>{ratingText(value, scale)}</Text>
    </View>
  );
}

export interface FieldValueProps {
  field: string;
  value: unknown;
  renderer: FieldRenderer | undefined;
  /** Writes `field:` before the value, as each line of a card does. */
  withKey?: boolean;
  textStyle?: StyleProp<TextStyle>;
}

interface ViewProps {
  field: string;
  value: unknown;
  renderer: FieldRenderer;
  /** The `field:` key to draw before the value, or null without one. */
  fieldKey: ReactElement | null;
  withKey: boolean;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * How one renderer draws a line. Undefined when it cannot draw this value,
 * which then reads as plain text; null when it draws nothing at all.
 */
type LineView = (props: ViewProps) => ReactElement | null | undefined;

const RatingView: LineView = ({ value, renderer, fieldKey }) => {
  const scale = ratingScale(renderer);
  if (scale === undefined || typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return (
    <View style={styles.row}>
      {fieldKey}
      {isRating(renderer, 'stars') ? (
        <StarRating value={value} scale={scale} />
      ) : (
        <RatingBar value={value} scale={scale} />
      )}
    </View>
  );
};

const LinkView: LineView = ({ field, value, withKey, textStyle }) =>
  isLink(value) ? (
    <FieldLink url={value} prefix={withKey ? `${field}:` : undefined} textStyle={textStyle} />
  ) : undefined;

/** Line renderers that draw more than text. Any other renderer reads as its formatted text. */
const VIEWS: Partial<Record<FixedRenderer, LineView>> = {
  badge: ({ field, value }) => {
    if (value === false) return null;
    return value === true ? <Text style={styles.badge}>{field}</Text> : undefined;
  },
  tags: ({ value, fieldKey, textStyle }) =>
    Array.isArray(value) ? (
      <View style={[styles.row, styles.wrap]}>
        {fieldKey}
        {value.length === 0 ? (
          <Text style={textStyle}>–</Text>
        ) : (
          value.map((tag, index) => (
            <Text key={`${index}-${String(tag)}`} style={styles.tag}>
              {summaryText(tag)}
            </Text>
          ))
        )}
      </View>
    ) : undefined,
  pills: ({ value, fieldKey }) => {
    if (typeof value !== 'string' || value.trim() === '') return undefined;
    const tone = pillTone(value);
    return (
      // Wraps like tags: a narrow card moves the pill under its key rather
      // than crushing it to a column of letters.
      <View style={[styles.row, styles.wrap]}>
        {fieldKey}
        <Text
          style={[
            styles.pill,
            {
              backgroundColor: `var(--tone-${tone}-bg)`,
              borderColor: `var(--tone-${tone}-border)`,
              color: `var(--tone-${tone}-text)`,
            },
          ]}
        >
          {value.trim()}
        </Text>
      </View>
    );
  },
  'color-swatch': ({ value, fieldKey, textStyle }) =>
    isColor(value) ? (
      <View style={styles.row}>
        {fieldKey}
        <View
          style={[styles.swatch, { backgroundColor: value.trim() }]}
          role="img"
          aria-label={value.trim()}
        />
        <Text style={[textStyle, styles.swatchText]}>{value.trim()}</Text>
      </View>
    ) : undefined,
  location: ({ field, value, withKey, textStyle }) => {
    const text = locationText(value);
    const url = mapUrl(value);
    if (text === undefined || url === undefined) return undefined;
    return (
      <FieldLink
        url={url}
        text={`📍 ${text}`}
        prefix={withKey ? `${field}:` : undefined}
        textStyle={textStyle}
      />
    );
  },
  'long-text': ({ field, value, withKey, textStyle }) =>
    typeof value === 'string' ? (
      <LongText field={field} value={value} withKey={withKey} textStyle={textStyle} />
    ) : undefined,
  link: LinkView,
  image: LinkView,
  youtube: LinkView,
};

function viewFor(renderer: FieldRenderer): LineView | undefined {
  return ratingScale(renderer) !== undefined ? RatingView : VIEWS[renderer as FixedRenderer];
}

/**
 * One field's value, drawn the way its renderer says. Picture and play-button
 * renderers have places of their own on a card, so they are not drawn here.
 * Returns null when the renderer has nothing to show, like a false badge.
 */
export function FieldValue({ field, value, renderer, withKey = false, textStyle }: FieldValueProps) {
  const fieldKey = withKey ? <Text style={textStyle}>{`${field}:`}</Text> : null;
  const view = renderer === undefined ? undefined : viewFor(renderer);
  const drawn = view?.({ field, value, renderer: renderer!, fieldKey, withKey, textStyle });
  return drawn === undefined ? (
    <Plain field={field} value={value} renderer={renderer} withKey={withKey} textStyle={textStyle} />
  ) : (
    drawn
  );
}

/** Prose shows this many lines before folding behind a More. */
const LONG_TEXT_LINES = 3;
/** Where nothing can be measured, text longer than this is taken to overflow. */
const LONG_TEXT_FOLD = 80;

/**
 * Prose a few lines deep, with the rest a tap away. The toggle is a control
 * inside a card that is one, so pressing it never also chooses the card.
 */
function LongText({
  field,
  value,
  withKey,
  textStyle,
}: {
  field: string;
  value: string;
  withKey: boolean;
  textStyle?: StyleProp<TextStyle>;
}) {
  const [open, setOpen] = useState(false);
  const text = value.trim();
  const ref = useRef<Text>(null);
  const [folds, setFolds] = useState(() => text.length > LONG_TEXT_FOLD || text.includes('\n'));

  // How much fits depends on the card's width, so on the web the clamped
  // text is measured: it folds exactly when some of it is hidden.
  useLayoutEffect(() => {
    const node = ref.current as unknown as HTMLElement | null;
    if (open || node === null || !(node.clientHeight > 0)) return;
    setFolds(node.scrollHeight > node.clientHeight + 1);
  }, [open, text]);

  return (
    <View style={styles.long}>
      <Text ref={ref} style={textStyle} numberOfLines={open ? undefined : LONG_TEXT_LINES}>
        {withKey ? `${field}: ${text}` : text}
      </Text>
      {folds && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? `Show less of ${field}` : `Show all of ${field}`}
          aria-expanded={open}
          onPress={(event) => {
            event.stopPropagation();
            setOpen(!open);
          }}
          style={styles.more}
        >
          <Text style={styles.moreText}>{open ? 'Less' : 'More'}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Plain({
  field,
  value,
  renderer,
  withKey,
  textStyle,
}: {
  field: string;
  value: unknown;
  renderer?: FieldRenderer;
  withKey: boolean;
  textStyle?: StyleProp<TextStyle>;
}) {
  const text = formatValue(value, renderer, field) ?? summaryText(value);
  return <Text style={textStyle}>{withKey ? `${field}: ${text}` : text}</Text>;
}

const styles = StyleSheet.create({
  pill: {
    paddingVertical: 1,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
    overflow: 'hidden',
    maxWidth: '100%',
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  swatchText: { fontFamily: fonts.mono },
  long: { gap: 2, maxWidth: '100%' },
  more: { alignSelf: 'flex-start' },
  moreText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '600', color: colors.accentStrong },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  wrap: { flexWrap: 'wrap', rowGap: 4 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  starRow: { flexDirection: 'row', gap: 1 },
  star: { fontFamily: fonts.body },
  starEmpty: { color: colors.starEmpty },
  starFull: { color: colors.star },
  starFill: { position: 'absolute', top: 0, left: 0, bottom: 0, overflow: 'hidden' },
  barTrack: {
    width: 64,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 999, backgroundColor: colors.accent },
  barText: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
  tag: {
    paddingVertical: 1,
    paddingHorizontal: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textSecondary,
    overflow: 'hidden',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 1,
    paddingHorizontal: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accentSoftBorder,
    backgroundColor: colors.accentSoft,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
    color: colors.accentStrong,
    overflow: 'hidden',
  },
});
