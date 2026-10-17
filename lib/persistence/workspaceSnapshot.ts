import { z } from 'zod';

import { pathKey } from '@/lib/import/paths';
import { FIELD_RENDERERS } from '@/types/source';
import type { PreviewTab, Workspace } from '@/types/source';

/** Bump when the persisted shape changes so stale snapshots are dropped. */
export const WORKSPACE_VERSION = 4;

export interface WorkspaceUiState {
  previewTab: PreviewTab;
}

export interface WorkspaceSnapshot {
  version: number;
  workspace: Workspace;
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
  document: z.unknown(),
  arrayPath: z.array(z.string()),
});

const rolesSchema = z.object({
  labelField: z.string().optional(),
  positionField: z.string().optional(),
  summaryFields: z.array(z.string()).optional(),
  fieldRenderers: z.record(z.string(), z.enum(FIELD_RENDERERS)).optional(),
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
  outcome: z.enum(['left', 'right', 'left_strong', 'right_strong', 'skip', 'place_below', 'place_above']),
  createdAt: z.string(),
});

const rankedListSchema = z.object({
  id: z.string().min(1),
  arrayPath: z.array(z.string()),
  roles: rolesSchema,
  alreadyRanked: z.boolean(),
  configuredExplicitly: z.boolean(),
  items: z.array(listItemSchema),
  comparisonEvents: z.array(comparisonEventSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const workspaceSchema = z
  .object({
    source: dataSourceSchema,
    listDefaults: z.object({ roles: rolesSchema, alreadyRanked: z.boolean() }),
    lists: z.record(z.string(), rankedListSchema),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  // Each list is filed under its own path, and the open one is among them.
  .refine(
    (workspace) =>
      Object.entries(workspace.lists).every(([key, list]) => key === pathKey(list.arrayPath)) &&
      workspace.lists[pathKey(workspace.source.arrayPath)] !== undefined,
  );

export const workspaceSnapshotSchema = z.object({
  version: z.number().int().positive(),
  workspace: workspaceSchema,
  ui: z.object({ previewTab: z.enum(['ranked', 'list', 'yaml', 'json']) }),
});

/**
 * Returns null for anything we cannot safely restore, older versions included.
 * Persisted state is a convenience, so failing to read it must never break the
 * app.
 */
export function parseWorkspaceSnapshot(input: unknown): WorkspaceSnapshot | null {
  const result = workspaceSnapshotSchema.safeParse(input);
  if (!result.success) return null;
  if (result.data.version !== WORKSPACE_VERSION) return null;
  return result.data as WorkspaceSnapshot;
}
