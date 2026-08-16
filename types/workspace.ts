/** Browser-local workspace snapshot. See ARCHITECTURE.md sections 5.1 and 5.2. */

import type { ExportFormat, ListItem, TextFormat, WorkspaceList } from './list';
import type { ComparisonEvent } from './ranking';

/** Bump when the persisted shape changes so stale snapshots can be migrated or dropped. */
export const WORKSPACE_VERSION = 1;

export interface WorkspaceUiState {
  previewMode: ExportFormat;
  editorDrafts: Partial<Record<TextFormat, string>>;
}

export interface WorkspaceSnapshot {
  version: number;
  list: WorkspaceList;
  items: ListItem[];
  comparisonEvents: ComparisonEvent[];
  ui: WorkspaceUiState;
}

/**
 * The portable interchange payload. JSON is canonical; YAML and Markdown map to
 * and from this shape. See ARCHITECTURE.md section 7.1.
 */
export interface ListDocument {
  version: number;
  title: string;
  description?: string;
  kind: WorkspaceList['kind'];
  sortField?: string;
  items: ListDocumentItem[];
}

export interface ListDocumentItem {
  id?: string;
  value: ListItem['value'];
}

export const LIST_DOCUMENT_VERSION = 1;
