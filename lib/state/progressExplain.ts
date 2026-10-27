import type { ShownEvidence } from '@/lib/engine/engineHost';
import { MIN_ITEMS_FOR_PAIR_SCALE, pairChances, type ProgressLevel } from '@/lib/ranking/bt/progress';
import type { ProgressState } from '@/lib/state/progress';
import type { RankingEvent } from '@/types/rankingEvents';

/**
 * Why the progress line reads what it does (docs/ARCHITECTURE.md 6.12): the
 * pairs most likely to be the wrong way round, grouped by what in the answers
 * leaves them in doubt, as plain data for the explainer window to word. It
 * reads the same chances the level does, so it never says less is in doubt
 * than the level shows. Worked out only while the window is open.
 */

/** One counted answer, by item id and the number the answer counter showed for it. */
export interface AnswerRef {
  winner: string;
  loser: string;
  answer: number;
  draw: boolean;
}

interface SpotBase {
  /** The largest chance of any of its pairs being the wrong way round. */
  chance: number;
  /** The next question on the cards is one of its pairs. */
  next: boolean;
}

/** One cause of doubt, said once for every pair it covers. */
export type Spot = SpotBase &
  (
    | {
        /** The answers lead from each item to the next and from the last back to the first. */
        kind: 'circle';
        /** In circle order, starting from the one shown highest. */
        items: string[];
        /** answers[k] is items[k] over items[k + 1], the last back to the first. */
        answers: AnswerRef[];
      }
    | {
        /** Answered directly both ways; every direct answer a draw; or one clear direct answer, with draws or alone. */
        kind: 'both-ways' | 'undecided' | 'one-answer';
        above: string;
        below: string;
        answers: AnswerRef[];
      }
    | {
        /** Never asked directly; `chain` is the shortest run of answers that puts `above` over `below`, if any. */
        kind: 'inferred';
        above: string;
        below: string;
        chain: AnswerRef[];
      }
    | {
        /** Placed by a move and hardly asked about since. */
        kind: 'moved';
        item: string;
      }
  );

export interface ProgressExplanation {
  state: ProgressState;
  level: ProgressLevel | null;
  /** The shown items never in an answered pair, in shown order; only while comparing. */
  uncompared: string[];
  spots: Spot[];
  /** Spots past the ones given. */
  moreSpots: number;
  /** Pairs in doubt in no spot, given or not; none at the top level. */
  doubtful: number;
  /**
   * The shown items in no pair in doubt, on a list under 26 items: by name when
   * there are a few, split into the run at the top, the run at the bottom and
   * the rest; only a count past that. Null on a long list, or with none.
   */
  settled: { first: string[]; middle: string[]; last: string[] } | { count: number } | null;
}

/** A pair this likely to be the wrong way round is in doubt. */
export const DOUBT = 0.05;
/** At the top level, a spot is mentioned only past this. */
export const TOP_LEVEL_DOUBT = 0.1;
export const MAX_SPOTS = 3;
/** The most answers a chain or either half of a circle is followed through. */
const MAX_CHAIN = 3;
/** The most pairs in doubt looked at for a cause; the rest are counted. */
const MAX_CLASSIFIED = 200;
/** Circles up to this many items are drawn; longer ones are written out. */
export const MAX_CIRCLE_PICTURE = 4;
/** Settled items are named up to this many. */
const MAX_SETTLED_NAMED = 6;
/** A moved item with fewer counted answers than this is still taken on the move's word. */
const MOVED_CONFIRMED_AFTER = 2;

const keyOf = (a: string, b: string): string => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

/** The counted answers, as the engine counts them: answers a move set aside are not among them. */
function countedAnswers(events: readonly RankingEvent[], evidence: ShownEvidence): AnswerRef[] {
  const idOf: string[] = [];
  for (const [id, slot] of evidence.slots) idOf[slot] = id;
  const answerAt: number[] = [];
  let answers = 0;
  for (const event of events) {
    if (event.kind === 'pair') answers++;
    answerAt.push(answers);
  }
  // A draw is two terms with one event index, one each way.
  const terms = new Map<number, AnswerRef>();
  for (const term of evidence.fit.pairs) {
    const winner = idOf[term.winner];
    const loser = idOf[term.loser];
    if (winner === undefined || loser === undefined) continue;
    const known = terms.get(term.eventIndex);
    if (known !== undefined) known.draw = true;
    else terms.set(term.eventIndex, { winner, loser, answer: answerAt[term.eventIndex] ?? 0, draw: false });
  }
  return [...terms.values()].sort((a, b) => a.answer - b.answer);
}

/** The shortest run of clear answers from `from` down to `to`, through shown items, of at most MAX_CHAIN; null if none. */
function chainBetween(
  from: string,
  to: string,
  beat: ReadonlyMap<string, AnswerRef[]>,
  shown: ReadonlySet<string>,
): AnswerRef[] | null {
  const via = new Map<string, AnswerRef>();
  let frontier = [from];
  const seen = new Set([from]);
  for (let step = 0; step < MAX_CHAIN && frontier.length > 0; step++) {
    const next: string[] = [];
    for (const item of frontier) {
      for (const answer of beat.get(item) ?? []) {
        if (seen.has(answer.loser) || !shown.has(answer.loser)) continue;
        seen.add(answer.loser);
        via.set(answer.loser, answer);
        if (answer.loser === to) {
          const chain: AnswerRef[] = [];
          for (let at = to; at !== from; at = (via.get(at) as AnswerRef).winner)
            chain.unshift(via.get(at) as AnswerRef);
          return chain;
        }
        next.push(answer.loser);
      }
    }
    frontier = next;
  }
  return null;
}

/** The items and answers of a circle through `down` then `up`, from the item shown highest; null unless every item is met once. */
function circleOf(
  down: AnswerRef[],
  up: AnswerRef[],
  position: ReadonlyMap<string, number>,
): { items: string[]; answers: AnswerRef[] } | null {
  const answers = [...down, ...up];
  const items = answers.map((answer) => answer.winner);
  if (new Set(items).size !== items.length) return null;
  let start = 0;
  items.forEach((item, k) => {
    if ((position.get(item) as number) < (position.get(items[start] as string) as number)) start = k;
  });
  return {
    items: [...items.slice(start), ...items.slice(0, start)],
    answers: [...answers.slice(start), ...answers.slice(0, start)],
  };
}

/** The shown items in no pair in doubt, as ProgressExplanation.settled says. */
function settledOf(
  shown: readonly string[],
  fitted: ReadonlyMap<string, number>,
  doubted: ReadonlySet<string>,
): ProgressExplanation['settled'] {
  if (shown.length >= MIN_ITEMS_FOR_PAIR_SCALE) return null;
  const settled = shown.filter((id) => fitted.has(id) && !doubted.has(id));
  if (settled.length === 0) return null;
  if (settled.length > MAX_SETTLED_NAMED) return { count: settled.length };
  let top = 0;
  while (top < shown.length && settled.includes(shown[top] as string)) top++;
  let bottom = shown.length;
  while (bottom > top && settled.includes(shown[bottom - 1] as string)) bottom--;
  return {
    first: shown.slice(0, top),
    middle: settled.filter((id) => {
      const at = shown.indexOf(id);
      return at >= top && at < bottom;
    }),
    last: shown.slice(bottom),
  };
}

export function explainProgress(input: {
  state: ProgressState;
  level: ProgressLevel | null;
  events: readonly RankingEvent[];
  /** The shown order, ranked items only. */
  shown: readonly string[];
  evidence: ShownEvidence | null;
}): ProgressExplanation {
  const { state, level, events, shown, evidence } = input;
  const empty: ProgressExplanation = {
    state,
    level,
    uncompared: [],
    spots: [],
    moreSpots: 0,
    doubtful: 0,
    settled: null,
  };

  if (state.kind === 'comparing') {
    const compared = new Set<string>();
    for (const event of events) {
      if (event.kind === 'pair') {
        compared.add(event.leftItemId);
        compared.add(event.rightItemId);
      }
    }
    return { ...empty, uncompared: shown.filter((id) => !compared.has(id)) };
  }
  if (evidence === null || (state.kind !== 'level' && state.kind !== 'ranked-start')) return empty;

  const shownSet = new Set(shown);
  const position = new Map(shown.map((id, k) => [id, k]));
  const answers = countedAnswers(events, evidence);
  const direct = new Map<string, AnswerRef[]>();
  const beat = new Map<string, AnswerRef[]>();
  const counted = new Map<string, number>();
  for (const answer of answers) {
    const key = keyOf(answer.winner, answer.loser);
    direct.set(key, [...(direct.get(key) ?? []), answer]);
    if (!answer.draw) beat.set(answer.winner, [...(beat.get(answer.winner) ?? []), answer]);
    for (const id of [answer.winner, answer.loser]) counted.set(id, (counted.get(id) ?? 0) + 1);
  }

  const doubts = (pairChances(evidence) ?? [])
    .filter((pair) => pair.chance >= DOUBT && shownSet.has(pair.above) && shownSet.has(pair.below))
    .sort((a, b) => b.chance - a.chance);
  const next = evidence.nextPair === null ? null : keyOf(evidence.nextPair[0], evidence.nextPair[1]);

  /** Each spot, with the sum of its pairs' chances to rank it by and the pairs it covers. */
  type Found = { spot: Spot; total: number; pairs: number };
  const found: Found[] = [];
  /** The circle spot each item is in, and the moved spot of each moved item. */
  const circleWith = new Map<string, Found>();
  const movedSpot = new Map<string, Found>();
  const add = (spot: Spot): Found => {
    const at = { spot, total: spot.chance, pairs: 1 };
    found.push(at);
    return at;
  };
  const join = (at: Found, chance: number, isNext: boolean): void => {
    at.total += chance;
    at.pairs++;
    at.spot.chance = Math.max(at.spot.chance, chance);
    at.spot.next ||= isNext;
  };

  // Only the likeliest pairs are worth a cause: past these, a long list early on
  // has hundreds of thousands in doubt, and they are only counted.
  const looked = doubts.slice(0, MAX_CLASSIFIED).map((pair) => {
    const met = direct.get(keyOf(pair.above, pair.below)) ?? [];
    const clear = met.filter((answer) => !answer.draw);
    const bothWays =
      clear.some((answer) => answer.winner === pair.above) &&
      clear.some((answer) => answer.winner === pair.below);
    const down = bothWays ? null : chainBetween(pair.above, pair.below, beat, shownSet);
    const up = down && chainBetween(pair.below, pair.above, beat, shownSet);
    return { ...pair, met, clear, bothWays, down, up, made: false };
  });

  // Circles first, so a pair is put with a circle whatever its chance. Circles
  // that share an item are one spot, drawn as the first one found.
  for (const pair of looked) {
    if (!pair.down || !pair.up) continue;
    const circle = circleOf(pair.down, pair.up, position);
    if (circle === null || circle.items.some((id) => circleWith.has(id))) continue;
    const nextInIt = evidence.nextPair !== null && evidence.nextPair.every((id) => circle.items.includes(id));
    const at = add({ chance: pair.chance, next: nextInIt, kind: 'circle', ...circle });
    for (const id of circle.items) circleWith.set(id, at);
    pair.made = true;
  }

  for (const { above, below, chance, met, clear, bothWays, down, up, made } of looked) {
    if (made) continue;
    const isNext = next === keyOf(above, below);
    const base = { chance, next: isNext };

    if (bothWays) {
      add({ ...base, kind: 'both-ways', above, below, answers: met });
      continue;
    }

    if (down && up) {
      const through = [...down, ...up].flatMap((answer) => [answer.winner, answer.loser]);
      const sharing = through.map((id) => circleWith.get(id)).find((at) => at !== undefined);
      if (sharing !== undefined) {
        join(sharing, chance, isNext);
        continue;
      }
    }

    if (met.length > 0 && clear.length === 0) {
      add({ ...base, kind: 'undecided', above, below, answers: met });
      continue;
    }

    const moved = [above, below].find(
      (id) => evidence.priorSource.get(id) === 'placement' && (counted.get(id) ?? 0) < MOVED_CONFIRMED_AFTER,
    );
    if (moved !== undefined) {
      const movedNext = evidence.nextPair?.includes(moved) ?? false;
      const at = movedSpot.get(moved);
      if (at !== undefined) join(at, chance, movedNext);
      else movedSpot.set(moved, add({ ...base, kind: 'moved', item: moved, next: movedNext }));
      continue;
    }

    if (met.length === 0) {
      add({ ...base, kind: 'inferred', above, below, chain: down ?? [] });
      continue;
    }
    if (clear.length === 1) {
      add({ ...base, kind: 'one-answer', above, below, answers: met });
      continue;
    }
  }

  // Stable, so spots of equal weight keep the order of their likeliest pair.
  found.sort((a, b) => b.total - a.total);
  // The top level gives only the likeliest change, and only past TOP_LEVEL_DOUBT.
  const likeliest = found.reduce<Found | undefined>(
    (best, at) => (best === undefined || at.spot.chance > best.spot.chance ? at : best),
    undefined,
  );
  const given =
    level === 3
      ? likeliest !== undefined && likeliest.spot.chance > TOP_LEVEL_DOUBT
        ? [likeliest]
        : []
      : found.slice(0, MAX_SPOTS);

  const doubted = new Set(doubts.flatMap((pair) => [pair.above, pair.below]));
  return {
    ...empty,
    spots: given.map((at) => at.spot),
    moreSpots: level === 3 ? 0 : found.length - given.length,
    doubtful: level === 3 ? 0 : doubts.length - found.reduce((total, at) => total + at.pairs, 0),
    settled: settledOf(shown, evidence.slots, doubted),
  };
}
