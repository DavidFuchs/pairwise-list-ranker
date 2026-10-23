/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DownloadButton } from '@/components/preview/DownloadButton';
import * as exportActions from '@/lib/browser/exportActions';
import type { SourceFormat } from '@/types/source';

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(format: SourceFormat = 'yaml', formats: SourceFormat[] = ['yaml', 'json']) {
  const download = vi.spyOn(exportActions, 'downloadText').mockReturnValue(true);
  const getText = vi.fn((chosen: SourceFormat) => `as ${chosen}`);
  render(<DownloadButton format={format} formats={formats} getText={getText} />);
  return { download, getText, user: userEvent.setup() };
}

describe('DownloadButton', () => {
  it('names the format it downloads', () => {
    setup('json');

    expect(screen.getByText('Download JSON')).toBeDefined();
  });

  it('calls a plain list a plain list', () => {
    setup('list', ['list', 'yaml', 'json']);

    expect(screen.getByText('Download plain list')).toBeDefined();
  });

  it('keeps the filename out of the visible text but in the label', () => {
    setup();

    expect(
      screen.getByRole('button', { name: /^Download YAML as pairwise-\d{4}-\d{2}-\d{2}\.yaml$/ }),
    ).toBeDefined();
  });

  it('downloads the main format, builds it only when asked, and confirms', async () => {
    const { download, getText, user } = setup();
    expect(getText).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^Download YAML as/ }));

    expect(getText).toHaveBeenCalledWith('yaml');
    expect(download).toHaveBeenCalledWith(expect.stringMatching(/\.yaml$/), 'as yaml', 'application/yaml');
    expect(await screen.findByText('Downloaded')).toBeDefined();
  });

  it('offers the other formats from the caret and downloads the one chosen', async () => {
    const { download, user } = setup();
    expect(screen.queryByRole('menuitem')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Choose a download format' }));
    await user.click(screen.getByRole('menuitem', { name: 'Download JSON' }));

    expect(download).toHaveBeenCalledWith(expect.stringMatching(/\.json$/), 'as json', 'application/json');
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('has no caret when there is no other format', () => {
    setup('yaml', ['yaml']);

    expect(screen.queryByRole('button', { name: 'Choose a download format' })).toBeNull();
  });
});
