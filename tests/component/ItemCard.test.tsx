/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ItemCard } from '@/components/comparison/ItemCard';
import type { ListItem } from '@/types/list';

const NOW = '2026-08-15T12:00:00.000Z';

function item(value: ListItem['value']): ListItem {
  return { id: 'item-1', listId: 'list-1', value, active: true, createdAt: NOW, updatedAt: NOW };
}

describe('ItemCard', () => {
  it('shows a simple item as its own label', () => {
    render(<ItemCard item={item('Tacos')} side="left" />);

    expect(screen.getByText('Tacos')).toBeDefined();
  });

  it('labels an object item with the chosen sort field', () => {
    render(<ItemCard item={item({ title: 'Arrival', year: 2016 })} side="left" sortField="title" />);

    expect(screen.getByText('Arrival')).toBeDefined();
  });

  it('always shows the chosen summary fields, in order, even when the item lacks one', () => {
    render(
      <ItemCard
        item={item({ title: 'Arrival', year: 2016, genre: 'Sci-fi', note: 'a very long note that would never fit a chip' })}
        side="left"
        sortField="title"
        summaryFields={['genre', 'director', 'note']}
      />,
    );

    expect(screen.getByText('genre: Sci-fi')).toBeDefined();
    expect(screen.getByText('director: –')).toBeDefined();
    expect(screen.getByText(/note: a very long note/)).toBeDefined();
    expect(screen.queryByText(/year/)).toBeNull();
  });

  it('summarises a few secondary fields without expanding', () => {
    render(
      <ItemCard
        item={item({ title: 'Arrival', year: 2016, director: 'Denis Villeneuve' })}
        side="left"
        sortField="title"
      />,
    );

    expect(screen.getByText(/2016/)).toBeDefined();
    expect(screen.getByText(/Denis Villeneuve/)).toBeDefined();
  });

  it('keeps the full object hidden until details are opened', () => {
    render(
      <ItemCard
        item={item({ title: 'Arrival', year: 2016, synopsis: 'Linguist meets heptapods.' })}
        side="left"
        sortField="title"
      />,
    );

    expect(screen.queryByText(/Linguist meets heptapods/)).toBeNull();
  });

  it('reveals the remaining fields when the pair opens details', () => {
    render(
      <ItemCard
        item={item({ title: 'Arrival', year: 2016, synopsis: 'Linguist meets heptapods.' })}
        side="left"
        sortField="title"
        expanded
      />,
    );

    expect(screen.getByText(/Linguist meets heptapods/)).toBeDefined();
  });

  it('carries no details control of its own, since the pair owns it', () => {
    render(
      <ItemCard
        item={item({ title: 'Arrival', synopsis: 'Linguist meets heptapods.' })}
        side="left"
        sortField="title"
      />,
    );

    expect(screen.queryByRole('button', { name: /details/i })).toBeNull();
  });

  it('renders nested structures as readable text', () => {
    render(
      <ItemCard
        item={item({ title: 'Arrival', crew: { director: 'Villeneuve' } })}
        side="left"
        sortField="title"
        expanded
      />,
    );

    expect(screen.getByText(/director: Villeneuve/)).toBeDefined();
  });

  it('offers no details toggle for a simple item', () => {
    render(<ItemCard item={item('Tacos')} side="left" />);

    expect(screen.queryByRole('button', { name: /details/i })).toBeNull();
  });

  it('names its side for screen readers', () => {
    render(<ItemCard item={item('Tacos')} side="right" />);

    expect(screen.getByLabelText(/right option: tacos/i)).toBeDefined();
  });
});

describe('choosing by pressing the card', () => {
  function setup(overrides: Partial<React.ComponentProps<typeof ItemCard>> = {}) {
    const props = {
      item: item({ title: 'Arrival', year: 2016 }),
      side: 'left' as const,
      sortField: 'title',
      onChoose: vi.fn(),
      onChooseStrong: vi.fn(),
      onRequestDelete: vi.fn(),
      onConfirmDelete: vi.fn(),
      onCancelDelete: vi.fn(),
      ...overrides,
    };
    render(<ItemCard {...props} />);
    return { ...props, user: userEvent.setup() };
  }

  it('chooses when the card is pressed', async () => {
    const { onChoose, user } = setup();

    await user.click(screen.getByLabelText(/choose arrival/i));

    expect(onChoose).toHaveBeenCalled();
  });

  it('no longer shows a separate Choose button', () => {
    setup();

    expect(screen.queryByText('Choose')).toBeNull();
  });

  it('says in words what the stronger verdict does', () => {
    setup();

    // An icon alone would leave a first-time user guessing.
    expect(screen.getByText('Much better')).toBeDefined();
  });

  it('sends the strong outcome from the flame', async () => {
    const { onChooseStrong, onChoose, user } = setup();

    await user.click(screen.getByRole('button', { name: /arrival is much better/i }));

    expect(onChooseStrong).toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('does not choose when delete is pressed', async () => {
    const { onChoose, onRequestDelete, user } = setup();

    await user.click(screen.getByRole('button', { name: /delete arrival/i }));

    expect(onRequestDelete).toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('is not pressable while a delete is being confirmed', async () => {
    const { onChoose, user } = setup({ pendingDelete: true });

    await user.click(screen.getByText(/remove "arrival" from the list/i));

    expect(onChoose).not.toHaveBeenCalled();
  });

  it('does not choose when confirming the delete', async () => {
    const { onChoose, onConfirmDelete, user } = setup({ pendingDelete: true });

    await user.click(screen.getByRole('button', { name: /confirm deleting arrival/i }));

    expect(onConfirmDelete).toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('leads with the title rather than a side marker', () => {
    setup();

    expect(screen.queryByText('LEFT')).toBeNull();
    expect(screen.queryByText('←')).toBeNull();
  });

  it('says how to choose', () => {
    setup();

    expect(screen.getByText(/click to choose/i)).toBeDefined();
  });

  it('is inert without a choose handler', () => {
    render(<ItemCard item={item('Tacos')} side="left" />);

    expect(screen.queryByRole('button', { name: /choose tacos/i })).toBeNull();
  });
});

describe('summary chips and details', () => {
  const film = { title: 'Arrival', year: 2016, director: 'Denis Villeneuve' };

  it('summarises fields as chips while details are closed', () => {
    render(<ItemCard item={item(film)} side="left" sortField="title" />);

    expect(screen.getByText('year: 2016')).toBeDefined();
  });

  it('drops the chips once details show the same fields in full', () => {
    render(<ItemCard item={item(film)} side="left" sortField="title" expanded />);

    expect(screen.queryByText('year: 2016')).toBeNull();
    expect(screen.getByText('2016')).toBeDefined();
  });
});
