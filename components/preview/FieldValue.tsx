import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import { FieldLink } from '@/components/preview/FieldLink';
import { formatValue, isLink, isRating, ratingFraction, ratingScale, ratingText } from '@/lib/renderers';
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
export function StarRating({ value, scale, size = 14 }: { value: number; scale: RatingScale; size?: number }) {
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

/**
 * One field's value, drawn the way its renderer says. Picture and play-button
 * renderers have places of their own on a card, so they are not drawn here.
 * Returns null when the renderer has nothing to show, like a false badge.
 */
export function FieldValue({ field, value, renderer, withKey = false, textStyle }: FieldValueProps) {
  const key = withKey ? <Text style={textStyle}>{`${field}:`}</Text> : null;
  const scale = ratingScale(renderer);

  if (renderer === 'badge') {
    if (value !== true) return value === false ? null : <Plain field={field} value={value} withKey={withKey} textStyle={textStyle} />;
    return <Text style={styles.badge}>{field}</Text>;
  }

  if (scale !== undefined && typeof value === 'number' && Number.isFinite(value)) {
    return (
      <View style={styles.row}>
        {key}
        {isRating(renderer, 'stars') ? <StarRating value={value} scale={scale} /> : <RatingBar value={value} scale={scale} />}
      </View>
    );
  }

  if (renderer === 'tags' && Array.isArray(value)) {
    return (
      <View style={[styles.row, styles.wrap]}>
        {key}
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
    );
  }

  if ((renderer === 'link' || renderer === 'image' || renderer === 'youtube') && isLink(value)) {
    return <FieldLink url={value} prefix={withKey ? `${field}:` : undefined} textStyle={textStyle} />;
  }

  return <Plain field={field} value={value} renderer={renderer} withKey={withKey} textStyle={textStyle} />;
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
