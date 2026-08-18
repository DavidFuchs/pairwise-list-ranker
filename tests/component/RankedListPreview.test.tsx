/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    comparisonCount: 0,
    onReorder: vi.fn(),
    ...overrides,
  };
  render(<RankedListPreview {...props} />);
  return { ...props, user: userEvent.setup() };
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

  it('asks before applying a row moved down with alt and arrow down', async () => {
    const { onReorder, user } = setup();

    fireEvent.keyDown(screen.getByLabelText(/reorder tacos/i), { key: 'ArrowDown', altKey: true });
    expect(onReorder).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /reorder and restart/i }));

    expect(onReorder).toHaveBeenCalledWith(['item-1', 'item-0', 'item-2']);
  });

  it('asks before applying a row moved up with alt and arrow up', async () => {
    const { onReorder, user } = setup();

    fireEvent.keyDown(screen.getByLabelText(/reorder curry/i), { key: 'ArrowUp', altKey: true });
    expect(onReorder).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /reorder and restart/i }));

    expect(onReorder).toHaveBeenCalledWith(['item-0', 'item-2', 'item-1']);
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

  it('asks before discarding comparisons', () => {
    const { onReorder } = setup({ comparisonCount: 47 });

    fireEvent.keyDown(screen.getByLabelText(/reorder tacos/i), { key: 'ArrowDown', altKey: true });

    expect(onReorder).not.toHaveBeenCalled();
    expect(screen.getByText(/47 comparisons/i)).toBeDefined();
    expect(screen.getByText(/starts a new ranking session/i)).toBeDefined();
  });

  /**
   * Reordering by hand always asserts a best-to-worst order, whether or not
   * there is any comparison history to discard - so it always asks, and with
   * wording that does not claim comparisons are being cleared when there are
   * none.
   */
  it('asks even with no comparisons yet, without claiming any are cleared', () => {
    const { onReorder } = setup({ comparisonCount: 0 });

    fireEvent.keyDown(screen.getByLabelText(/reorder tacos/i), { key: 'ArrowDown', altKey: true });

    expect(onReorder).not.toHaveBeenCalled();
    expect(screen.getByText(/treats this order as best to worst/i)).toBeDefined();
    expect(screen.queryByText(/comparisons are cleared/i)).toBeNull();
    expect(screen.queryByText(/starts a new ranking session/i)).toBeNull();
  });

  it('applies the reorder once confirmed', async () => {
    const { onReorder, user } = setup({ comparisonCount: 47 });
    fireEvent.keyDown(screen.getByLabelText(/reorder tacos/i), { key: 'ArrowDown', altKey: true });

    await user.click(screen.getByRole('button', { name: /reorder and restart/i }));

    expect(onReorder).toHaveBeenCalledWith(['item-1', 'item-0', 'item-2']);
  });

  it('restores the previous order on cancel', async () => {
    const { onReorder, user } = setup({ comparisonCount: 47 });
    fireEvent.keyDown(screen.getByLabelText(/reorder tacos/i), { key: 'ArrowDown', altKey: true });

    await user.click(screen.getByRole('button', { name: /cancel reordering/i }));

    expect(onReorder).not.toHaveBeenCalled();
    expect(screen.queryByText(/starts a new ranking session/i)).toBeNull();
  });

  it('shows the pending order while the confirmation is open', () => {
    setup({ comparisonCount: 47 });

    fireEvent.keyDown(screen.getByLabelText(/reorder tacos/i), { key: 'ArrowDown', altKey: true });

    expect(screen.getAllByRole('listitem')[0]?.textContent).toContain('Ramen');
  });

  it('renumbers the rows in the pending order', () => {
    setup({ comparisonCount: 47 });

    fireEvent.keyDown(screen.getByLabelText(/reorder tacos/i), { key: 'ArrowDown', altKey: true });

    expect(screen.getByLabelText(/reorder tacos, position 2/i)).toBeDefined();
  });
});
