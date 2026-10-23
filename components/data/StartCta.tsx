import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, fonts, space } from '@/lib/theme';

export interface StartCtaProps {
  label: string;
  /** Why the button is not ready yet, said above it. */
  reason?: string;
  ready: boolean;
  onSubmit: () => void;
}

/** The setup screen's way forward: what is still missing, then the button. */
export function StartCta({ label, reason, ready, onSubmit }: StartCtaProps) {
  return (
    <View style={styles.cta}>
      {reason !== undefined && <Text style={styles.reason}>{reason}</Text>}
      <Button label={label} variant="primary" disabled={!ready} onPress={onSubmit} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  cta: { gap: space.md },
  button: { alignSelf: 'stretch' },
  // Plain text, like every other hint here. A sunken fill inside a hairline
  // border is this app's word for "you can interact with this", so a
  // read-only message wearing it would read as a field to type in.
  reason: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
});
