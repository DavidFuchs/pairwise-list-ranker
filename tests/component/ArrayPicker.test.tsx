/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ArrayPicker } from '@/components/data/ArrayPicker';
import type { ArrayCandidate } from '@/lib/import/arrayCandidates';

const movies: ArrayCandidate = {
  path: ['movies'],
  count: 12,
  entryKind: 'object',
  samples: ['Alien', 'Arrival'],
};

const actors: ArrayCandidate = {
  path: ['actors'],
  count: 4,
  entryKind: 'scalar',
  samples: ['Sigourney Weaver'],
};

describe('ArrayPicker', () => {
  it('offers each candidate with its size and shape', () => {
    render(<ArrayPicker candidates={[movies, actors]} value={null} onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: /rank the list at movies/i })).toBeDefined();
    expect(screen.getByText(/12 objects/i)).toBeDefined();
    expect(screen.getByText(/4 texts/i)).toBeDefined();
  });

  it('previews what the entries look like', () => {
    render(<ArrayPicker candidates={[movies, actors]} value={null} onChange={vi.fn()} />);

    expect(screen.getByText(/Alien · Arrival/)).toBeDefined();
  });

  it('reports the chosen path', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ArrayPicker candidates={[movies, actors]} value={null} onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: /rank the list at actors/i }));

    expect(onChange).toHaveBeenCalledWith(['actors']);
  });

  it('marks the current choice', () => {
    render(<ArrayPicker candidates={[movies, actors]} value={['movies']} onChange={vi.fn()} />);

    expect(
      screen.getByRole('radio', { name: /rank the list at movies/i }).getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('asks nothing when there is only one candidate', () => {
    const { container } = render(
      <ArrayPicker candidates={[movies]} value={['movies']} onChange={vi.fn()} />,
    );

    expect(container.textContent).toBe('');
  });

  it('names a bare-array document readably', () => {
    const bare: ArrayCandidate = { path: [], count: 3, entryKind: 'scalar', samples: ['a'] };
    render(<ArrayPicker candidates={[bare, actors]} value={null} onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: /rank the list at the list/i })).toBeDefined();
  });

  it('shows a progress meter for every candidate that already has ranking behind it', () => {
    render(
      <ArrayPicker
        candidates={[movies, actors]}
        value={['movies']}
        onChange={vi.fn()}
        rankedCoverages={{ movies: 0.42, actors: 0.1 }}
      />,
    );

    expect(screen.getByRole('progressbar', { name: /ranking progress for movies/i })).toBeDefined();
    expect(screen.getByRole('progressbar', { name: /ranking progress for actors/i })).toBeDefined();
    expect(screen.getByText('42%')).toBeDefined();
    expect(screen.getByText('10%')).toBeDefined();
  });

  it('shows no progress meter for a candidate with nothing ranked yet', () => {
    render(<ArrayPicker candidates={[movies, actors]} value={['movies']} onChange={vi.fn()} />);

    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
