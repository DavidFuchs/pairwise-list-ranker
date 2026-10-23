/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PreviewPane } from '@/components/preview/PreviewPane';
import * as exportActions from '@/lib/browser/exportActions';
import { cardLayout } from '@/lib/renderers';
import type { ListItem } from '@/types/list';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const NOW = '2026-08-16T00:00:00.000Z';

function ranked(): ListItem[] {
  return [{ title: 'Arrival' }, { title: 'Alien' }].map((value, index) => ({
    id: `item-${index}`,
    listId: 'ws-1',
    value,
    createdAt: NOW,
    updatedAt: NOW,
  }));
}

function setup(overrides: Partial<React.ComponentProps<typeof PreviewPane>> = {}) {
  const props: React.ComponentProps<typeof PreviewPane> = {
    tab: 'ranked',
    tabs: ['ranked', 'yaml', 'json'],
    onTabChange: vi.fn(),
    ranked: ranked(),
    layout: cardLayout({ labelField: 'title' }),
    exportText: 'movies:\n  - title: Arrival\n',
    getExportText: (format) => `as ${format}`,
    format: 'yaml',
    removedCount: 0,
    onReorder: vi.fn(),
    ...overrides,
  };
  render(<PreviewPane {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('PreviewPane', () => {
  it('shows the ranking on the ranked tab', () => {
    setup();

    expect(screen.getByText('Arrival')).toBeDefined();
  });

  it('offers no editor on the ranked tab', () => {
    setup();

    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('shows the exported text on a format tab', () => {
    setup({ tab: 'yaml' });

    expect(screen.getByText(/movies:/)).toBeDefined();
  });

  it('never offers an editable buffer', () => {
    setup({ tab: 'yaml' });

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /import|apply/i })).toBeNull();
  });

  it('offers a download on a format tab, and a copy icon in the text', () => {
    setup({ tab: 'yaml' });

    expect(screen.getByRole('button', { name: /^Download YAML/ })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Copy YAML to the clipboard' })).toBeDefined();
  });

  it('offers a download but no copy on the ranked tab', () => {
    setup({ tab: 'ranked' });

    expect(screen.getByRole('button', { name: /^Download YAML/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Copy/ })).toBeNull();
  });

  it('copies the text it shows', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const { user } = setup({ tab: 'yaml' });
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await user.click(screen.getByRole('button', { name: 'Copy YAML to the clipboard' }));

    expect(writeText).toHaveBeenCalledWith('movies:\n  - title: Arrival\n');
    expect(await screen.findByText('Copied')).toBeDefined();
  });

  it('shows only the tabs the source can produce', () => {
    setup({ tabs: ['ranked', 'yaml'] });

    expect(screen.queryByRole('tab', { name: /json/i })).toBeNull();
  });

  it('reports a tab change', async () => {
    const { onTabChange, user } = setup();

    await user.click(screen.getByRole('tab', { name: /json/i }));

    expect(onTabChange).toHaveBeenCalledWith('json');
  });
});

describe('PreviewPane export', () => {
  it('downloads from the ranked view in the imported format, building the file only when asked', async () => {
    const download = vi.spyOn(exportActions, 'downloadText').mockReturnValue(true);
    const getExportText = vi.fn((format: string) => `as ${format}`);
    const { user } = setup({ tab: 'ranked', exportText: '', getExportText });

    expect(getExportText).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^Download YAML/ }));

    expect(getExportText).toHaveBeenCalledWith('yaml');
    expect(download).toHaveBeenCalledWith(expect.stringMatching(/\.yaml$/), 'as yaml', 'application/yaml');
  });

  it('downloads the tab’s format on a format tab, and another from the caret', async () => {
    const download = vi.spyOn(exportActions, 'downloadText').mockReturnValue(true);
    const { user } = setup({ tab: 'json', format: 'json', exportText: '{}' });

    await user.click(screen.getByRole('button', { name: /^Download JSON/ }));
    expect(download).toHaveBeenLastCalledWith(expect.stringMatching(/\.json$/), '{}', 'application/json');

    await user.click(screen.getByRole('button', { name: 'Choose a download format' }));
    await user.click(screen.getByRole('menuitem', { name: 'Download YAML' }));
    expect(download).toHaveBeenLastCalledWith(
      expect.stringMatching(/\.yaml$/),
      'as yaml',
      'application/yaml',
    );
  });

  it('keeps the session controls, set apart as a way to carry on later', () => {
    setup({ sessionFile: { onSave: vi.fn(() => ''), onOpen: vi.fn(async () => null) } });

    expect(screen.getByText('Keep working later, here or in another browser')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Save this session to a file' })).toBeDefined();
  });
});

describe('PreviewPane before any decision', () => {
  it('says the order is only the one given', () => {
    setup({ decided: false });

    expect(screen.getByText(/^Not ranked yet: this is the order you gave/)).toBeDefined();
  });

  it('calls a list marked already ranked the user’s own order', () => {
    setup({ decided: false, trustedOrder: true });

    expect(screen.getByText(/^Your order, as given/)).toBeDefined();
  });

  it('invites a drag once there is a decision behind the order', () => {
    setup({ decided: true });

    expect(screen.getByText('Drag a row to arrange it')).toBeDefined();
  });
});

describe('PreviewPane while restoring', () => {
  it('says so on a format tab, rather than showing an order', () => {
    setup({ tab: 'yaml', status: 'restoring', exportText: '' });

    expect(screen.getByText('Restoring your ranking…')).toBeDefined();
    expect(screen.queryByLabelText(/yaml export/i)).toBeNull();
  });

  it('offers no copy icon over text it is not showing', () => {
    setup({ tab: 'yaml', status: 'restoring', exportText: '' });

    expect(screen.queryByRole('button', { name: /^Copy/ })).toBeNull();
  });

  it('builds the export only when asked, even on a format tab', async () => {
    const download = vi.spyOn(exportActions, 'downloadText').mockReturnValue(true);
    const getExportText = vi.fn(() => 'movies: [Arrival]');
    const { user } = setup({ tab: 'yaml', status: 'restoring', exportText: '', getExportText });

    await user.click(screen.getByRole('button', { name: /^Download YAML/ }));

    expect(getExportText).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledWith(expect.any(String), 'movies: [Arrival]', 'application/yaml');
  });
});

describe('PreviewPane subtitle', () => {
  it('invites no drag over the plain rows of a ranking that could not be restored', () => {
    setup({ status: 'unrestored', decided: true });

    expect(screen.queryByText('Drag a row to arrange it')).toBeNull();
    expect(screen.getByText(/^Couldn't restore your ranking/)).toBeDefined();
  });

  it('claims no new order over the restoring message on a format tab', () => {
    setup({ tab: 'yaml', status: 'restoring', exportText: '' });

    expect(screen.queryByText('Your document, in the new order')).toBeNull();
    expect(screen.getByText('Restoring your ranking…')).toBeDefined();
  });

  it('keeps its subtitle while the ranking is ready', () => {
    setup({ tab: 'yaml' });

    expect(screen.getByText('Your document, in the new order')).toBeDefined();
  });

  it('offers a List setup gear in the Your data header when given a way to open it', async () => {
    const onOpenSetup = vi.fn();
    const { user } = setup({ onOpenSetup });

    const gear = screen.getByRole('button', { name: 'List setup' });
    expect(gear.getAttribute('title')).toBe('List setup');
    await user.click(gear);

    expect(onOpenSetup).toHaveBeenCalledTimes(1);
  });

  it('has no gear without a way to open list setup', () => {
    setup();

    expect(screen.queryByRole('button', { name: 'List setup' })).toBeNull();
  });
});
