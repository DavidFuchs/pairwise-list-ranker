import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, fonts, space } from '@/lib/theme';

export interface ProgressFileControlsProps {
  /** Downloads the progress file; returns what to tell the user. */
  onSave: () => string;
  /** Asks for a file and applies it; resolves with what to tell the user, or null if cancelled. */
  onLoad: () => Promise<string | null>;
}

const FEEDBACK_MS = 6000;

/**
 * Ratings come from the comparisons, which the exported document does not
 * carry. These two buttons keep them in a file of their own, so a half-finished
 * ranking can be put down and picked up again on another browser.
 */
export function ProgressFileControls({ onSave, onLoad }: ProgressFileControlsProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (feedback === null) return;
    const timer = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Button
          label="Save progress"
          accessibilityLabel="Download a progress file"
          variant="secondary"
          size="sm"
          onPress={() => setFeedback(onSave())}
        />
        <Button
          label="Load progress"
          accessibilityLabel="Load a progress file"
          variant="secondary"
          size="sm"
          onPress={() => {
            void onLoad().then((message) => {
              if (message !== null) setFeedback(message);
            });
          }}
        />
      </View>
      {feedback !== null && (
        <Text style={styles.feedback} accessibilityLiveRegion="polite">
          {feedback}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.xs },
  actions: { flexDirection: 'row', gap: space.sm },
  feedback: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
});
