import { describe, expect, it } from 'vitest';

import { fieldLabel, fieldLabelFor } from '@/lib/renderers';

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

describe('fieldLabelFor', () => {
  it('drops a unit the duration renderer already shows', () => {
    expect(fieldLabelFor('duration_sec', 'duration')).toBe('Duration');
    expect(fieldLabelFor('lengthSeconds', 'duration')).toBe('Length');
    expect(fieldLabelFor('runtime_in_secs', 'duration')).toBe('Runtime');
    expect(fieldLabelFor('track_ms', 'duration')).toBe('Track');
  });

  it('drops a currency the money renderer already shows', () => {
    expect(fieldLabelFor('price_usd', 'currency-USD')).toBe('Price');
    expect(fieldLabelFor('box_office_usd', 'currency-CAD')).toBe('Box office USD');
  });

  it('keeps the unit where the value is drawn as it is', () => {
    expect(fieldLabelFor('duration_sec', undefined)).toBe('Duration sec');
    expect(fieldLabelFor('duration_sec', 'compact')).toBe('Duration sec');
  });

  it('never leaves a name with no words', () => {
    expect(fieldLabelFor('seconds', 'duration')).toBe('Seconds');
    expect(fieldLabelFor('in_seconds', 'duration')).toBe('In');
  });
});
