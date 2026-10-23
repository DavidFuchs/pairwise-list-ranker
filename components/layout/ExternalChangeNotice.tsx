import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { useScreenFocused } from '@/lib/hooks/useScreenFocused';
import { listStore, useListStore } from '@/lib/state/useListStore';
import { colors, fonts, space } from '@/lib/theme';

/** How long the "updated" note stays; it is information, not a question. */
const REFRESHED_NOTE_MS = 5000;

/**
 * What the user is told when another tab has saved the workspace
 * (docs/ARCHITECTURE.md 8.3). A tab that was out of sight has already taken the
 * new copy, so it only says so. A tab in front asks, because swapping the
 * screen under someone's hands could throw away what they just did.
 */
export function ExternalChangeNotice() {
  const change = useListStore((state) => state.externalChange);
  // Screens behind the one in front stay mounted, and only one should speak.
  const focused = useScreenFocused();

  useEffect(() => {
    if (change !== 'refreshed') return;
    const timer = setTimeout(() => listStore.getState().dismissExternalChange(), REFRESHED_NOTE_MS);
    return () => clearTimeout(timer);
  }, [change]);

  if (change === 'none' || !focused) return null;

  if (change === 'refreshed') {
    return (
      <View style={styles.strip} role="status">
        <Text style={styles.text}>Updated from another tab.</Text>
      </View>
    );
  }

  return (
    <View style={styles.strip} role="alert">
      <Text style={styles.text}>
        This list was changed in another tab. Reload to see it, or keep this tab&apos;s version and replace
        the other.
      </Text>
      <View style={styles.actions}>
        <Button label="Reload" size="sm" onPress={() => listStore.getState().reloadFromStorage()} />
        <Button
          label="Keep this tab's version"
          variant="ghost"
          size="sm"
          onPress={() => listStore.getState().keepThisTab()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.accentSoft,
  },
  text: { flexShrink: 1, fontFamily: fonts.body, fontSize: 12, color: colors.textPrimary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
