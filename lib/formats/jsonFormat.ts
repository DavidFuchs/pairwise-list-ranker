import { canonicalizeDocument, isBlank, lineForOffset, normalizeText } from '@/lib/formats/canonical';
import type { ParseIssue, ParseResult } from '@/lib/validation/listSchemas';
import { coerceToListDocument } from '@/lib/validation/listSchemas';
import type { ListDocument } from '@/types/workspace';

export interface ParseOptions {
  /** Title to use when the text is a bare array with no metadata of its own. */
  title?: string;
}

export function serializeJson(doc: ListDocument): string {
  return `${JSON.stringify(canonicalizeDocument(doc), null, 2)}\n`;
}

export function parseJson(text: string, options: ParseOptions = {}): ParseResult<ListDocument> {
  if (isBlank(text)) {
    return { ok: false, issues: [{ path: '', message: 'There is nothing to import: the JSON is empty.' }] };
  }

  const source = normalizeText(text);

  let payload: unknown;
  try {
    payload = JSON.parse(source);
  } catch (error) {
    return { ok: false, issues: [syntaxIssue(error, source)] };
  }

  return coerceToListDocument(payload, options);
}

function syntaxIssue(error: unknown, source: string): ParseIssue {
  const message = error instanceof Error ? error.message : String(error);

  // V8 reports "... in JSON at position 24 (line 3 column 3)"; older runtimes
  // only give the position, so fall back to counting newlines ourselves.
  const lineMatch = /line (\d+)/.exec(message);
  if (lineMatch?.[1]) {
    return { path: '', message: `Invalid JSON: ${message}`, line: Number(lineMatch[1]) };
  }

  const positionMatch = /position (\d+)/.exec(message);
  if (positionMatch?.[1]) {
    return {
      path: '',
      message: `Invalid JSON: ${message}`,
      line: lineForOffset(source, Number(positionMatch[1])),
    };
  }

  return { path: '', message: `Invalid JSON: ${message}` };
}
