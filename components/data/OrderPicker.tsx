import { useId } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldSelect } from '@/components/data/FieldSelect';
import { MIN_RANKABLE } from '@/lib/import/arrayCandidates';
import { describeSort, sortDirectionLabels } from '@/lib/import/sortField';
import type { SortFieldCandidate } from '@/lib/import/sortField';
import { colors, fonts, radius, space } from '@/lib/theme';
import type { StartingOrder } from '@/types/rankingEvents';
import type { SortSpec } from '@/types/source';

export interface OrderPickerProps {
  value: StartingOrder;
  onChange: (startingOrder: StartingOrder) => void;
  /** Fewer items than this have no order worth describing, so nothing is asked. */
  itemCount: number;
  /**
   * Shows the choice but does not allow changing it: a list's starting order is
   * fixed when it is created, and what it was is part of its history.
   */
  readOnly?: boolean;
  /** The fields the list could be sorted by; none disables that option. */
  sortFields?: SortFieldCandidate[];
  /** The sort chosen, which makes "Sort by a field" the selected option. */
  sort?: SortSpec | null;
  onSortChange?: (sort: SortSpec | null) => void;
}

const SORT_HINT =
  'Your list has a field that already says something about the order, such as a rating or a date';
const SORT_NONE_HINT = 'No ordered fields in this list';

const OPTIONS: { value: StartingOrder; label: string; accessibilityLabel: string; hint: string }[] = [
  {
    value: 'unordered',
    label: 'No particular order',
    accessibilityLabel: 'The list is in no particular order',
    hint: "You haven't tried to rank it yet, or only very loosely",
  },
  {
    value: 'rough',
    label: 'Roughly best to worst',
    accessibilityLabel: 'The list is roughly in order, best to worst',
    hint: 'You sorted it yourself',
  },
  {
    value: 'ranked',
    label: 'Ranked best to worst',
    accessibilityLabel: 'The list is already ranked, best to worst',
    hint: 'You ranked it in this app before, or put real care into it by hand',
  },
];

/**
 * How far to trust the imported order (docs/ARCHITECTURE.md 6.4). "Roughly" and "Ranked" both
 * start from that order, with the second trusting it much more, so answers
 * refine it instead of rebuilding it.
 *
 * Four named options rather than a switch: an unlabelled off state next to
 * the words "already ranked" reads as a claim about the list, not a choice
 * about it. Naming every order makes the unchosen ones visible, and a hint
 * under each says who it is for, since the names alone do not.
 */
export function OrderPicker({
  value,
  onChange,
  itemCount,
  readOnly = false,
  sortFields = [],
  sort = null,
  onSortChange,
}: OrderPickerProps) {
  const hintIds = useId();
  if (itemCount < MIN_RANKABLE) return null;

  const sortKind =
    sort === null ? undefined : sortFields.find((candidate) => candidate.field === sort.field)?.kind;
  const sortUnavailable = sortFields.length === 0;
  const sortHintId = `${hintIds}-sort`;
  const directions = sortDirectionLabels(sortKind ?? 'number');

  return (
    <View style={styles.group}>
      <Text style={styles.heading} role="heading" aria-level={3}>
        What order is your list in?
      </Text>

      <View style={styles.options} role="radiogroup" aria-label="What order the list is in">
        {OPTIONS.map((option) => {
          const checked = sort === null && value === option.value;
          const hintId = `${hintIds}-${option.value}`;
          return (
            // The label names the option and replaces what it holds, so the
            // hint under it is tied on as its description, read after the name.
            <Pressable
              key={option.value}
              role="radio"
              accessibilityLabel={option.accessibilityLabel}
              aria-describedby={hintId}
              aria-checked={checked}
              disabled={readOnly}
              onPress={() => {
                onSortChange?.(null);
                onChange(option.value);
              }}
              style={[
                styles.option,
                checked && styles.optionSelected,
                readOnly && !checked && styles.optionLocked,
              ]}
            >
              <Text style={[styles.label, checked && styles.labelSelected]}>{option.label}</Text>
              <Text id={hintId} style={styles.optionHint}>
                {option.hint}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          role="radio"
          accessibilityLabel="Sort by a field"
          aria-describedby={sortHintId}
          aria-checked={sort !== null}
          aria-disabled={readOnly || sortUnavailable}
          disabled={readOnly || sortUnavailable}
          onPress={() => {
            const first = sortFields[0];
            // Already chosen: pressing it again keeps the field and direction picked.
            if (sort === null && first !== undefined)
              onSortChange?.({ field: first.field, direction: 'desc' });
          }}
          style={[
            styles.option,
            sort !== null && styles.optionSelected,
            (readOnly ? sort === null : sortUnavailable) && styles.optionLocked,
          ]}
        >
          <Text style={[styles.label, sort !== null && styles.labelSelected]}>Sort by a field</Text>
          <Text id={sortHintId} style={styles.optionHint}>
            {sortUnavailable ? SORT_NONE_HINT : SORT_HINT}
          </Text>
        </Pressable>
      </View>

      {sort !== null && readOnly && (
        <Text style={styles.hint}>{`${capitalized(describeSort(sort, sortKind ?? 'number'))}.`}</Text>
      )}

      {sort !== null && !readOnly && (
        <View style={styles.sortRow}>
          <FieldSelect
            value={sort.field}
            fields={sortFields}
            onChange={(field) => onSortChange?.({ field, direction: sort.direction })}
          />
          <View style={styles.directions} role="radiogroup" aria-label="Sort direction">
            {(['desc', 'asc'] as const).map((direction) => {
              const checked = sort.direction === direction;
              return (
                <Pressable
                  key={direction}
                  role="radio"
                  accessibilityLabel={directions[direction]}
                  aria-checked={checked}
                  onPress={() => onSortChange?.({ field: sort.field, direction })}
                  style={[styles.direction, checked && styles.optionSelected]}
                >
                  <Text style={[styles.label, checked && styles.labelSelected]}>{directions[direction]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <Text style={styles.hint}>
        {readOnly
          ? 'Set when this list was created.'
          : 'Not sure? Choose “Roughly best to worst”: trusting a list too much makes it hard to fix, and trusting it too little costs only a few answers.'}
      </Text>
    </View>
  );
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const styles = StyleSheet.create({
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  directions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  direction: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  group: { gap: space.xs },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  // Every option claims equal width, so they read as one control rather than
  // as buttons of whatever size their words happened to need.
  option: {
    flexGrow: 1,
    flexBasis: 150,
    gap: 2,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  optionLocked: { opacity: 0.6 },
  optionSelected: { borderColor: colors.accentSoftBorder, backgroundColor: colors.accentSoft },
  label: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  labelSelected: { color: colors.accentStrong, fontWeight: '600' },
  optionHint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
});
