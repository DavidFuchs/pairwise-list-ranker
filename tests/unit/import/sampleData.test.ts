import { describe, expect, it } from 'vitest';

import { analyzeSource } from '@/lib/import/analyze';
import { entriesAtPath } from '@/lib/import/arrayCandidates';
import { SAMPLE_JSON, SAMPLE_LIST, SAMPLE_PATH, SAMPLE_ROLES, SAMPLE_SONGS, SAMPLE_YAML } from '@/lib/import/sampleData';
import { rendererOptionsFor } from '@/lib/renderers';

describe('sample data', () => {
  it('reads the YAML and JSON samples back as the same songs', () => {
    for (const text of [SAMPLE_YAML, SAMPLE_JSON]) {
      const analysis = analyzeSource(text, 'auto');
      expect(analysis.issues).toEqual([]);
      expect(entriesAtPath(analysis.document, SAMPLE_PATH)).toEqual(SAMPLE_SONGS);
    }
  });

  it('keeps ids, numbers-as-text and dates as text in YAML', () => {
    const songs = entriesAtPath(analyzeSource(SAMPLE_YAML, 'auto').document, SAMPLE_PATH) as Record<string, unknown>[];
    expect(songs.find((song) => song.artist === 'Adele')?.album).toBe('25');
    expect(typeof songs[0]?.apple_music_id).toBe('string');
    expect(songs[0]?.release_date).toBe('2024-04-12');
  });

  it('makes the plain-list sample from the song names', () => {
    expect(SAMPLE_LIST.split('\n')).toEqual(SAMPLE_SONGS.map((song) => song.song_name));
  });

  // The preset is only a showcase if every renderer it picks is one the
  // field's values actually qualify for.
  it('presets only renderers each field is offered', () => {
    for (const [field, renderer] of Object.entries(SAMPLE_ROLES.fieldRenderers ?? {})) {
      const offered = rendererOptionsFor(SAMPLE_SONGS.map((song) => song[field as keyof typeof song])).map(
        (option) => option.id,
      );
      expect(offered, field).toContain(renderer);
    }
  });

  it('presets fields every song has, and not the title among the details', () => {
    for (const field of [SAMPLE_ROLES.labelField!, ...SAMPLE_ROLES.summaryFields!]) {
      expect(SAMPLE_SONGS.every((song) => field in song), field).toBe(true);
    }
    expect(SAMPLE_ROLES.summaryFields).not.toContain(SAMPLE_ROLES.labelField);
  });
});
