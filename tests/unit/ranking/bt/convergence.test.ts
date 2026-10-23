import { describe, expect, it } from 'vitest';

import { replay, replayPolished } from '@/lib/ranking/bt/engine';
import { drivenHistory } from '@/tests/helpers/engineCorpus';
import type { UserModel } from '@/tests/helpers/simUser';
import type { StartingOrder } from '@/types/rankingEvents';

/**
 * Convergence quality (docs/ARCHITECTURE.md 11). The engine stops at its test; what the user
 * sees must not depend on the slack left below it. replayPolished shakes the
 * final fit and solves it again until quadratic convergence runs well past the
 * stopping test, and the displayed order and both questions must come out the
 * same.
 */
const CASES: { seed: number; user: UserModel; startingOrder: StartingOrder; n: number; events: number }[] = [
  { seed: 301, user: 'typical', startingOrder: 'unordered', n: 40, events: 220 },
  { seed: 302, user: 'careful', startingOrder: 'rough', n: 25, events: 160 },
  { seed: 303, user: 'fuzzy', startingOrder: 'ranked', n: 55, events: 300 },
  { seed: 304, user: 'sloppy', startingOrder: 'unordered', n: 18, events: 250 },
  { seed: 305, user: 'typical', startingOrder: 'rough', n: 60, events: 350 },
];

describe('solving far past the stopping test changes nothing visible (docs/ARCHITECTURE.md 11)', () => {
  for (const { seed, user, startingOrder, n, events } of CASES) {
    it(`${user} on ${n} items, ${startingOrder}, seed ${seed}`, () => {
      const l = drivenHistory({ n, events, seed, user, startingOrder });
      const stopped = replay(l);
      const polished = replayPolished(l);
      expect(polished.converged).toBe(true);
      expect(polished.iterations).toBeGreaterThan(0);
      expect(polished.state.ranked).toEqual(stopped.ranked);
      expect(polished.state.nextPair).toEqual(stopped.nextPair);
      for (const [item, s] of stopped.strengths) {
        expect(polished.state.strengths.get(item) as number).toBeCloseTo(s, 8);
      }
    });
  }
});
