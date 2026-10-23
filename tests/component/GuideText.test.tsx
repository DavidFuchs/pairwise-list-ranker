/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GuideFaq } from '@/components/layout/GuideFaq';
import { GUIDE_TOPICS } from '@/components/layout/GuideTopics';

const REMOVED_MODE_WORDS = /Auto\b|five at a time|five items|group of five|Rough sort/i;

afterEach(cleanup);

describe('guide text under pairs only', () => {
  it('no guide topic or FAQ answer mentions Auto, five items at a time, or a group of five', () => {
    const noop = vi.fn();
    for (const make of GUIDE_TOPICS) {
      const topic = make(noop);
      const { container } = render(<>{topic.body}</>);
      const text = `${topic.title} ${topic.summary} ${container.textContent}`;
      expect(text, `topic ${topic.id}`).not.toMatch(REMOVED_MODE_WORDS);
      cleanup();
    }
    const { container } = render(<GuideFaq onOpenTopic={noop} />);
    expect(container.textContent).not.toMatch(REMOVED_MODE_WORDS);
  });

  it('no guide topic, FAQ answer or How it works text mentions Edit data', () => {
    const noop = vi.fn();
    for (const make of GUIDE_TOPICS) {
      const topic = make(noop);
      const { container } = render(<>{topic.body}</>);
      const text = `${topic.title} ${topic.summary} ${container.textContent}`;
      expect(text, `topic ${topic.id}`).not.toMatch(/Edit data/i);
      cleanup();
    }
    const { container } = render(<GuideFaq onOpenTopic={noop} />);
    expect(container.textContent).not.toMatch(/Edit data/i);
  });

  it('the List setup topic exists and mentions the gear', () => {
    const topics = GUIDE_TOPICS.map((make) => make(vi.fn()));
    const topic = topics.find((t) => t.title === 'List setup');
    expect(topic).toBeDefined();
    const { container } = render(<>{topic?.body}</>);
    expect(container.textContent).toMatch(/gear/i);
    expect(container.textContent).toMatch(/Start over/);
  });

  it('the starting order topic mentions sorting by a field', () => {
    const topics = GUIDE_TOPICS.map((make) => make(vi.fn()));
    const topic = topics.find((t) => t.id === 'starting-order');
    expect(topic).toBeDefined();
    const { container } = render(<>{topic?.body}</>);
    expect(container.textContent).toContain('Sort by a field');
  });

  it('every link opens an existing topic', async () => {
    const user = userEvent.setup();
    const ids = new Set(GUIDE_TOPICS.map((make) => make(vi.fn()).id));
    ids.add('faq');
    const opened: string[] = [];
    const open = (id: string) => opened.push(id);

    const press = async (node: React.ReactNode) => {
      render(<>{node}</>);
      for (const link of screen.queryAllByRole('link')) await user.click(link);
      cleanup();
    };
    for (const make of GUIDE_TOPICS) await press(make(open).body);
    await press(<GuideFaq onOpenTopic={open} />);

    expect(opened.length).toBeGreaterThan(0);
    for (const id of opened) expect(ids.has(id), `link to ${id}`).toBe(true);
  });
});
