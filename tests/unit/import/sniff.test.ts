import { describe, expect, it } from 'vitest';

import { parseSource, sniffFormat } from '@/lib/import/sniff';

describe('sniffFormat', () => {
  it('detects JSON', () => {
    expect(sniffFormat('[{"title":"Alien"}]')).toBe('json');
  });

  it('detects YAML mappings', () => {
    expect(sniffFormat('movies:\n  - title: Alien\n')).toBe('yaml');
  });

  it('detects YAML sequences', () => {
    expect(sniffFormat('- title: Alien\n- title: Arrival\n')).toBe('yaml');
  });

  it('treats bare lines as a plain list', () => {
    expect(sniffFormat('Alien\nArrival\nSolaris\n')).toBe('list');
  });

  it('treats a bulleted list of plain text as YAML, which reads it the same way', () => {
    expect(sniffFormat('- Alien\n- Arrival\n')).toBe('yaml');
  });

  it('treats a single word as a plain list, not a YAML scalar', () => {
    expect(sniffFormat('Alien')).toBe('list');
  });

  it('treats a list whose first line looks like a YAML key as a plain list', () => {
    // "2001: A Space Odyssey" reads as a YAML mapping key on its own, but the
    // following bare lines make the whole blob invalid YAML - sniffing must
    // reject it the same way parseSource would, not hand back a format it
    // cannot actually parse.
    const text = '2001: A Space Odyssey\nBlade Runner\nAlien\n';

    expect(sniffFormat(text)).toBe('list');
    expect(parseSource(text, sniffFormat(text))).toEqual({
      ok: true,
      data: ['2001: A Space Odyssey', 'Blade Runner', 'Alien'],
    });
  });
});

describe('parseSource', () => {
  it('parses JSON to the value verbatim', () => {
    const result = parseSource('{"a":[1,2]}', 'json');

    expect(result).toEqual({ ok: true, data: { a: [1, 2] } });
  });

  it('parses YAML to the value verbatim', () => {
    const result = parseSource('owner: david\nmovies:\n  - Alien\n', 'yaml');

    expect(result).toEqual({ ok: true, data: { owner: 'david', movies: ['Alien'] } });
  });

  it('parses a plain list to an array of strings', () => {
    const result = parseSource('Alien\nArrival\n', 'list');

    expect(result).toEqual({ ok: true, data: ['Alien', 'Arrival'] });
  });

  it('reports a JSON syntax error, naming the format', () => {
    const result = parseSource('{\n  "a": ,\n}', 'json');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toMatch(/invalid json/i);
  });

  // V8 only reports a character offset for some syntax errors, so the line is
  // best-effort for JSON. It is always available for YAML.
  it('reports the line of a JSON error when the runtime gives a position', () => {
    const result = parseSource('{"a": 1}\n{"b": 2}', 'json');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.line).toBe(2);
  });

  it('reports a YAML syntax error with a line number', () => {
    const result = parseSource('movies:\n  - a\n - b\n', 'yaml');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.line).toBe(3);
  });

  it('refuses empty text', () => {
    const result = parseSource('   \n  ', 'yaml');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toMatch(/nothing to read/i);
  });

  it('strips a byte order mark before parsing', () => {
    const result = parseSource('﻿{"a":1}', 'json');

    expect(result).toEqual({ ok: true, data: { a: 1 } });
  });
});
