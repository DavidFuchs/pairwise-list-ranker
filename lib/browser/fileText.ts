/** What reading a chosen or dropped file came to. */
export type FileText = { name: string; text: string } | { refused: string };

/** The kinds of file a list can come in, for the file picker. */
export const TEXT_FILE_ACCEPT = '.txt,.text,.csv,.tsv,.md,.yaml,.yml,.json,text/*,application/json';

/** Types that are text even though they do not say text/. */
const TEXT_TYPES = /^text\/|json|yaml|xml|javascript|csv/i;

/** How far into a file to look for signs that it is not text. */
const SNIFF_LENGTH = 4096;

/**
 * Reads a file as text, or refuses it with a reason the user can act on. A
 * picture or a spreadsheet read as text is a page of noise, which the editor
 * would otherwise take for a list and rank.
 */
export async function readTextFile(file: File): Promise<FileText> {
  const refused = {
    refused: `"${file.name}" is not a text file. Pairwise reads plain lists, YAML and JSON.`,
  };
  // An empty type is common for .yaml and .txt, so only a stated non-text type rules a file out.
  if (file.type !== '' && !TEXT_TYPES.test(file.type)) return refused;

  const text = await file.text();
  const head = text.slice(0, SNIFF_LENGTH);
  // NUL never appears in text, and runs of replacement characters are bytes
  // that did not decode as UTF-8.
  const undecodable = head.match(/�/g)?.length ?? 0;
  if (head.includes('\u0000') || undecodable > Math.max(2, head.length / 100)) return refused;

  return { name: file.name, text };
}
