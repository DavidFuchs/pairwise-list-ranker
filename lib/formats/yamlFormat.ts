import { parse as parseYamlText, stringify as stringifyYaml } from 'yaml';

import { canonicalizeDocument, isBlank, normalizeText } from '@/lib/formats/canonical';
import type { ParseOptions } from '@/lib/formats/jsonFormat';
import type { ParseIssue, ParseResult } from '@/lib/validation/listSchemas';
import { coerceToListDocument } from '@/lib/validation/listSchemas';
import type { ListDocument } from '@/types/workspace';

export function serializeYaml(doc: ListDocument): string {
  return stringifyYaml(canonicalizeDocument(doc), { lineWidth: 0 });
}

export function parseYaml(text: string, options: ParseOptions = {}): ParseResult<ListDocument> {
  if (isBlank(text)) {
    return { ok: false, issues: [{ path: '', message: 'There is nothing to import: the YAML is empty.' }] };
  }

  const source = normalizeText(text);

  let payload: unknown;
  try {
    // 'error' keeps real errors throwing but drops warnings, so malformed
    // pasted text surfaces in the editor instead of the browser console.
    payload = parseYamlText(source, { logLevel: 'error' });
  } catch (error) {
    return { ok: false, issues: [syntaxIssue(error)] };
  }

  return coerceToListDocument(payload, options);
}

interface YamlParseError extends Error {
  linePos?: { line: number; col: number }[];
}

function syntaxIssue(error: unknown): ParseIssue {
  const message = error instanceof Error ? error.message : String(error);
  const line = (error as YamlParseError)?.linePos?.[0]?.line;

  return {
    path: '',
    message: `Invalid YAML: ${message}`,
    ...(typeof line === 'number' ? { line } : {}),
  };
}
