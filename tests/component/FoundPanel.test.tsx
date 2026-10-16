/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FoundPanel } from '@/components/data/FoundPanel';
import { analyzeSource } from '@/lib/import/analyze';

const NESTED =
  'version: 3\nmovies:\n  - title: Alien\n    order: 2\n  - title: Arrival\n    order: 1\nactors:\n  - Weaver\n  - Adams\n';

function setup(overrides: Partial<React.ComponentProps<typeof FoundPanel>> = {}) {
  const props = {
    analysis: analyzeSource(NESTED, 'auto'),
    selectedPath: ['movies'],
    roles: { labelField: 'title' },
    alreadyRanked: false,
    isBlank: false,
    entries: [
      { title: 'Alien', order: 2 },
      { title: 'Arrival', order: 1 },
    ] as unknown[],
    ctaLabel: 'Start ranking',
    isDefault: false,
    onSelectPath: vi.fn(),
    onRolesChange: vi.fn(),
    onAlreadyRankedChange: vi.fn(),
    onSetAsDefault: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  render(<FoundPanel {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('FoundPanel', () => {
  it('summarises what was found', () => {
    setup();

    expect(screen.getByText(/2 items/i)).toBeDefined();
  });

  it('offers the arrays it found', () => {
    setup();

    expect(screen.getByRole('radio', { name: /rank the list at movies/i })).toBeDefined();
    expect(screen.getByRole('radio', { name: /rank the list at actors/i })).toBeDefined();
  });

  it('reports a different array choice', async () => {
    const { onSelectPath, user } = setup();

    await user.click(screen.getByRole('radio', { name: /rank the list at actors/i }));

    expect(onSelectPath).toHaveBeenCalledWith(['actors']);
  });

  it('offers the label fields of the selected array', () => {
    setup({ roles: {} });

    expect(screen.getByRole('button', { name: /label items by title/i })).toBeDefined();
  });

  it('reports a label choice', async () => {
    const { onRolesChange, user } = setup({ roles: {} });

    await user.click(screen.getByRole('button', { name: /label items by title/i }));

    expect(onRolesChange).toHaveBeenCalledWith({ labelField: 'title' });
  });

  it('offers the position fields and keeps the label when one is chosen', async () => {
    const { onRolesChange, user } = setup();

    await user.click(screen.getByRole('radio', { name: /write the new order into order/i }));

    expect(onRolesChange).toHaveBeenCalledWith({ labelField: 'title', positionField: 'order' });
  });

  it('enables the call to action when everything is resolved', () => {
    setup();

    expect(
      screen.getByRole('button', { name: /start ranking/i }).getAttribute('aria-disabled'),
    ).not.toBe('true');
  });

  it('submits', async () => {
    const { onSubmit, user } = setup();

    await user.click(screen.getByRole('button', { name: /start ranking/i }));

    expect(onSubmit).toHaveBeenCalled();
  });

  it('blocks when no label is chosen', () => {
    setup({ roles: {} });

    expect(
      screen.getByRole('button', { name: /start ranking/i }).getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('asks for a title when none is set', () => {
    setup({ roles: {} });

    expect(screen.getAllByText(/which field should title/i)).toHaveLength(1);
  });

  it('blocks a one-item list', () => {
    setup({ entries: [{ title: 'Alien' }] });

    expect(screen.getByText(/at least two items/i)).toBeDefined();
  });

  it('shows warnings about arrays it skipped', () => {
    setup({
      analysis: analyzeSource('mixed:\n  - Alien\n  - title: Arrival\n', 'auto'),
      selectedPath: null,
      entries: [],
    });

    expect(screen.getByText(/mixes text and objects/i)).toBeDefined();
  });

  it('carries a different call-to-action label', () => {
    setup({ ctaLabel: 'Apply edits' });

    expect(screen.getByRole('button', { name: /apply edits/i })).toBeDefined();
  });

  it('defaults the order choice to no particular order', () => {
    setup();

    expect(
      screen
        .getByRole('radio', { name: /the list is in no particular order/i })
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('reports choosing an already-ranked order', async () => {
    const { onAlreadyRankedChange, user } = setup();

    await user.click(
      screen.getByRole('radio', { name: /the list is already ranked, best to worst/i }),
    );

    expect(onAlreadyRankedChange).toHaveBeenCalledWith(true);
  });

  it('reflects an already-ranked value passed in', () => {
    setup({ alreadyRanked: true });

    expect(
      screen
        .getByRole('radio', { name: /the list is already ranked, best to worst/i })
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('does not ask about order when there is no list to order', () => {
    setup({ isBlank: true, analysis: analyzeSource('', 'auto'), selectedPath: null, entries: [] });

    expect(screen.queryByRole('radio', { name: /the list is in no particular order/i })).toBeNull();
  });

  it('asks for a list instead of counting nothing when the box is empty', () => {
    setup({ isBlank: true, analysis: analyzeSource('', 'auto'), selectedPath: null, entries: [] });

    expect(screen.getByText(/nothing yet/i)).toBeDefined();
    expect(screen.getByText(/to get started/i)).toBeDefined();
    expect(screen.queryByText(/0 items/i)).toBeNull();
    expect(
      screen.getByRole('button', { name: /start ranking/i }).getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('counts a single item without saying "1 items"', () => {
    setup({ entries: [{ title: 'Alien' }] });

    expect(screen.getByText('1 item')).toBeDefined();
  });
});

describe('FoundPanel default-for-every-list control', () => {
  it('offers to make these the default when the document holds more than one list', () => {
    setup();

    expect(screen.getByRole('button', { name: /set as default/i })).toBeDefined();
  });

  it('says which lists the default reaches', () => {
    setup();

    expect(screen.getByText(/lists you have not set up yourself/i)).toBeDefined();
  });

  it('sets the default the moment it is pressed', async () => {
    const { onSetAsDefault, user } = setup();

    await user.click(screen.getByRole('button', { name: /set as default/i }));

    expect(onSetAsDefault).toHaveBeenCalled();
  });

  it('says so, and asks nothing more, once these settings are the default', () => {
    setup({ isDefault: true });

    expect(screen.getByText(/these are the default/i)).toBeDefined();
    expect(
      screen.getByRole('button', { name: /set as default/i }).getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('asks nothing when the document holds a single list', () => {
    const plain = ['Alien', 'Arrival', 'Solaris'].join('\n');
    setup({ analysis: analyzeSource(plain, 'auto'), selectedPath: [] });

    expect(screen.queryByRole('button', { name: /set as default/i })).toBeNull();
  });
});
