/** @vitest-environment jsdom */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HowItWorksModal } from '@/components/layout/HowItWorksModal';

/** jsdom has no layout, so the window's width is whatever the document element says it is. */
function resizeWindow(width: number) {
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: width });
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

function setup(width = 1200) {
  resizeWindow(width);
  render(<HowItWorksModal visible onClose={vi.fn()} />);
  return userEvent.setup();
}

function isSelected(name: string): boolean {
  return screen.getByRole('tab', { name }).getAttribute('aria-selected') === 'true';
}

describe('HowItWorksModal', () => {
  it('opens on the quick start', () => {
    setup();
    expect(isSelected('Quick start')).toBe(true);
    expect(screen.getByText('2. Pick a side')).toBeDefined();
  });

  it('does not mention Edit data', async () => {
    const user = setup();
    expect(document.body.textContent).not.toMatch(/Edit data/i);
    await user.click(screen.getByRole('tab', { name: 'Full guide' }));
    expect(document.body.textContent).not.toMatch(/Edit data/i);
  });

  it('switches to the full guide from its tab and from the quick start', async () => {
    const user = setup();
    await user.click(screen.getByRole('link', { name: 'full guide' }));
    expect(isSelected('Full guide')).toBe(true);
    expect(screen.queryByText('2. Pick a side')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Quick start' }));
    expect(screen.getByText('2. Pick a side')).toBeDefined();
  });

  it('points the quick start at the question about rows moving', async () => {
    const user = setup();
    await user.click(screen.getByRole('link', { name: 'questions' }));
    expect(isSelected('Questions')).toBe(true);
    expect(screen.getByText('Why did items move that I was not comparing?')).toBeDefined();
  });

  it('names "Don\'t recognize" in the quick start, the guide and the questions', async () => {
    const user = setup();
    expect(screen.getAllByText(/Don.t recognize…/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('tab', { name: 'Full guide' }));
    await user.click(screen.getByRole('button', { name: 'Answering questions' }));
    expect(screen.getAllByText(/Don.t recognize…/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('tab', { name: 'Questions' }));
    expect(screen.getAllByText(/Don.t recognize…/).length).toBeGreaterThan(0);
  });

  it('does not describe the Auto, Five at a time and Pairs buttons', () => {
    setup();
    expect(document.body.textContent).not.toMatch(/Auto|five at a time|five items|Rough sort/i);
  });

  describe('full guide', () => {
    it('lists every topic beside the first one, grouped by what a person is doing', async () => {
      const user = setup();
      await user.click(screen.getByRole('tab', { name: 'Full guide' }));

      const contents = screen.getByRole('navigation', { name: 'Guide topics' });
      for (const group of ['Set up your list', 'Rank it', 'Keep your result']) {
        expect(contents.textContent).toContain(group);
      }
      for (const topic of ['Bringing in your list', 'How the order is worked out', 'List setup']) {
        expect(screen.getByRole('button', { name: topic })).toBeDefined();
      }
      expect(screen.getByRole('heading', { name: 'Bringing in your list' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Bringing in your list' }).getAttribute('aria-current')).toBe(
        'page',
      );
    });

    it('shows one topic at a time, straight from the contents', async () => {
      const user = setup();
      await user.click(screen.getByRole('tab', { name: 'Full guide' }));
      await user.click(screen.getByRole('button', { name: 'How the order is worked out' }));

      expect(screen.getByRole('heading', { name: 'How the order is worked out' })).toBeDefined();
      expect(screen.queryByRole('heading', { name: 'Bringing in your list' })).toBeNull();
      expect(
        screen.getByRole('button', { name: 'How the order is worked out' }).getAttribute('aria-current'),
      ).toBe('page');
    });

    it('steps to the neighbouring topics, and on to the questions after the last', async () => {
      const user = setup();
      await user.click(screen.getByRole('tab', { name: 'Full guide' }));

      await user.click(
        screen.getByRole('button', { name: 'Next: Already ranked, in no order, or sortable?' }),
      );
      expect(
        screen.getByRole('heading', { name: 'Already ranked, in no order, or sortable?' }),
      ).toBeDefined();
      await user.click(screen.getByRole('button', { name: 'Previous: Bringing in your list' }));
      expect(screen.getByRole('heading', { name: 'Bringing in your list' })).toBeDefined();

      await user.click(screen.getByRole('button', { name: 'Privacy' }));
      await user.click(screen.getByRole('button', { name: 'Next: Questions and answers' }));
      expect(isSelected('Questions')).toBe(true);
    });

    it('follows a link in one topic to another', async () => {
      const user = setup();
      await user.click(screen.getByRole('tab', { name: 'Full guide' }));
      await user.click(screen.getByRole('button', { name: 'Answering questions' }));
      await user.click(screen.getByRole('link', { name: 'How the order is worked out' }));
      expect(screen.getByRole('heading', { name: 'How the order is worked out' })).toBeDefined();
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

  describe('questions', () => {
    it('answers the question about unrelated rows moving, and links on to how the order is worked out', async () => {
      const user = setup();
      await user.click(screen.getByRole('tab', { name: 'Questions' }));

      expect(
        screen.getByRole('heading', { name: 'Why did items move that I was not comparing?' }),
      ).toBeDefined();
      await user.click(screen.getByRole('link', { name: 'How the order is worked out' }));
      expect(isSelected('Full guide')).toBe(true);
      expect(screen.getByRole('heading', { name: 'How the order is worked out' })).toBeDefined();
    });
  });

  describe('on a narrow screen', () => {
    it('shows the contents first, then one topic with a way back', async () => {
      const user = setup(480);
      await user.click(screen.getByRole('tab', { name: 'Full guide' }));

      expect(screen.queryByRole('navigation', { name: 'Guide topics' })).toBeNull();
      expect(screen.getByRole('button', { name: 'List setup' })).toBeDefined();
      expect(screen.queryByRole('heading', { name: 'List setup' })).toBeNull();

      await user.click(screen.getByRole('button', { name: 'List setup' }));
      expect(screen.getByRole('heading', { name: 'List setup' })).toBeDefined();

      await user.click(screen.getByRole('button', { name: 'All topics' }));
      expect(screen.queryByRole('heading', { name: 'List setup' })).toBeNull();
    });
  });
});
