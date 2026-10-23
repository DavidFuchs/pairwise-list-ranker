/** Make pasted text safe to parse: drop the BOM and normalize line endings. */
export function normalizeText(text: string): string {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

export function isBlank(text: string): boolean {
  return normalizeText(text).trim().length === 0;
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
