import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import { linkText } from '@/lib/renderers';
import { colors, fonts } from '@/lib/theme';

export interface FieldLinkProps {
  url: string;
  /** What the link reads as; the shortened address when absent. */
  text?: string;
  /** Written before the address, as the other lines on a card are. */
  prefix?: string;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * A field value drawn as a link, opening in a new tab. It sits on cards and
 * cells that are themselves controls, so a click on it stops here rather than
 * also choosing the card or the field around it.
 */
export function FieldLink({ url, text, prefix, textStyle }: FieldLinkProps) {
  const target = url.trim();
  const link = (
    <Pressable
      accessibilityRole="link"
      href={target}
      hrefAttrs={{ target: '_blank', rel: 'noopener noreferrer' }}
      onPress={(event) => {
        event.stopPropagation();
        // On the web the anchor itself navigates.
        if (Platform.OS !== 'web') void Linking.openURL(target);
      }}
      style={styles.link}
    >
      <Text style={[styles.base, textStyle, styles.text]} numberOfLines={1}>
        {text ?? linkText(target)}
      </Text>
    </Pressable>
  );
  if (prefix === undefined) return link;

  // Beside the link rather than inside it: an underline cannot be taken back
  // off text nested in the underlined run.
  return (
    <View style={styles.row}>
      <Text style={[textStyle, styles.prefix]} numberOfLines={1}>
        {prefix}
      </Text>
      {link}
    </View>
  );
}

const styles = StyleSheet.create({
  // A gap, not a trailing space: flex items drop whitespace at their edges.
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 4, maxWidth: '100%' },
  // The name holds its line and the address gives way, truncating, since the
  // name is what says what the address is. Capped so a long name still leaves
  // the address some room.
  prefix: { flexShrink: 0, maxWidth: '60%' },
  link: { flexShrink: 1, minWidth: 0, alignSelf: 'flex-start', maxWidth: '100%' },
  base: { fontFamily: fonts.body, fontSize: 12 },
  // Size comes from textStyle when given, so a link reads at the size of the line it sits in.
  text: {
    color: colors.accentStrong,
    textDecorationLine: 'underline',
  },
});
