import { describe, expect, it } from 'vitest';

import {
  pillTone,
  cleanRenderers,
  coordinates,
  deezerTrackId,
  flagText,
  formatValue,
  isColor,
  isImageLink,
  itemPictures,
  itemPreviewSources,
  layoutSummary,
  mapUrl,
  picturesOf,
  ratingFraction,
  ratingText,
  regionCode,
  rendererCaveat,
  rendererOptionsFor,
  slotOf,
  steamAppId,
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

  it('reads null and blank values as missing, so one empty cell rules nothing out', () => {
    expect(offered(['https://example.com/a.png', null, '', '  '])).toContain('image');
    expect(offered(['Pop', 'Rock', null, 'Pop', ''])).toContain('pills');
    expect(offered(['2024-01-02', null])).toContain('date');
    expect(offered([4.5, null, 3])).toContain('stars-5');
    expect(offered([true, null])).toContain('badge');
    expect(offered([null, ''])).toEqual([undefined]);
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
  it('takes the play-button fields out of the plain lines', () => {
    expect(
      layoutSummary({
        summaryFields: ['artist', 'apple_music_id', 'year'],
        fieldRenderers: { apple_music_id: 'apple-music-preview' },
      }),
    ).toEqual({
      plainFields: ['artist', 'year'],
      renderers: { apple_music_id: 'apple-music-preview' },
      pictureFields: [],
      mediaFields: ['apple_music_id'],
    });
  });

  it('keeps each line with its renderer', () => {
    expect(
      layoutSummary({
        summaryFields: ['score', 'genres'],
        fieldRenderers: { score: 'stars-10', genres: 'tags' },
      }).renderers,
    ).toEqual({ score: 'stars-10', genres: 'tags' });
  });

  it('gives every picture field to the one gallery, in the card order', () => {
    expect(
      layoutSummary({
        summaryFields: ['site', 'video', 'cover', 'banner'],
        fieldRenderers: { site: 'link', video: 'youtube', cover: 'image', banner: 'steam-header' },
      }),
    ).toMatchObject({
      plainFields: ['site'],
      pictureFields: ['video', 'cover', 'banner'],
      mediaFields: [],
    });
  });

  it('lines up every clip source as a fallback, in the card order', () => {
    expect(
      layoutSummary({
        summaryFields: ['deezer', 'apple'],
        fieldRenderers: { deezer: 'deezer-preview', apple: 'apple-music-preview' },
      }).mediaFields,
    ).toEqual(['deezer', 'apple']);
  });
});

describe('item slots', () => {
  const song = {
    cover: 'https://example.com/a.jpg',
    shots: ['https://example.com/1.png', 'https://example.com/2.png'],
    apple: '1001',
    deezer: 'https://www.deezer.com/fr/track/3135556',
  };
  const read = (field: string) => (song as Record<string, unknown>)[field];
  const renderers = {
    cover: 'image',
    shots: 'image-gallery',
    apple: 'apple-music-preview',
    deezer: 'deezer-preview',
  } as const;

  it('pictures every image of every picture field, field by field', () => {
    expect(itemPictures(read, ['shots', 'cover'], renderers).map((picture) => picture.uri)).toEqual([
      'https://example.com/1.png',
      'https://example.com/2.png',
      'https://example.com/a.jpg',
    ]);
  });

  it('skips a field with nothing to picture', () => {
    expect(itemPictures(() => undefined, ['cover'], renderers)).toEqual([]);
  });

  it('names each clip source with its catalogue, in order', () => {
    expect(itemPreviewSources(read, ['deezer', 'apple'], renderers)).toEqual([
      { provider: 'deezer', id: '3135556' },
      { provider: 'apple', id: '1001' },
    ]);
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
    expect(picturesOf('https://youtu.be/dQw4w9WgXcQ', 'youtube')[0]?.uri).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    );
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
    expect(formatValue(true, 'badge', 'explicit')).toBe('Explicit');
    expect(formatValue(false, 'badge', 'explicit')).toBeNull();
  });

  it('offers each rating at every scale its values fit under', () => {
    const rating = rendererOptionsFor([9.2, 6]).find((option) => option.label === 'Stars');
    expect(rating?.variants?.map((entry) => entry.label)).toEqual(['10', '100']);
    expect(rating?.variantPrompt).toBe('out of');
    expect(rating?.id).toBe('stars-10');
    expect(
      rendererOptionsFor([0.4, 0.9])
        .find((option) => option.label === 'Bar')
        ?.variants?.map((entry) => entry.id),
    ).toEqual(['bar-1', 'bar-5', 'bar-10', 'bar-100']);
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

describe('picture and play-button renderers', () => {
  it('puts each renderer in its slot', () => {
    expect(['image', 'image-gallery', 'youtube', 'steam-header'].map((id) => slotOf(id as never))).toEqual([
      'picture',
      'picture',
      'picture',
      'picture',
    ]);
    expect(slotOf('deezer-preview')).toBe('media');
    expect(slotOf('apple-music-preview')).toBe('media');
    expect(slotOf('tags')).toBe('line');
    expect(slotOf(undefined)).toBe('line');
  });

  it('offers a gallery for lists of images, single images among them', () => {
    expect(
      offered([['https://example.com/a.png', 'https://example.com/b.jpg'], 'https://example.com/c.png']),
    ).toContain('image-gallery');
    expect(offered(['https://example.com/a.png'])).not.toContain('image-gallery');
    expect(offered([['https://example.com/a.png', 'https://example.com/page']])).not.toContain(
      'image-gallery',
    );
  });

  it('reads Steam app ids and store addresses, picturing the banner and opening the store', () => {
    expect(steamAppId(620)).toBe('620');
    expect(steamAppId('https://store.steampowered.com/app/1245620/ELDEN_RING/')).toBe('1245620');
    expect(steamAppId('Portal 2')).toBeUndefined();
    expect(offered([620, '1245620'])).toContain('steam-header');
    const [banner] = picturesOf(620, 'steam-header');
    expect(banner?.uri).toBe(
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg',
    );
    expect(banner?.href).toBe('https://store.steampowered.com/app/620');

    // Newer games keep their banner behind a hashed folder: the address
    // Steam hands out is drawn as given, and still links to the store.
    const hashed =
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2950790/0123abcd/header.jpg?t=1786000000';
    expect(steamAppId(hashed)).toBe('2950790');
    expect(offered([hashed])).toContain('steam-header');
    const [fresh] = picturesOf(hashed, 'steam-header');
    expect(fresh?.uri).toBe(hashed);
    expect(fresh?.href).toBe('https://store.steampowered.com/app/2950790');
    expect(steamAppId('https://example.com/steam/apps/1/header.jpg')).toBeUndefined();
    expect(banner?.aspect).toBeGreaterThan(2);
  });

  it('reads Deezer track ids and addresses', () => {
    expect(deezerTrackId('3135556')).toBe('3135556');
    expect(deezerTrackId('https://www.deezer.com/track/3135556')).toBe('3135556');
    expect(deezerTrackId('https://www.deezer.com/en/track/3135556?utm=x')).toBe('3135556');
    expect(deezerTrackId('https://www.deezer.com/album/302127')).toBeUndefined();
    expect(offered(['https://www.deezer.com/track/1'])).toContain('deezer-preview');
    expect(offered(['https://www.deezer.com/track/1'])).not.toContain('apple-music-preview');
  });
});

describe('line renderers', () => {
  it('offers currency for numbers, in each currency', () => {
    const money = rendererOptionsFor([120000, 98500.5]).find((option) => option.label === 'Currency');
    expect(money?.variantPrompt).toBe('in');
    expect(money?.variants?.map((entry) => entry.id)).toContain('currency-CAD');
    expect(offered(['120000'])).not.toContain('currency-USD');
    expect(formatValue(120000, 'currency-USD', 'salary')).toMatch(/120,000/);
    expect(formatValue(120000, 'currency-USD', 'salary')).not.toMatch(/\.00/);
    expect(formatValue(12.5, 'currency-EUR', 'price')).toMatch(/12\.50/);
  });

  it('offers pills for a few short words that repeat', () => {
    expect(offered(['High', 'Low', 'High', 'Medium'])).toContain('pills');
    // Every item different: names, not a category.
    expect(offered(['Arrival', 'Heat', 'Alien'])).not.toContain('pills');
    expect(offered(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'a'])).not.toContain('pills');
  });

  it('offers pills for a dozen or more categories, as long as they repeat', () => {
    const genres = [
      'Pop',
      'Rock',
      'Metal',
      'Country',
      'Jazz',
      'Blues',
      'Folk',
      'Soul',
      'Funk',
      'Reggae',
      'Punk',
      'Hip-Hop',
    ];
    expect(offered([...genres, ...genres])).toContain('pills');
    expect(offered(Array.from({ length: 60 }, (_, index) => `Genre ${index % 30}`))).not.toContain('pills');
  });

  it('offers pills for a field named like a category, even before its values repeat', () => {
    expect(rendererOptionsFor(['Pop', 'Rock', 'Metal'], 'genre').map((option) => option.id)).toContain(
      'pills',
    );
    expect(rendererOptionsFor(['Open', 'Closed'], 'Status').map((option) => option.id)).toContain('pills');
    expect(
      rendererOptionsFor(['Arrival', 'Heat', 'Alien'], 'title').map((option) => option.id),
    ).not.toContain('pills');
  });

  it('colours a pill by its word alone, and priorities by what they mean', () => {
    expect(pillTone('High')).toBe('red');
    expect(pillTone(' low ')).toBe('green');
    expect(pillTone('Medium')).toBe('amber');
    expect(pillTone('Thai')).toBe(pillTone('thai'));
  });

  it('offers long text for prose', () => {
    expect(offered(['short', 'x'.repeat(81)])).toContain('long-text');
    expect(offered(['two\nlines'])).toContain('long-text');
    expect(offered(['short', 'also short'])).not.toContain('long-text');
    expect(formatValue('one\n\n  two', 'long-text', 'notes')).toBe('one two');
  });

  it('offers a map for coordinates, and for text in a field named like a place', () => {
    expect(coordinates({ lat: 43.65, lng: -79.38 })).toEqual([43.65, -79.38]);
    expect(coordinates({ latitude: 43.65, longitude: -79.38 })).toEqual([43.65, -79.38]);
    expect(coordinates([43.65, -79.38])).toEqual([43.65, -79.38]);
    expect(coordinates('43.65, -79.38')).toEqual([43.65, -79.38]);
    expect(coordinates([120, 10])).toBeUndefined();
    expect(offered([{ lat: 1, lng: 2 }])).toContain('location');
    expect(rendererOptionsFor(['100 Queen St W, Toronto'], 'address').map((option) => option.id)).toContain(
      'location',
    );
    expect(rendererOptionsFor(['Arrival'], 'title').map((option) => option.id)).not.toContain('location');
    expect(mapUrl('100 Queen St W')).toBe(
      'https://www.google.com/maps/search/?api=1&query=100%20Queen%20St%20W',
    );
    expect(mapUrl({ lat: 43.65, lng: -79.38 })).toBe(
      'https://www.google.com/maps/search/?api=1&query=43.65%2C-79.38',
    );
  });

  it('offers flags for real two-letter country codes only', () => {
    expect(regionCode('ca')).toBe('CA');
    expect(regionCode('UK')).toBe('GB');
    expect(regionCode('XX')).toBeUndefined();
    expect(regionCode('ZZ')).toBeUndefined();
    expect(regionCode('CAN')).toBeUndefined();
    expect(offered(['CA', 'jp'])).toContain('flag');
    expect(offered(['CA', 'no'])).toContain('flag');
    expect(offered(['CA', 'xx'])).not.toContain('flag');
    expect(flagText('CA')).toMatch(/^🇨🇦 /);
  });

  it('offers a colour swatch for CSS colours', () => {
    for (const color of [
      '#fff',
      '#FFAA00',
      '#ffaa0080',
      'rgb(255, 0, 0)',
      'rgba(255 0 0 / 50%)',
      'hsl(120deg 50% 50%)',
    ]) {
      expect(isColor(color)).toBe(true);
    }
    expect(isColor('red')).toBe(false);
    expect(isColor('#ggg')).toBe(false);
    expect(offered(['#fff', '#000000'])).toContain('color-swatch');
  });
});

describe('renderer caveats', () => {
  const context = { field: 'this', earlier: [], later: [], drawsFlags: true };
  const banner =
    'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2950790/0123abcd/header.jpg';

  it('warns about Steam app ids, but not about banner addresses', () => {
    expect(rendererCaveat('steam-header', [620, banner], context)?.tone).toBe('warning');
    expect(
      rendererCaveat('steam-header', ['https://store.steampowered.com/app/620/'], context),
    ).toBeDefined();
    expect(rendererCaveat('steam-header', [banner, undefined], context)).toBeUndefined();
  });

  it('mentions flags only where the browser cannot draw them', () => {
    expect(rendererCaveat('flag', ['US'], context)).toBeUndefined();
    expect(rendererCaveat('flag', ['US'], { ...context, drawsFlags: false })?.tone).toBe('tip');
  });

  it('suggests a second preview only when there is no other to fall back to', () => {
    expect(rendererCaveat('apple-music-preview', ['1'], context)).toBeDefined();
    expect(
      rendererCaveat('apple-music-preview', ['1'], {
        ...context,
        later: [{ field: 'deezer', renderer: 'deezer-preview' }],
      })?.text,
    ).not.toMatch(/not every track/i);
    expect(
      rendererCaveat('deezer-preview', ['1'], { ...context, later: [{ field: 'art', renderer: 'image' }] })
        ?.text,
    ).toMatch(/not every track/i);
  });

  it('lists every preview sharing the play button, in order, on each of them', () => {
    const caveat = rendererCaveat('deezer-preview', ['1'], {
      ...context,
      earlier: [
        { field: 'artist', renderer: undefined },
        { field: 'apple_id', renderer: 'apple-music-preview' },
      ],
    });
    expect(caveat?.text).toMatch(/share the play button/i);
    expect(caveat?.order).toEqual([
      { field: 'apple_id', current: false },
      { field: 'this', current: true },
    ]);
    const first = rendererCaveat('apple-music-preview', ['1'], {
      ...context,
      later: [{ field: 'deezer', renderer: 'deezer-preview' }],
    });
    expect(first?.order).toEqual([
      { field: 'this', current: true },
      { field: 'deezer', current: false },
    ]);
  });

  it('lists every picture sharing the spot beside the title, in order, on each of them', () => {
    const earlier = [{ field: 'poster', renderer: 'image' as const }];
    const later = [
      { field: 'blurb', renderer: 'long-text' as const },
      { field: 'stills', renderer: 'image-gallery' as const },
    ];
    for (const renderer of ['image', 'image-gallery', 'youtube', 'steam-header'] as const) {
      const caveat = rendererCaveat(renderer, ['https://img.example/a.jpg'], { ...context, earlier, later });
      expect(caveat?.text, renderer).toMatch(/share the spot beside the title/i);
      expect(
        caveat?.order?.map((entry) => entry.field),
        renderer,
      ).toEqual(['poster', 'this', 'stills']);
    }
    const first = rendererCaveat('image', ['https://img.example/a.jpg'], { ...context, later: earlier });
    expect(first?.order?.map((entry) => entry.field)).toEqual(['this', 'poster']);
    expect(rendererCaveat('image', ['https://img.example/a.jpg'], context)).toBeUndefined();
  });

  it('suggests coordinates only for addresses', () => {
    expect(rendererCaveat('location', ['Oaxaca, Mexico'], context)?.tone).toBe('tip');
    expect(rendererCaveat('location', ['53.12, -9.73', [17.06, -96.72]], context)).toBeUndefined();
  });

  it('has nothing to say about most renderers', () => {
    expect(rendererCaveat('tags', [['a']], context)).toBeUndefined();
    expect(rendererCaveat(undefined, ['text'], context)).toBeUndefined();
  });
});
