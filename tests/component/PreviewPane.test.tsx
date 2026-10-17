/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PreviewPane } from '@/components/preview/PreviewPane';
import { cardLayout } from '@/lib/renderers';
import type { ListItem } from '@/types/list';
import type { RankedItem } from '@/types/ranking';

const NOW = '2026-08-16T00:00:00.000Z';

function ranked(): RankedItem<ListItem>[] {
  return [{ title: 'Arrival' }, { title: 'Alien' }].map((value, index) => ({
    rank: index + 1,
    item: {
      id: `item-${index}`,
      listId: 'ws-1',
      value,
      active: true,
      createdAt: NOW,
      updatedAt: NOW,
    },
    state: {
      itemId: `item-${index}`,
      rating: 1500,
      comparisons: 0,
      wins: 0,
      losses: 0,
      skips: 0,
    },
  }));
}

function setup(overrides: Partial<React.ComponentProps<typeof PreviewPane>> = {}) {
  const props: React.ComponentProps<typeof PreviewPane> = {
    tab: 'ranked',
    tabs: ['ranked', 'yaml', 'json'],
    onTabChange: vi.fn(),
    ranking: ranked(),
    layout: cardLayout({ labelField: 'title' }),
    exportText: 'movies:\n  - title: Arrival\n',
    filename: 'films-2026-08-16.yaml',
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

  it('offers copy and download on a format tab', () => {
    setup({ tab: 'yaml' });

    expect(screen.getByRole('button', { name: /copy/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /download/i })).toBeDefined();
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
  it('exports from the ranked view, building the file only when asked', async () => {
    const getExportText = vi.fn(() => 'movies:\n  - title: Arrival\n');
    const writeText = vi.fn(() => Promise.resolve());
    const { user } = setup({ tab: 'ranked', exportText: '', getExportText });
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    expect(screen.getByRole('button', { name: /^Download ranked list/ })).toBeDefined();
    expect(getExportText).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^Copy the ranked/ }));

    expect(getExportText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('movies:\n  - title: Arrival\n');
  });

  it('keeps the session controls, set apart as a way to carry on later', () => {
    setup({ sessionFile: { onSave: vi.fn(() => ''), onOpen: vi.fn(async () => null) } });

    expect(screen.getByText('Keep working later, here or in another browser')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Save this session to a file' })).toBeDefined();
  });
});
