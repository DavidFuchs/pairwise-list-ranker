/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ComparisonDeck } from '@/components/comparison/ComparisonDeck';
import { cardLayout } from '@/lib/renderers';
import type { ListItem } from '@/types/list';

const NOW = '2026-08-15T12:00:00.000Z';

function item(id: string, value: ListItem['value']): ListItem {
  return {
    id,
    listId: 'list-1',
    value,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const pair: [ListItem, ListItem] = [item('item-1', 'Tacos'), item('item-2', 'Ramen')];

function setup(overrides: Partial<React.ComponentProps<typeof ComparisonDeck>> = {}) {
  const props = {
    pair,
    answers: 2,
    onOutcome: vi.fn(),
    onDelete: vi.fn(),
    onMarkUnrecognized: vi.fn(),
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

  it('counts the answers so far', () => {
    setup();

    expect(screen.getByText('2 answers so far')).toBeDefined();
  });

  it('counts a single answer in the singular', () => {
    setup({ answers: 1 });

    expect(screen.getByText('1 answer so far')).toBeDefined();
  });

  it('groups the digits of a large count', () => {
    setup({ answers: 1312 });

    expect(screen.getByText('1,312 answers so far')).toBeDefined();
  });

  it('says how many items are being ranked', () => {
    setup({ items: 40 });

    expect(screen.getByText('40 items · 2 answers so far')).toBeDefined();
  });

  const comparing = {
    text: "Can't tell how close you are yet. 3 of 9 items haven't been compared.",
    bar: 'coverage',
    share: 6 / 9,
  } as const;
  const close = { text: 'Close. Mostly fine adjustments left.', bar: 'level', share: 0.75 } as const;

  it('shows the progress line when given one', () => {
    setup({ progress: close });

    expect(screen.getByText(close.text)).toBeDefined();
  });

  it('offers "Why?" on the progress line only when it can open the explainer', async () => {
    const onExplainProgress = vi.fn();
    const { user } = setup({ progress: close, onExplainProgress });
    await user.click(screen.getByRole('link', { name: 'Why is the order at this stage?' }));
    expect(onExplainProgress).toHaveBeenCalledOnce();
  });

  it('has no "Why?" link without a way to open the explainer', () => {
    setup({ progress: close });
    expect(screen.queryByRole('link', { name: 'Why is the order at this stage?' })).toBeNull();
  });

  it('fills the bar to the share the progress says, with ticks only for a level', () => {
    const width = () => screen.getByTestId('progress-fill').style.width;

    const { unmount } = render(
      <ComparisonDeck
        pair={pair}
        answers={2}
        progress={close}
        onOutcome={vi.fn()}
        onDelete={vi.fn()}
        onMarkUnrecognized={vi.fn()}
      />,
    );
    expect(width()).toBe('75%');
    expect(screen.queryByTestId('progress-bar-level')).not.toBeNull();
    unmount();

    setup({ progress: comparing });
    expect(width()).toBe('66.66666666666666%');
    expect(screen.queryByTestId('progress-bar-coverage')).not.toBeNull();
  });

  it('keeps the progress line outside the polite live region', () => {
    setup({ progress: close });

    expect(screen.getByText(close.text).closest('[aria-live]')).toBeNull();
    expect(screen.getByText('2 answers so far').closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('shows no progress line when none is given', () => {
    setup();

    expect(screen.queryByText(/Close\. Mostly|Can't tell how close/)).toBeNull();
    setup({ progress: null });
    expect(screen.queryByText(/Close\. Mostly|Can't tell how close/)).toBeNull();
  });

  it('shows no progress line while restoring or with no pair', () => {
    const { unmount } = render(
      <ComparisonDeck
        pair={pair}
        answers={2}
        status="restoring"
        progress={close}
        onOutcome={vi.fn()}
        onDelete={vi.fn()}
        onMarkUnrecognized={vi.fn()}
      />,
    );
    expect(screen.queryByText(close.text)).toBeNull();
    unmount();
    setup({ pair: null, progress: close });
    expect(screen.queryByText(close.text)).toBeNull();
  });

  it('keeps each item’s actions inside its own card', () => {
    setup();

    // The card itself is the choice, so it carries that accessible name.
    const leftCard = screen.getByLabelText('Choose Tacos');
    expect(within(leftCard).getByRole('button', { name: 'Tacos is much better' })).toBeDefined();
    expect(within(leftCard).getByRole('button', { name: 'Delete Tacos' })).toBeDefined();
    expect(within(leftCard).queryByLabelText('Choose Ramen')).toBeNull();
  });

  it('shows no meter, percentage or estimate (docs/ARCHITECTURE.md 6.12)', () => {
    setup({ answers: 400 });

    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByText(/settled|estimate|sorted well enough/i)).toBeNull();
  });

  it("offers one shared Can't decide rather than one per card", () => {
    setup();

    expect(screen.getAllByRole('button', { name: "Can't decide" })).toHaveLength(1);
  });
});

describe('choosing a winner', () => {
  it('reports a win for the left item', async () => {
    const { onOutcome, user } = setup();

    await user.click(screen.getByLabelText('Choose Tacos'));

    expect(onOutcome).toHaveBeenCalledWith('left');
  });

  it('reports a win for the right item', async () => {
    const { onOutcome, user } = setup();

    await user.click(screen.getByLabelText('Choose Ramen'));

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

  it("records Can't decide as a draw", async () => {
    const { onOutcome, user } = setup();

    await user.click(screen.getByRole('button', { name: "Can't decide" }));

    expect(onOutcome).toHaveBeenCalledWith('draw');
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

    expect(screen.queryByLabelText('Choose Tacos')).toBeNull();
    expect(screen.getByLabelText('Choose Ramen')).toBeDefined();
  });

  it('drops a pending delete when the user picks a winner instead', async () => {
    const { onDelete, onOutcome, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Delete Tacos' }));
    await user.click(screen.getByLabelText('Choose Ramen'));

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

  it("records Can't decide, a draw, with the s key", async () => {
    const { onOutcome, user } = setup();

    await user.keyboard('s');

    expect(onOutcome).toHaveBeenCalledWith('draw');
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

    // Keys are drawn as keys under the tray, each beside what it does.
    expect(screen.getByText('←')).toBeDefined();
    expect(screen.getByText('choose')).toBeDefined();
    expect(screen.getByText('S')).toBeDefined();
    expect(screen.getByText("can't decide")).toBeDefined();
  });

  it('says which key finishes the delete it is halfway through', async () => {
    const { user } = setup();

    await user.keyboard('d');

    expect(screen.getByText(/press L or R/i)).toBeDefined();
  });

  it('drops a half-typed delete when the pair is answered by pointer', async () => {
    const { user } = setup();

    await user.keyboard('d');
    await user.click(screen.getByLabelText('Choose Tacos'));

    expect(screen.queryByText(/press L or R/i)).toBeNull();
  });

  it('names the keys that answer the confirmation', async () => {
    const { user } = setup();

    await user.keyboard('dl');

    const confirm = screen.getByRole('alert');
    expect(within(confirm).getByText('Enter')).toBeDefined();
    expect(within(confirm).getByText('Esc')).toBeDefined();
    expect(screen.getByText(/enter removes/i)).toBeDefined();
  });

  it('moves focus to the confirmation, and back to the trash can on a keep', async () => {
    const { user } = setup();

    await user.keyboard('dl');
    expect(window.document.activeElement).toBe(screen.getByRole('alert'));

    await user.keyboard('{Escape}');
    expect(window.document.activeElement).toBe(screen.getByRole('button', { name: 'Delete Tacos' }));
  });

  it('lets a focused confirmation button answer for itself', async () => {
    const { onDelete, user } = setup();

    await user.keyboard('dl');
    const keep = screen.getByRole('button', { name: 'Keep Tacos' });
    keep.focus();
    await user.keyboard('{Enter}');

    // The global Enter binding must not fire the destructive action out from
    // under a button whose own label says "Keep".
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete Tacos' })).toBeDefined();
  });

  it('stays quiet when there is no pair to act on', async () => {
    const { onOutcome, user } = setup({
      pair: null,
      answers: 0,
    });

    await user.keyboard('{ArrowLeft}');

    expect(onOutcome).not.toHaveBeenCalled();
  });
});

describe('states with nothing to compare', () => {
  it('explains itself when there is nothing left to compare', () => {
    setup({
      pair: null,
      answers: 0,
      activeItems: 1,
    });

    expect(screen.getByText(/at least two items/i)).toBeDefined();
    expect(screen.queryByLabelText(/^Choose /)).toBeNull();
  });

  /** The engine never asks the previous pair again, so a two-item list has nothing to ask after one answer. */
  it('says both items are ranked when two are active and nothing is left to ask', () => {
    setup({ pair: null, answers: 1, activeItems: 2, onUndo: vi.fn() });

    expect(
      screen.getByText('Both items are ranked. Drag a row to swap them, or undo your answer.'),
    ).toBeDefined();
    expect(screen.queryByText(/at least two items/i)).toBeNull();
  });

  it('keeps the size of the list with nothing left to ask', () => {
    setup({ pair: null, answers: 1, activeItems: 2, items: 2 });

    expect(screen.getByText('2 items · 1 answer so far')).toBeDefined();
  });

  it('names the list holding the undo, disabled, when Undo is on another list', () => {
    setup({ undoElsewhere: 'Movies' });

    const undo = screen.getByRole('button', { name: 'Undo is on the Movies list' });
    expect(undo.getAttribute('aria-disabled')).toBe('true');
  });

  it('offers a plain Undo when it is on this list', () => {
    setup({ onUndo: vi.fn(), undoElsewhere: 'Movies' });

    expect(screen.getByRole('button', { name: 'Undo last change' }).getAttribute('aria-disabled')).not.toBe(
      'true',
    );
  });

  it('offers no undo in the text when there is nothing to undo', () => {
    setup({ pair: null, answers: 1, activeItems: 2 });

    expect(screen.getByText('Both items are ranked. Drag a row to swap them.')).toBeDefined();
    expect(screen.queryByText(/undo your answer/)).toBeNull();
  });

  it('says only that nothing is left to ask when more than two items are active', () => {
    setup({ pair: null, answers: 9, activeItems: 5, onUndo: vi.fn() });

    expect(screen.getByText('Nothing left to ask right now.')).toBeDefined();
    expect(screen.queryByText(/Both items are ranked/)).toBeNull();
  });

  it('keeps the answer count with no pair on offer', () => {
    setup({ pair: null, answers: 1, activeItems: 2 });

    expect(screen.getByText('1 answer so far')).toBeDefined();
  });

  it('keeps Undo, by button and by Ctrl+Z, with no pair on offer', async () => {
    const { onUndo, onOutcome, user } = setup({ pair: null, answers: 1, activeItems: 2, onUndo: vi.fn() });

    await user.click(screen.getByRole('button', { name: 'Undo last change' }));
    await user.keyboard('{Control>}z{/Control}');
    await user.keyboard('{ArrowLeft}s');

    expect(onUndo).toHaveBeenCalledTimes(2);
    expect(onOutcome).not.toHaveBeenCalled();
  });

  it('offers no Undo with no pair when there is nothing to undo', () => {
    setup({ pair: null, answers: 0, activeItems: 1 });

    expect(screen.queryByRole('button', { name: 'Undo last change' })).toBeNull();
  });

  // Ranking can no longer start without a label field - the data screen blocks
  // it - so the deck has no such state left to render.
});

describe('the gutter', () => {
  it('separates the two cards with an "or"', () => {
    setup();

    expect(screen.getByText('or')).toBeDefined();
  });

  it("keeps the Can't decide action for the pair", () => {
    setup();

    expect(screen.getByRole('button', { name: "Can't decide" })).toBeDefined();
  });

  it('keeps the cards free of keycaps', () => {
    setup();

    for (const card of screen.getAllByLabelText(/^Choose /)) {
      expect(within(card).queryByText('←')).toBeNull();
      expect(within(card).queryByText('→')).toBeNull();
    }
  });
});

describe('details, shared by the pair', () => {
  const films = [
    { title: 'Arrival', synopsis: 'Linguist meets heptapods.' },
    { title: 'Alien', synopsis: 'Crew meets xenomorph.' },
  ];

  function withDetails() {
    return setup({
      pair: [
        {
          id: 'item-1',
          listId: 'list-1',
          value: films[0]!,
          createdAt: NOW,
          updatedAt: NOW,
        },
        {
          id: 'item-2',
          listId: 'list-1',
          value: films[1]!,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      layout: cardLayout({ labelField: 'title' }),
    });
  }

  it('offers one toggle for the pair', () => {
    withDetails();

    expect(screen.getAllByRole('switch', { name: /show details on both cards/i })).toHaveLength(1);
  });

  it('opens both cards at once', async () => {
    const user = userEvent.setup();
    withDetails();

    await user.click(screen.getByRole('switch', { name: /show details on both cards/i }));

    expect(screen.getByText(/Linguist meets heptapods/)).toBeDefined();
    expect(screen.getByText(/Crew meets xenomorph/)).toBeDefined();
  });

  it('closes both cards at once', async () => {
    const user = userEvent.setup();
    withDetails();
    const toggle = screen.getByRole('switch', {
      name: /show details on both cards/i,
    });

    await user.click(toggle);
    await user.click(toggle);

    expect(screen.queryByText(/Linguist meets heptapods/)).toBeNull();
    expect(screen.queryByText(/Crew meets xenomorph/)).toBeNull();
  });

  it('stays hidden when the items are bare strings', () => {
    setup();

    expect(screen.queryByRole('switch', { name: /show details/i })).toBeNull();
  });
});

describe('ComparisonDeck undo', () => {
  it('keeps Undo in place but unavailable until there is something to undo', () => {
    setup();
    expect(screen.getByRole('button', { name: /undo/i }).getAttribute('aria-disabled')).toBe('true');
  });

  it('undoes from the button and from Ctrl+Z', async () => {
    const { user, onUndo } = setup({ onUndo: vi.fn() });

    await user.click(screen.getByRole('button', { name: /undo/i }));
    await user.keyboard('{Control>}z{/Control}');

    expect(onUndo).toHaveBeenCalledTimes(2);
  });

  it('Ctrl+Z undoes and disarms "Don\'t recognize…", so the next key does not mark', async () => {
    const { user, onUndo, onMarkUnrecognized } = setup({ onUndo: vi.fn() });

    await user.keyboard('k');
    expect(screen.getAllByLabelText(/^Don't recognize /).length).toBeGreaterThan(0);

    await user.keyboard('{Control>}z{/Control}');

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText(/^Don't recognize /)).toBeNull();
    await user.keyboard('l');
    expect(onMarkUnrecognized).not.toHaveBeenCalled();
  });

  it('shows nothing about the order having settled', () => {
    setup();
    expect(screen.queryByText(/settled|choices settle/)).toBeNull();
  });
});

/** While a cold build runs, or when none worked, nothing from a half-built state is answerable. */
describe('a ranking that is not ready', () => {
  it('says the ranking is being restored, in place of the cards', () => {
    setup({ status: 'restoring' });

    expect(screen.getByText('Restoring your ranking…')).toBeDefined();
    expect(screen.queryByLabelText(/^Choose /)).toBeNull();
    expect(screen.queryByRole('button', { name: "Can't decide" })).toBeNull();
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();
    expect(screen.queryByText(/answers so far/)).toBeNull();
  });

  it('records nothing from the keyboard while restoring', async () => {
    const { onOutcome, onDelete, onUndo, user } = setup({ status: 'restoring', onUndo: vi.fn() });

    await user.keyboard('{ArrowLeft}{ArrowRight}s');
    await user.keyboard('dl{Enter}');
    await user.keyboard('{Control>}z{/Control}');

    expect(onOutcome).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('says the ranking could not be restored, with nothing to answer', async () => {
    const { onOutcome, user } = setup({ status: 'unrestored' });

    expect(
      screen.getByText(
        "Couldn't restore your ranking. Your answers are saved; reload the page to try again.",
      ),
    ).toBeDefined();
    expect(screen.queryByLabelText(/^Choose /)).toBeNull();
    await user.keyboard('{ArrowLeft}s');
    expect(onOutcome).not.toHaveBeenCalled();
  });
});

describe('leaving the ready state', () => {
  it('drops an armed delete, so it never fires on the pair that comes back', async () => {
    const onDelete = vi.fn();
    const props = { pair, answers: 2, onOutcome: vi.fn(), onDelete, onMarkUnrecognized: vi.fn() };
    const user = userEvent.setup();
    const { rerender } = render(<ComparisonDeck {...props} />);

    await user.click(screen.getByRole('button', { name: 'Delete Tacos' }));
    expect(screen.getByRole('button', { name: /confirm deleting tacos/i })).toBeDefined();

    rerender(<ComparisonDeck {...props} status="restoring" />);
    rerender(<ComparisonDeck {...props} status="ready" />);

    expect(screen.queryByRole('button', { name: /confirm deleting tacos/i })).toBeNull();
    await user.keyboard('{Enter}');
    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe("Don't recognize…", () => {
  const other: [ListItem, ListItem] = [item('item-3', 'Pho'), item('item-4', 'Sushi')];

  it('shows the pill as "Can\'t decide" and "Don\'t recognize…"; pressing the second arms it and records nothing', async () => {
    const { onOutcome, onMarkUnrecognized, user } = setup();

    expect(screen.getByRole('button', { name: "Can't decide" })).toBeDefined();
    await user.click(screen.getByRole('button', { name: "Don't recognize…" }));

    expect(onOutcome).not.toHaveBeenCalled();
    expect(onMarkUnrecognized).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: "Don't recognize either" })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
    expect(screen.queryByRole('button', { name: "Can't decide" })).toBeNull();
  });

  it('armed, both cards show "Don\'t recognize this one" and no Much better or trash can', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: "Don't recognize…" }));

    expect(screen.getAllByText("Don't recognize this one")).toHaveLength(2);
    expect(screen.queryByText('Click to choose')).toBeNull();
    expect(screen.queryByText('Much better')).toBeNull();
    expect(screen.queryByRole('button', { name: /is much better/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull();
  });

  it('armed, pressing the left card marks the left item only', async () => {
    const { onOutcome, onMarkUnrecognized, user } = setup();

    await user.click(screen.getByRole('button', { name: "Don't recognize…" }));
    await user.click(screen.getByLabelText("Don't recognize Tacos"));

    expect(onMarkUnrecognized).toHaveBeenCalledTimes(1);
    expect(onMarkUnrecognized).toHaveBeenCalledWith(['item-1']);
    expect(onOutcome).not.toHaveBeenCalled();
    // The mark ends the armed state.
    expect(screen.getByRole('button', { name: "Can't decide" })).toBeDefined();
  });

  it('armed, pressing the right card marks the right item only', async () => {
    const { onMarkUnrecognized, user } = setup();

    await user.click(screen.getByRole('button', { name: "Don't recognize…" }));
    await user.click(screen.getByLabelText("Don't recognize Ramen"));

    expect(onMarkUnrecognized).toHaveBeenCalledWith(['item-2']);
  });

  it('"Don\'t recognize either" marks both, in one call', async () => {
    const { onOutcome, onMarkUnrecognized, user } = setup();

    await user.click(screen.getByRole('button', { name: "Don't recognize…" }));
    await user.click(screen.getByRole('button', { name: "Don't recognize either" }));

    expect(onMarkUnrecognized).toHaveBeenCalledTimes(1);
    expect(onMarkUnrecognized).toHaveBeenCalledWith(['item-1', 'item-2']);
    expect(onOutcome).not.toHaveBeenCalled();
  });

  it('Cancel and Esc disarm, recording nothing', async () => {
    const { onOutcome, onMarkUnrecognized, user } = setup();

    await user.click(screen.getByRole('button', { name: "Don't recognize…" }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: "Can't decide" })).toBeDefined();
    expect(screen.getAllByText('Click to choose')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: "Don't recognize…" }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: "Can't decide" })).toBeDefined();

    expect(onOutcome).not.toHaveBeenCalled();
    expect(onMarkUnrecognized).not.toHaveBeenCalled();
  });

  it('K then L, R or B marks; K then Esc cancels', async () => {
    const { onMarkUnrecognized, user } = setup();

    await user.keyboard('kl');
    expect(onMarkUnrecognized).toHaveBeenLastCalledWith(['item-1']);
    await user.keyboard('kr');
    expect(onMarkUnrecognized).toHaveBeenLastCalledWith(['item-2']);
    await user.keyboard('kb');
    expect(onMarkUnrecognized).toHaveBeenLastCalledWith(['item-1', 'item-2']);
    expect(onMarkUnrecognized).toHaveBeenCalledTimes(3);

    await user.keyboard('k{Escape}');
    expect(onMarkUnrecognized).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: "Can't decide" })).toBeDefined();
  });

  it('armed, arrows, Shift+arrows, S and D record nothing and leave it armed', async () => {
    const { onOutcome, onDelete, onMarkUnrecognized, user } = setup();

    await user.keyboard('k');
    await user.keyboard('{ArrowLeft}{ArrowRight}{Shift>}{ArrowLeft}{ArrowRight}{/Shift}sdx');

    expect(onOutcome).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onMarkUnrecognized).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
    expect(screen.queryByText(/press L or R/i)).toBeNull();

    // Still armed: the next L is a mark, not the side of a delete.
    await user.keyboard('l');
    expect(onMarkUnrecognized).toHaveBeenCalledWith(['item-1']);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('K does nothing while a delete is armed, or while a D waits for its side', async () => {
    const { onMarkUnrecognized, user } = setup();

    await user.keyboard('dl');
    await user.keyboard('k');
    expect(screen.queryByRole('button', { name: "Don't recognize either" })).toBeNull();
    expect(screen.getByRole('alert')).toBeDefined();
    await user.keyboard('{Escape}');

    await user.keyboard('dk');
    expect(screen.queryByRole('button', { name: "Don't recognize either" })).toBeNull();
    expect(onMarkUnrecognized).not.toHaveBeenCalled();
  });

  it('arming "don\'t recognize" clears an armed delete', async () => {
    const { onDelete, user } = setup();

    await user.keyboard('dl');
    await user.click(screen.getByRole('button', { name: "Don't recognize…" }));

    expect(screen.queryByRole('alert')).toBeNull();
    await user.keyboard('{Enter}');
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('the hint line reads "K then L, R or B: don\'t recognize" while armed', async () => {
    const { user } = setup();

    expect(screen.queryByText("K then L, R or B: don't recognize")).toBeNull();
    await user.keyboard('k');

    expect(screen.getByText("K then L, R or B: don't recognize")).toBeDefined();
  });

  it('lists K among the shortcuts', () => {
    setup();

    expect(screen.getByText('K')).toBeDefined();
    expect(screen.getByText("then L, R or B: don't recognize")).toBeDefined();
  });

  it('a new pair disarms', async () => {
    const onMarkUnrecognized = vi.fn();
    const props = { pair, answers: 2, onOutcome: vi.fn(), onDelete: vi.fn(), onMarkUnrecognized };
    const user = userEvent.setup();
    const { rerender } = render(<ComparisonDeck {...props} />);

    await user.click(screen.getByRole('button', { name: "Don't recognize…" }));
    rerender(<ComparisonDeck {...props} pair={other} />);

    expect(screen.getByRole('button', { name: "Can't decide" })).toBeDefined();
    expect(screen.getAllByText('Click to choose')).toHaveLength(2);
    await user.keyboard('l');
    expect(onMarkUnrecognized).not.toHaveBeenCalled();
  });

  it('records nothing from the keyboard while restoring', async () => {
    const { onMarkUnrecognized, user } = setup({ status: 'restoring' });

    await user.keyboard('klkb');

    expect(onMarkUnrecognized).not.toHaveBeenCalled();
  });
});
