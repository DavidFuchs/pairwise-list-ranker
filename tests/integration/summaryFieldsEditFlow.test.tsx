/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DataScreen from '@/app/index';
import { listStore } from '@/lib/state/useListStore';

const replace = vi.fn();
vi.mock('expo-router', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const RAW = `- title: One
  artist: A
  album: X
  year: 1999
- title: Two
  artist: B
  album: Y
  year: 2001
`;

function seed() {
  listStore.getState().startRanking({
    source: {
      format: 'yaml',
      rawText: RAW,
      document: [
        { title: 'One', artist: 'A', album: 'X', year: 1999 },
        { title: 'Two', artist: 'B', album: 'Y', year: 2001 },
      ],
      arrayPath: [],
    },
    roles: { labelField: 'title', summaryFields: ['artist', 'album', 'year'] },
  });
}

describe('re-ordering card details while editing data', () => {
  beforeEach(() => {
    listStore.getState().reset();
    globalThis.localStorage?.clear();
    replace.mockClear();
  });

  it('applies the new order to the workspace', async () => {
    seed();
    const user = userEvent.setup();
    render(<DataScreen />);

    for (const field of ['artist', 'album', 'year']) {
      await user.click(screen.getByRole('button', { name: `Show ${field} on cards` }));
    }
    for (const field of ['year', 'artist', 'album']) {
      await user.click(screen.getByRole('button', { name: `Show ${field} on cards` }));
    }
    await user.click(screen.getByRole('button', { name: /apply edits/i }));
    await user.click(screen.getByRole('button', { name: /apply edits/i }));

    expect(listStore.getState().workspace?.roles.summaryFields).toEqual(['year', 'artist', 'album']);
  });
});
