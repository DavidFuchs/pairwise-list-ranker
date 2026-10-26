import { settleLevel, type ProgressLevel } from '@/lib/ranking/bt/progress';
import { formatCount } from '@/lib/state/selectors';
import type { RankedList } from '@/types/source';

/** What the progress line is about, before it is worded. */
export type ProgressState =
  | { kind: 'none' }
  /** Some shown items have not been in a single answered pair, so nothing can be said about how close the order is. */
  | { kind: 'comparing'; uncompared: number; total: number }
  /** Every item has been compared, but the list started ranked, so the engine's estimate says nothing about the start. */
  | { kind: 'ranked-start' }
  | { kind: 'level'; disorder: number; items: number };

/**
 * The progress line's state for the open list (docs/ARCHITECTURE.md 6.12). Until every
 * shown item has been in at least one answered pair, only that is said. After,
 * a level is read off the engine's disorder, except for a list that started
 * ranked: the engine trusts a ranked start, so a bad import would read as
 * close, and that list says so instead.
 */
export function selectProgressState(
  list: RankedList,
  shown: readonly string[],
  disorder: number | null,
): ProgressState {
  if (shown.length < 2) return { kind: 'none' };

  const compared = new Set<string>();
  for (const event of list.events) {
    if (event.kind === 'pair') {
      compared.add(event.leftItemId);
      compared.add(event.rightItemId);
    }
  }
  const uncompared = shown.filter((id) => !compared.has(id)).length;
  if (uncompared > 0) return { kind: 'comparing', uncompared, total: shown.length };

  if (list.initialStartingOrder === 'ranked') return { kind: 'ranked-start' };
  if (disorder === null) return { kind: 'none' };
  return { kind: 'level', disorder, items: shown.length };
}

/** The level to show for a state, given the one shown before (so it does not flicker), or null when none applies. */
export function levelFor(state: ProgressState, previous: ProgressLevel | null): ProgressLevel | null {
  return state.kind === 'level' ? settleLevel(previous, state.disorder, state.items) : null;
}

/**
 * What the deck draws: the words, and a bar. While items are still uncompared
 * the bar is the share already compared; once there is a level it is that level
 * out of four, with ticks between the levels; a list that started ranked stays
 * on the full compared bar, because there is no level to read.
 */
export interface ProgressDisplay {
  text: string;
  bar: 'coverage' | 'level';
  /** How much of the bar is filled, 0 to 1. */
  share: number;
}

const LEVEL_TEXT: readonly string[] = [
  'Rough order so far.',
  'Taking shape.',
  'Close. Mostly fine adjustments left.',
  'Changes from here should be small.',
];

export function describeProgress(state: ProgressState, level: ProgressLevel | null): ProgressDisplay | null {
  if (state.kind === 'comparing') {
    const { uncompared, total } = state;
    return {
      text: `Can't tell how close you are yet. ${formatCount(uncompared)} of ${formatCount(total)} items ${
        uncompared === 1 ? "hasn't" : "haven't"
      } been compared.`,
      bar: 'coverage',
      share: total === 0 ? 0 : (total - uncompared) / total,
    };
  }
  if (state.kind === 'ranked-start') {
    return {
      text: 'Every item has been compared. Keep going to fix your order where answers disagree.',
      bar: 'coverage',
      share: 1,
    };
  }
  if (state.kind === 'level' && level !== null) {
    return { text: LEVEL_TEXT[level] as string, bar: 'level', share: (level + 1) / 4 };
  }
  return null;
}
