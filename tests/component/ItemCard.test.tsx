/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ItemCard } from '@/components/comparison/ItemCard';
import { cardLayout } from '@/lib/renderers';
import type { ListItem } from '@/types/list';

const NOW = '2026-08-15T12:00:00.000Z';

function item(value: ListItem['value']): ListItem {
  return { id: 'item-1', listId: 'list-1', value, createdAt: NOW, updatedAt: NOW };
}

describe('ItemCard', () => {
  it('shows a simple item as its own label', () => {
    render(<ItemCard item={item('Tacos')} side="left" />);

    expect(screen.getByText('Tacos')).toBeDefined();
  });

  it('labels an object item with the chosen sort field', () => {
    render(
      <ItemCard
        item={item({ title: 'Arrival', year: 2016 })}
        side="left"
        layout={cardLayout({ labelField: 'title' })}
      />,
    );

    expect(screen.getByText('Arrival')).toBeDefined();
  });

  it('always shows the chosen summary fields, in order, even when the item lacks one', () => {
    render(
      <ItemCard
        layout={cardLayout({ labelField: 'title', summaryFields: ['genre', 'director', 'note'] })}
        item={item({
          title: 'Arrival',
          year: 2016,
          genre: 'Sci-fi',
          note: 'a very long note that would never fit a chip',
        })}
        side="left"
      />,
    );

    expect(screen.getByText('Genre: Sci-fi')).toBeDefined();
    expect(screen.getByText('Director: –')).toBeDefined();
    expect(screen.getByText(/Note: a very long note/)).toBeDefined();
    expect(screen.queryByText(/year/)).toBeNull();
  });

  it('keeps every chosen field on a compact card, as the preview shows it', () => {
    render(
      <ItemCard
        compact
        layout={cardLayout({ labelField: 'title', summaryFields: ['genre', 'director', 'year', 'note'] })}
        item={item({
          title: 'Arrival',
          year: 2016,
          genre: 'Sci-fi',
          director: 'Denis Villeneuve',
          note: 'Quiet',
        })}
        side="left"
      />,
    );

    expect(screen.getByText('Genre: Sci-fi')).toBeDefined();
    expect(screen.getByText('Director: Denis Villeneuve')).toBeDefined();
    expect(screen.getByText('Year: 2016')).toBeDefined();
    expect(screen.getByText('Note: Quiet')).toBeDefined();
  });

  it('shows only the title until fields are chosen', () => {
    render(
      <ItemCard
        layout={cardLayout({ labelField: 'title' })}
        item={item({ title: 'Arrival', year: 2016, director: 'Denis Villeneuve' })}
        side="left"
      />,
    );

    expect(screen.queryByText(/2016/)).toBeNull();
    expect(screen.queryByText(/Denis Villeneuve/)).toBeNull();
  });

  it('keeps the full object hidden until details are opened', () => {
    render(
      <ItemCard
        layout={cardLayout({ labelField: 'title' })}
        item={item({ title: 'Arrival', year: 2016, synopsis: 'Linguist meets heptapods.' })}
        side="left"
      />,
    );

    expect(screen.queryByText(/Linguist meets heptapods/)).toBeNull();
  });

  it('reveals the remaining fields when the pair opens details', () => {
    render(
      <ItemCard
        layout={cardLayout({ labelField: 'title' })}
        item={item({ title: 'Arrival', year: 2016, synopsis: 'Linguist meets heptapods.' })}
        side="left"
        expanded
      />,
    );

    expect(screen.getByText(/Linguist meets heptapods/)).toBeDefined();
  });

  it('carries no details control of its own, since the pair owns it', () => {
    render(
      <ItemCard
        layout={cardLayout({ labelField: 'title' })}
        item={item({ title: 'Arrival', synopsis: 'Linguist meets heptapods.' })}
        side="left"
      />,
    );

    expect(screen.queryByRole('button', { name: /details/i })).toBeNull();
  });

  it('renders nested structures as readable text', () => {
    render(
      <ItemCard
        layout={cardLayout({ labelField: 'title' })}
        item={item({ title: 'Arrival', crew: { director: 'Villeneuve' } })}
        side="left"
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

    await user.click(screen.getByText(/remove "arrival" from the list\?/i));

    expect(onChoose).not.toHaveBeenCalled();
  });

  it("points the remove confirmation to Don't recognize…", () => {
    setup({ pendingDelete: true });

    expect(
      screen.getByText(
        'Remove "Arrival" from the list? If you don\'t know it, use Don\'t recognize… instead.',
      ),
    ).toBeDefined();
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

  it('armed to not recognize, says so, and hides Much better and the trash can', () => {
    setup({ recognizeArmed: true });

    expect(screen.getByText("Don't recognize this one")).toBeDefined();
    expect(screen.queryByText('Click to choose')).toBeNull();
    expect(screen.queryByText('Much better')).toBeNull();
    expect(screen.queryByRole('button', { name: /delete arrival/i })).toBeNull();
  });

  it('armed to not recognize, still reports a press on the card', async () => {
    const { onChoose, user } = setup({ recognizeArmed: true });

    await user.click(screen.getByLabelText("Don't recognize Arrival"));

    expect(onChoose).toHaveBeenCalled();
  });

  it('is inert without a choose handler', () => {
    render(<ItemCard item={item('Tacos')} side="left" />);

    expect(screen.queryByRole('button', { name: /choose tacos/i })).toBeNull();
  });
});

describe('summary chips and details', () => {
  const film = { title: 'Arrival', year: 2016, director: 'Denis Villeneuve' };

  it('shows chosen fields as chips while details are closed', () => {
    render(
      <ItemCard
        item={item(film)}
        side="left"
        layout={cardLayout({ labelField: 'title', summaryFields: ['year'] })}
      />,
    );

    expect(screen.getByText('Year: 2016')).toBeDefined();
  });

  it('draws a link field as a link that opens in a new tab', () => {
    render(
      <ItemCard
        layout={cardLayout({
          labelField: 'title',
          summaryFields: ['site'],
          fieldRenderers: { site: 'link' },
        })}
        item={item({ ...film, site: 'https://example.com/arrival' })}
        side="left"
      />,
    );

    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('https://example.com/arrival');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.textContent).toBe('example.com/arrival');
  });

  it('does not choose the card when its link is clicked', async () => {
    const onChoose = vi.fn();
    render(
      <ItemCard
        layout={cardLayout({
          labelField: 'title',
          summaryFields: ['site'],
          fieldRenderers: { site: 'link' },
        })}
        item={item({ ...film, site: 'https://example.com/arrival' })}
        side="left"
        onChoose={onChoose}
      />,
    );

    // A real anchor would navigate; jsdom only reports it.
    const link = screen.getByRole('link');
    link.addEventListener('click', (event) => event.preventDefault());
    await userEvent.setup().click(link);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('pictures an image field beside the title', () => {
    render(
      <ItemCard
        layout={cardLayout({
          labelField: 'title',
          summaryFields: ['poster'],
          fieldRenderers: { poster: 'image' },
        })}
        item={item({ ...film, poster: 'https://example.com/arrival.jpg' })}
        side="left"
      />,
    );

    expect(screen.getByRole('img', { name: 'Arrival' })).toBeDefined();
  });

  it('draws a rating as stars against its scale', () => {
    render(
      <ItemCard
        layout={cardLayout({
          labelField: 'title',
          summaryFields: ['score'],
          fieldRenderers: { score: 'stars-10' },
        })}
        item={item({ ...film, score: 9.2 })}
        side="left"
      />,
    );
    expect(screen.getByRole('img', { name: '9.2/10' })).toBeDefined();
  });

  it('leaves out a false badge and names a true one', () => {
    const { rerender } = render(
      <ItemCard
        item={item({ ...film, explicit: false })}
        side="left"
        layout={cardLayout({
          labelField: 'title',
          summaryFields: ['explicit'],
          fieldRenderers: { explicit: 'badge' },
        })}
      />,
    );
    expect(screen.queryByText(/explicit/)).toBeNull();
    rerender(
      <ItemCard
        item={item({ ...film, explicit: true })}
        side="left"
        layout={cardLayout({
          labelField: 'title',
          summaryFields: ['explicit'],
          fieldRenderers: { explicit: 'badge' },
        })}
      />,
    );
    expect(screen.getByText('Explicit')).toBeDefined();
  });

  it('pictures a YouTube video by its thumbnail, opening the video', () => {
    render(
      <ItemCard
        layout={cardLayout({
          labelField: 'title',
          summaryFields: ['trailer'],
          fieldRenderers: { trailer: 'youtube' },
        })}
        item={item({ ...film, trailer: 'https://youtu.be/dQw4w9WgXcQ' })}
        side="left"
      />,
    );
    expect(screen.getByRole('link', { name: 'Watch Arrival on YouTube' }).getAttribute('href')).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
  });
});

describe('ItemCard picture slot and new lines', () => {
  const game = { title: 'Portal', steam: 620 };

  it('pages through every picture field as one gallery, without choosing the card', async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();
    render(
      <ItemCard
        layout={cardLayout({
          labelField: 'title',
          summaryFields: ['cover', 'shots'],
          fieldRenderers: { cover: 'image', shots: 'image-gallery' },
        })}
        item={item({
          ...game,
          cover: 'https://example.com/cover.jpg',
          shots: ['https://example.com/1.png', 'https://example.com/2.png'],
        })}
        side="left"
        onChoose={onChoose}
      />,
    );

    expect(screen.getByRole('img', { name: 'Portal, picture 1 of 3' })).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Next picture of Portal' }));
    expect(screen.getByRole('img', { name: 'Portal, picture 2 of 3' })).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Previous picture of Portal' }));
    await user.click(screen.getByRole('button', { name: 'Previous picture of Portal' }));
    // Wraps from the first to the last.
    expect(screen.getByRole('img', { name: 'Portal, picture 3 of 3' })).toBeDefined();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('shows one picture without a pager', () => {
    render(
      <ItemCard
        item={item(game)}
        side="left"
        layout={cardLayout({
          labelField: 'title',
          summaryFields: ['steam'],
          fieldRenderers: { steam: 'steam-header' },
        })}
      />,
    );
    expect(screen.queryByRole('button', { name: /picture of Portal/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Open Portal on Steam' }).getAttribute('href')).toBe(
      'https://store.steampowered.com/app/620',
    );
  });

  it('draws pills, a swatch, a flag, money and a map link', () => {
    render(
      <ItemCard
        item={item({
          title: 'Office',
          priority: 'High',
          colour: '#336699',
          country: 'CA',
          rent: 2400,
          address: '100 Queen St W',
        })}
        side="left"
        layout={cardLayout({
          labelField: 'title',
          summaryFields: ['priority', 'colour', 'country', 'rent', 'address'],
          fieldRenderers: {
            priority: 'pills',
            colour: 'color-swatch',
            country: 'flag',
            rent: 'currency-CAD',
            address: 'location',
          },
        })}
      />,
    );
    expect(screen.getByText('High')).toBeDefined();
    expect(screen.getByRole('img', { name: '#336699' })).toBeDefined();
    expect(screen.getByText(/🇨🇦/)).toBeDefined();
    expect(screen.getByText(/2,400/)).toBeDefined();
    expect(screen.getByRole('link', { name: /100 Queen St W/ }).getAttribute('href')).toContain(
      'google.com/maps',
    );
  });

  it('folds long text behind a toggle that does not choose the card', async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();
    render(
      <ItemCard
        layout={cardLayout({
          labelField: 'title',
          summaryFields: ['notes'],
          fieldRenderers: { notes: 'long-text' },
        })}
        item={item({ title: 'Plan', notes: 'word '.repeat(60) })}
        side="left"
        onChoose={onChoose}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Show all of Notes' }));
    expect(screen.getByRole('button', { name: 'Show less of Notes' })).toBeDefined();
    expect(onChoose).not.toHaveBeenCalled();
  });
});
