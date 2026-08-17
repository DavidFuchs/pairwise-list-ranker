import type { SourceFormat } from '@/types/source';

const EXTENSIONS: Record<SourceFormat, string> = {
  yaml: 'yaml',
  json: 'json',
  list: 'txt',
};

const MIME_TYPES: Record<SourceFormat, string> = {
  yaml: 'application/yaml',
  json: 'application/json',
  list: 'text/plain',
};

export function extensionFor(format: SourceFormat): string {
  return EXTENSIONS[format];
}

export function mimeTypeFor(format: SourceFormat): string {
  return MIME_TYPES[format];
}

export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'list' : slug;
}

/** e.g. `favorite-sci-fi-films-2026-08-16.yaml` */
export function exportFilename(name: string, format: SourceFormat, at: Date = new Date()): string {
  return `${slugify(name)}-${at.toISOString().slice(0, 10)}.${extensionFor(format)}`;
}
