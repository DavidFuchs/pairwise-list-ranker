import { parse as parseYamlText } from 'yaml';

import { parsePlainList } from '@/lib/import/plainList';
import { isBlank, lineForOffset, normalizeText } from '@/lib/import/text';
import type { ParseIssue, ParseResult } from '@/lib/import/types';
import type { SourceFormat } from '@/types/source';

/**
 * A default, not a verdict: the data screen lets the user override it. Valid
 * YAML and an intended plain list overlap, so the override is the escape hatch.
 */
export function sniffFormat(text: string): SourceFormat {
  const source = normalizeText(text);
  if (isBlank(source)) return 'list';

  try {
    JSON.parse(source);
    return 'json';
  } catch {
    // Not JSON; try YAML next.
  }

  try {
    // 'error' matches parseYamlSource's strictness: sniffing something as YAML
    // that then fails to actually parse as YAML would strand the user on a
    // format the app picked for them but can't itself read.
    const payload = parseYamlText(source, { logLevel: 'error' });
    // A bare scalar means YAML read the whole blob as one string, which is
    // never what a user pasting a list meant.
    if (payload !== null && typeof payload === 'object') return 'yaml';
  } catch {
    // Not YAML either.
  }

  return 'list';
}

export function parseSource(text: string, format: SourceFormat): ParseResult<unknown> {
  if (isBlank(text)) {
    return { ok: false, issues: [{ path: '', message: 'There is nothing to read yet.' }] };
  }

  const source = normalizeText(text);

  switch (format) {
    case 'list':
      return { ok: true, data: parsePlainList(source) };
    case 'json':
      return parseJsonSource(source);
    case 'yaml':
      return parseYamlSource(source);
  }
}

function parseJsonSource(source: string): ParseResult<unknown> {
  try {
    return { ok: true, data: JSON.parse(source) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const offset = Number(/position (\d+)/.exec(message)?.[1] ?? NaN);
    const line = Number.isNaN(offset) ? undefined : lineForOffset(source, offset);

    return {
      ok: false,
      issues: [
        { path: '', message: `Invalid JSON: ${message}`, ...(line === undefined ? {} : { line }) },
      ],
    };
  }
}

interface YamlParseError extends Error {
  linePos?: { line: number; col: number }[];
}

function parseYamlSource(source: string): ParseResult<unknown> {
  try {
    // 'error' keeps real errors throwing but drops warnings, so malformed
    // pasted text surfaces on the data screen instead of the browser console.
    return { ok: true, data: parseYamlText(source, { logLevel: 'error' }) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const line = (error as YamlParseError)?.linePos?.[0]?.line;
    const issue: ParseIssue = {
      path: '',
      message: `Invalid YAML: ${message}`,
      ...(typeof line === 'number' ? { line } : {}),
    };

    return { ok: false, issues: [issue] };
  }
}
