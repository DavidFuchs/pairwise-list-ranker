import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';

import PasteScreen from '@/app/index';
import SetupScreen from '@/app/setup';
import { pasteDraft } from '@/lib/state/pasteDraft';

/** The paste page's text box. */
export function typeSource(text: string) {
  fireEvent.change(screen.getByLabelText(/your list/i), { target: { value: text } });
}

/** Presses the paste page's Continue once it is enabled. */
export async function pressContinue() {
  const user = userEvent.setup();
  await waitFor(() => {
    const enabled = screen
      .getAllByRole('button', { name: /^continue$/i })
      .filter((button) => button.getAttribute('aria-disabled') !== 'true');
    expect(enabled.length).toBeGreaterThan(0);
  });
  const button = screen
    .getAllByRole('button', { name: /^continue$/i })
    .find((candidate) => candidate.getAttribute('aria-disabled') !== 'true');
  await user.click(button!);
}

/**
 * The two screens a new list passes through: text pasted on the paste page,
 * then Continue, leaving the list setup rendered. The router is mocked by the
 * caller, so Continue only records the navigation; this renders the next screen.
 */
export async function reachSetup(text: string, options: { format?: RegExp } = {}) {
  // Screens left over from an earlier test, and the text they left behind.
  cleanup();
  pasteDraft.getState().clear();
  const user = userEvent.setup();
  const paste = render(<PasteScreen />);
  if (options.format !== undefined) await user.click(screen.getByRole('radio', { name: options.format }));
  typeSource(text);
  await pressContinue();
  paste.unmount();
  return render(<SetupScreen />);
}
