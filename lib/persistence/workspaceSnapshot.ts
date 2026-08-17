import { z } from 'zod';

import type { ListItem } from '@/types/list';
import type { ComparisonEvent } from '@/types/ranking';
import type { PreviewTab, Workspace } from '@/types/source';

/** Bump when the persisted shape changes so stale snapshots are dropped. */
export const WORKSPACE_VERSION = 2;

export interface WorkspaceUiState {
  previewTab: PreviewTab;
}

export interface WorkspaceSnapshot {
  version: number;
  workspace: Workspace;
  items: ListItem[];
  comparisonEvents: ComparisonEvent[];
  ui: WorkspaceUiState;
}

const itemValueSchema = z.union([
  z.string(),
  z.custom<Record<string, unknown>>(
    (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
  ),
]);

/**
 * The source document is the user's, so it is stored and restored as-is. Only
 * the app's own annotations around it are validated.
 */
const dataSourceSchema = z.object({
  format: z.enum(['list', 'yaml', 'json']),
  rawText: z.string(),
  document: z.unknown(),
  arrayPath: z.array(z.string()),
});

const workspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  source: dataSourceSchema,
  roles: z.object({
    labelField: z.string().optional(),
    positionField: z.string().optional(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const listItemSchema = z.object({
  id: z.string().min(1),
  listId: z.string().min(1),
  value: itemValueSchema,
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const comparisonEventSchema = z.object({
  id: z.string().min(1),
  listId: z.string().min(1),
  leftItemId: z.string().min(1),
  rightItemId: z.string().min(1),
  outcome: z.enum(['left', 'right', 'left_strong', 'right_strong', 'skip']),
  createdAt: z.string(),
});

export const workspaceSnapshotSchema = z.object({
  version: z.number().int().positive(),
  workspace: workspaceSchema,
  items: z.array(listItemSchema),
  comparisonEvents: z.array(comparisonEventSchema),
  ui: z.object({ previewTab: z.enum(['ranked', 'list', 'yaml', 'json']) }),
});

/**
 * Returns null for anything we cannot safely restore. Persisted state is a
 * convenience, so failing to read it must never break the app. Version 1
 * snapshots hold no source document and are therefore unrecoverable.
 */
export function parseWorkspaceSnapshot(input: unknown): WorkspaceSnapshot | null {
  const result = workspaceSnapshotSchema.safeParse(input);
  if (!result.success) return null;
  if (result.data.version !== WORKSPACE_VERSION) return null;
  return result.data as WorkspaceSnapshot;
}
