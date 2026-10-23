import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space } from '@/lib/theme';
import type { PreviewTab } from '@/types/source';

export interface PreviewTabsProps {
  tab: PreviewTab;
  /** Only the tabs this source can produce. */
  tabs: PreviewTab[];
  onChange: (tab: PreviewTab) => void;
}

export const TAB_LABELS: Record<PreviewTab, string> = {
  ranked: 'Ranked',
  list: 'Plain list',
  yaml: 'YAML',
  json: 'JSON',
};

export function PreviewTabs({ tab, tabs, onChange }: PreviewTabsProps) {
  return (
    <View style={styles.group} role="tablist">
      {tabs.map((option) => {
        const selected = option === tab;

        return (
          <Pressable
            key={option}
            role="tab"
            accessibilityLabel={TAB_LABELS[option]}
            aria-selected={selected}
            onPress={() => onChange(option)}
            style={[styles.tab, selected && styles.tabSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{TAB_LABELS[option]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    gap: space.xs,
    padding: space.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  tabSelected: { backgroundColor: colors.surface },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  labelSelected: { color: colors.textPrimary, fontWeight: '600' },
});
