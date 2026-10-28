import { describe, expect, it } from 'vitest';

import { MAX_SHOWINGS, MAX_SHOWINGS_SPLIT } from '@/lib/ranking/bt/constants';
import { replay } from '@/lib/ranking/bt/engine';
import type { EngineList, RankingEvent } from '@/types/rankingEvents';

const ids = ['banff', 'cape-breton', 'dubrovnik', 'reykjavik', 'lisbon', 'amalfi'];
// The order the answers follow: the import order, except Reykjavík above Dubrovnik.
const truth = ['banff', 'cape-breton', 'reykjavik', 'dubrovnik', 'lisbon', 'amalfi'];

const key = (a: string, b: string): string => [a, b].sort().join('|');
const SPLIT = key('reykjavik', 'dubrovnik');

function answer(index: number, winner: string, loser: string): RankingEvent {
  return {
    id: `e${index}`,
    listId: 'list',
    createdAt: '2026-10-27T00:00:00.000Z',
    kind: 'pair',
    leftItemId: winner,
    rightItemId: loser,
    outcome: 'left',
  };
}

/** Every pair once by the truth, with Reykjavík and Dubrovnik answered Reykjavík, Dubrovnik, Reykjavík among them. */
function history(): RankingEvent[] {
  const answers: [string, string][] = [];
  for (let i = 0; i < truth.length; i++) {
    for (let j = i + 1; j < truth.length; j++) {
      answers.push([truth[i] as string, truth[j] as string]);
    }
  }
  // The truth pairs put Reykjavík over Dubrovnik at index 9; the other way comes two answers
  // later, and Reykjavík again at the end.
  answers.splice(11, 0, ['dubrovnik', 'reykjavik']);
  answers.push(['reykjavik', 'dubrovnik']);
  return answers.map(([winner, loser], i) => answer(i, winner, loser));
}

interface Session {
  /** Each question after the history, as a pair key, in order. */
  questions: string[];
  /** Times the split pair had been asked, history included, before each question. */
  splitBefore: number[];
  /**
   * One past the last question that asked a pair other than the split one
   * while it had been asked fewer than MAX_SHOWINGS times: from here on, every
   * other pair the picker asks is at its limit. Pairs the answers have settled
   * outright are never asked again, so "every other pair" means those it asks.
   */
  othersAtLimitFrom: number;
}

/**
 * Plays the history, then answers `more` of the engine's questions, choosing
 * the winner with `choose`.
 */
function play(more: number, choose: (a: string, b: string) => string): Session {
  const events = history();
  const asked = new Map<string, number>();
  for (const event of events) {
    if (event.kind !== 'pair') continue;
    const k = key(event.leftItemId, event.rightItemId);
    asked.set(k, (asked.get(k) ?? 0) + 1);
  }
  const questions: string[] = [];
  const splitBefore: number[] = [];
  let othersAtLimitFrom = 0;
  for (let step = 0; step < more; step++) {
    const list: EngineList = { originalItemIds: ids, startingOrder: 'unordered', events };
    const next = replay(list).nextPair;
    if (!next) break;
    const [a, b] = next;
    const k = key(a, b);
    const times = asked.get(k) ?? 0;
    const winner = choose(a, b);
    events.push(answer(events.length, winner, winner === a ? b : a));
    questions.push(k);
    splitBefore.push(asked.get(SPLIT) ?? 0);
    asked.set(k, times + 1);
    if (k !== SPLIT && times < MAX_SHOWINGS) othersAtLimitFrom = step + 1;
  }
  return { questions, splitBefore, othersAtLimitFrom };
}

const byTruth = (a: string, b: string): string => (truth.indexOf(a) < truth.indexOf(b) ? a : b);

describe('a pair answered both ways (docs/ARCHITECTURE.md 6.7)', () => {
  it('comes back before the others reach three, and rests once two answers in a row agree', () => {
    const { questions, othersAtLimitFrom } = play(40, byTruth);
    // The run goes on past the point where every other pair it asks is at its limit.
    expect(othersAtLimitFrom).toBeLessThan(questions.length);
    // Reykjavík and Dubrovnik come back before every other pair has been asked three times.
    const askedAgainAt = questions.indexOf(SPLIT);
    expect(askedAgainAt).not.toBe(-1);
    expect(askedAgainAt).toBeLessThan(othersAtLimitFrom);
    // Its fourth answer (Reykjavík) makes a run of two, so it is not asked a fifth time
    // until every other pair has been asked three times.
    const fifthAt = questions.indexOf(SPLIT, askedAgainAt + 1);
    if (fifthAt !== -1) expect(fifthAt).toBeGreaterThanOrEqual(othersAtLimitFrom);
  });

  it('rests at MAX_SHOWINGS_SPLIT when its answers keep going back and forth', () => {
    // Reykjavík and Dubrovnik went Reykjavík, Dubrovnik, Reykjavík: each answer from here flips it.
    let last = 'reykjavik';
    const { questions, splitBefore, othersAtLimitFrom } = play(40, (a, b) => {
      if (key(a, b) !== SPLIT) return byTruth(a, b);
      last = last === 'reykjavik' ? 'dubrovnik' : 'reykjavik';
      return last;
    });
    expect(othersAtLimitFrom).toBeLessThan(questions.length);
    expect(splitBefore[othersAtLimitFrom]).toBe(MAX_SHOWINGS_SPLIT);
  });
});
