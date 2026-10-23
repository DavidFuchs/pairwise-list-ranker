/** Words that read as letters, kept in capitals wherever they fall. */
const ACRONYMS = new Set([
  'api',
  'aud',
  'cad',
  'chf',
  'dvd',
  'eur',
  'gbp',
  'html',
  'id',
  'imdb',
  'inr',
  'ip',
  'isbn',
  'jpy',
  'json',
  'mpaa',
  'tv',
  'uk',
  'uri',
  'url',
  'us',
  'usa',
  'usd',
  'yaml',
]);

/**
 * A field's name as a person would write it, for the cards and the ranked list:
 * `box_office_usd` reads "Box office USD", `releaseDate` reads "Release date".
 * A name that already has spaces is the user's own wording and is left alone,
 * and the field picker keeps the raw key, where it identifies the field.
 *
 * `unitWords` are units the value is already drawn in, dropped from the end of
 * the name (with an "in" before them) so long as a word is left.
 */
export function fieldLabel(field: string, unitWords: readonly string[] = []): string {
  if (/\s/.test(field) || field === '') return field;
  const words = field
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .split(/[_\-.]+|\s+/)
    .filter((word) => word !== '')
    .map((word) => (ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word.toLowerCase()));
  if (words.length > 1 && unitWords.includes(words[words.length - 1]!.toLowerCase())) {
    words.pop();
    if (words.length > 1 && words[words.length - 1] === 'in') words.pop();
  }
  if (words.length === 0) return field;
  const [first, ...rest] = words;
  return [first!.charAt(0).toUpperCase() + first!.slice(1), ...rest].join(' ');
}
