/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ComparisonActions } from '@/components/comparison/ComparisonActions';

function setup(overrides: Partial<React.ComponentProps<typeof ComparisonActions>> = {}) {
  const props = {
    leftLabel: 'Tacos',
    rightLabel: 'Ramen',
    onOutcome: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<ComparisonActions {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('ComparisonActions', () => {
  it('offers every comparison action', () => {
    setup();

    for (const name of [
      /choose tacos/i,
      /choose ramen/i,
      /tacos is much better/i,
      /ramen is much better/i,
      /skip this pair/i,
      /delete tacos/i,
      /delete ramen/i,
    ]) {
      expect(screen.getByRole('button', { name })).toBeDefined();
    }
  });

  it('reports a win for the left item', async () => {
    const { onOutcome, user } = setup();

    await user.click(screen.getByRole('button', { name: /choose tacos/i }));

    expect(onOutcome).toHaveBeenCalledWith('left');
  });

  it('reports a win for the right item', async () => {
    const { onOutcome, user } = setup();

    await user.click(screen.getByRole('button', { name: /choose ramen/i }));

    expect(onOutcome).toHaveBeenCalledWith('right');
  });

  it('reports a much-better win as a strong outcome', async () => {
    const { onOutcome, user } = setup();

    await user.click(screen.getByRole('button', { name: /tacos is much better/i }));

    expect(onOutcome).toHaveBeenCalledWith('left_strong');
  });

  it('reports a skip', async () => {
    const { onOutcome, user } = setup();

    await user.click(screen.getByRole('button', { name: /skip this pair/i }));

    expect(onOutcome).toHaveBeenCalledWith('skip');
  });

  it('asks for confirmation before deleting', async () => {
    const { onDelete, user } = setup();

    await user.click(screen.getByRole('button', { name: /delete tacos/i }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /confirm deleting tacos/i })).toBeDefined();
  });

  it('deletes once the action is confirmed', async () => {
    const { onDelete, user } = setup();

    await user.click(screen.getByRole('button', { name: /delete tacos/i }));
    await user.click(screen.getByRole('button', { name: /confirm deleting tacos/i }));

    expect(onDelete).toHaveBeenCalledWith('left');
  });

  it('lets the user back out of a delete', async () => {
    const { onDelete, user } = setup();

    await user.click(screen.getByRole('button', { name: /delete tacos/i }));
    await user.click(screen.getByRole('button', { name: /keep tacos/i }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /delete tacos/i })).toBeDefined();
  });

  it('drops a pending delete when the user picks a winner instead', async () => {
    const { onDelete, onOutcome, user } = setup();

    await user.click(screen.getByRole('button', { name: /delete tacos/i }));
    await user.click(screen.getByRole('button', { name: /choose tacos/i }));

    expect(onOutcome).toHaveBeenCalledWith('left');
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /confirm deleting tacos/i })).toBeNull();
  });

  it('ignores comparison actions while disabled', async () => {
    const { onOutcome } = setup({ disabled: true });
    // Disabled buttons carry pointer-events: none, so bypass the pointer check
    // to prove the handler stays silent even if a press does land.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const button = screen.getByRole('button', { name: /choose tacos/i });

    expect(button.getAttribute('aria-disabled')).toBe('true');
    await user.click(button);

    expect(onOutcome).not.toHaveBeenCalled();
  });
});
