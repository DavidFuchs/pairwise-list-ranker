/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExportToolbar } from '@/components/preview/ExportToolbar';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ExportToolbar', () => {
  it('offers copy and download', () => {
    render(<ExportToolbar format="yaml" text="a: 1" filename="films-2026-08-16.yaml" />);

    expect(screen.getByRole('button', { name: /copy/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /download/i })).toBeDefined();
  });

  it('offers no import action', () => {
    render(<ExportToolbar format="yaml" text="a: 1" filename="films.yaml" />);

    expect(screen.queryByRole('button', { name: /import|apply/i })).toBeNull();
  });

  it('shows the filename', () => {
    render(<ExportToolbar format="yaml" text="a: 1" filename="films-2026-08-16.yaml" />);

    expect(screen.getByText('films-2026-08-16.yaml')).toBeDefined();
  });

  it('copies the text and confirms', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    // userEvent.setup() installs its own clipboard stub, so ours goes second.
    const user = userEvent.setup();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<ExportToolbar format="yaml" text="a: 1" filename="films.yaml" />);

    await user.click(screen.getByRole('button', { name: /copy/i }));

    expect(writeText).toHaveBeenCalledWith('a: 1');
    expect(await screen.findByText(/copied/i)).toBeDefined();
  });
});
