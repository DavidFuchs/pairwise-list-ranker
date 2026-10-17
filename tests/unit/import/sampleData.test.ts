import { describe, expect, it } from 'vitest';

import { analyzeSource } from '@/lib/import/analyze';
import { entriesAtPath } from '@/lib/import/arrayCandidates';
import {
  GAME_SAMPLE,
  MOVIE_SAMPLE,
  SAMPLE_GAMES,
  SAMPLE_MOVIES,
  SAMPLE_SONGS,
  SAMPLES,
  SONG_SAMPLE,
} from '@/lib/import/sampleData';
import { picturesOf, rendererOptionsFor } from '@/lib/renderers';

describe('sample data', () => {
  it('reads each sample back as its own records, in the format it names', () => {
    for (const [sample, records] of [
      [SONG_SAMPLE, SAMPLE_SONGS],
      [MOVIE_SAMPLE, SAMPLE_MOVIES],
      [GAME_SAMPLE, SAMPLE_GAMES],
    ] as const) {
      const analysis = analyzeSource(sample.text, 'auto');
      expect(analysis.issues, sample.id).toEqual([]);
      expect(analysis.format, sample.id).toBe(sample.format);
      expect(entriesAtPath(analysis.document, sample.path), sample.id).toEqual(records);
    }
  });

  it('keeps dates and codes as text in the YAML movies', () => {
    const movies = entriesAtPath(analyzeSource(MOVIE_SAMPLE.text, 'auto').document, MOVIE_SAMPLE.path) as Record<
      string,
      unknown
    >[];
    expect(movies[0]?.release_date).toBe('2008-09-04');
    expect(movies.find((movie) => movie.title === 'Das Boot')?.country).toBe('DE');
  });

  // A preset is only a showcase if every renderer it picks is one the field's
  // values actually qualify for.
  it('presets only renderers each field is offered', () => {
    for (const sample of SAMPLES) {
      const records = entriesAtPath(analyzeSource(sample.text, 'auto').document, sample.path) as Record<
        string,
        unknown
      >[];
      for (const [field, renderer] of Object.entries(sample.roles.fieldRenderers ?? {})) {
        const offered = rendererOptionsFor(
          records.map((record) => record[field]),
          field,
        ).flatMap((option) => [option.id, ...(option.variants ?? []).map((variant) => variant.id)]);
        expect(offered, `${sample.id}.${field}`).toContain(renderer);
      }
    }
  });

  it('presets the title apart from the details, and only fields the records carry', () => {
    for (const sample of SAMPLES) {
      const records = entriesAtPath(analyzeSource(sample.text, 'auto').document, sample.path) as Record<
        string,
        unknown
      >[];
      for (const field of [sample.roles.labelField!, ...sample.roles.summaryFields!]) {
        expect(
          records.some((record) => field in record),
          `${sample.id}.${field}`,
        ).toBe(true);
      }
      expect(sample.roles.summaryFields).not.toContain(sample.roles.labelField);
    }
  });

  it('shows off renderers the songs leave out', () => {
    const songs = new Set(Object.values(SONG_SAMPLE.roles.fieldRenderers ?? {}));
    const fresh = Object.values(MOVIE_SAMPLE.roles.fieldRenderers ?? {}).filter((renderer) => !songs.has(renderer));
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
