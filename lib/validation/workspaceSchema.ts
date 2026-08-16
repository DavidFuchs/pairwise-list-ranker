import { z } from 'zod';

import type { WorkspaceSnapshot } from '@/types/workspace';
import { WORKSPACE_VERSION } from '@/types/workspace';

const itemValueSchema = z.union([
  z.string(),
  z.custom<Record<string, unknown>>(
    (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
  ),
]);

const workspaceListSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string().optional(),
  kind: z.enum(['primitive', 'object']),
  sortField: z.string().optional(),
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
  list: workspaceListSchema,
  items: z.array(listItemSchema),
  comparisonEvents: z.array(comparisonEventSchema),
  ui: z.object({
    previewMode: z.enum(['gui', 'yaml', 'json', 'markdown']),
    editorDrafts: z.object({
      yaml: z.string().optional(),
      json: z.string().optional(),
      markdown: z.string().optional(),
    }),
  }),
});

/**
 * Returns null for anything we cannot safely restore — malformed data, a shape
 * from another app, or a snapshot written by a newer version. Persisted state
 * is a convenience, so failing to read it must never break the app.
 */
export function parseWorkspaceSnapshot(input: unknown): WorkspaceSnapshot | null {
  const result = workspaceSnapshotSchema.safeParse(input);
  if (!result.success) return null;
  if (result.data.version > WORKSPACE_VERSION) return null;
  return result.data;
}
