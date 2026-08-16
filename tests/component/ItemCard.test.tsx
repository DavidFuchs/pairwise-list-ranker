/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

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
