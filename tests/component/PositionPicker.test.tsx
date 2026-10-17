/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PositionPicker } from '@/components/data/PositionPicker';

const candidates = [
  { field: 'order', suggested: true },
  { field: 'year', suggested: false },
];

describe('PositionPicker', () => {
  it('offers each numeric field plus a none option', () => {
    render(<PositionPicker candidates={candidates} onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: /write the new order into order/i })).toBeDefined();
    expect(screen.getByRole('radio', { name: /write the new order into year/i })).toBeDefined();
    expect(screen.getByRole('radio', { name: /do not write the order into any field/i })).toBeDefined();
  });

  it('reports the chosen field', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PositionPicker candidates={candidates} onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: /write the new order into year/i }));

    expect(onChange).toHaveBeenCalledWith('year');
  });

  it('reports clearing the choice', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PositionPicker candidates={candidates} value="order" onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: /do not write the order into any field/i }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('selects none when no field is chosen', () => {
    render(<PositionPicker candidates={candidates} onChange={vi.fn()} />);

    expect(
      screen
        .getByRole('radio', { name: /do not write the order into any field/i })
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('says the choice is optional', () => {
    render(<PositionPicker candidates={candidates} onChange={vi.fn()} />);

    expect(screen.getByText(/optional/i)).toBeDefined();
  });

  it('renders nothing when there is nowhere to write', () => {
    const { container } = render(<PositionPicker candidates={[]} onChange={vi.fn()} />);

    expect(container.textContent).toBe('');
  });
});
