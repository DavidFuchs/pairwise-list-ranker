import type { ListDocument } from '@/types/workspace';

const BOM = '﻿';

/** Make pasted text safe to parse: drop the BOM and normalize line endings. */
export function normalizeText(text: string): string {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

export function isBlank(text: string): boolean {
  return normalizeText(text).trim().length === 0;
}

export function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(1) : text;
}

/**
 * Reorder a document into canonical key order so JSON and YAML exports look the
 * same every time and diff cleanly. Optional keys are omitted, never undefined.
 */
export function canonicalizeDocument(doc: ListDocument): ListDocument {
  return {
    version: doc.version,
    title: doc.title,
    ...(doc.description === undefined ? {} : { description: doc.description }),
    kind: doc.kind,
    ...(doc.sortField === undefined ? {} : { sortField: doc.sortField }),
    items: doc.items.map((item) => ({
      ...(item.id === undefined ? {} : { id: item.id }),
      value: item.value,
    })),
  };
}

/** 1-based line number for a character offset, for editor diagnostics. */
export function lineForOffset(text: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  for (let i = 0; i < clamped; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
}
