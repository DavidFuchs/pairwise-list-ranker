/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WorkspaceControls } from '@/components/editor/WorkspaceControls';

function setup(overrides: Partial<React.ComponentProps<typeof WorkspaceControls>> = {}) {
  const props = {
    persistenceAvailable: true,
    canExport: true,
    onDownload: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
  render(<WorkspaceControls {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('WorkspaceControls', () => {
  it('explains that the list lives in the browser', () => {
    setup();

    expect(screen.getByText(/in this browser/i)).toBeDefined();
  });

  it('says plainly when the browser will not keep the list', () => {
    setup({ persistenceAvailable: false });

    expect(screen.getByText(/will not be kept|not saved/i)).toBeDefined();
  });

  it('shows when the workspace was last saved', () => {
    setup({ savedAt: '2026-08-15T12:00:00.000Z' });

    expect(screen.getByText(/last saved/i)).toBeDefined();
  });

  it('offers a download for every exportable format', () => {
    setup();

    expect(screen.getByRole('button', { name: /download yaml/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /download json/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /download markdown/i })).toBeDefined();
  });

  it('downloads the requested format', async () => {
    const { onDownload, user } = setup();

    await user.click(screen.getByRole('button', { name: /download markdown/i }));

    expect(onDownload).toHaveBeenCalledWith('markdown');
  });

  it('offers no downloads when there is nothing to export', () => {
    setup({ canExport: false });

    expect(screen.queryByRole('button', { name: /download yaml/i })).toBeNull();
  });

  it('asks before clearing the workspace', async () => {
    const { onReset, user } = setup();

    await user.click(screen.getByRole('button', { name: /clear this workspace/i }));

    expect(onReset).not.toHaveBeenCalled();
    expect(screen.getByText(/exported files are not affected/i)).toBeDefined();
  });

  it('clears the workspace once confirmed', async () => {
    const { onReset, user } = setup();

    await user.click(screen.getByRole('button', { name: /clear this workspace/i }));
    await user.click(screen.getByRole('button', { name: /confirm clearing the workspace/i }));

    expect(onReset).toHaveBeenCalled();
  });

  it('lets the user back out of clearing', async () => {
    const { onReset, user } = setup();

    await user.click(screen.getByRole('button', { name: /clear this workspace/i }));
    await user.click(screen.getByRole('button', { name: /keep the workspace/i }));

    expect(onReset).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /clear this workspace/i })).toBeDefined();
  });
});
