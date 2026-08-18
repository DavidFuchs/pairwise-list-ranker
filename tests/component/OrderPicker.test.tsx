/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OrderPicker } from '@/components/data/OrderPicker';

const UNORDERED = /the list is in no particular order/i;
const RANKED = /the list is already ranked, best to worst/i;

describe('OrderPicker', () => {
  it('offers both orders as named choices', () => {
    render(<OrderPicker value={false} itemCount={4} onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: UNORDERED })).toBeDefined();
    expect(screen.getByRole('radio', { name: RANKED })).toBeDefined();
  });

  it('selects no particular order by default', () => {
    render(<OrderPicker value={false} itemCount={4} onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: UNORDERED }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: RANKED }).getAttribute('aria-checked')).toBe('false');
  });

  it('reflects a list that is already ranked', () => {
    render(<OrderPicker value itemCount={4} onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: RANKED }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: UNORDERED }).getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it('reports choosing an already-ranked list', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<OrderPicker value={false} itemCount={4} onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: RANKED }));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reports going back to no particular order', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<OrderPicker value itemCount={4} onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: UNORDERED }));

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('says what the choice does, rather than repeating the heading', () => {
    render(<OrderPicker value={false} itemCount={4} onChange={vi.fn()} />);

    expect(screen.getByText(/refine it, instead of ranking from scratch/i)).toBeDefined();
  });

  it('asks nothing when there is no order to describe', () => {
    const { container } = render(<OrderPicker value={false} itemCount={1} onChange={vi.fn()} />);

    expect(container.textContent).toBe('');
  });
});
