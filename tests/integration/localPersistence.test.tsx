/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import WorkspaceScreen from '@/app/index';
import { WORKSPACE_STORAGE_KEY } from '@/lib/persistence/browserStorage';
import { listStore } from '@/lib/state/useListStore';

const DINNERS = 'version: 1\ntitle: Weeknight dinners\nkind: primitive\nitems:\n  - value: Tacos\n  - value: Ramen\n  - value: Curry\n';

async function importYaml(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(screen.getByRole('tab', { name: /yaml/i }));
  fireEvent.change(screen.getByLabelText('yaml source'), { target: { value: text } });
  await user.click(screen.getByRole('button', { name: /import the edited yaml/i }));
}

/**
 * A reload keeps whatever localStorage holds but starts with empty memory,
 * which is what makes hydration observable.
 */
function simulateReload() {
  listStore.setState({
    list: null,
    items: [],
    comparisonEvents: [],
    editorDrafts: {},
    previewMode: 'gui',
    hydrated: false,
  });
}

describe('local persistence', () => {
  beforeEach(() => {
    listStore.getState().reset();
    globalThis.localStorage.clear();
  });

  it('restores the list after a reload', async () => {
    const user = userEvent.setup();
    const first = render(<WorkspaceScreen />);
    await importYaml(user, DINNERS);
    first.unmount();

    simulateReload();
    render(<WorkspaceScreen />);

    expect(listStore.getState().items.map((item) => item.value)).toEqual([
      'Tacos',
      'Ramen',
      'Curry',
    ]);
    expect(screen.getAllByText('Weeknight dinners').length).toBeGreaterThan(0);
  });

  it('restores the ranking, not just the items', async () => {
    const user = userEvent.setup();
    const first = render(<WorkspaceScreen />);
    await importYaml(user, DINNERS);
    const pair = listStore.getState().currentPair()!;
    listStore.getState().recordComparison(pair.left.id, pair.right.id, 'left_strong');
    const expected = listStore.getState().ranking()[0]?.item.id;
    first.unmount();

    simulateReload();
    render(<WorkspaceScreen />);

    expect(listStore.getState().comparisonEvents).toHaveLength(1);
    expect(listStore.getState().ranking()[0]?.item.id).toBe(expected);
  });

  it('keeps the chosen preview mode across a reload', async () => {
    const user = userEvent.setup();
    const first = render(<WorkspaceScreen />);
    await importYaml(user, DINNERS);
    await user.click(screen.getByRole('tab', { name: /markdown/i }));
    first.unmount();

    simulateReload();
    render(<WorkspaceScreen />);

    expect(screen.getByRole('tab', { name: /markdown/i }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('starts clean when the saved workspace is corrupt', () => {
    globalThis.localStorage.setItem(WORKSPACE_STORAGE_KEY, '{"half a snapshot"');
    simulateReload();

    render(<WorkspaceScreen />);

    expect(listStore.getState().list).toBeNull();
    expect(screen.getByText(/start with a list/i)).toBeDefined();
  });

  it('starts clean when the saved workspace came from a newer version', () => {
    globalThis.localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({ version: 99, list: {}, items: [], comparisonEvents: [], ui: {} }),
    );
    simulateReload();

    render(<WorkspaceScreen />);

    expect(listStore.getState().list).toBeNull();
  });

  it('stays usable after recovering from corrupt data', async () => {
    globalThis.localStorage.setItem(WORKSPACE_STORAGE_KEY, 'not json at all');
    simulateReload();
    const user = userEvent.setup();
    render(<WorkspaceScreen />);

    await importYaml(user, DINNERS);

    expect(listStore.getState().items).toHaveLength(3);
  });

  it('clears both the workspace and its saved copy', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);
    await importYaml(user, DINNERS);

    await user.click(screen.getByRole('button', { name: /clear this workspace/i }));
    await user.click(screen.getByRole('button', { name: /confirm clearing the workspace/i }));

    expect(listStore.getState().list).toBeNull();
    expect(globalThis.localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
  });

  it('does not restore a workspace that was cleared', async () => {
    const user = userEvent.setup();
    const first = render(<WorkspaceScreen />);
    await importYaml(user, DINNERS);
    await user.click(screen.getByRole('button', { name: /clear this workspace/i }));
    await user.click(screen.getByRole('button', { name: /confirm clearing the workspace/i }));
    first.unmount();

    simulateReload();
    render(<WorkspaceScreen />);

    expect(listStore.getState().list).toBeNull();
  });

  it('tells the user their work is kept in this browser', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);

    await importYaml(user, DINNERS);

    expect(screen.getByText(/kept in this browser only/i)).toBeDefined();
  });
});
