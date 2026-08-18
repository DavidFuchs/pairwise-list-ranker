import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Modal } from '@/components/ui/Modal';
import { ProgressMeter } from '@/components/ui/ProgressMeter';
import { formatPath } from '@/lib/import/arrayCandidates';
import { describeCoverage } from '@/lib/state/selectors';
import { colors, fonts, radius, space } from '@/lib/theme';

export interface ListSwitcherOption {
  path: string[];
  count: number;
  entryKind: 'object' | 'scalar';
  /** Ranking progress for this list, if it has any yet. */
  coverage?: number;
  /**
   * False for a list never chosen before - its label field and ranked-order
   * answer aren't known, so selecting it opens the data screen to ask
   * instead of switching straight to a guess.
   */
  configured: boolean;
}

export interface ListSwitcherProps {
  /** The path currently being ranked. */
  currentPath: string[];
  /** e.g. "movies · shown by title · already ranked", for the caption. */
  caption: string;
  /** Every rankable list in the document, current one included. Rendering
   *  nothing when there is only one keeps the common case unchanged. */
  options: ListSwitcherOption[];
  onSelect: (path: string[]) => void;
}

/**
 * Always-visible replacement for the plain list-name text, so that a document
 * holding more than one rankable list makes that obvious from the toolbar
 * instead of only inside the data-editing screen. Picking another list here
 * switches immediately, the same "nothing is lost" behaviour as ArrayPicker.
 */
export function ListSwitcher({ currentPath, caption, options, onSelect }: ListSwitcherProps) {
  const [open, setOpen] = useState(false);
  if (options.length < 2) return null;

  const currentKey = currentPath.join('.');

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Switch list - currently ranking ${formatPath(currentPath)}, ${options.length} lists available`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
      >
        <Text style={styles.triggerPath} numberOfLines={1}>
          {formatPath(currentPath)}
        </Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>
      <Text style={styles.caption} numberOfLines={1}>
        {caption}
      </Text>

      <Modal visible={open} onClose={() => setOpen(false)} title="Switch list">
        <Text style={styles.hint}>
          This data has {options.length} lists you can rank. An already set-up list switches to it
          right away; a new one opens the editor first so you can choose its fields and order.
        </Text>

        <View style={styles.options} role="radiogroup" aria-label="Which list to rank">
          {options.map((option) => {
            const key = option.path.join('.');
            const selected = key === currentKey;

            return (
              <Pressable
                key={key}
                role="radio"
                accessibilityLabel={
                  option.configured || selected
                    ? `Rank the list at ${formatPath(option.path)}`
                    : `Rank the list at ${formatPath(option.path)} - opens the data screen to set it up first`
                }
                aria-checked={selected}
                onPress={() => {
                  setOpen(false);
                  if (!selected) onSelect(option.path);
                }}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.optionSelected,
                  pressed && !selected && styles.optionPressed,
                ]}
              >
                <View style={styles.optionHeader}>
                  <Text style={[styles.optionPath, selected && styles.optionPathSelected]}>
                    {formatPath(option.path)}
                  </Text>
                  <Text style={styles.optionMeta}>
                    {selected
                      ? 'Ranking now'
                      : option.configured
                        ? `${option.count} ${option.entryKind === 'object' ? 'objects' : 'texts'}`
                        : 'Not set up yet'}
                  </Text>
                </View>
                {option.coverage !== undefined && (
                  <View style={styles.progressRow}>
                    <View style={styles.progressBar}>
                      <ProgressMeter
                        coverage={option.coverage}
                        accessibilityLabel={`Ranking progress for ${formatPath(option.path)}`}
                      />
                    </View>
                    <Text style={styles.progressLabel}>{describeCoverage(option.coverage).label}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexShrink: 1, gap: 1 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    maxWidth: '100%',
    paddingVertical: 3,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  triggerPressed: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoftBorder },
  triggerPath: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  chevron: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  caption: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginLeft: 2 },
  hint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  options: { gap: space.xs, marginTop: space.sm },
  option: {
    gap: 2,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  optionSelected: { borderColor: colors.accentSoftBorder, backgroundColor: colors.accentSoft },
  optionPressed: { borderColor: colors.borderStrong },
  optionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionPath: { fontFamily: fonts.mono, fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  optionPathSelected: { color: colors.accentStrong },
  optionMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: 2 },
  progressBar: { flex: 1 },
  progressLabel: { fontFamily: fonts.mono, fontSize: 11, color: colors.textFaint },
});
