/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RankRail } from '@/components/rank/RankRail';

function setup(overrides: Partial<React.ComponentProps<typeof RankRail>> = {}) {
  const props = {
    name: 'Sci-fi films',
    context: 'movies · shown by title · order written back',
    progress: { activeItems: 12, comparisons: 47, skips: 2, coverage: 0.6 },
    removedCount: 0,
    onRename: vi.fn(),
    onEditData: vi.fn(),
    onStartOver: vi.fn(),
    ...overrides,
  };
  render(<RankRail {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('RankRail', () => {
  it('shows the list name as an editable field', () => {
    setup();

    expect((screen.getByLabelText(/list name/i) as HTMLInputElement).value).toBe('Sci-fi films');
  });

  it('reports a rename', () => {
    const { onRename } = setup();

    fireEvent.change(screen.getByLabelText(/list name/i), { target: { value: 'Best films' } });

    expect(onRename).toHaveBeenCalledWith('Best films');
  });

  it('says what is being ranked and how', () => {
    setup();

    expect(screen.getByText(/movies · shown by title · order written back/)).toBeDefined();
  });

  it('shows progress', () => {
    setup();

    expect(screen.getByText(/47 comparisons/i)).toBeDefined();
    expect(screen.getByText(/12 items/i)).toBeDefined();
  });

  it('mentions removed items only when there are some', () => {
    setup({ removedCount: 2 });

    expect(screen.getByText(/2 removed items are excluded from the export/i)).toBeDefined();
  });

  it('stays quiet when nothing was removed', () => {
    setup();

    expect(screen.queryByText(/excluded from the export/i)).toBeNull();
  });

  it('offers editing the data', async () => {
    const { onEditData, user } = setup();

    await user.click(screen.getByRole('button', { name: /edit data/i }));

    expect(onEditData).toHaveBeenCalled();
  });

  it('confirms before starting over', async () => {
    const { onStartOver, user } = setup();

    await user.click(screen.getByRole('button', { name: /^start over$/i }));

    expect(onStartOver).not.toHaveBeenCalled();
    expect(screen.getByText(/clears this list from the browser/i)).toBeDefined();

    await user.click(screen.getByRole('button', { name: /confirm start over/i }));

    expect(onStartOver).toHaveBeenCalled();
  });

  it('can cancel starting over', async () => {
    const { onStartOver, user } = setup();

    await user.click(screen.getByRole('button', { name: /^start over$/i }));
    await user.click(screen.getByRole('button', { name: /keep this list/i }));

    expect(onStartOver).not.toHaveBeenCalled();
    expect(screen.queryByText(/clears this list from the browser/i)).toBeNull();
  });
});
