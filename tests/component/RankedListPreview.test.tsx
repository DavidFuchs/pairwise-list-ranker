/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RankedListPreview } from '@/components/preview/RankedListPreview';
import type { ListItem } from '@/types/list';

// Each row draws one PreviewButton, so the labels it is drawn with say which rows rendered.
const drawn = vi.hoisted(() => ({ labels: [] as string[] }));
vi.mock('@/components/preview/PreviewButton', () => ({
  PreviewButton: ({ label }: { label: string }) => {
    drawn.labels.push(label);
    return null;
  },
}));

const NOW = '2026-08-16T00:00:00.000Z';

function items(labels: string[], prefix = 'item'): ListItem[] {
  return labels.map((label, index) => ({
    id: `${prefix}-${index}`,
    listId: 'ws-1',
    value: label,
    createdAt: NOW,
    updatedAt: NOW,
  }));
}

function setup(overrides: Partial<React.ComponentProps<typeof RankedListPreview>> = {}) {
  const props = {
    ranked: items(['Tacos', 'Ramen', 'Curry']),
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
    setup({ ranked: [] });

    expect(screen.getByText(/nothing here yet/i)).toBeDefined();
  });

  it('shows each row its rank and no rating number', () => {
    setup();

    const rows = screen.getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual(['⠿1Tacos', '⠿2Ramen', '⠿3Curry']);
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

  it('sends a row to the top with alt and Home, and to the bottom with alt and End', () => {
    const { onReorder } = setup();

    fireEvent.keyDown(screen.getByLabelText(/reorder curry/i), { key: 'Home', altKey: true });
    expect(onReorder).toHaveBeenLastCalledWith('item-2', ['item-2', 'item-0', 'item-1']);

    fireEvent.keyDown(screen.getByLabelText(/reorder tacos/i), { key: 'End', altKey: true });
    expect(onReorder).toHaveBeenLastCalledWith('item-0', ['item-1', 'item-2', 'item-0']);
  });

  it('leaves a row already at that end where it is', () => {
    const { onReorder } = setup();

    fireEvent.keyDown(screen.getByLabelText(/reorder tacos/i), { key: 'Home', altKey: true });
    fireEvent.keyDown(screen.getByLabelText(/reorder curry/i), { key: 'End', altKey: true });

    expect(onReorder).not.toHaveBeenCalled();
  });
});

describe('RankedListPreview with a long list', () => {
  it('mounts only a window of the rows', () => {
    const labels = Array.from({ length: 500 }, (_, i) => `Song ${i}`);
    setup({ ranked: items(labels) });

    const mounted = screen.getAllByRole('listitem').length;
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(100);
    expect(screen.getByText('Song 0')).toBeDefined();
    expect(screen.queryByText('Song 499')).toBeNull();
  });
});

describe('RankedListPreview when the ranking changes', () => {
  beforeEach(() => {
    drawn.labels = [];
  });

  it('draws again only the rows whose rank changed', () => {
    const ranked = items(Array.from({ length: 500 }, (_, i) => `Song ${i}`));
    const onReorder = vi.fn();
    const { rerender } = render(<RankedListPreview ranked={ranked} onReorder={onReorder} />);
    drawn.labels = [];

    // An answer moves Song 3 to second place: rows 1 and 2 shift down, and the
    // rest of the window is exactly as it was. The parent hands over a new
    // array and a new callback, as it does on every render.
    const next = [ranked[0], ranked[3], ranked[1], ranked[2], ...ranked.slice(4)] as ListItem[];
    rerender(<RankedListPreview ranked={next} onReorder={() => onReorder()} />);

    expect(drawn.labels.sort()).toEqual(['Song 1', 'Song 2', 'Song 3']);
  });

  it('still moves a row from the ranking it was last given', () => {
    const ranked = items(Array.from({ length: 100 }, (_, i) => `Song ${i}`));
    const onReorder = vi.fn();
    const { rerender } = render(<RankedListPreview ranked={ranked} onReorder={onReorder} />);
    const next = [ranked[1], ranked[0], ...ranked.slice(2)] as ListItem[];
    rerender(<RankedListPreview ranked={next} onReorder={onReorder} />);

    fireEvent.keyDown(screen.getByLabelText(/reorder song 2,/i), { key: 'ArrowUp', altKey: true });

    expect(onReorder).toHaveBeenCalledWith('item-2', [
      'item-1',
      'item-2',
      'item-0',
      ...next.slice(3).map((i) => i.id),
    ]);
  });
});

describe('RankedListPreview beyond the ranking', () => {
  it('a marked row has a grip and a remove control, with its rank after the counted rows', () => {
    const onRemove = vi.fn();
    setup({ unrecognized: items(['Natto', 'Durian'], 'odd'), onRemove });

    expect(screen.getByText("Didn't recognize")).toBeDefined();
    const rows = screen.getAllByRole('listitem');
    expect(rows.slice(-2).map((row) => row.textContent)).toEqual(['⠿4Natto', '⠿5Durian']);
    expect(
      screen.getByRole('button', {
        name: `Move Natto back into the ranking, from "Didn't recognize". Hold alt and press the up arrow to put it last in the ranking, or Home to put it first.`,
      }),
    ).toBeDefined();
    expect(screen.queryByLabelText(/^reorder natto/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Natto from the list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Natto' }));
    expect(onRemove).toHaveBeenCalledWith('odd-0');
  });

  it('Alt+Up on a marked row calls onReorder with it last among the ranked', () => {
    const { onReorder } = setup({ unrecognized: items(['Natto'], 'odd') });

    fireEvent.keyDown(screen.getByLabelText(/^move natto/i), { key: 'ArrowUp', altKey: true });

    expect(onReorder).toHaveBeenCalledWith('odd-0', ['item-0', 'item-1', 'item-2', 'odd-0']);
  });

  it('Alt+Home puts it first', () => {
    const { onReorder } = setup({ unrecognized: items(['Natto'], 'odd') });

    fireEvent.keyDown(screen.getByLabelText(/^move natto/i), { key: 'Home', altKey: true });

    expect(onReorder).toHaveBeenCalledWith('odd-0', ['odd-0', 'item-0', 'item-1', 'item-2']);
  });

  it('Alt+Down does nothing', () => {
    const { onReorder } = setup({ unrecognized: items(['Natto', 'Durian'], 'odd') });

    fireEvent.keyDown(screen.getByLabelText(/^move natto/i), { key: 'ArrowDown', altKey: true });
    fireEvent.keyDown(screen.getByLabelText(/^move natto/i), { key: 'End', altKey: true });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('a marked row has nowhere to go with nothing ranked', () => {
    const { onReorder } = setup({ ranked: [], unrecognized: items(['Natto'], 'odd') });

    fireEvent.keyDown(screen.getByLabelText(/^move natto/i), { key: 'ArrowUp', altKey: true });
    fireEvent.pointerDown(screen.getByLabelText(/^move natto/i), { clientY: 0 });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientY: 0 }));
    });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('shows no unrecognized section when there is nothing in it', () => {
    setup();

    expect(screen.queryByText("Didn't recognize")).toBeNull();
  });

  it('shows no rows and nothing to drag while restoring', () => {
    setup({ status: 'restoring' });

    expect(screen.getByText('Restoring your ranking…')).toBeDefined();
    expect(screen.queryByRole('listitem')).toBeNull();
    expect(screen.queryByLabelText(/^reorder /i)).toBeNull();
  });

  it('shows the items, but not as a ranking, when it could not be restored', () => {
    setup({ status: 'unrestored' });

    expect(
      screen.getByText(
        "Couldn't restore your ranking. Your answers are saved; reload the page to try again.",
      ),
    ).toBeDefined();
    expect(screen.getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      'Tacos',
      'Ramen',
      'Curry',
    ]);
    expect(screen.queryByLabelText(/^reorder /i)).toBeNull();
  });
});

describe('a drag when the ranking stops being ready', () => {
  /** Grabs Tacos, then lets go far below the last row. */
  function grabTacos() {
    fireEvent.pointerDown(screen.getByLabelText(/reorder tacos/i), { clientY: 0 });
  }
  function letGoAtTheBottom() {
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientY: 10_000 }));
    });
  }

  it('records a drop on a ready ranking', () => {
    const { onReorder } = setup();

    grabTacos();
    letGoAtTheBottom();

    expect(onReorder).toHaveBeenCalledWith('item-0', ['item-1', 'item-2', 'item-0']);
  });

  it('is abandoned when the ranking goes back to restoring, and records nothing', () => {
    const onReorder = vi.fn();
    const ranked = items(['Tacos', 'Ramen', 'Curry']);
    const { rerender } = render(<RankedListPreview ranked={ranked} onReorder={onReorder} />);

    grabTacos();
    rerender(<RankedListPreview ranked={ranked} onReorder={onReorder} status="restoring" />);
    rerender(<RankedListPreview ranked={ranked} onReorder={onReorder} status="ready" />);
    letGoAtTheBottom();

    expect(onReorder).not.toHaveBeenCalled();
    expect(document.querySelector('[data-dragging="true"]')).toBeNull();
  });
});

describe('dragging a marked row', () => {
  // jsdom lays nothing out, so every row measures at the top of the page:
  // the ranked rows run down from 0 and the last one ends at 2 * pitch + 56.
  function grabNatto() {
    fireEvent.pointerDown(screen.getByLabelText(/^move natto/i), { clientY: 0 });
  }
  function letGo(clientY: number) {
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientY }));
    });
  }

  it('dropped among the ranked rows, rejoins the ranking there', () => {
    const { onReorder } = setup({ unrecognized: items(['Natto'], 'odd') });

    grabNatto();
    letGo(70);

    expect(onReorder).toHaveBeenCalledWith('odd-0', ['item-0', 'odd-0', 'item-1', 'item-2']);
  });

  it('dropped below the ranked rows, records nothing and shows no line', () => {
    const { onReorder } = setup({ unrecognized: items(['Natto'], 'odd') });

    grabNatto();
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientY: 10_000 }));
    });
    expect(document.querySelector('[data-insertion]')).toBeNull();
    letGo(10_000);

    expect(onReorder).not.toHaveBeenCalled();
  });
});

describe('removing from a row', () => {
  it('asks first, as a card does, and removes only when confirmed', () => {
    const onRemove = vi.fn();
    setup({ onRemove });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Ramen from the list' }));
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep Ramen' }));
    expect(onRemove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Ramen from the list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ramen' }));
    expect(onRemove).toHaveBeenCalledWith('item-1');
  });

  it('offers no remove control without a way to remove', () => {
    setup();

    expect(screen.queryByRole('button', { name: /from the list/ })).toBeNull();
  });
});
