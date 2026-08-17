/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
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

describe('ComparisonDeck layout', () => {
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

  it('keeps each item’s actions inside its own card', () => {
    setup();

    // The card itself is the choice, so it carries that accessible name.
    const leftCard = screen.getByRole('button', { name: 'Choose Tacos' });
    expect(within(leftCard).getByRole('button', { name: 'Tacos is much better' })).toBeDefined();
    expect(within(leftCard).getByRole('button', { name: 'Delete Tacos' })).toBeDefined();
    expect(within(leftCard).queryByRole('button', { name: 'Choose Ramen' })).toBeNull();
  });

  it('offers one shared skip rather than one per card', () => {
    setup();

    expect(screen.getAllByRole('button', { name: /skip this pair/i })).toHaveLength(1);
  });
});

describe('choosing a winner', () => {
  it('reports a win for the left item', async () => {
    const { onOutcome, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Choose Tacos' }));

    expect(onOutcome).toHaveBeenCalledWith('left');
  });

  it('reports a win for the right item', async () => {
    const { onOutcome, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Choose Ramen' }));

    expect(onOutcome).toHaveBeenCalledWith('right');
  });

  it('reports a much-better win as a strong outcome', async () => {
    const { onOutcome, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Tacos is much better' }));

    expect(onOutcome).toHaveBeenCalledWith('left_strong');
  });

  it('reports a much-better win for the right item', async () => {
    const { onOutcome, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Ramen is much better' }));

    expect(onOutcome).toHaveBeenCalledWith('right_strong');
  });

  it('reports a skip', async () => {
    const { onOutcome, user } = setup();

    await user.click(screen.getByRole('button', { name: /skip this pair/i }));

    expect(onOutcome).toHaveBeenCalledWith('skip');
  });
});

describe('deleting from a card', () => {
  it('asks for confirmation before deleting', async () => {
    const { onDelete, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Delete Tacos' }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /confirm deleting tacos/i })).toBeDefined();
  });

  it('asks inside the card being deleted', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Delete Tacos' }));

    const leftCard = screen.getByLabelText(/left option: tacos/i);
    expect(within(leftCard).getByRole('button', { name: /confirm deleting tacos/i })).toBeDefined();
  });

  it('deletes by item id once confirmed', async () => {
    const { onDelete, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Delete Tacos' }));
    await user.click(screen.getByRole('button', { name: /confirm deleting tacos/i }));

    expect(onDelete).toHaveBeenCalledWith('item-1');
  });

  it('lets the user back out', async () => {
    const { onDelete, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Delete Tacos' }));
    await user.click(screen.getByRole('button', { name: /keep tacos/i }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete Tacos' })).toBeDefined();
  });

  it('hides the choose action while a delete is pending', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Delete Tacos' }));

    expect(screen.queryByRole('button', { name: 'Choose Tacos' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose Ramen' })).toBeDefined();
  });

  it('drops a pending delete when the user picks a winner instead', async () => {
    const { onDelete, onOutcome, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Delete Tacos' }));
    await user.click(screen.getByRole('button', { name: 'Choose Ramen' }));

    expect(onOutcome).toHaveBeenCalledWith('right');
    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe('keyboard shortcuts', () => {
  it('chooses the left item with the left arrow key', async () => {
    const { onOutcome, user } = setup();

    await user.keyboard('{ArrowLeft}');

    expect(onOutcome).toHaveBeenCalledWith('left');
  });

  it('chooses the right item with the right arrow key', async () => {
    const { onOutcome, user } = setup();

    await user.keyboard('{ArrowRight}');

    expect(onOutcome).toHaveBeenCalledWith('right');
  });

  it('marks a much-better win with shift and an arrow key', async () => {
    const { onOutcome, user } = setup();

    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');

    expect(onOutcome).toHaveBeenCalledWith('right_strong');
  });

  it('skips with the s key', async () => {
    const { onOutcome, user } = setup();

    await user.keyboard('s');

    expect(onOutcome).toHaveBeenCalledWith('skip');
  });

  it('arms a delete with d then l, rather than deleting outright', async () => {
    const { onDelete, user } = setup();

    await user.keyboard('dl');

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /confirm deleting tacos/i })).toBeDefined();
  });

  it('arms the right item with d then r', async () => {
    const { user } = setup();

    await user.keyboard('dr');

    expect(screen.getByRole('button', { name: /confirm deleting ramen/i })).toBeDefined();
  });

  it('confirms an armed delete with enter', async () => {
    const { onDelete, user } = setup();

    await user.keyboard('dl{Enter}');

    expect(onDelete).toHaveBeenCalledWith('item-1');
  });

  it('cancels an armed delete with escape', async () => {
    const { onDelete, user } = setup();

    await user.keyboard('dl{Escape}');

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete Tacos' })).toBeDefined();
  });

  it('ignores shortcuts while the user is typing in a text field', async () => {
    const { onOutcome, user } = setup();
    const field = window.document.createElement('textarea');
    window.document.body.appendChild(field);
    field.focus();

    await user.keyboard('{ArrowLeft}s');

    expect(onOutcome).not.toHaveBeenCalled();
    field.remove();
  });

  it('tells the user the shortcuts exist', () => {
    setup();

    // The plain arrow keys are shown as keycaps on the cards themselves; the
    // tray carries only the shortcuts that have nowhere else to live.
    expect(screen.getByText(/s skips/i)).toBeDefined();
    expect(screen.getAllByText('←')).toHaveLength(1);
  });

  it('stays quiet when there is no pair to act on', async () => {
    const { onOutcome, user } = setup({
      pair: null,
      progress: { activeItems: 1, comparisons: 0, skips: 0, coverage: 0 },
    });

    await user.keyboard('{ArrowLeft}');

    expect(onOutcome).not.toHaveBeenCalled();
  });
});

describe('states with nothing to compare', () => {
  it('explains itself when there is nothing left to compare', () => {
    setup({ pair: null, progress: { activeItems: 1, comparisons: 0, skips: 0, coverage: 0 } });

    expect(screen.getByText(/at least two items/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Choose / })).toBeNull();
  });

  // Ranking can no longer start without a label field — the data screen blocks
  // it — so the deck has no such state left to render.
});

describe('the gutter', () => {
  it('separates the two cards with an "or"', () => {
    setup();

    expect(screen.getByText('or')).toBeDefined();
  });

  it('keeps the skip action for the pair', () => {
    setup();

    expect(screen.getByRole('button', { name: /skip this pair/i })).toBeDefined();
  });

  it('leaves the plain arrow keys to the cards, which show their own keycaps', () => {
    setup();

    expect(screen.queryByText(/arrow keys choose/i)).toBeNull();
    expect(screen.getByText(/shift \+ arrow for much better/i)).toBeDefined();
  });
});
