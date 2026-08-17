import { describe, expect, it } from 'vitest';

import { parsePlainList } from '@/lib/import/plainList';

describe('parsePlainList', () => {
  it('takes one item per line', () => {
    expect(parsePlainList('Alien\nArrival\nSolaris')).toEqual(['Alien', 'Arrival', 'Solaris']);
  });

  it('drops blank lines and surrounding whitespace', () => {
    expect(parsePlainList('  Alien  \n\n\n  Arrival\n')).toEqual(['Alien', 'Arrival']);
  });

  it('strips dash, star, plus, and unicode bullets', () => {
    expect(parsePlainList('- Alien\n* Arrival\n+ Solaris\n• Stalker\n')).toEqual([
      'Alien',
      'Arrival',
      'Solaris',
      'Stalker',
    ]);
  });

  it('strips en dashes, em dashes, and blockquote markers', () => {
    expect(parsePlainList('– Alien\n- Arrival\n> Solaris')).toEqual([
      'Alien',
      'Arrival',
      'Solaris',
    ]);
  });

  it('strips numbered markers in every common style', () => {
    expect(parsePlainList('1. Alien\n2) Arrival\n(3) Solaris\n10. Stalker')).toEqual([
      'Alien',
      'Arrival',
      'Solaris',
      'Stalker',
    ]);
  });

  it('strips task boxes, checked or not', () => {
    expect(parsePlainList('- [ ] Alien\n- [x] Arrival')).toEqual(['Alien', 'Arrival']);
  });

  it('strips only one marker per line', () => {
    expect(parsePlainList('- - Alien')).toEqual(['- Alien']);
  });

  it('keeps a leading dash that is part of the text', () => {
    expect(parsePlainList('-40 below zero\n-fatal error')).toEqual([
      '-40 below zero',
      '-fatal error',
    ]);
  });

  it('keeps a number that is part of the text', () => {
    expect(parsePlainList('1984\n2001: A Space Odyssey')).toEqual([
      '1984',
      '2001: A Space Odyssey',
    ]);
  });

  it('reads an indented list the same as a flat one', () => {
    expect(parsePlainList('  - Alien\n    - Arrival')).toEqual(['Alien', 'Arrival']);
  });

  it('returns nothing for blank text', () => {
    expect(parsePlainList('   \n\n  ')).toEqual([]);
  });
});
