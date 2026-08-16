import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space } from '@/lib/theme';
import type { ExportFormat } from '@/types/list';

const TABS: { mode: ExportFormat; label: string }[] = [
  { mode: 'gui', label: 'GUI' },
  { mode: 'yaml', label: 'YAML' },
  { mode: 'json', label: 'JSON' },
  { mode: 'markdown', label: 'Markdown' },
];

export interface FormatTabsProps {
  mode: ExportFormat;
  onChange: (mode: ExportFormat) => void;
}

export function FormatTabs({ mode, onChange }: FormatTabsProps) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const selected = tab.mode === mode;
        return (
          <Pressable
            key={tab.mode}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            aria-selected={selected}
            onPress={() => onChange(tab.mode)}
            style={[styles.tab, selected && styles.tabSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 2,
    padding: 3,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
  },
  tabSelected: {
    backgroundColor: colors.surface,
    boxShadow: '0 2px 6px rgba(16, 24, 40, 0.08)',
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  labelSelected: { color: colors.textPrimary },
});
