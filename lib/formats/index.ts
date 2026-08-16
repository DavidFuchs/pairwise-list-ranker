import { parseJson, serializeJson, type ParseOptions } from '@/lib/formats/jsonFormat';
import { parseMarkdown, serializeMarkdown } from '@/lib/formats/markdownFormat';
import { parseYaml, serializeYaml } from '@/lib/formats/yamlFormat';
import type { ParseResult } from '@/lib/validation/listSchemas';
import type { TextFormat } from '@/types/list';
import type { ListDocument } from '@/types/workspace';

export { canonicalizeDocument, normalizeText } from '@/lib/formats/canonical';
export { documentFromWorkspace, workspaceFromDocument } from '@/lib/formats/documentMapping';
export { parseJson, serializeJson } from '@/lib/formats/jsonFormat';
export { parseMarkdown, serializeMarkdown } from '@/lib/formats/markdownFormat';
export { parseYaml, serializeYaml } from '@/lib/formats/yamlFormat';
export type { ParseOptions } from '@/lib/formats/jsonFormat';

/** The formats that produce copyable/downloadable output. The GUI view never does. */
export const TEXT_FORMATS: readonly TextFormat[] = ['yaml', 'json', 'markdown'] as const;

const EXTENSIONS: Record<TextFormat, string> = {
  yaml: 'yaml',
  json: 'json',
  markdown: 'md',
};

const MIME_TYPES: Record<TextFormat, string> = {
  yaml: 'application/yaml',
  json: 'application/json',
  markdown: 'text/markdown',
};

export function serializeDocument(doc: ListDocument, format: TextFormat): string {
  switch (format) {
    case 'json':
      return serializeJson(doc);
    case 'yaml':
      return serializeYaml(doc);
    case 'markdown':
      return serializeMarkdown(doc);
  }
}

export function parseDocument(
  text: string,
  format: TextFormat,
  options: ParseOptions = {},
): ParseResult<ListDocument> {
  switch (format) {
    case 'json':
      return parseJson(text, options);
    case 'yaml':
      return parseYaml(text, options);
    case 'markdown':
      return parseMarkdown(text);
  }
}

export function mimeTypeFor(format: TextFormat): string {
  return MIME_TYPES[format];
}

export function extensionFor(format: TextFormat): string {
  return EXTENSIONS[format];
}

/** e.g. `favorite-sci-fi-films-2026-08-15.yaml` */
export function exportFilename(doc: ListDocument, format: TextFormat, at: Date = new Date()): string {
  const date = at.toISOString().slice(0, 10);
  return `${slugify(doc.title)}-${date}.${extensionFor(format)}`;
}

export function slugify(title: string): string {
  const slug = title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'list' : slug;
}
