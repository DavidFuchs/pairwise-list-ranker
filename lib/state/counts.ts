/**
 * The two things the app counts, and the only words its copy uses for them
 * (docs/ARCHITECTURE.md 6.12):
 *
 * - **answers**: pair answers (draws included). Shown as
 *   progress, in the strip and the list switcher.
 * - **changes**: user actions, the same unit as undo steps (docs/ARCHITECTURE.md 10.3). An
 *   answer, a move, a mark and a removal are one change each. Named wherever
 *   work is about to be lost.
 */
import { allLists } from '@/lib/state/lists';
import type { RankingEvent, RecordedEvent } from '@/types/rankingEvents';
import type { Workspace } from '@/types/source';

/** Answers in a history: each pair answer, draw included, is one. */
export function countAnswers(events: readonly RankingEvent[]): number {
  let answers = 0;
  for (const event of events) if (event.kind === 'pair') answers++;
  return answers;
}

/** Changes across a whole workspace: one per action, even an action that touched several lists. */
export function countChanges(workspace: Workspace | null): number {
  if (workspace === null) return 0;
  const actions = new Set<string>();
  for (const list of allLists(workspace)) {
    for (const event of list.events as readonly RecordedEvent[]) actions.add(event.actionId);
  }
  return actions.size;
}

/** "1 change" or "12 changes". */
export function changesText(changes: number): string {
  return `${changes} ${changes === 1 ? 'change' : 'changes'}`;
}

/** "1 answer" or "12 answers". */
export function answersText(answers: number): string {
  return `${answers} ${answers === 1 ? 'answer' : 'answers'}`;
}
