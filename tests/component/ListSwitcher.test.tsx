/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ListSwitcher } from '@/components/layout/ListSwitcher';
import type { ListSwitcherOption } from '@/components/layout/ListSwitcher';

const movies: ListSwitcherOption = {
  path: ['movies'],
  count: 12,
  entryKind: 'object',
  samples: ['Alien', 'Arrival'],
  coverage: { coverage: 0.42, earned: 0.42 },
  configLine: 'shown by title · already ranked',
};

const actors: ListSwitcherOption = {
  path: ['actors'],
  count: 4,
  entryKind: 'object',
  samples: ['Sigourney Weaver'],
  configLine: 'shown by name · already ranked',
};

function renderSwitcher(overrides: Partial<Parameters<typeof ListSwitcher>[0]> = {}) {
  const props = {
    currentPath: ['movies'],
    caption: 'movies · shown by title · already ranked',
    options: [movies, actors],
    onSelect: vi.fn(),
    onConfigure: vi.fn(),
    ...overrides,
  };
  render(<ListSwitcher {...props} />);
  return props;
}

async function openSwitcher(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /switch list/i }));
}

describe('ListSwitcher', () => {
  it('shows each list the way the data screen does, samples and all', async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await openSwitcher(user);

    expect(screen.getByRole('radio', { name: /rank the list at actors/i })).toBeDefined();
    expect(screen.getByText(/4 objects/i)).toBeDefined();
    expect(screen.getByText(/Sigourney Weaver/)).toBeDefined();
  });

  it('shows the setup each list would be ranked with', async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await openSwitcher(user);

    expect(screen.getByText('shown by name · already ranked')).toBeDefined();
  });

  it('switches to a list that has never been configured, in one press', async () => {
    const user = userEvent.setup();
    const props = renderSwitcher();

    await openSwitcher(user);
    await user.click(screen.getByRole('radio', { name: /rank the list at actors/i }));

    expect(props.onSelect).toHaveBeenCalledWith(['actors']);
    expect(props.onConfigure).not.toHaveBeenCalled();
  });

  it('opens the data screen from Configure without switching to the list', async () => {
    const user = userEvent.setup();
    const props = renderSwitcher();

    await openSwitcher(user);
    await user.click(screen.getByRole('button', { name: /configure the list at actors/i }));

    expect(props.onConfigure).toHaveBeenCalledWith(['actors']);
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it('offers Configure for the list being ranked right now too', async () => {
    const user = userEvent.setup();
    const props = renderSwitcher();

    await openSwitcher(user);
    await user.click(screen.getByRole('button', { name: /configure the list at movies/i }));

    expect(props.onConfigure).toHaveBeenCalledWith(['movies']);
  });

  it('leaves the list being ranked alone when its own row is pressed', async () => {
    const user = userEvent.setup();
    const props = renderSwitcher();

    await openSwitcher(user);
    await user.click(screen.getByRole('radio', { name: /rank the list at movies/i }));

    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it('carries the progress of a list that has ranking behind it', async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await openSwitcher(user);

    expect(screen.getByRole('progressbar', { name: /ranking progress for movies/i })).toBeDefined();
  });

  it('stays out of the way when the document holds only one list', () => {
    const { container } = render(
      <ListSwitcher
        currentPath={['movies']}
        caption="movies"
        options={[movies]}
        onSelect={vi.fn()}
        onConfigure={vi.fn()}
      />,
    );

    expect(container.textContent).toBe('');
  });

  it('cannot switch to or configure a list with too few items to rank', async () => {
    const tooShort: ListSwitcherOption = {
      path: ['director'],
      count: 1,
      entryKind: 'scalar',
      samples: ['Cameron'],
    };
    const user = userEvent.setup();
    const props = renderSwitcher({ options: [movies, tooShort] });

    await openSwitcher(user);

    const row = screen.getByRole('radio', { name: /director.*too few items/i });
    expect(row.getAttribute('aria-disabled')).toBe('true');
    await expect(user.click(row)).rejects.toThrow(/pointer-events: none/);
    expect(
      screen.getByRole('button', { name: /configure the list at director/i }).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(props.onSelect).not.toHaveBeenCalled();
  });
});
