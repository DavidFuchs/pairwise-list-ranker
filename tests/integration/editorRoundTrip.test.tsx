/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import WorkspaceScreen from '@/app/index';
import { WORKSPACE_STORAGE_KEY } from '@/lib/persistence/browserStorage';
import { listStore } from '@/lib/state/useListStore';

const DINNERS = 'version: 1\ntitle: Weeknight dinners\nkind: primitive\nitems:\n  - value: Tacos\n  - value: Ramen\n  - value: Curry\n';

function editorFor(format: 'yaml' | 'json' | 'markdown'): HTMLTextAreaElement {
  return screen.getByLabelText(`${format} source`) as HTMLTextAreaElement;
}

async function importYaml(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(screen.getByRole('tab', { name: /yaml/i }));
  fireEvent.change(editorFor('yaml'), { target: { value: text } });
  await user.click(screen.getByRole('button', { name: /import the edited yaml/i }));
}

describe('editor round trip', () => {
  beforeEach(() => {
    listStore.getState().reset();
    globalThis.localStorage?.clear();
  });

  it('imports pasted YAML into the live list', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);

    await importYaml(user, DINNERS);

    // Imported items show up in both the control rail and the ranked preview.
    await user.click(screen.getByRole('tab', { name: /gui/i }));
    expect(screen.getAllByText('Tacos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Curry').length).toBeGreaterThan(0);
    expect(listStore.getState().items.map((item) => item.value)).toEqual([
      'Tacos',
      'Ramen',
      'Curry',
    ]);
  });

  it('keeps the live list when the pasted text does not parse', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);
    await importYaml(user, DINNERS);

    await user.click(screen.getByRole('tab', { name: /json/i }));
    fireEvent.change(editorFor('json'), { target: { value: '{ broken' } });
    await user.click(screen.getByRole('button', { name: /import the edited json/i }));

    expect(screen.getByText(/invalid json/i)).toBeDefined();
    expect(listStore.getState().items).toHaveLength(3);
  });

  it('leaves the broken text in the editor so nothing is lost', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);
    await importYaml(user, DINNERS);

    await user.click(screen.getByRole('tab', { name: /json/i }));
    fireEvent.change(editorFor('json'), { target: { value: '{ broken' } });
    await user.click(screen.getByRole('button', { name: /import the edited json/i }));

    expect(editorFor('json').value).toBe('{ broken');
  });

  it('recovers when the text is corrected and imported again', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);
    await importYaml(user, DINNERS);

    await user.click(screen.getByRole('tab', { name: /json/i }));
    fireEvent.change(editorFor('json'), { target: { value: '{ broken' } });
    await user.click(screen.getByRole('button', { name: /import the edited json/i }));
    fireEvent.change(editorFor('json'), { target: { value: '["Pho","Bibimbap"]' } });
    await user.click(screen.getByRole('button', { name: /import the edited json/i }));

    expect(listStore.getState().items.map((item) => item.value)).toEqual(['Pho', 'Bibimbap']);
    expect(screen.queryByText(/invalid json/i)).toBeNull();
  });

  it('shows the current ranking in Markdown after comparing', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);
    await importYaml(user, DINNERS);

    const pair = listStore.getState().currentPair()!;
    listStore.getState().recordComparison(pair.left.id, pair.right.id, 'left');

    await user.click(screen.getByRole('tab', { name: /markdown/i }));

    expect(editorFor('markdown').value).toContain('# Weeknight dinners');
    expect(editorFor('markdown').value.indexOf('Tacos')).toBeGreaterThan(-1);
  });

  it('re-renders the preview after every comparison', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);
    await importYaml(user, DINNERS);
    await user.click(screen.getByRole('tab', { name: /gui/i }));

    const pair = listStore.getState().currentPair()!;
    const winner = pair.right;
    await user.click(screen.getByRole('button', { name: new RegExp(`choose ${winner.value}`, 'i') }));

    expect(listStore.getState().ranking()[0]?.item.id).toBe(winner.id);
  });

  it('saves the workspace to browser storage as the user works', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);

    await importYaml(user, DINNERS);

    const saved = globalThis.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    expect(saved).toContain('Weeknight dinners');
  });

  it('clears the workspace when the user resets it', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);
    await importYaml(user, DINNERS);

    await user.click(screen.getByRole('button', { name: /reset workspace/i }));
    await user.click(screen.getByRole('button', { name: /confirm reset/i }));

    expect(listStore.getState().list).toBeNull();
    expect(globalThis.localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
  });
});

describe('working with the list', () => {
  beforeEach(() => {
    listStore.getState().reset();
    globalThis.localStorage?.clear();
  });

  it('adds an item from the control rail', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);
    await importYaml(user, DINNERS);

    await user.type(screen.getByLabelText(/new item/i), 'Pho');
    await user.click(screen.getByRole('button', { name: /add item/i }));

    expect(listStore.getState().items.map((item) => item.value)).toContain('Pho');
  });

  it('deletes from the comparison without ranking that pair', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);
    await importYaml(user, DINNERS);
    const doomed = listStore.getState().currentPair()!.left;

    await user.click(screen.getByRole('button', { name: new RegExp(`delete ${doomed.value}`, 'i') }));
    await user.click(
      screen.getByRole('button', { name: new RegExp(`confirm deleting ${doomed.value}`, 'i') }),
    );

    expect(listStore.getState().comparisonEvents).toEqual([]);
    expect(listStore.getState().ranking().map((entry) => entry.item.id)).not.toContain(doomed.id);
  });

  it('welcomes a first-time visitor with somewhere to start', () => {
    render(<WorkspaceScreen />);

    expect(screen.getByText(/paste a list/i)).toBeDefined();
  });
});
