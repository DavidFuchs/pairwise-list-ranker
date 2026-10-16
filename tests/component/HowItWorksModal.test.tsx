/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HowItWorksModal } from '@/components/layout/HowItWorksModal';

function setup() {
  render(<HowItWorksModal visible onClose={vi.fn()} />);
  return userEvent.setup();
}

describe('HowItWorksModal', () => {
  it('opens on the quick start', () => {
    setup();
    expect(screen.getByRole('tab', { name: 'Quick start' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Pick a side')).toBeDefined();
  });

  it('switches to the full guide from its tab and from the quick start', async () => {
    const user = setup();
    await user.click(screen.getByRole('link', { name: 'full guide' }));
    expect(screen.getByRole('tab', { name: 'Full guide' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByText('Pick a side')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Quick start' }));
    expect(screen.getByText('Pick a side')).toBeDefined();
  });

  it('opens one guide topic at a time', async () => {
    const user = setup();
    await user.click(screen.getByRole('tab', { name: 'Full guide' }));

    const first = screen.getByRole('button', { name: 'Bringing in your list' });
    const renderers = screen.getByRole('button', { name: 'Ways to draw a field' });
    expect(first.getAttribute('aria-expanded')).toBe('true');
    expect(renderers.getAttribute('aria-expanded')).toBe('false');

    await user.click(renderers);
    expect(renderers.getAttribute('aria-expanded')).toBe('true');
    expect(first.getAttribute('aria-expanded')).toBe('false');
  });

  it('documents every way to draw a field', async () => {
    const user = setup();
    await user.click(screen.getByRole('tab', { name: 'Full guide' }));
    await user.click(screen.getByRole('button', { name: 'Ways to draw a field' }));

    for (const name of ['Text', 'Link', 'Image', 'Apple Music preview']) {
      expect(screen.getByText(name)).toBeDefined();
    }
    expect(screen.getByText(/\.png, \.jpg, \.jpeg, \.gif, \.webp/)).toBeDefined();
  });
});
