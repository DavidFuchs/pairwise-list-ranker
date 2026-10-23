import { stringify as stringifyYaml } from 'yaml';

/**
 * Renders a parsed document back to JSON or YAML syntax. Shared by the export
 * screen and the data screen's format tabs, so switching between them and
 * round-tripping the text always agrees on the same formatting.
 */
export function serializeDocument(document: unknown, format: 'json' | 'yaml'): string {
  return format === 'json'
    ? `${JSON.stringify(document, null, 2)}\n`
    : stringifyYaml(document, { lineWidth: 0 });
}
