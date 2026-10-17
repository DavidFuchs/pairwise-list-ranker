import { describe, expect, it } from 'vitest';

import { readTextFile } from '@/lib/browser/fileText';

const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
]);

describe('readTextFile', () => {
  it('reads YAML, JSON and plain text, including files with no stated type', async () => {
    expect(await readTextFile(new File(['- Alien\n'], 'films.yaml', { type: '' }))).toEqual({
      name: 'films.yaml',
      text: '- Alien\n',
    });
    expect(await readTextFile(new File(['[1]'], 'a.json', { type: 'application/json' }))).toEqual({
      name: 'a.json',
      text: '[1]',
    });
    expect(await readTextFile(new File(['Alien'], 'a.txt', { type: 'text/plain' }))).toEqual({
      name: 'a.txt',
      text: 'Alien',
    });
  });

  it('refuses a file that says it is not text', async () => {
    const read = await readTextFile(new File([png], 'photo.png', { type: 'image/png' }));
    expect(read).toEqual({
      refused: '"photo.png" is not a text file. Pairwise reads plain lists, YAML and JSON.',
    });
  });

  it('refuses binary content even when the file names no type', async () => {
    expect('refused' in (await readTextFile(new File([png], 'mystery', { type: '' })))).toBe(true);
  });
});
