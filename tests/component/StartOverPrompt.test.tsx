/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Text } from 'react-native';

import { AppShell } from '@/components/layout/AppShell';

function setup(props: Partial<React.ComponentProps<typeof AppShell>> = {}) {
  const onReset = vi.fn();
  const onSaveBeforeReset = vi.fn(() => 'Saved pairwise-session-2026-08-16.json');
  render(
    <AppShell
      stage={<Text>Stage</Text>}
      preview={<Text>Preview</Text>}
      onReset={onReset}
      resetCost="Your 12 changes will be lost."
      onSaveBeforeReset={onSaveBeforeReset}
      {...props}
    />,
  );
  return { user: userEvent.setup(), onReset, onSaveBeforeReset };
}

describe('the start-over prompt', () => {
  it('says what will be lost before anything is cleared', async () => {
    const { user, onReset } = setup();
    await user.click(screen.getByRole('button', { name: 'Start over' }));

    expect(screen.getByText(/Your 12 changes will be lost\./)).toBeDefined();
    expect(onReset).not.toHaveBeenCalled();
  });

  it('offers to save the session first, and says how that went', async () => {
    const { user, onSaveBeforeReset, onReset } = setup();
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    await user.click(screen.getByRole('button', { name: 'Save session first' }));

    expect(onSaveBeforeReset).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Saved pairwise-session-2026-08-16.json')).toBeDefined();
    // Saving does not answer the question: the list is still there.
    expect(onReset).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirm start over' })).toBeDefined();
  });

  it('offers no save when there is nothing to lose', async () => {
    const { user } = setup({ resetCost: undefined });
    await user.click(screen.getByRole('button', { name: 'Start over' }));

    expect(screen.queryByRole('button', { name: 'Save session first' })).toBeNull();
  });

  it('labels its buttons the way they are spoken', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Start over' }));

    expect(screen.getByRole('button', { name: 'Keep this list' }).textContent).toBe('Keep this list');
    expect(screen.getByRole('button', { name: 'Confirm start over' }).textContent).toBe('Start over');
  });

  it('stands down on Escape', async () => {
    const { user, onReset } = setup();
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('button', { name: 'Confirm start over' })).toBeNull();
    expect(onReset).not.toHaveBeenCalled();
  });

  it('stands down when the user goes back to the page', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    await user.click(screen.getByText('Stage'));

    expect(screen.queryByRole('button', { name: 'Confirm start over' })).toBeNull();
  });

  it('clears the list once confirmed', async () => {
    const { user, onReset } = setup();
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    await user.click(screen.getByRole('button', { name: 'Confirm start over' }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
