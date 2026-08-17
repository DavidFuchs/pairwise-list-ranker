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
      diff: { kept: [{ item: item('a'), entry: 'x' }], added: [], removed: [], keptComparisons: 0 },
    });

    expect(screen.getByText(/1 item unchanged/i)).toBeDefined();
    expect(screen.queryByText(/added/i)).toBeNull();
    expect(screen.queryByText(/removed/i)).toBeNull();
  });
});
