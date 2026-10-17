import { describe, expect, it } from 'vitest';

import { fieldLabel } from '@/lib/renderers';

describe('fieldLabel', () => {
  it('reads snake, kebab and camel case as words, in sentence case', () => {
    expect(fieldLabel('rotten_tomatoes')).toBe('Rotten tomatoes');
    expect(fieldLabel('release-date')).toBe('Release date');
    expect(fieldLabel('releaseDate')).toBe('Release date');
    expect(fieldLabel('year')).toBe('Year');
  });

  it('keeps letter-words in capitals wherever they fall', () => {
    expect(fieldLabel('box_office_usd')).toBe('Box office USD');
    expect(fieldLabel('imdb_url')).toBe('IMDB URL');
    expect(fieldLabel('mpaaRating')).toBe('MPAA rating');
  });

  it('leaves a name that already has spaces as the user wrote it', () => {
    expect(fieldLabel('Rotten Tomatoes')).toBe('Rotten Tomatoes');
  });
});
