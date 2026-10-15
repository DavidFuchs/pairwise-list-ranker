/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RankedListPreview } from '@/components/preview/RankedListPreview';
import type { ListItem } from '@/types/list';
import type { RankedItem } from '@/types/ranking';

const NOW = '2026-08-16T00:00:00.000Z';

function ranked(labels: string[]): RankedItem<ListItem>[] {
  return labels.map((label, index) => ({
    rank: index + 1,
    item: {
      id: `item-${index}`,
      listId: 'ws-1',
      value: label,
      active: true,
      createdAt: NOW,
      updatedAt: NOW,
    },
    state: {
      itemId: `item-${index}`,
      rating: 1500 - index,
      comparisons: 0,
      wins: 0,
      losses: 0,
      skips: 0,
    },
  }));
}

function setup(overrides: Partial<React.ComponentProps<typeof RankedListPreview>> = {}) {
  const props = {
    ranking: ranked(['Tacos', 'Ramen', 'Curry']),
    onReorder: vi.fn(),
    ...overrides,
  };
  render(<RankedListPreview {...props} />);
  return props;
}

describe('RankedListPreview', () => {
  it('lists the ranking in order', () => {
    setup();

    expect(screen.getByText('Tacos')).toBeDefined();
    expect(screen.getByText('Curry')).toBeDefined();
  });

  it('says so when there is nothing to show', () => {
    setup({ ranking: [] });

    expect(screen.getByText(/nothing here yet/i)).toBeDefined();
  });

  it('offers a grip on every row', () => {
    setup();

    expect(screen.getByLabelText(/reorder tacos/i)).toBeDefined();
    expect(screen.getByLabelText(/reorder curry/i)).toBeDefined();
  });

  it('applies a row moved down with alt and arrow down immediately', () => {
    const { onReorder } = setup();

    fireEvent.keyDown(screen.getByLabelText(/reorder tacos/i), { key: 'ArrowDown', altKey: true });

    expect(onReorder).toHaveBeenCalledWith('item-0', ['item-1', 'item-0', 'item-2']);
  });

  it('applies a row moved up with alt and arrow up immediately', () => {
    const { onReorder } = setup();

    fireEvent.keyDown(screen.getByLabelText(/reorder curry/i), { key: 'ArrowUp', altKey: true });

    expect(onReorder).toHaveBeenCalledWith('item-2', ['item-0', 'item-2', 'item-1']);
  });

  it('ignores arrow keys without alt, so scrolling still works', () => {
    const { onReorder } = setup();

    fireEvent.keyDown(screen.getByLabelText(/reorder tacos/i), { key: 'ArrowDown' });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('does not move the first row up', () => {
    const { onReorder } = setup();

    fireEvent.keyDown(screen.getByLabelText(/reorder tacos/i), { key: 'ArrowUp', altKey: true });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('does not move the last row down', () => {
    const { onReorder } = setup();

    fireEvent.keyDown(screen.getByLabelText(/reorder curry/i), { key: 'ArrowDown', altKey: true });

    expect(onReorder).not.toHaveBeenCalled();
  });
});

describe('RankedListPreview with a long list', () => {
  it('mounts only a window of the rows', () => {
    const labels = Array.from({ length: 500 }, (_, i) => `Song ${i}`);
    setup({ ranking: ranked(labels) });

    const mounted = screen.getAllByRole('listitem').length;
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(100);
    expect(screen.getByText('Song 0')).toBeDefined();
    expect(screen.queryByText('Song 499')).toBeNull();
  });
});
