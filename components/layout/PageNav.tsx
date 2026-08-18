import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Wraps a lone back/forward Button so it sits at the top of the main content
 * column instead of stretching to the column's full width - flex row layout
 * only stretches children along the cross axis (height), so the button hugs
 * its label rather than spanning the stage.
 */
export function PageNav({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
