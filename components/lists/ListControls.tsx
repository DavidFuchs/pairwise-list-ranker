import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { parse as parseYamlText } from 'yaml';

import { Button } from '@/components/ui/Button';
import { selectItemLabel } from '@/lib/state/selectors';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import type { ItemValue, ListItem, WorkspaceList } from '@/types/list';

export interface ListControlsProps {
  list: WorkspaceList;
  items: ListItem[];
  onAddItem: (value: ItemValue) => void;
  onRemoveItem: (itemId: string) => void;
}

export function ListControls({ list, items, onAddItem, onRemoveItem }: ListControlsProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activeItems = items.filter((item) => item.active);

  function submit() {
    const text = draft.trim();
    if (text === '') return;

    const value = list.kind === 'object' ? parseObjectValue(text) : text;
    if (value === null) {
      setError('Enter an object, for example: title: Arrival');
      return;
    }

    onAddItem(value);
    setDraft('');
    setError(null);
  }

  return (
    <View style={styles.panel} dataSet={{ surface: 'panel' }}>
      <View style={styles.headerBlock}>
        <Text style={styles.title} numberOfLines={2}>
          {list.title}
        </Text>
        {list.description !== undefined && (
          <Text style={styles.description}>{list.description}</Text>
        )}
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {list.kind === 'object' ? 'Object list' : 'Simple list'}
            </Text>
          </View>
          <Text style={styles.count}>{`${activeItems.length} items`}</Text>
        </View>
      </View>

      <View style={styles.addBlock}>
        <TextInput
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            setError(null);
          }}
          onSubmitEditing={submit}
          placeholder={list.kind === 'object' ? 'title: Arrival' : 'Add an item'}
          accessibilityLabel="New item"
          style={styles.input}
        />
        <Button label="Add item" variant="secondary" size="sm" onPress={submit} />
        {error !== null && <Text style={styles.error}>{error}</Text>}
      </View>

      <ScrollView style={styles.itemScroll} contentContainerStyle={styles.itemList}>
        {activeItems.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.itemLabel} numberOfLines={1}>
              {selectItemLabel(item, list.sortField)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${selectItemLabel(item, list.sortField)} from the list`}
              onPress={() => onRemoveItem(item.id)}
              style={styles.removeButton}
            >
              <Text style={styles.removeText}>×</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** Object lists accept a pasted YAML/JSON mapping for the new item. */
function parseObjectValue(text: string): ItemValue | null {
  try {
    const parsed: unknown = parseYamlText(text, { logLevel: 'error' });
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as ItemValue;
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  panel: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerBlock: { gap: space.xs },
  title: {
    ...typeScale.sectionTitle,
    fontFamily: fonts.heading,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  description: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  badgeText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  count: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
  addBlock: { gap: space.sm },
  input: {
    paddingVertical: 10,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textPrimary,
  },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.dangerText },
  itemScroll: { maxHeight: 280 },
  itemList: { gap: 2 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingVertical: 6,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.canvas,
  },
  itemLabel: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textPrimary },
  removeButton: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  removeText: { fontFamily: fonts.body, fontSize: 16, color: colors.textSecondary },
});
