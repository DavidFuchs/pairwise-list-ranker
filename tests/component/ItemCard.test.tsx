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

  it('reveals the remaining fields when details are opened', async () => {
    const user = userEvent.setup();
    render(
      <ItemCard
        item={item({ title: 'Arrival', year: 2016, synopsis: 'Linguist meets heptapods.' })}
        side="left"
        sortField="title"
      />,
    );

    await user.click(screen.getByRole('button', { name: /details for arrival/i }));

    expect(screen.getByText(/Linguist meets heptapods/)).toBeDefined();
  });

  it('renders nested structures as readable text', async () => {
    const user = userEvent.setup();
    render(
      <ItemCard
        item={item({ title: 'Arrival', crew: { director: 'Villeneuve' } })}
        side="left"
        sortField="title"
      />,
    );

    await user.click(screen.getByRole('button', { name: /details for arrival/i }));

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

    await user.click(screen.getByRole('button', { name: /choose arrival/i }));

    expect(onChoose).toHaveBeenCalled();
  });

  it('no longer shows a separate Choose button', () => {
    setup();

    expect(screen.queryByText('Choose')).toBeNull();
  });

  it('no longer shows a Much better strip', () => {
    setup();

    expect(screen.queryByText(/much better/i)).toBeNull();
  });

  it('sends the strong outcome from the flame', async () => {
    const { onChooseStrong, onChoose, user } = setup();

    await user.click(screen.getByRole('button', { name: /arrival is much better/i }));

    expect(onChooseStrong).toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('does not choose when the details toggle is pressed', async () => {
    const { onChoose, user } = setup();

    await user.click(screen.getByRole('button', { name: /show details for arrival/i }));

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

  it('shows the keyboard shortcut on the card it belongs to', () => {
    setup();

    expect(screen.getByText('←')).toBeDefined();
  });

  it('shows the right arrow on the right card', () => {
    setup({ side: 'right' });

    expect(screen.getByText('→')).toBeDefined();
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
