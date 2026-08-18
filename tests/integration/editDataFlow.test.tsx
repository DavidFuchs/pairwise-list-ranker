/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DataScreen from '@/app/index';
import { listStore } from '@/lib/state/useListStore';

const replace = vi.fn();
const push = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace, push }),
}));

const RAW = 'Alien\nArrival\nSolaris\n';

function seedWorkspace() {
  listStore.getState().startRanking({
    source: {
      format: 'list',
      rawText: RAW,
      document: ['Alien', 'Arrival', 'Solaris'],
      arrayPath: [],
    },
    roles: {},
  });
  const [left, right] = listStore.getState().items;
  listStore.getState().recordComparison(left?.id ?? '', right?.id ?? '', 'left');
}

describe('editing data mid-run', () => {
  beforeEach(() => {
    listStore.getState().reset();
    globalThis.localStorage?.clear();
    replace.mockClear();
    push.mockClear();
  });

  it('opens with the unranked text unchanged, when nothing has reordered it', () => {
    listStore.getState().startRanking({
      source: { format: 'list', rawText: RAW, document: ['Alien', 'Arrival', 'Solaris'], arrayPath: [] },
      roles: {},
    });
    render(<DataScreen />);

    expect((screen.getByLabelText(/your list/i) as HTMLTextAreaElement).value).toBe(RAW);
  });

  /**
   * Reported bug: ranking a list by comparisons reordered it, but going back
   * to "Edit data" still showed the original import order. The text box now
   * reflects the ranking's current order instead of the stale import text.
   */
  it('opens with the ranking\'s current order, once comparisons have reordered it', () => {
    seedWorkspace();
    render(<DataScreen />);

    expect((screen.getByLabelText(/your list/i) as HTMLTextAreaElement).value).toBe(
      'Alien\nSolaris\nArrival\n',
    );
  });

  it('summarises the change before applying it', async () => {
    seedWorkspace();
    const user = userEvent.setup();
    render(<DataScreen />);

    fireEvent.change(screen.getByLabelText(/your list/i), {
      target: { value: 'Alien\nArrival\nStalker\n' },
    });
    await user.click(await screen.findByRole('button', { name: /apply edits/i }));

    expect(screen.getByText(/2 items unchanged/i)).toBeDefined();
    expect(screen.getByText(/1 item added/i)).toBeDefined();
    expect(screen.getByText(/1 item removed/i)).toBeDefined();
  });

  it('changes nothing until it is confirmed', async () => {
    seedWorkspace();
    const user = userEvent.setup();
    render(<DataScreen />);

    fireEvent.change(screen.getByLabelText(/your list/i), {
      target: { value: 'Alien\nArrival\n' },
    });
    await user.click(await screen.findByRole('button', { name: /apply edits/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(listStore.getState().items.filter((entry) => entry.active)).toHaveLength(3);
  });

  it('keeps the ranking for entries that did not change', async () => {
    seedWorkspace();
    const keptIds = listStore.getState().items.slice(0, 2).map((entry) => entry.id);
    const user = userEvent.setup();
    render(<DataScreen />);

    fireEvent.change(screen.getByLabelText(/your list/i), {
      target: { value: 'Alien\nArrival\nStalker\n' },
    });
    await user.click(await screen.findByRole('button', { name: /apply edits/i }));
    await user.click(screen.getAllByRole('button', { name: /apply edits/i })[0]!);

    expect(listStore.getState().items.slice(0, 2).map((entry) => entry.id)).toEqual(keptIds);
    expect(listStore.getState().comparisonEvents).toHaveLength(1);
    expect(replace).toHaveBeenCalledWith('/rank');
  });

  it('deactivates the entries the user deleted', async () => {
    seedWorkspace();
    const user = userEvent.setup();
    render(<DataScreen />);

    fireEvent.change(screen.getByLabelText(/your list/i), {
      target: { value: 'Alien\nArrival\n' },
    });
    await user.click(await screen.findByRole('button', { name: /apply edits/i }));
    await user.click(screen.getAllByRole('button', { name: /apply edits/i })[0]!);

    expect(listStore.getState().items.filter((entry) => entry.active)).toHaveLength(2);
  });

  it('does not bounce back to the rank screen', () => {
    seedWorkspace();
    render(<DataScreen />);

    expect(replace).not.toHaveBeenCalled();
  });

  it('offers a way back to ranking', () => {
    seedWorkspace();
    render(<DataScreen />);

    expect(screen.getByRole('button', { name: /back to ranking/i })).toBeDefined();
  });

  /**
   * The exact reported scenario: a YAML document with two lists, one of them
   * ranked to put a different item on top. The edit screen must show that
   * list reordered, and leave the untouched list exactly as imported.
   */
  it('reorders only the ranked list in a multi-list document, leaving the other as imported', () => {
    const rawText = "list1:\n  - pears\n  - oranges\n  - apples\nlist2:\n  - chevy\n  - ford\n  - gm\n";
    listStore.getState().startRanking({
      source: {
        format: 'yaml',
        rawText,
        document: { list1: ['pears', 'oranges', 'apples'], list2: ['chevy', 'ford', 'gm'] },
        arrayPath: ['list1'],
      },
      roles: {},
    });
    const [pears, oranges, apples] = listStore.getState().items;
    // pears beats both other items, ending up on top.
    listStore.getState().recordComparison(pears?.id ?? '', oranges?.id ?? '', 'left');
    listStore.getState().recordComparison(pears?.id ?? '', apples?.id ?? '', 'left');

    render(<DataScreen />);

    const value = (screen.getByLabelText(/your list/i) as HTMLTextAreaElement).value;
    expect(value).toContain('list1:\n  - pears');
    expect(value).toContain('list2:\n  - chevy\n  - ford\n  - gm');
  });
});
