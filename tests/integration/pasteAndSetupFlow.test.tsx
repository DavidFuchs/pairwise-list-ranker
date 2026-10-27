/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PasteScreen from '@/app/index';
import SetupScreen from '@/app/setup';
import { engineHost } from '@/lib/engine/engineHost';
import { pasteDraft } from '@/lib/state/pasteDraft';
import { listStore } from '@/lib/state/useListStore';
import { openList } from '@/tests/helpers/lists';

const replace = vi.fn();
const push = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({
    replace,
    push,
    back: vi.fn(),
    canGoBack: () => false,
    canDismiss: () => false,
    dismissAll: vi.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

function typeSource(text: string) {
  fireEvent.change(screen.getByLabelText(/your list/i), { target: { value: text } });
}

/** The card titles in the setup preview, in the order the cards are drawn. */
function previewTitles(): string[] {
  const panel = screen.getByRole('heading', { name: 'Card previews', hidden: true }).parentElement!
    .parentElement!.parentElement!;
  return [...panel.querySelectorAll('[role="heading"][aria-level="3"]')].map(
    (node) => node.textContent ?? '',
  );
}

function expectContinueDisabled() {
  const buttons = screen.getAllByRole('button', { name: /^continue$/i });
  expect(buttons.length).toBeGreaterThan(0);
  for (const button of buttons) expect(button.getAttribute('aria-disabled')).toBe('true');
}

describe('the paste page and the list setup', () => {
  beforeEach(() => {
    cleanup();
    listStore.getState().reset();
    pasteDraft.getState().clear();
    globalThis.localStorage?.clear();
    replace.mockClear();
    push.mockClear();
  });

  it('the paste page shows only intake and a disabled Continue for empty text', async () => {
    render(<PasteScreen />);

    expect(screen.getByLabelText(/your list/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /try a sample list/i })).toBeDefined();
    expectContinueDisabled();
    expect(screen.queryByRole('button', { name: /start ranking/i })).toBeNull();
    expect(screen.queryByText(/starting order/i)).toBeNull();
  });

  it('unparseable text keeps Continue disabled and shows the issue', async () => {
    const user = userEvent.setup();
    render(<PasteScreen />);

    await user.click(screen.getByRole('radio', { name: /read the text as json/i }));
    typeSource('{"a": 1}\n{"b": 2}');

    expect(await screen.findByText(/line 2/i)).toBeDefined();
    expectContinueDisabled();
    for (const button of screen.getAllByRole('button', { name: /^continue$/i })) fireEvent.click(button);
    expect(push).not.toHaveBeenCalled();
  });

  it('a valid list continues to setup, where fields and order can be chosen, and Start ranking opens the ranking', async () => {
    const user = userEvent.setup();
    const paste = render(<PasteScreen />);

    typeSource(
      'movies:\n  - title: Alien\n    order: 2\n  - title: Arrival\n    order: 1\n  - title: Solaris\n    order: 3\n',
    );
    await user.click((await screen.findAllByRole('button', { name: /^continue$/i }))[0]!);
    expect(push).toHaveBeenCalledWith('/setup');
    paste.unmount();

    render(<SetupScreen />);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /label items by title/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    await user.click(screen.getByRole('button', { name: /start ranking/i }));

    expect(openList(listStore).items).toHaveLength(3);
    expect(listStore.getState().workspace?.source.arrayPath).toEqual(['movies']);
    expect(pasteDraft.getState().rawText).toBe('');
    expect(replace).toHaveBeenCalledWith('/rank');
  });

  it('starting a list with a sort opens a ranking in field order', async () => {
    const user = userEvent.setup();
    const paste = render(<PasteScreen />);

    typeSource(
      'albums:\n  - title: Low\n    plays: 10\n  - title: High\n    plays: 300\n  - title: Mid\n    plays: 120\n  - title: Top\n    plays: 900\n',
    );
    await user.click((await screen.findAllByRole('button', { name: /^continue$/i }))[0]!);
    paste.unmount();

    render(<SetupScreen />);
    await user.click(screen.getByRole('radio', { name: /sort by a field/i }));
    expect((screen.getByLabelText('Sort field') as HTMLSelectElement).value).toBe('plays');
    // The cards follow the sort, so a wrong direction is visible before starting.
    await user.click(screen.getByRole('radio', { name: 'High to low' }));
    expect(previewTitles()).toEqual(['Top', 'High', 'Mid', 'Low']);
    await user.click(screen.getByRole('radio', { name: 'Low to high' }));
    expect(previewTitles()).toEqual(['Low', 'Mid', 'High', 'Top']);
    await user.click(screen.getByRole('radio', { name: 'High to low' }));
    await user.click(screen.getByRole('button', { name: /start ranking/i }));

    const list = openList(listStore);
    expect(list.initialSort).toEqual({ field: 'plays', direction: 'desc' });
    expect(list.initialStartingOrder).toBe('rough');
    const byId = new Map(list.items.map((item) => [item.id, (item.value as { title: string }).title]));
    expect(list.originalItemIds.map((id) => byId.get(id))).toEqual(['Top', 'High', 'Mid', 'Low']);
    // And the engine's first ranking, the view the rank screen opens on, is the same order.
    expect(engineHost.rankingNow(list).map((item) => (item.value as { title: string }).title)).toEqual([
      'Top',
      'High',
      'Mid',
      'Low',
    ]);
  });

  it('setup with no draft and no workspace returns to the paste page', async () => {
    render(<SetupScreen />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  it('the paste page redirects to the ranking when a workspace exists', async () => {
    listStore.getState().startRanking({
      source: { format: 'list', document: ['a', 'b'], arrayPath: [] },
      roles: {},
    });
    render(<PasteScreen />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/rank'));
  });
});
