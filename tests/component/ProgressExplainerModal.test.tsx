/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProgressExplainerModal } from '@/components/comparison/ProgressExplainerModal';
import type { ProgressLevel } from '@/lib/ranking/bt/progress';
import type { ProgressDisplay } from '@/lib/state/progress';
import type { ProgressExplanation, Spot } from '@/lib/state/progressExplain';

const NAMES: Record<string, string> = {
  reykjavik: 'Reykjavík',
  lisbon: 'Lisbon',
  'cape-breton': 'Cape Breton Island',
  banff: 'Banff',
  dubrovnik: 'Dubrovnik',
  amalfi: 'Amalfi Coast',
  a: 'Alpha',
  b: 'Bravo',
};
const labelOf = (id: string) => NAMES[id] ?? id;

const shaping: ProgressDisplay = { text: 'Taking shape.', bar: 'level', share: 0.5 };

const tripsCircle: Spot = {
  kind: 'circle',
  items: ['reykjavik', 'lisbon', 'cape-breton'],
  answers: [
    { winner: 'reykjavik', loser: 'lisbon', answer: 1, draw: false },
    { winner: 'lisbon', loser: 'cape-breton', answer: 15, draw: false },
    { winner: 'cape-breton', loser: 'reykjavik', answer: 9, draw: false },
  ],
  chance: 0.47,
  next: true,
};

function atLevel(level: ProgressLevel, over: Partial<ProgressExplanation> = {}): ProgressExplanation {
  return {
    state: { kind: 'level', disorder: 0.09, items: 6 },
    level,
    uncompared: [],
    spots: [],
    moreSpots: 0,
    doubtful: 0,
    settled: null,
    ...over,
  };
}

function setup(explanation: ProgressExplanation | null, progress = shaping) {
  const onClose = vi.fn();
  render(
    <ProgressExplainerModal
      visible
      onClose={onClose}
      progress={progress}
      explanation={explanation}
      labelOf={labelOf}
    />,
  );
  return { onClose, user: userEvent.setup() };
}

describe('ProgressExplainerModal', () => {
  it('draws the trips circle with each answer, and says the next question is about it', () => {
    setup(
      atLevel(1, {
        spots: [tripsCircle],
        settled: { first: ['banff'], middle: [], last: ['dubrovnik', 'amalfi'] },
      }),
    );
    expect(screen.getByText('How close is this order?')).toBeDefined();
    expect(screen.getByText('Taking shape.')).toBeDefined();
    expect(screen.getByText('Most of the order is settled. A few spots are still in doubt:')).toBeDefined();
    expect(screen.getByText('These answers go in a circle')).toBeDefined();
    expect(screen.getByText('about even')).toBeDefined();
    const circle = screen.getByTestId('progress-circle');
    for (const name of ['Reykjavík', 'Lisbon', 'Cape Breton Island']) {
      expect(circle.textContent).toContain(name);
    }
    expect(screen.getByText(/over, answer 1$/)).toBeDefined();
    expect(screen.getByText(/over, answer 15$/)).toBeDefined();
    expect(screen.getByText('over, answer 9')).toBeDefined();
    expect(circle.getAttribute('aria-label')).toBe(
      'Reykjavík over Lisbon, answer 1. Lisbon over Cape Breton Island, answer 15. Cape Breton Island over Reykjavík, answer 9.',
    );
    expect(document.body.textContent).toContain('The next question is about this.');
    expect(document.body.textContent).toContain(
      'Everything else is settled: Banff first, Dubrovnik and Amalfi Coast last, from answers that all agree.',
    );
  });

  it('says nothing about the next question for a spot it is not about', () => {
    setup(atLevel(1, { spots: [{ ...tripsCircle, next: false }] }));
    expect(document.body.textContent).not.toContain('The next question is about this.');
  });

  it('writes out a circle too long to draw', () => {
    const items = ['a', 'b', 'reykjavik', 'lisbon', 'banff'];
    const answers = items.map((winner, k) => ({
      winner,
      loser: items[(k + 1) % items.length] as string,
      answer: k + 1,
      draw: false,
    }));
    setup(atLevel(1, { spots: [{ ...tripsCircle, items, answers }] }));
    expect(screen.queryByTestId('progress-circle')).toBeNull();
    expect(
      screen.getByText('Alpha over Bravo over Reykjavík over Lisbon over Banff over Alpha'),
    ).toBeDefined();
  });

  it('words each kind of spot with what settles it', () => {
    const pairOf = { above: 'a', below: 'b', chance: 0.25, next: false };
    setup(
      atLevel(0, {
        spots: [
          {
            ...pairOf,
            kind: 'both-ways',
            answers: [
              { winner: 'a', loser: 'b', answer: 4, draw: false },
              { winner: 'b', loser: 'a', answer: 19, draw: false },
            ],
          },
          { ...pairOf, kind: 'undecided', answers: [{ winner: 'a', loser: 'b', answer: 2, draw: true }] },
          { ...pairOf, kind: 'inferred', chain: [] },
        ],
        moreSpots: 2,
        doubtful: 5,
      }),
      { text: 'Rough order so far.', bar: 'level', share: 0.25 },
    );
    expect(
      screen.getByText('Many items could still move several places. 5 more pairs are still in doubt.'),
    ).toBeDefined();
    expect(screen.getByText("You've picked both ways")).toBeDefined();
    expect(screen.getByText('Alpha over Bravo, answer 4.')).toBeDefined();
    expect(screen.getByText('Bravo over Alpha, answer 19.')).toBeDefined();
    expect(screen.getByText("You couldn't decide between these")).toBeDefined();
    expect(screen.getByText('Never compared directly')).toBeDefined();
    expect(screen.getByText('Their order comes from how each did against other items.')).toBeDefined();
    expect(screen.getByText('Comparing them directly settles it.')).toBeDefined();
    expect(screen.getAllByText('could go either way')).toHaveLength(3);
    expect(screen.getByText('And 2 more spots like these.')).toBeDefined();
  });

  it('names the items not yet compared, and counts past eight', () => {
    const uncompared = Array.from({ length: 10 }, (_, k) => `item ${k + 1}`);
    setup(
      { ...atLevel(0), state: { kind: 'comparing', uncompared: 10, total: 12 }, level: null, uncompared },
      { text: "Can't tell how close you are yet.", bar: 'coverage', share: 2 / 12 },
    );
    expect(document.body.textContent).toContain("can't say how close the order is until every item");
    expect(screen.getByText(`${uncompared.slice(0, 8).join(', ')} and 2 more.`)).toBeDefined();
    expect(screen.getByText('Keep answering to bring them in.')).toBeDefined();
  });

  it('says a ranked start cannot be measured, and when no answer disagrees with it', () => {
    setup({ ...atLevel(0), state: { kind: 'ranked-start' }, level: null });
    expect(document.body.textContent).toContain('trusts that order');
    expect(screen.getByText('None of your answers disagree with the starting order so far.')).toBeDefined();
  });

  it('at the top level says nothing is in real doubt and that the user can stop', () => {
    setup(atLevel(3), { text: 'Changes from here should be small.', bar: 'level', share: 1 });
    expect(screen.getByText('Nothing is left in real doubt.')).toBeDefined();
    expect(screen.getByText('You can stop here, or keep going to be sure.')).toBeDefined();
  });

  it('closes from its close button', async () => {
    const { onClose, user } = setup(atLevel(1));
    await user.click(screen.getAllByRole('button', { name: 'Close' }).at(-1) as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });
});
