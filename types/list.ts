/** Item shapes. The list itself now lives in types/source.ts. */

export type PrimitiveItemValue = string;

export type ComplexItemValue = Record<string, unknown>;

export type ItemValue = PrimitiveItemValue | ComplexItemValue;

export interface ListItem {
  id: string;
  listId: string;
  value: ItemValue;
  createdAt: string;
  updatedAt: string;
}

export function isComplexItemValue(value: ItemValue): value is ComplexItemValue {
  return typeof value === 'object' && value !== null;
}

export function isPrimitiveItemValue(value: ItemValue): value is PrimitiveItemValue {
  return typeof value === 'string';
}

/** One field of an item, or undefined for a bare string or a missing field. */
export function fieldOf(item: ListItem, field: string | undefined): unknown {
  return field !== undefined && isComplexItemValue(item.value) ? item.value[field] : undefined;
}
