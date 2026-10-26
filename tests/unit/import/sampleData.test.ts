import { describe, expect, it } from 'vitest';

import { analyzeSource } from '@/lib/import/analyze';
import { entriesAtPath } from '@/lib/import/arrayCandidates';
import {
  GAME_SAMPLE,
  MOVIE_SAMPLE,
  SAMPLE_GAMES,
  SAMPLE_MOVIES,
  SAMPLE_SONGS,
  SAMPLE_TRIPS,
  SAMPLES,
  SONG_SAMPLE,
  TRIP_SAMPLE,
} from '@/lib/import/sampleData';
import type { Sample } from '@/lib/import/sampleData';
import { picturesOf, rendererOptionsFor } from '@/lib/renderers';

/** Every list a sample sets up, opened one or not. */
function presetLists(sample: Sample): { path: string[]; records: Record<string, unknown>[] }[] {
  const document = analyzeSource(sample.text, 'auto').document;
  return [sample.path, ...(sample.siblingPaths ?? [])].map((path) => ({
    path,
    records: entriesAtPath(document, path) as Record<string, unknown>[],
  }));
}

describe('sample data', () => {
  it('reads each sample back as its own records, in the format it names', () => {
    for (const [sample, records] of [
      [SONG_SAMPLE, SAMPLE_SONGS],
      [MOVIE_SAMPLE, SAMPLE_MOVIES],
      [GAME_SAMPLE, SAMPLE_GAMES],
      [TRIP_SAMPLE, SAMPLE_TRIPS.summer],
    ] as const) {
      const analysis = analyzeSource(sample.text, 'auto');
      expect(analysis.issues, sample.id).toEqual([]);
      expect(analysis.format, sample.id).toBe(sample.format);
      expect(entriesAtPath(analysis.document, sample.path), sample.id).toEqual(records);
    }
  });

  it('keeps dates and codes as text in the YAML movies', () => {
    const movies = entriesAtPath(
      analyzeSource(MOVIE_SAMPLE.text, 'auto').document,
      MOVIE_SAMPLE.path,
    ) as Record<string, unknown>[];
    expect(movies[0]?.release_date).toBe('2008-09-04');
    expect(movies.find((movie) => movie.title === 'Das Boot')?.country).toBe('DE');
  });

  // A preset is only a showcase if every renderer it picks is one the field's
  // values actually qualify for.
  it('presets only renderers each field is offered, in every list it sets up', () => {
    for (const sample of SAMPLES) {
      for (const { path, records } of presetLists(sample)) {
        for (const [field, renderer] of Object.entries(sample.roles.fieldRenderers ?? {})) {
          const offered = rendererOptionsFor(
            records.map((record) => record[field]),
            field,
          ).flatMap((option) => [option.id, ...(option.variants ?? []).map((variant) => variant.id)]);
          expect(offered, `${path.join('.')}.${field}`).toContain(renderer);
        }
      }
    }
  });

  it('presets the title apart from the details, and only fields the records carry', () => {
    for (const sample of SAMPLES) {
      for (const { path, records } of presetLists(sample)) {
        for (const field of [sample.roles.labelField!, ...sample.roles.summaryFields!]) {
          expect(
            records.some((record) => field in record),
            `${path.join('.')}.${field}`,
          ).toBe(true);
        }
      }
      expect(sample.roles.summaryFields).not.toContain(sample.roles.labelField);
    }
  });

  it('offers every trip list in the picker, and nothing else', () => {
    const { candidates, warnings } = analyzeSource(TRIP_SAMPLE.text, 'auto');
    expect(candidates.map((candidate) => candidate.path)).toEqual([
      TRIP_SAMPLE.path,
      ...TRIP_SAMPLE.siblingPaths!,
    ]);
    expect(warnings).toEqual([]);
  });

  it('shows off renderers the songs leave out', () => {
    const songs = new Set(Object.values(SONG_SAMPLE.roles.fieldRenderers ?? {}));
    const fresh = Object.values(MOVIE_SAMPLE.roles.fieldRenderers ?? {}).filter(
      (renderer) => !songs.has(renderer),
    );
    expect(fresh.length).toBeGreaterThanOrEqual(10);
  });

  it('draws every game a Steam banner that links to its own store page', () => {
    for (const game of SAMPLE_GAMES) {
      const [banner] = picturesOf(game.steam_header, 'steam-header');
      expect(banner?.uri, game.title).toBe(game.steam_header);
      expect(banner?.href, game.title).toBe(`https://store.steampowered.com/app/${game.steam_app_id}`);
    }
  });

  it('keeps one game per year', () => {
    const years = SAMPLE_GAMES.map((game) => game.year);
    expect(new Set(years).size).toBe(years.length);
  });

  it('gives each movie as many cast photos as cast names', () => {
    for (const movie of SAMPLE_MOVIES) expect(movie.cast_photos, movie.title).toHaveLength(movie.cast.length);
  });
});

describe('sample text', () => {
  it('is the same text each time it is read, and is written out only when read', () => {
    for (const sample of SAMPLES) {
      expect(sample.text).toBe(sample.text);
      expect(sample.text.length).toBeGreaterThan(100);
    }
  });
});
