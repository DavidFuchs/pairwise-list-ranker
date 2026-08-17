import { StyleSheet, Text, View } from 'react-native';

import { Switch } from '@/components/ui/Switch';
import { colors, fonts, space } from '@/lib/theme';

export interface AlreadyRankedToggleProps {
  value: boolean;
  onChange: (alreadyRanked: boolean) => void;
}

/**
 * Whether the imported order is a trusted best-to-worst ranking, not just an
 * arbitrary sequence. On, initial ratings are seeded from that order instead
 * of starting flat, so comparisons refine it rather than rebuild it.
 */
export function AlreadyRankedToggle({ value, onChange }: AlreadyRankedToggleProps) {
  return (
    <View style={styles.group}>
      <View style={styles.row}>
        <Text style={styles.heading}>Already ranked, best to worst</Text>
        <Switch
          value={value}
          onChange={onChange}
          accessibilityLabel="This list is already ranked, best to worst"
        />
      </View>
      <Text style={styles.hint}>
        Turn this on if the list is already ranked best to worst. This will pre-bias the ranking algorithm.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
});
