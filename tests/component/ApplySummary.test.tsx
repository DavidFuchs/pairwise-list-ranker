/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApplySummary } from '@/components/data/ApplySummary';
import type { SettingsDiff } from '@/lib/import/diff';
import type { ListItem } from '@/types/list';

function item(id: string): ListItem {
  return {
    id,
    listId: 'ws-1',
    value: 'x',
    active: true,
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
  };
}

const settledSettings: SettingsDiff = {
  order: 'unchanged',
  label: null,
  writeBack: null,
  changed: false,
};

/** Entries untouched: what an edit that only changed the options leaves behind. */
const untouchedData = {
  kept: [
    { item: item('a'), entry: 'x' },
    { item: item('b'), entry: 'y' },
  ],
  added: [] as unknown[],
  removed: [] as ListItem[],
  keptComparisons: 0,
  ordered: [],
  reordered: false,
};

function setup(overrides: Partial<React.ComponentProps<typeof ApplySummary>> = {}) {
  const props = {
    settings: settledSettings,
    diff: {
      kept: [item('a'), item('b')].map((entry) => ({ item: entry, entry: 'x' })),
      added: ['y'] as unknown[],
      removed: [item('c')],
      keptComparisons: 47,
      ordered: [],
      reordered: false,
    },
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
  render(<ApplySummary {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('ApplySummary', () => {
  it('counts what stays, what is new, and what goes', () => {
    setup();

    expect(screen.getByText(/2 items unchanged/i)).toBeDefined();
    expect(screen.getByText(/1 item added/i)).toBeDefined();
    expect(screen.getByText(/1 item removed/i)).toBeDefined();
  });

  it('says the rankings are kept', () => {
    setup();

    expect(screen.getByText(/47 comparisons kept/i)).toBeDefined();
  });

  it('confirms', async () => {
    const { onConfirm, user } = setup();

    await user.click(screen.getByRole('button', { name: /apply edits/i }));

    expect(onConfirm).toHaveBeenCalled();
  });

  it('cancels', async () => {
    const { onCancel, user } = setup();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalled();
  });

  it('counts nothing when no entry was touched', () => {
    setup({ diff: untouchedData });

    expect(screen.queryByText(/unchanged/i)).toBeNull();
    expect(screen.queryByText(/added/i)).toBeNull();
    expect(screen.queryByText(/removed/i)).toBeNull();
  });

  it('says plainly when applying would change nothing', () => {
    setup({ diff: untouchedData });

    expect(screen.getByText(/nothing changed/i)).toBeDefined();
  });

  /**
   * Reordering the text changes nothing a count of added and removed entries
   * can show, so the summary has to say it outright.
   */
  it('reports an order change even when every entry is untouched', () => {
    setup({
      diff: {
        kept: [
          { item: item('a'), entry: 'x' },
          { item: item('b'), entry: 'y' },
        ],
        added: [],
        removed: [],
        keptComparisons: 3,
        ordered: [],
        reordered: true,
      },
    });

    expect(screen.getByText(/order changed/i)).toBeDefined();
    expect(screen.queryByText(/nothing changed/i)).toBeNull();
  });

  /**
   * Reordering the text sets the starting order, but a ranking that already
   * has comparisons behind it will not simply follow the text. Saying it would
   * is a promise the app cannot keep.
   */
  it('does not promise the list will follow the text when comparisons survive', () => {
    setup({
      diff: {
        kept: [
          { item: item('a'), entry: 'x' },
          { item: item('b'), entry: 'y' },
        ],
        added: [],
        removed: [],
        keptComparisons: 12,
        ordered: [],
        reordered: true,
      },
    });

    expect(screen.getByText(/12 comparisons still decide/i)).toBeDefined();
    expect(screen.queryByText(/will follow your text/i)).toBeNull();
  });

  it('says the list will follow the text when nothing has been compared', () => {
    setup({
      diff: {
        kept: [{ item: item('a'), entry: 'x' }],
        added: [],
        removed: [],
        keptComparisons: 0,
        ordered: [],
        reordered: true,
      },
    });

    expect(screen.getByText(/will follow your text/i)).toBeDefined();
  });

  /**
   * An edit that only answered the setup questions differently is not an edit
   * to the data, and counting entries at it reads as though it were.
   */
  describe('settings', () => {
    it('does not claim nothing changed when only an option changed', () => {
      setup({
        diff: untouchedData,
        settings: { ...settledSettings, order: 'seeded', changed: true },
      });

      expect(screen.queryByText(/nothing changed/i)).toBeNull();
    });

    it('names the consequence of declaring the list already ranked', () => {
      setup({
        diff: untouchedData,
        settings: { ...settledSettings, order: 'seeded', changed: true },
      });

      expect(screen.getByText(/best to worst/i)).toBeDefined();
      expect(screen.getByText(/ratings restart from/i)).toBeDefined();
    });

    it('names the consequence of withdrawing that claim', () => {
      setup({
        diff: untouchedData,
        settings: { ...settledSettings, order: 'flattened', changed: true },
      });

      expect(screen.getByText(/no particular order/i)).toBeDefined();
      expect(screen.getByText(/restart flat/i)).toBeDefined();
    });

    /**
     * Re-seeding derives every starting rating again, so the ranking numbers
     * move even though every comparison behind them survives. Saying the
     * rankings are kept would be the same lie the counts used to tell.
     */
    it('never promises the rankings are kept when the order option changed', () => {
      setup({
        diff: { ...untouchedData, added: ['z'], keptComparisons: 12 },
        settings: { ...settledSettings, order: 'seeded', changed: true },
      });

      expect(screen.queryByText(/rankings kept/i)).toBeNull();
      expect(screen.getByText(/12 comparisons are kept and replayed/i)).toBeDefined();
      expect(screen.getByText(/ranking numbers will shift/i)).toBeDefined();
    });

    it('says what decides the ranking when the order option changed before any comparison', () => {
      setup({
        diff: untouchedData,
        settings: { ...settledSettings, order: 'seeded', changed: true },
      });

      expect(screen.getByText(/nothing has been compared yet/i)).toBeDefined();
    });

    it('reports the label field the cards will use', () => {
      setup({
        diff: untouchedData,
        settings: {
          ...settledSettings,
          label: { from: 'name', to: 'title' },
          changed: true,
        },
      });

      expect(screen.getByText(/cards now show “title”/i)).toBeDefined();
    });

    /** The write-back field reaches the exported file and nothing else. */
    it('reports the write-back field as an export change', () => {
      setup({
        diff: untouchedData,
        settings: {
          ...settledSettings,
          writeBack: { from: undefined, to: 'rank' },
          changed: true,
        },
      });

      expect(screen.getByText(/export will now number your items in “rank”/i)).toBeDefined();
    });

    it('reports the write-back field being cleared', () => {
      setup({
        diff: untouchedData,
        settings: {
          ...settledSettings,
          writeBack: { from: 'rank', to: undefined },
          changed: true,
        },
      });

      expect(screen.getByText(/export will no longer number your items/i)).toBeDefined();
    });

    it('reports data and settings changes together', () => {
      setup({
        settings: { ...settledSettings, order: 'seeded', changed: true },
      });

      expect(screen.getByText(/1 item added/i)).toBeDefined();
      expect(screen.getByText(/best to worst/i)).toBeDefined();
    });
  });
});
