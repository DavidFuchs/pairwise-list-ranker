import { isComplexItemValue } from '@/types/list';
import type { ListItem } from '@/types/list';

/** What a card chip or ranked row says for a field the item may not carry. */
export function summaryText(value: unknown): string {
  if (value === undefined || value === null || value === '') return '–';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * The chosen summary fields of one item, in the chosen order. Every chosen
 * field is present, with a dash for a missing value, so two items always line
 * up field for field.
 */
export function summaryEntries(item: ListItem, fields: string[]): [string, string][] {
  const value = item.value;
  return fields.map((key) => [key, summaryText(isComplexItemValue(value) ? value[key] : undefined)]);
}
