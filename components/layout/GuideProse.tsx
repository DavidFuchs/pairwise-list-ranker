import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, space, typeScale } from '@/lib/theme';

/** The few text pieces every help page is written with, so the guide, the FAQ and the quick start read alike. */

export function P({ children }: { children: ReactNode }) {
  return <Text style={prose.body}>{children}</Text>;
}

export function B({ children }: { children: ReactNode }) {
  return <Text style={prose.strong}>{children}</Text>;
}

/** A key or control name, set like the shortcut line under the cards. */
export function K({ children }: { children: ReactNode }) {
  return <Text style={prose.key}>{children}</Text>;
}

/** A pointer to another page of help. */
export function GuideLink({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  return (
    <Text accessibilityRole="link" onPress={onPress} style={prose.link}>
      {children}
    </Text>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <View style={prose.bullets}>
      {items.map((item, index) => (
        <View key={index} style={prose.bullet}>
          <Text style={prose.bulletMark}>•</Text>
          <Text style={[prose.body, prose.bulletText]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export const prose = StyleSheet.create({
  body: { ...typeScale.meta, fontFamily: fonts.body, color: colors.textSecondary },
  strong: { color: colors.textPrimary, fontWeight: '600' },
  key: { fontFamily: fonts.mono, fontSize: 12, color: colors.textPrimary },
  link: { color: colors.accentStrong, fontWeight: '600', textDecorationLine: 'underline' },
  bullets: { gap: space.sm },
  bullet: { flexDirection: 'row', gap: space.sm },
  bulletMark: { ...typeScale.meta, color: colors.textFaint },
  bulletText: { flex: 1 },
});
