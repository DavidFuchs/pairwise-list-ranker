/** Outcome of a pair question, from the left item's point of view. */
export type PairOutcome = 'left' | 'right' | 'left_strong' | 'right_strong' | 'draw';

/** How well ordered the imported list already was. */
export type StartingOrder = 'unordered' | 'rough' | 'ranked';

interface EventBase {
  id: string;
  listId: string;
  createdAt: string;
}

/** One entry of the append-only history the Bradley-Terry engine replays. */
export type RankingEvent = EventBase &
  (
    | { kind: 'pair'; leftItemId: string; rightItemId: string; outcome: PairOutcome }
    | {
        /**
         * Every move, by any route (docs/ARCHITECTURE.md 6.8): a drag or a keyboard move
         * places one item between the rows it was put between, as displayed
         * (one is absent at the very top or bottom). The engine sets the
         * item's earlier answers aside, fits, then puts it between its rows.
         */
        kind: 'placement';
        itemId: string;
        aboveItemId?: string;
        belowItemId?: string;
      }
    | { kind: 'unrecognized'; itemIds: string[] }
    | {
        /**
         * Items taken out of the list. They stay in the fit, so their answers
         * keep counting for everyone they met, but are no longer shown. Only
         * undo brings one back.
         */
        kind: 'removal';
        itemIds: string[];
      }
  );

/**
 * An event as a list's history keeps it: with the id of the user action that
 * recorded it (docs/ARCHITECTURE.md 10.3). Every event one action records shares the id, across
 * lists, so undo takes the action back whole. The engine never reads it.
 */
export type RecordedEvent = RankingEvent & { actionId: string };

/**
 * originalItemIds is the original import, in import order: its index is the
 * item's arrivalIndex. It holds every item the list will ever have, all of
 * them present before the first event. startingOrder is the list's starting
 * order, fixed when it was created; it seeds the priors once.
 */
export interface EngineList {
  originalItemIds: readonly string[];
  startingOrder: StartingOrder;
  events: readonly RankingEvent[];
}
