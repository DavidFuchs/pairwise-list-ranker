/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OrderPicker } from '@/components/data/OrderPicker';
import type { SortFieldCandidate } from '@/lib/import/sortField';

const UNORDERED = /the list is in no particular order/i;
const ROUGH = /the list is roughly in order, best to worst/i;
const RANKED = /the list is already ranked, best to worst/i;

describe('OrderPicker', () => {
  it('four options, with their hints, and the unsure line', () => {
    render(<OrderPicker value="unordered" itemCount={4} onChange={vi.fn()} />);

    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.textContent)).toEqual([
      "No particular orderYou haven't tried to rank it yet, or only very loosely",
      'Roughly best to worstYou sorted it yourself',
      'Ranked best to worstYou ranked it in this app before, or put real care into it by hand',
      'Sort by a fieldNo ordered fields in this list',
    ]);
    expect(
      screen.getByText(
        'Not sure? Choose “Roughly best to worst”: trusting a list too much makes it hard to fix, and trusting it too little costs only a few answers.',
      ),
    ).toBeDefined();
  });

  it('each option is described by its hint, so a screen reader reads it after the name', () => {
    render(<OrderPicker value="unordered" itemCount={4} onChange={vi.fn()} />);

    expect(
      screen.getByRole('radio', {
        name: UNORDERED,
        description: "You haven't tried to rank it yet, or only very loosely",
      }),
    ).toBeDefined();
    expect(screen.getByRole('radio', { name: ROUGH, description: 'You sorted it yourself' })).toBeDefined();
    expect(
      screen.getByRole('radio', {
        name: RANKED,
        description: 'You ranked it in this app before, or put real care into it by hand',
      }),
    ).toBeDefined();
  });

  it('choosing "Roughly best to worst" reports \'rough\'', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<OrderPicker value="ranked" itemCount={4} onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: ROUGH }));

    expect(onChange).toHaveBeenCalledWith('rough');
  });

  it('reflects a list that is roughly in order', () => {
    render(<OrderPicker value="rough" itemCount={4} onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: ROUGH }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: UNORDERED }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('radio', { name: RANKED }).getAttribute('aria-checked')).toBe('false');
  });

  it('selects no particular order by default', () => {
    render(<OrderPicker value="unordered" itemCount={4} onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: UNORDERED }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: RANKED }).getAttribute('aria-checked')).toBe('false');
  });

  it('reflects a list that is already ranked', () => {
    render(<OrderPicker value="ranked" itemCount={4} onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: RANKED }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: UNORDERED }).getAttribute('aria-checked')).toBe('false');
  });

  it('reports choosing an already-ranked list', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<OrderPicker value="unordered" itemCount={4} onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: RANKED }));

    expect(onChange).toHaveBeenCalledWith('ranked');
  });

  it('reports going back to no particular order', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<OrderPicker value="ranked" itemCount={4} onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: UNORDERED }));

    expect(onChange).toHaveBeenCalledWith('unordered');
  });

  it('asks nothing when there is no order to describe', () => {
    const { container } = render(<OrderPicker value="unordered" itemCount={1} onChange={vi.fn()} />);

    expect(container.textContent).toBe('');
  });

  it('read-only shows the options locked with the note, and ignores presses', async () => {
    const onChange = vi.fn();
    // A locked option takes no pointer events, which is the point of the check.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<OrderPicker value="rough" itemCount={4} onChange={onChange} readOnly />);

    expect(screen.getByText('Set when this list was created.')).toBeDefined();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByRole('radio', { name: ROUGH }).getAttribute('aria-checked')).toBe('true');
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.getAttribute('aria-disabled')).toBe('true');
    }

    await user.click(screen.getByRole('radio', { name: RANKED }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not show the note when it can be changed', () => {
    render(<OrderPicker value="rough" itemCount={4} onChange={vi.fn()} />);

    expect(screen.queryByText('Set when this list was created.')).toBeNull();
  });

  describe('sort by a field', () => {
    const NUMBER_FIELDS: SortFieldCandidate[] = [
      { field: 'plays', kind: 'number' },
      { field: 'rating', kind: 'number' },
    ];
    const SORT = { name: /sort by a field/i };

    it('offers Sort by a field with the first qualifying field and high to low selected', async () => {
      const onSortChange = vi.fn();
      const user = userEvent.setup();
      render(
        <OrderPicker
          value="unordered"
          itemCount={4}
          onChange={vi.fn()}
          sortFields={NUMBER_FIELDS}
          sort={null}
          onSortChange={onSortChange}
        />,
      );

      expect(screen.getAllByRole('radio')).toHaveLength(4);
      expect(
        screen.getByText(
          'Your list has a field that already says something about the order, such as a rating or a date',
        ),
      ).toBeDefined();
      await user.click(screen.getByRole('radio', SORT));

      expect(onSortChange).toHaveBeenCalledWith({ field: 'plays', direction: 'desc' });
    });

    it('shows the field and direction choices once selected, and reports changes', async () => {
      const onSortChange = vi.fn();
      const user = userEvent.setup();
      render(
        <OrderPicker
          value="rough"
          itemCount={4}
          onChange={vi.fn()}
          sortFields={NUMBER_FIELDS}
          sort={{ field: 'plays', direction: 'desc' }}
          onSortChange={onSortChange}
        />,
      );

      expect(screen.getByRole('radio', SORT).getAttribute('aria-checked')).toBe('true');
      expect(screen.getByRole('radio', { name: ROUGH }).getAttribute('aria-checked')).toBe('false');
      expect(screen.getByRole('radio', { name: 'High to low' }).getAttribute('aria-checked')).toBe('true');
      expect(screen.getByRole('radio', { name: 'Low to high' }).getAttribute('aria-checked')).toBe('false');
      expect((screen.getByLabelText('Sort field') as HTMLSelectElement).value).toBe('plays');

      await user.click(screen.getByRole('radio', { name: 'Low to high' }));
      expect(onSortChange).toHaveBeenLastCalledWith({ field: 'plays', direction: 'asc' });

      await user.selectOptions(screen.getByLabelText('Sort field'), 'rating');
      expect(onSortChange).toHaveBeenLastCalledWith({ field: 'rating', direction: 'desc' });
    });

    it('keeps the sort controls outside the radio group of the four orders', () => {
      render(
        <OrderPicker
          value="rough"
          itemCount={4}
          onChange={vi.fn()}
          sortFields={NUMBER_FIELDS}
          sort={{ field: 'plays', direction: 'desc' }}
          onSortChange={vi.fn()}
        />,
      );

      const groups = screen.getAllByRole('radiogroup');
      expect(groups.length).toBeGreaterThan(1);
      for (const group of groups) {
        expect(group.parentElement?.closest('[role="radiogroup"]')).toBeNull();
      }
    });

    it('is disabled with the no-ordered-fields line when nothing qualifies', () => {
      render(
        <OrderPicker
          value="unordered"
          itemCount={4}
          onChange={vi.fn()}
          sortFields={[]}
          sort={null}
          onSortChange={vi.fn()}
        />,
      );

      expect(screen.getByRole('radio', SORT).getAttribute('aria-disabled')).toBe('true');
      expect(screen.getByText('No ordered fields in this list')).toBeDefined();
    });

    it('uses date labels for a date field', () => {
      render(
        <OrderPicker
          value="rough"
          itemCount={4}
          onChange={vi.fn()}
          sortFields={[{ field: 'released', kind: 'date' }]}
          sort={{ field: 'released', direction: 'desc' }}
          onSortChange={vi.fn()}
        />,
      );

      expect(screen.getByRole('radio', { name: 'Newest first' }).getAttribute('aria-checked')).toBe('true');
      expect(screen.getByRole('radio', { name: 'Oldest first' })).toBeDefined();
      expect(screen.queryByRole('radio', { name: 'High to low' })).toBeNull();
    });

    it('read-only prints the chosen sort and the note', () => {
      render(
        <OrderPicker
          value="rough"
          itemCount={4}
          onChange={vi.fn()}
          sortFields={NUMBER_FIELDS}
          sort={{ field: 'plays', direction: 'desc' }}
          onSortChange={vi.fn()}
          readOnly
        />,
      );

      expect(screen.getByText('Sorted by plays, high to low.')).toBeDefined();
      expect(screen.getByText('Set when this list was created.')).toBeDefined();
      expect(screen.queryByLabelText('Sort field')).toBeNull();
      expect(screen.queryByRole('radio', { name: 'High to low' })).toBeNull();
      expect(screen.getByRole('radio', SORT).getAttribute('aria-checked')).toBe('true');
      for (const radio of screen.getAllByRole('radio')) {
        expect(radio.getAttribute('aria-disabled')).toBe('true');
      }
    });

    it('choosing the selected option again keeps the field and direction', async () => {
      const onSortChange = vi.fn();
      const user = userEvent.setup();
      render(
        <OrderPicker
          value="rough"
          itemCount={4}
          onChange={vi.fn()}
          sortFields={NUMBER_FIELDS}
          sort={{ field: 'rating', direction: 'asc' }}
          onSortChange={onSortChange}
        />,
      );

      await user.click(screen.getByRole('radio', SORT));

      expect(onSortChange).not.toHaveBeenCalled();
    });

    it('choosing another option clears the sort', async () => {
      const onSortChange = vi.fn();
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <OrderPicker
          value="rough"
          itemCount={4}
          onChange={onChange}
          sortFields={NUMBER_FIELDS}
          sort={{ field: 'plays', direction: 'desc' }}
          onSortChange={onSortChange}
        />,
      );

      await user.click(screen.getByRole('radio', { name: RANKED }));

      expect(onSortChange).toHaveBeenCalledWith(null);
      expect(onChange).toHaveBeenCalledWith('ranked');
    });
  });
});
