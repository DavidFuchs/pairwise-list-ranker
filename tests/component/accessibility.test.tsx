/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ComparisonDeck } from '@/components/comparison/ComparisonDeck';
import { SourceInput } from '@/components/data/SourceInput';
import { AppShell } from '@/components/layout/AppShell';
import { PreviewPane } from '@/components/preview/PreviewPane';
import type { ListItem } from '@/types/list';

const NOW = '2026-08-15T12:00:00.000Z';

function item(id: string, value: ListItem['value']): ListItem {
  return {
    id,
    listId: 'list-1',
    value,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const pair: [ListItem, ListItem] = [item('item-1', 'Tacos'), item('item-2', 'Ramen')];

describe('landmarks', () => {
  it('marks the header, the working area, and the preview', () => {
    render(
      <AppShell
        listName="Dinners"
        onReset={vi.fn()}
        rail={null}
        stage={<span>stage</span>}
        preview={<span>preview</span>}
      />,
    );

    expect(screen.getByRole('banner')).toBeDefined();
    expect(screen.getByRole('main')).toBeDefined();
    expect(screen.getByRole('complementary')).toBeDefined();
  });
});

describe('comparison stage announcements', () => {
  it('announces the pair on offer politely', () => {
    render(
      <ComparisonDeck
        pair={pair}
        answers={2}
        onOutcome={vi.fn()}
        onDelete={vi.fn()}
        onMarkUnrecognized={vi.fn()}
      />,
    );

    const live = screen.getByText(/comparing tacos and ramen/i);
    expect(live.closest('[aria-live]')?.getAttribute('aria-live')).toBe('polite');
  });

  it('announces the answer count politely, with no bare bar', () => {
    render(
      <ComparisonDeck
        pair={pair}
        answers={2}
        onOutcome={vi.fn()}
        onDelete={vi.fn()}
        onMarkUnrecognized={vi.fn()}
      />,
    );

    const count = screen.getByText('2 answers so far');
    expect(count.closest('[aria-live]')?.getAttribute('aria-live')).toBe('polite');
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('preview pane', () => {
  it('labels the ranked list for screen readers', () => {
    render(
      <PreviewPane
        tab="ranked"
        tabs={['ranked', 'yaml']}
        ranked={[]}
        exportText=""
        getExportText={() => ''}
        format="yaml"
        removedCount={0}
        onReorder={vi.fn()}
        onTabChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/current ranking/i)).toBeDefined();
  });

  it('labels the exported text region for screen readers', () => {
    render(
      <PreviewPane
        tab="yaml"
        tabs={['ranked', 'yaml']}
        ranked={[]}
        exportText="movies: []"
        getExportText={() => ''}
        format="yaml"
        removedCount={0}
        onReorder={vi.fn()}
        onTabChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/yaml export/i)).toBeDefined();
  });
});

describe('source input', () => {
  it('announces parse problems as an alert', () => {
    render(
      <SourceInput
        value="{ broken"
        onChange={vi.fn()}
        override="json"
        onOverrideChange={vi.fn()}
        issues={[{ path: '', message: 'Invalid JSON', line: 1 }]}
      />,
    );

    expect(screen.getByRole('alert')).toBeDefined();
  });
});
