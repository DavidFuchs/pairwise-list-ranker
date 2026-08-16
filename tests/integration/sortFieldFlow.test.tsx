/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import WorkspaceScreen from '@/app/index';
import { listStore } from '@/lib/state/useListStore';

/** Two equally plausible text fields, so the app cannot safely guess a label. */
const AMBIGUOUS = JSON.stringify([
  { alpha: 'Arrival', beta: 'Villeneuve', year: 2016, cast: ['Amy Adams'] },
  { alpha: 'Alien', beta: 'Scott', year: 1979, cast: ['Sigourney Weaver'] },
]);

async function importJson(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(screen.getByRole('tab', { name: /json/i }));
  fireEvent.change(screen.getByLabelText('json source'), { target: { value: text } });
  await user.click(screen.getByRole('button', { name: /import the edited json/i }));
}

describe('choosing a sort field', () => {
  beforeEach(() => {
    listStore.getState().reset();
    globalThis.localStorage?.clear();
  });

  it('blocks ranking until a label field is chosen', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);

    await importJson(user, AMBIGUOUS);

    expect(listStore.getState().list?.sortField).toBeUndefined();
    expect(screen.getByText(/pick a label field first/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: /^choose /i })).toBeNull();
  });

  it('offers the scalar fields, but not the array field', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);

    await importJson(user, AMBIGUOUS);

    expect(screen.getByRole('button', { name: /label items by alpha/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /label items by year/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /label items by cast/i })).toBeNull();
  });

  it('starts ranking once a field is picked', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);
    await importJson(user, AMBIGUOUS);

    await user.click(screen.getByRole('button', { name: /label items by alpha/i }));

    expect(listStore.getState().list?.sortField).toBe('alpha');
    expect(screen.getByRole('button', { name: /choose arrival/i })).toBeDefined();
  });

  it('relabels the cards when a different field is picked', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);
    await importJson(user, AMBIGUOUS);

    await user.click(screen.getByRole('button', { name: /label items by beta/i }));

    expect(screen.getByRole('button', { name: /choose villeneuve/i })).toBeDefined();
  });

  it('preselects an obvious label field without asking', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);

    await importJson(user, JSON.stringify([{ title: 'Arrival' }, { title: 'Alien' }]));

    expect(listStore.getState().list?.sortField).toBe('title');
    expect(screen.getByRole('button', { name: /choose arrival/i })).toBeDefined();
  });

  it('keeps the chosen field in browser storage', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);
    await importJson(user, AMBIGUOUS);

    await user.click(screen.getByRole('button', { name: /label items by alpha/i }));

    const saved = globalThis.localStorage.getItem('pairwise-list-ranker:workspace:v1');
    expect(JSON.parse(saved ?? '{}').list.sortField).toBe('alpha');
  });

  it('exports the fields that are not the label, too', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);
    await importJson(user, AMBIGUOUS);
    await user.click(screen.getByRole('button', { name: /label items by alpha/i }));

    await user.click(screen.getByRole('tab', { name: /yaml/i }));
    const exported = (screen.getByLabelText('yaml source') as HTMLTextAreaElement).value;

    expect(exported).toContain('beta: Villeneuve');
    expect(exported).toContain('year: 2016');
    expect(exported).toContain('Amy Adams');
  });

  it('shows the other fields in the card drill-in', async () => {
    const user = userEvent.setup();
    render(<WorkspaceScreen />);
    await importJson(user, AMBIGUOUS);
    await user.click(screen.getByRole('button', { name: /label items by alpha/i }));

    await user.click(screen.getByRole('button', { name: /show details for arrival/i }));

    expect(screen.getAllByText(/Amy Adams/).length).toBeGreaterThan(0);
  });
});
