/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ComparisonDeck } from '@/components/comparison/ComparisonDeck';
import type { ListItem } from '@/types/list';

const NOW = '2026-08-15T12:00:00.000Z';

function item(id: string, value: ListItem['value']): ListItem {
  return { id, listId: 'list-1', value, active: true, createdAt: NOW, updatedAt: NOW };
}

const pair = { left: item('item-1', 'Tacos'), right: item('item-2', 'Ramen') };

function setup(overrides: Partial<React.ComponentProps<typeof ComparisonDeck>> = {}) {
  const props = {
    pair,
    progress: { activeItems: 3, comparisons: 2, skips: 0, coverage: 0.4 },
    onOutcome: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<ComparisonDeck {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('ComparisonDeck', () => {
  it('shows both items of the pair', () => {
    setup();

    expect(screen.getByText('Tacos')).toBeDefined();
    expect(screen.getByText('Ramen')).toBeDefined();
  });

  it('reports how much comparing has been done', () => {
    setup();

    expect(screen.getByText(/2 comparisons/i)).toBeDefined();
    expect(screen.getByText(/3 items/i)).toBeDefined();
  });

  it('passes the chosen outcome up', async () => {
    const { onOutcome, user } = setup();

    await user.click(screen.getByRole('button', { name: /choose ramen/i }));

    expect(onOutcome).toHaveBeenCalledWith('right');
  });

  it('deletes by item id rather than by side', async () => {
    const { onDelete, user } = setup();

    await user.click(screen.getByRole('button', { name: /delete tacos/i }));
    await user.click(screen.getByRole('button', { name: /confirm deleting tacos/i }));

    expect(onDelete).toHaveBeenCalledWith('item-1');
  });

  it('explains itself when there is nothing left to compare', () => {
    setup({ pair: null, progress: { activeItems: 1, comparisons: 0, skips: 0, coverage: 0 } });

    expect(screen.getByText(/at least two items/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: /choose/i })).toBeNull();
  });

  it('blocks ranking until an object list has a sort field', () => {
    setup({ needsSortField: true });

    expect(screen.getByText(/choose which field/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: /choose tacos/i })).toBeNull();
  });
});
