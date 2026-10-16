import { describe, expect, it } from 'vitest';

import { cleanRenderers, layoutSummary, rendererOptionsFor } from '@/lib/renderers';
import { resolveRoles } from '@/lib/import/roles';

describe('rendererOptionsFor', () => {
  it('always offers the plain type, named after it', () => {
    expect(rendererOptionsFor(['number'])[0]).toEqual({ id: undefined, label: 'number' });
  });

  it('offers the preview for strings and numbers only', () => {
    expect(rendererOptionsFor(['string']).map((option) => option.id)).toContain('apple-music-preview');
    expect(rendererOptionsFor(['number']).map((option) => option.id)).toContain('apple-music-preview');
    expect(rendererOptionsFor(['boolean']).map((option) => option.id)).not.toContain('apple-music-preview');
    expect(rendererOptionsFor(['string', 'object']).map((option) => option.id)).not.toContain('apple-music-preview');
  });
});

describe('cleanRenderers', () => {
  it('keeps renderers for shown fields only', () => {
    expect(cleanRenderers({ id: 'apple-music-preview', gone: 'apple-music-preview' }, ['id'])).toEqual({
      id: 'apple-music-preview',
    });
  });

  it('is absent when nothing is left', () => {
    expect(cleanRenderers({ gone: 'apple-music-preview' }, ['id'])).toBeUndefined();
  });
});

describe('layoutSummary', () => {
  it('takes the preview field out of the plain lines', () => {
    expect(
      layoutSummary({
        summaryFields: ['artist', 'apple_music_id', 'year'],
        fieldRenderers: { apple_music_id: 'apple-music-preview' },
      }),
    ).toEqual({ plainFields: ['artist', 'year'], previewField: 'apple_music_id' });
  });

  it('has no preview field by default', () => {
    expect(layoutSummary({ summaryFields: ['artist'] })).toEqual({
      plainFields: ['artist'],
      previewField: undefined,
    });
  });
});

describe('resolveRoles fieldRenderers', () => {
  const entries = [
    { title: 'A', artist: 'X', apple_music_id: '1' },
    { title: 'B', artist: 'Y', apple_music_id: '2' },
  ];

  it('keeps a renderer on a field still shown', () => {
    const roles = resolveRoles(entries, {
      labelField: 'title',
      summaryFields: ['artist', 'apple_music_id'],
      fieldRenderers: { apple_music_id: 'apple-music-preview' },
    });
    expect(roles.fieldRenderers).toEqual({ apple_music_id: 'apple-music-preview' });
  });

  it('drops a renderer whose field is no longer in the data', () => {
    const roles = resolveRoles(entries, {
      labelField: 'title',
      summaryFields: ['artist', 'removed'],
      fieldRenderers: { removed: 'apple-music-preview' },
    });
    expect(roles.fieldRenderers).toBeUndefined();
  });

  it('allows five summary fields', () => {
    const wide = [{ title: 'A', a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }];
    expect(resolveRoles(wide, { labelField: 'title' }).summaryFields).toHaveLength(5);
  });
});
