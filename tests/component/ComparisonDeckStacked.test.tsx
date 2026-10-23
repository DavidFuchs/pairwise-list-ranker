/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { ComparisonDeck } from '@/components/comparison/ComparisonDeck';
import type { ListItem } from '@/types/list';

const NOW = '2026-08-15T12:00:00.000Z';

function item(id: string, value: ListItem['value']): ListItem {
  return { id, listId: 'list-1', value, createdAt: NOW, updatedAt: NOW };
}

// Own file: react-native-web keeps the first ResizeObserver it sees, so a
// phone-width stub here would leak into the other deck tests if shared.
beforeAll(() => {
  // react-native-web measures the node itself when the observer fires.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 320,
    bottom: 400,
    width: 320,
    height: 400,
    toJSON: () => ({}),
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [{ target, contentRect: { width: 320, height: 400 } } as unknown as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
});

describe('ComparisonDeck on a phone-width stage', () => {
  it('armed, the gutter between the stacked cards says what a press does, since they have no hint bar', async () => {
    const user = userEvent.setup();
    render(
      <ComparisonDeck
        pair={[item('item-1', 'Tacos'), item('item-2', 'Ramen')]}
        answers={2}
        onOutcome={vi.fn()}
        onDelete={vi.fn()}
        onMarkUnrecognized={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.queryByText('Click to choose')).toBeNull());
    expect(screen.getByText('or')).toBeDefined();

    await user.click(screen.getByRole('button', { name: "Don't recognize…" }));

    expect(screen.getByText("Tap the one you don't recognize")).toBeDefined();
    expect(screen.queryByText('or')).toBeNull();
  });
});
