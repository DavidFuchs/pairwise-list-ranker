import type { ReactNode } from 'react';
import { Modal as RNModal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space, typeScale } from '@/lib/theme';

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * A centred card over a dimmed backdrop. Tapping the backdrop, pressing
 * Escape (native to RN's Modal on web), or the close glyph all close it the
 * same way, so there is exactly one notion of "dismiss".
 */
export function Modal({ visible, onClose, title, children }: ModalProps) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        accessibilityLabel="Close"
        onPress={onClose}
      >
        <Pressable
          style={styles.card}
          dataSet={{ surface: 'panel' }}
          // Swallows the bubble so tapping the card itself does not close it.
          onPress={(event) => event.stopPropagation()}
          accessibilityViewIsModal
          accessibilityRole="none"
          aria-modal
          aria-label={title}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeGlyph}>×</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    backgroundColor: colors.overlay,
  },
  card: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '86%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typeScale.sectionTitle,
    fontFamily: fonts.heading,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  closeButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  closeGlyph: { fontFamily: fonts.body, fontSize: 20, lineHeight: 22, color: colors.textFaint },
  body: { flexGrow: 0 },
  bodyContent: { padding: space.lg, gap: space.lg },
});
