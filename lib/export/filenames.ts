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

function today(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * What to call the downloaded ranked list. Lists are not named by the user, so
 * the file is simply "pairwise" and the date, e.g. `pairwise-2026-08-16.yaml`.
 */
export function exportFilename(format: SourceFormat, at: Date = new Date()): string {
  return `pairwise-${today(at)}.${extensionFor(format)}`;
}

/** e.g. `pairwise-session-2026-08-16.json` */
export function sessionFilename(at: Date = new Date()): string {
  return `pairwise-session-${today(at)}.json`;
}
