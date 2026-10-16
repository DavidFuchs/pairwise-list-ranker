import { describe, expect, it } from 'vitest';

import {
  cleanRenderers,
  formatValue,
  isImageLink,
  layoutSummary,
  pictureUrl,
  ratingFraction,
  ratingText,
  rendererOptionsFor,
  youtubeId,
} from '@/lib/renderers';
import { resolveRoles } from '@/lib/import/roles';

const offered = (values: unknown[]) => rendererOptionsFor(values).map((option) => option.id);

describe('rendererOptionsFor', () => {
  it('always offers the plain type, named after it', () => {
    expect(rendererOptionsFor([1, 2])[0]).toEqual({ id: undefined, label: 'number' });
  });

  it('offers the preview for strings and numbers only', () => {
    expect(offered(['123'])).toContain('apple-music-preview');
    expect(offered([123])).toContain('apple-music-preview');
    expect(offered([true])).not.toContain('apple-music-preview');
    expect(offered(['123', { a: 1 }])).not.toContain('apple-music-preview');
    // Scores and words are not track ids.
    expect(offered([9.2, 7])).not.toContain('apple-music-preview');
    expect(offered(['Pop'])).not.toContain('apple-music-preview');
  });

  it('offers a link when every value is a web address', () => {
    expect(offered(['https://example.com/a', 'http://example.com/b'])).toContain('link');
    expect(offered(['https://example.com/a', 'example.com/b'])).not.toContain('link');
    expect(offered(['ftp://example.com/a'])).not.toContain('link');
  });

  it('offers an image when every value is a link to an image file', () => {
    expect(offered(['https://example.com/a.png', 'https://example.com/b.JPEG?w=100'])).toContain('image');
    expect(offered(['https://example.com/a.webp#top', 'https://example.com/b.gif'])).toContain('image');
    expect(offered(['https://example.com/a.png', 'https://example.com/page'])).not.toContain('image');
    expect(offered(['https://example.com/png'])).not.toContain('image');
    expect(offered(['photo.png'])).not.toContain('image');
  });

  it('ignores items without the field', () => {
    expect(offered(['https://example.com/a.png', undefined])).toContain('image');
    expect(offered([])).toEqual([undefined]);
  });
});

describe('isImageLink', () => {
  it('reads the extension from the path alone', () => {
    expect(isImageLink('https://cdn.example.com/x/100x100bb.jpg')).toBe(true);
    expect(isImageLink('https://example.com/image.php?file=a.png')).toBe(false);
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
    ).toEqual({
      plainFields: ['artist', 'year'],
      renderers: {},
      previewField: 'apple_music_id',
      pictureField: undefined,
      pictureRenderer: undefined,
    });
  });

  it('keeps each line with its renderer', () => {
    expect(
      layoutSummary({ summaryFields: ['score', 'genres'], fieldRenderers: { score: 'stars-10', genres: 'tags' } }).renderers,
    ).toEqual({ score: 'stars-10', genres: 'tags' });
  });

  it('pictures one field, image or video, and shows the next as a link', () => {
    expect(
      layoutSummary({
        summaryFields: ['site', 'video', 'cover'],
        fieldRenderers: { site: 'link', video: 'youtube', cover: 'image' },
      }),
    ).toEqual({
      plainFields: ['site', 'cover'],
      renderers: { site: 'link', cover: 'link' },
      previewField: undefined,
      pictureField: 'video',
      pictureRenderer: 'youtube',
    });
  });
});

describe('new renderers', () => {
  it('offers YouTube thumbnails for every kind of video address', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?t=42',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://m.youtube.com/embed/dQw4w9WgXcQ',
    ]) {
      expect(youtubeId(url)).toBe('dQw4w9WgXcQ');
    }
    expect(offered(['https://www.youtube.com/@channel'])).not.toContain('youtube');
    expect(pictureUrl('https://youtu.be/dQw4w9WgXcQ', 'youtube')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });

  it('offers tags for lists of words or numbers, empty ones included', () => {
    expect(offered([['Pop'], [], [1, 'two']])).toContain('tags');
    expect(offered([['Pop'], [{ name: 'x' }]])).not.toContain('tags');
    expect(formatValue(['Pop', 'Disco'], 'tags', 'genres')).toBe('Pop, Disco');
    expect(formatValue([], 'tags', 'genres')).toBe('–');
  });

  it('offers dates only for real calendar dates, read without a time zone shift', () => {
    expect(offered(['2024-04-12', '2021-08-13T10:00:00Z'])).toEqual(expect.arrayContaining(['date', 'year']));
    expect(offered(['2023-02-30'])).not.toContain('date');
    expect(offered(['12/04/2024'])).not.toContain('date');
    expect(formatValue('2024-01-01', 'year', 'released')).toBe('2024');
    // Midnight UTC must not become the 31st in a time zone west of it.
    expect(formatValue('2024-01-01', 'date', 'released')).toMatch(/1/);
    expect(formatValue('2024-01-01', 'date', 'released')).not.toMatch(/31/);
  });

  it('reads durations as minutes and seconds, or hours past an hour', () => {
    expect(offered([171, 0])).toContain('duration');
    expect(offered([171.5])).not.toContain('duration');
    expect(offered([-3])).not.toContain('duration');
    expect(formatValue(171, 'duration', 'length')).toBe('2:51');
    expect(formatValue(3735, 'duration', 'length')).toBe('1:02:15');
    expect(formatValue(5, 'duration', 'length')).toBe('0:05');
  });

  it('offers compact numbers only where there is something to shorten', () => {
    expect(offered([12, 1534000])).toContain('compact');
    expect(offered([12, 999])).not.toContain('compact');
  });

  it('draws a badge as the field name when true and nothing when false', () => {
    expect(offered([true, false])).toContain('badge');
    expect(formatValue(true, 'badge', 'explicit')).toBe('explicit');
    expect(formatValue(false, 'badge', 'explicit')).toBeNull();
  });

  it('offers each rating at every scale its values fit under', () => {
    const rating = rendererOptionsFor([9.2, 6]).find((option) => option.label === 'Stars');
    expect(rating?.scales?.map((entry) => entry.scale)).toEqual([10, 100]);
    expect(rating?.id).toBe('stars-10');
    expect(rendererOptionsFor([0.4, 0.9]).find((option) => option.label === 'Bar')?.scales?.map((entry) => entry.scale)).toEqual([1, 5, 10, 100]);
    expect(rendererOptionsFor([-1, 3]).find((option) => option.label === 'Stars')).toBeUndefined();
    expect(rendererOptionsFor([250]).find((option) => option.label === 'Stars')).toBeUndefined();
  });

  it('fills a rating to its share of the scale', () => {
    expect(ratingFraction(9.2, 10)).toBeCloseTo(0.92);
    expect(ratingFraction(12, 10)).toBe(1);
    expect(ratingText(9.2, 10)).toBe('9.2/10');
    expect(ratingText(0.86, 1)).toBe('86%');
    expect(formatValue(9.2, 'stars-10', 'score')).toBe('★ 9.2/10');
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

  it('has no limit on summary fields', () => {
    const wide = [{ title: 'A', a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }];
    const all = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(resolveRoles(wide, { labelField: 'title', summaryFields: all }).summaryFields).toEqual(all);
  });
});
