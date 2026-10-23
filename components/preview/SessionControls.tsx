import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, fonts, radius, space } from '@/lib/theme';

/** What opening a file comes to: something to say, or a question to ask first. */
export type OpenOutcome =
  | { message: string }
  /** Opening would replace what is loaded, so it waits for a yes. */
  | { confirm: string; apply: () => string };

export interface SessionControlsProps {
  /** Downloads the session file; returns what to tell the user. */
  onSave: () => string;
  /** Asks for a file and reads it; resolves with the outcome, or null if cancelled. */
  onOpen: () => Promise<OpenOutcome | null>;
}

const FEEDBACK_MS = 6000;

/**
 * The browser keeps a session on its own; these keep it in a file, so it can
 * be carried to another browser or put away and picked up later. One file
 * holds the document, every list's setup and every list's progress.
 */
export function SessionControls({ onSave, onOpen }: SessionControlsProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ confirm: string; apply: () => string } | null>(null);

  useEffect(() => {
    if (feedback === null) return;
    const timer = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Button
          label="Save session"
          accessibilityLabel="Save this session to a file"
          variant="secondary"
          size="sm"
          onPress={() => {
            setAsking(null);
            setFeedback(onSave());
          }}
        />
        <Button
          label="Open session"
          accessibilityLabel="Open a session file"
          variant="secondary"
          size="sm"
          onPress={() => {
            void onOpen().then((outcome) => {
              if (outcome === null) return;
              if ('confirm' in outcome) {
                setFeedback(null);
                setAsking(outcome);
              } else {
                setFeedback(outcome.message);
              }
            });
          }}
        />
      </View>

      {asking !== null && (
        <View style={styles.confirm} accessibilityRole="alert">
          <Text style={styles.confirmText}>{asking.confirm}</Text>
          <View style={styles.actions}>
            <Button label="Keep current" variant="ghost" size="sm" onPress={() => setAsking(null)} />
            <Button
              label="Replace"
              accessibilityLabel="Replace with the saved session"
              variant="dangerStrong"
              size="sm"
              onPress={() => {
                setFeedback(asking.apply());
                setAsking(null);
              }}
            />
          </View>
        </View>
      )}

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
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  feedback: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  confirm: {
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerSoftBorder,
    backgroundColor: colors.dangerSoft,
  },
  confirmText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.dangerText },
});
