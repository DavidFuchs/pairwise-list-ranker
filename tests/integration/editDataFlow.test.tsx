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

  it('opens with the current text', () => {
    seedWorkspace();
    render(<DataScreen />);

    expect((screen.getByLabelText(/your list/i) as HTMLTextAreaElement).value).toBe(RAW);
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
});
