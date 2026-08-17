/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApplySummary } from '@/components/data/ApplySummary';
import type { ListItem } from '@/types/list';

function item(id: string): ListItem {
  return {
    id,
    listId: 'ws-1',
    value: 'x',
    active: true,
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
  };
}

function setup(overrides: Partial<React.ComponentProps<typeof ApplySummary>> = {}) {
  const props = {
    diff: {
      kept: [item('a'), item('b')].map((entry) => ({ item: entry, entry: 'x' })),
      added: ['y'] as unknown[],
      removed: [item('c')],
      keptComparisons: 47,
      ordered: [],
      reordered: false,
    },
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
  render(<ApplySummary {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('ApplySummary', () => {
  it('counts what stays, what is new, and what goes', () => {
    setup();

    expect(screen.getByText(/2 items unchanged/i)).toBeDefined();
    expect(screen.getByText(/1 item added/i)).toBeDefined();
    expect(screen.getByText(/1 item removed/i)).toBeDefined();
  });

  it('says the rankings are kept', () => {
    setup();

    expect(screen.getByText(/47 comparisons kept/i)).toBeDefined();
  });

  it('confirms', async () => {
    const { onConfirm, user } = setup();

    await user.click(screen.getByRole('button', { name: /apply edits/i }));

    expect(onConfirm).toHaveBeenCalled();
  });

  it('cancels', async () => {
    const { onCancel, user } = setup();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalled();
  });

  it('reads sensibly when nothing changed', () => {
    setup({
      diff: {
        kept: [{ item: item('a'), entry: 'x' }],
        added: [],
        removed: [],
        keptComparisons: 0,
        ordered: [],
        reordered: false,
      },
    });

    expect(screen.getByText(/1 item unchanged/i)).toBeDefined();
    expect(screen.queryByText(/added/i)).toBeNull();
    expect(screen.queryByText(/removed/i)).toBeNull();
  });

  it('says plainly when applying would change nothing', () => {
    setup({
      diff: {
        kept: [{ item: item('a'), entry: 'x' }],
        added: [],
        removed: [],
        keptComparisons: 0,
        ordered: [],
        reordered: false,
      },
    });

    expect(screen.getByText(/nothing changed/i)).toBeDefined();
  });

  /**
   * Reordering the text changes nothing a count of added and removed entries
   * can show, so the summary has to say it outright.
   */
  it('reports an order change even when every entry is untouched', () => {
    setup({
      diff: {
        kept: [
          { item: item('a'), entry: 'x' },
          { item: item('b'), entry: 'y' },
        ],
        added: [],
        removed: [],
        keptComparisons: 3,
        ordered: [],
        reordered: true,
      },
    });

    expect(screen.getByText(/order changed/i)).toBeDefined();
    expect(screen.queryByText(/nothing changed/i)).toBeNull();
  });

  /**
   * Reordering the text sets the starting order, but a ranking that already
   * has comparisons behind it will not simply follow the text. Saying it would
   * is a promise the app cannot keep.
   */
  it('does not promise the list will follow the text when comparisons survive', () => {
    setup({
      diff: {
        kept: [
          { item: item('a'), entry: 'x' },
          { item: item('b'), entry: 'y' },
        ],
        added: [],
        removed: [],
        keptComparisons: 12,
        ordered: [],
        reordered: true,
      },
    });

    expect(screen.getByText(/12 comparisons still decide/i)).toBeDefined();
    expect(screen.queryByText(/will follow your text/i)).toBeNull();
  });

  it('says the list will follow the text when nothing has been compared', () => {
    setup({
      diff: {
        kept: [{ item: item('a'), entry: 'x' }],
        added: [],
        removed: [],
        keptComparisons: 0,
        ordered: [],
        reordered: true,
      },
    });

    expect(screen.getByText(/will follow your text/i)).toBeDefined();
  });
});
