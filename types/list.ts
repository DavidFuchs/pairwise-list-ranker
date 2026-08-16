/** Canonical list and item shapes. See ARCHITECTURE.md section 5.1. */

export type PrimitiveItemValue = string;

export type ComplexItemValue = Record<string, unknown>;

export type ItemValue = PrimitiveItemValue | ComplexItemValue;

export type ListKind = 'primitive' | 'object';

export type ExportFormat = 'gui' | 'yaml' | 'json' | 'markdown';

/** The formats that produce copyable/downloadable output. `gui` is preview-only. */
export type TextFormat = Exclude<ExportFormat, 'gui'>;

export interface WorkspaceList {
  id: string;
  title: string;
  description?: string;
  kind: ListKind;
  /** Object lists only: which scalar field drives the display label. */
  sortField?: string;
  createdAt: string;
  updatedAt: string;
}

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
