import { z } from 'zod';

import { collectLabelFieldCandidates, preferredLabelField } from '@/lib/import/labelField';
import type { ListDocument } from '@/types/workspace';
import { LIST_DOCUMENT_VERSION } from '@/types/workspace';

export interface ParseIssue {
  /** Dotted path into the payload, e.g. `items.1.value`. Empty for root issues. */
  path: string;
  message: string;
  /** 1-based line in the source text, when the format can pinpoint one. */
  line?: number;
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; issues: ParseIssue[] };

const DEFAULT_TITLE = 'Untitled list';

const complexValueSchema = z.custom<Record<string, unknown>>(
  (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
  { message: 'Expected a string or an object' },
);

const itemValueSchema = z.union([z.string(), complexValueSchema]);

const listDocumentItemSchema = z.object({
  id: z.string().min(1).optional(),
  value: itemValueSchema,
});

const baseListDocumentSchema = z.object({
  version: z.number().int().positive().default(LIST_DOCUMENT_VERSION),
  title: z.string().min(1, 'A list title is required'),
  description: z.string().optional(),
  kind: z.enum(['primitive', 'object']),
  sortField: z.string().min(1).optional(),
  items: z.array(listDocumentItemSchema).min(1, 'A list needs at least one item'),
});

export const listDocumentSchema = baseListDocumentSchema.superRefine((doc, ctx) => {
  if (doc.version > LIST_DOCUMENT_VERSION) {
    ctx.addIssue({
      code: 'custom',
      path: ['version'],
      message: `This list was written by a newer version of the app (version ${doc.version}, supported up to ${LIST_DOCUMENT_VERSION}).`,
    });
  }

  if (doc.kind === 'primitive' && doc.sortField !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['sortField'],
      message: 'A sort field only applies to object lists',
    });
  }

  doc.items.forEach((item, index) => {
    const isObjectValue = typeof item.value === 'object';
    if (doc.kind === 'primitive' && isObjectValue) {
      ctx.addIssue({
        code: 'custom',
        path: ['items', index, 'value'],
        message: 'This list is a simple list, so every item must be a string',
      });
    }
    if (doc.kind === 'object' && !isObjectValue) {
      ctx.addIssue({
        code: 'custom',
        path: ['items', index, 'value'],
        message: 'This list is an object list, so every item must be an object',
      });
    }
  });

  const seen = new Set<string>();
  doc.items.forEach((item, index) => {
    if (item.id === undefined) return;
    if (seen.has(item.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['items', index, 'id'],
        message: `Duplicate item id "${item.id}"`,
      });
    }
    seen.add(item.id);
  });
});

export function toParseIssues(error: z.ZodError): ParseIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

/** Validate a payload that is already in canonical document shape. */
export function parseListDocument(input: unknown): ParseResult<ListDocument> {
  const result = listDocumentSchema.safeParse(input);
  if (!result.success) {
    return { ok: false, issues: toParseIssues(result.error) };
  }
  return { ok: true, data: result.data };
}

/**
 * Validate a payload that may be either a canonical document or a bare array of
 * strings/objects, as produced by hand-written YAML, JSON, or Markdown.
 */
export function coerceToListDocument(
  input: unknown,
  options: { title?: string } = {},
): ParseResult<ListDocument> {
  if (!Array.isArray(input)) {
    return parseListDocument(input);
  }

  const hasStrings = input.some((entry) => typeof entry === 'string');
  const hasObjects = input.some(
    (entry) => typeof entry === 'object' && entry !== null && !Array.isArray(entry),
  );

  if (hasStrings && hasObjects) {
    return {
      ok: false,
      issues: [
        {
          path: 'items',
          message: 'A list cannot mix plain strings and objects. Use one or the other.',
        },
      ],
    };
  }

  const kind = hasObjects ? 'object' : 'primitive';
  const document = {
    version: LIST_DOCUMENT_VERSION,
    title: options.title ?? DEFAULT_TITLE,
    kind,
    items: input.map((value) => ({ value })),
    ...(kind === 'object' ? { sortField: detectSortField(input) } : {}),
  };

  return parseListDocument(document);
}

/**
 * Pick a display field for object lists, or undefined when the choice is
 * ambiguous so the UI can ask. See lib/import/labelField.ts.
 */
export function detectSortField(items: unknown[]): string | undefined {
  const objects = items.filter(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && !Array.isArray(item),
  );

  return preferredLabelField(collectLabelFieldCandidates(objects));
}
