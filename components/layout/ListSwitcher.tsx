import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ListOptionRow } from '@/components/data/ListOptionRow';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatPath, MIN_RANKABLE } from '@/lib/import/arrayCandidates';
import type { ArrayCandidate } from '@/lib/import/arrayCandidates';
import { pathKey } from '@/lib/import/paths';
import { colors, fonts, radius, space } from '@/lib/theme';

export interface ListSwitcherOption extends ArrayCandidate {
  /** Answers given on this list so far; absent for a list never opened. */
  answers?: number;
  /**
   * The setup this list would be ranked with, e.g. "shown by title · already
   * ranked". A list never set up by hand takes the document's defaults, so
   * showing it here is what makes switching in one press honest.
   */
  configLine?: string;
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
  /** Opens list setup on that list, to change its fields or, for a list never opened, its order. */
  onConfigure: (path: string[]) => void;
}

/**
 * Always-visible replacement for the plain list-name text, so that a document
 * holding more than one rankable list makes that obvious from the toolbar
 * instead of only inside list setup. Picking another list here
 * switches immediately, the same "nothing is lost" behaviour as ArrayPicker,
 * and a list never set up before comes along on the document's defaults rather
 * than sending the user through list setup first.
 */
export function ListSwitcher({ currentPath, caption, options, onSelect, onConfigure }: ListSwitcherProps) {
  const [open, setOpen] = useState(false);
  if (options.length < 2) return null;

  const currentKey = pathKey(currentPath);

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
          This data has {options.length} lists you can rank. Pick one to switch to it right away, on the
          settings shown under it. Configure changes one list{'’'}s fields, or how far its order can be
          trusted for a list you have not opened yet, and can set the default the others follow.
        </Text>

        <View style={styles.options} role="radiogroup" aria-label="Which list to rank">
          {options.map((option) => {
            const key = pathKey(option.path);
            const selected = key === currentKey;

            return (
              <ListOptionRow
                key={key}
                candidate={option}
                selected={selected}
                answers={option.answers}
                configLine={option.configLine}
                meta={selected ? 'Ranking now' : undefined}
                onPress={() => {
                  setOpen(false);
                  if (!selected) onSelect(option.path);
                }}
                action={
                  <Button
                    label="Configure"
                    accessibilityLabel={`Configure the list at ${formatPath(option.path)}`}
                    variant="secondary"
                    size="sm"
                    disabled={option.count < MIN_RANKABLE}
                    onPress={() => {
                      setOpen(false);
                      onConfigure(option.path);
                    }}
                  />
                }
              />
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
  triggerPressed: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoftBorder,
  },
  triggerPath: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  chevron: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  options: { gap: space.xs, marginTop: space.sm },
});
