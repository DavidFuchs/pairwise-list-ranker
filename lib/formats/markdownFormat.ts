import { parse as parseYamlText, stringify as stringifyYaml } from 'yaml';

import { canonicalizeDocument, isBlank, normalizeText } from '@/lib/formats/canonical';
import type { ParseIssue, ParseResult } from '@/lib/validation/listSchemas';
import { parseListDocument } from '@/lib/validation/listSchemas';
import { isComplexItemValue } from '@/types/list';
import type { ListDocument, ListDocumentItem } from '@/types/workspace';
import { LIST_DOCUMENT_VERSION } from '@/types/workspace';

/**
 * A strict, app-defined Markdown dialect (ARCHITECTURE.md section 7.4) — not
 * general Markdown import. Object items are `## heading` sections whose body is
 * a fenced YAML block; simple items are one-line bullets. Item ids are not
 * represented, so importing Markdown assigns fresh ids.
 */

const TITLE_PATTERN = /^#\s+(.+)$/;
const SECTION_PATTERN = /^##\s+(.*)$/;
const BULLET_PATTERN = /^[-*]\s+(.*)$/;
const FENCE_PATTERN = /^(`{3,})\s*([A-Za-z]*)\s*$/;
const METADATA_PATTERN = /^(Kind|Sort field|Version):\s*(.*)$/i;

const YAML_FENCE_LANGUAGES = new Set(['', 'yaml', 'yml']);

export function serializeMarkdown(doc: ListDocument): string {
  const canonical = canonicalizeDocument(doc);
  const blocks: string[] = [`# ${canonical.title}`];

  if (canonical.description !== undefined && canonical.description.trim() !== '') {
    blocks.push(canonical.description);
  }

  if (canonical.kind === 'object') {
    const metadata = ['Kind: object'];
    if (canonical.sortField !== undefined) metadata.push(`Sort field: ${canonical.sortField}`);
    blocks.push(metadata.join('\n'));

    canonical.items.forEach((item, index) => {
      const body = stringifyYaml(item.value, { lineWidth: 0 }).trimEnd();
      const fence = '`'.repeat(fenceLengthFor(body));
      blocks.push(`## ${labelFor(item, canonical.sortField, index)}`);
      blocks.push(`${fence}yaml\n${body}\n${fence}`);
    });
  } else {
    blocks.push(canonical.items.map((item) => `- ${escapeBullet(String(item.value))}`).join('\n'));
  }

  return `${blocks.join('\n\n')}\n`;
}

export function parseMarkdown(text: string): ParseResult<ListDocument> {
  if (isBlank(text)) {
    return {
      ok: false,
      issues: [{ path: '', message: 'There is nothing to import: the Markdown is empty.' }],
    };
  }

  const lines = normalizeText(text).split('\n');
  const titleIndex = lines.findIndex((line) => line.trim() !== '');
  const titleMatch = TITLE_PATTERN.exec(lines[titleIndex]!.trim());

  if (!titleMatch?.[1]) {
    return {
      ok: false,
      issues: [
        {
          path: 'title',
          message: 'Expected the list title on the first line, written as "# My list".',
          line: titleIndex + 1,
        },
      ],
    };
  }

  const scan = scanBody(lines, titleIndex + 1);
  if (scan.issues.length > 0) return { ok: false, issues: scan.issues };

  if (scan.bullets.length > 0 && scan.sections.length > 0) {
    return {
      ok: false,
      issues: [
        {
          path: 'items',
          message: 'A list cannot mix bullet items and "##" object sections. Use one or the other.',
          line: scan.mixedAtLine,
        },
      ],
    };
  }

  if (scan.bullets.length === 0 && scan.sections.length === 0) {
    return {
      ok: false,
      issues: [
        {
          path: 'items',
          message: 'Found no items. Add bullets like "- Tacos", or "##" sections with yaml blocks.',
        },
      ],
    };
  }

  const kind = scan.sections.length > 0 ? 'object' : 'primitive';
  const declaredKind = scan.metadata.get('kind');
  if (declaredKind !== undefined && declaredKind !== kind) {
    return {
      ok: false,
      issues: [
        {
          path: 'kind',
          message: `The document says "Kind: ${declaredKind}" but its items are a ${kind} list.`,
        },
      ],
    };
  }

  const items: ListDocumentItem[] = [];
  if (kind === 'object') {
    for (const section of scan.sections) {
      const parsed = parseSectionBody(section);
      if ('issue' in parsed) return { ok: false, issues: [parsed.issue] };
      items.push({ value: parsed.value });
    }
  } else {
    for (const bullet of scan.bullets) {
      items.push({ value: unescapeBullet(bullet) });
    }
  }

  const declaredVersion = Number(scan.metadata.get('version'));
  const sortField = scan.metadata.get('sort field');
  const description = scan.description;

  return parseListDocument({
    version: Number.isFinite(declaredVersion) && declaredVersion > 0 ? declaredVersion : LIST_DOCUMENT_VERSION,
    title: titleMatch[1].trim(),
    ...(description === undefined ? {} : { description }),
    kind,
    ...(sortField === undefined ? {} : { sortField }),
    items,
  });
}

interface Section {
  label: string;
  /** 1-based line of the `##` heading. */
  headingLine: number;
  body?: { text: string; startLine: number };
}

interface BodyScan {
  metadata: Map<string, string>;
  description?: string;
  bullets: string[];
  sections: Section[];
  mixedAtLine?: number;
  issues: ParseIssue[];
}

function scanBody(lines: string[], startIndex: number): BodyScan {
  const scan: BodyScan = { metadata: new Map(), bullets: [], sections: [], issues: [] };
  const descriptionLines: string[] = [];
  let current: Section | undefined;

  for (let index = startIndex; index < lines.length; index += 1) {
    const raw = lines[index]!;
    const line = raw.trim();
    const lineNumber = index + 1;

    if (line === '') continue;

    const fence = FENCE_PATTERN.exec(line);
    if (fence?.[1]) {
      const closing = findFenceEnd(lines, index, fence[1]);
      if (closing === -1) {
        scan.issues.push({
          path: 'items',
          message: 'A code block was opened but never closed.',
          line: lineNumber,
        });
        return scan;
      }

      const isYamlBlock = YAML_FENCE_LANGUAGES.has((fence[2] ?? '').toLowerCase());
      if (current && current.body === undefined && isYamlBlock) {
        current.body = {
          text: lines.slice(index + 1, closing).join('\n'),
          startLine: lineNumber,
        };
      }
      index = closing;
      continue;
    }

    const section = SECTION_PATTERN.exec(line);
    if (section) {
      if (scan.bullets.length > 0 && scan.mixedAtLine === undefined) scan.mixedAtLine = lineNumber;
      current = { label: (section[1] ?? '').trim(), headingLine: lineNumber };
      scan.sections.push(current);
      continue;
    }

    const bullet = BULLET_PATTERN.exec(line);
    if (bullet && current === undefined) {
      if (scan.sections.length > 0 && scan.mixedAtLine === undefined) scan.mixedAtLine = lineNumber;
      scan.bullets.push(bullet[1] ?? '');
      continue;
    }

    if (current !== undefined) continue;

    const metadata = METADATA_PATTERN.exec(line);
    if (metadata?.[1] && scan.bullets.length === 0) {
      scan.metadata.set(metadata[1].toLowerCase(), (metadata[2] ?? '').trim());
      continue;
    }

    if (scan.bullets.length === 0) descriptionLines.push(line);
  }

  if (descriptionLines.length > 0) scan.description = descriptionLines.join('\n');
  return scan;
}

function findFenceEnd(lines: string[], openIndex: number, fence: string): number {
  for (let index = openIndex + 1; index < lines.length; index += 1) {
    const candidate = lines[index]!.trim();
    if (/^`{3,}$/.test(candidate) && candidate.length >= fence.length) return index;
  }
  return -1;
}

function parseSectionBody(
  section: Section,
): { value: Record<string, unknown> } | { issue: ParseIssue } {
  if (section.body === undefined) {
    return {
      issue: {
        path: 'items',
        message: `The section "${section.label}" has no yaml block. Every object item needs one.`,
        line: section.headingLine,
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = parseYamlText(section.body.text, { logLevel: 'error' });
  } catch (error) {
    return { issue: yamlIssue(error, section) };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      issue: {
        path: 'items',
        message: `The yaml block for "${section.label}" must describe an object with named fields.`,
        line: section.body.startLine,
      },
    };
  }

  return { value: parsed as Record<string, unknown> };
}

interface YamlParseError extends Error {
  linePos?: { line: number; col: number }[];
}

function yamlIssue(error: unknown, section: Section): ParseIssue {
  const message = error instanceof Error ? error.message : String(error);
  const blockLine = (error as YamlParseError)?.linePos?.[0]?.line;
  const startLine = section.body?.startLine ?? section.headingLine;

  return {
    path: 'items',
    message: `Invalid YAML in "${section.label}": ${message}`,
    line: typeof blockLine === 'number' ? startLine + blockLine : startLine,
  };
}

function labelFor(item: ListDocumentItem, sortField: string | undefined, index: number): string {
  const value = item.value;
  if (isComplexItemValue(value)) {
    const preferred = sortField === undefined ? undefined : value[sortField];
    if (typeof preferred === 'string' || typeof preferred === 'number') return String(preferred);

    const firstString = Object.values(value).find((entry) => typeof entry === 'string');
    if (typeof firstString === 'string') return firstString;
  }
  return `Item ${index + 1}`;
}

/** Fences must be longer than any backtick run inside the block they wrap. */
function fenceLengthFor(body: string): number {
  const runs = body.match(/`+/g) ?? [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  return Math.max(3, longest + 1);
}

function escapeBullet(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
}

function unescapeBullet(value: string): string {
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '\\' && index + 1 < value.length) {
      const next = value[index + 1];
      if (next === 'n') {
        result += '\n';
        index += 1;
        continue;
      }
      if (next === '\\') {
        result += '\\';
        index += 1;
        continue;
      }
    }
    result += char;
  }
  return result;
}
