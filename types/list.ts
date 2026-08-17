/** Item shapes. The list itself now lives in types/source.ts. */

export type PrimitiveItemValue = string;

export type ComplexItemValue = Record<string, unknown>;

export type ItemValue = PrimitiveItemValue | ComplexItemValue;

export interface ListItem {
  id: string;
  listId: string;
  value: ItemValue;
  /** Deleted items stay in history but drop out of the ranking pool. */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function isComplexItemValue(value: ItemValue): value is ComplexItemValue {
  return typeof value === 'object' && value !== null;
}

export function isPrimitiveItemValue(value: ItemValue): value is PrimitiveItemValue {
  return typeof value === 'string';
}
