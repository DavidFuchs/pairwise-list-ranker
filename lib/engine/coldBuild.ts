import { createReplayJob } from '@/lib/ranking/bt/engine';
import { openSealed, sealSnapshot } from '@/lib/ranking/bt/sealed';
import type { EngineSnapshot } from '@/lib/ranking/bt/snapshot';
import type { EngineList } from '@/types/rankingEvents';

export interface ColdBuildRequest {
  /** `${listId}:${events.length}:${lastEventId}`, so a result can be matched to the history it was built for. */
  key: string;
  list: EngineList;
}

export interface ColdBuilder {
  /** Resolves with a snapshot covering the whole list, or rejects; never resolves for a superseded key after cancel(key). */
  build(request: ColdBuildRequest): Promise<EngineSnapshot>;
  cancel(key: string): void;
  /** Where the next build runs; a cold builder whose worker failed to start moves to slices. */
  readonly via: 'worker' | 'slices' | 'sync';
}

/** What the worker posts back: the sealed snapshot, or why the replay failed. */
export type ColdBuildReply = { sealed: string } | { error: string };

/** One build under way: the sealed snapshot it will give, and how to stop it. */
interface Run {
  sealed: Promise<string>;
  stop(): void;
}

const DEFAULT_SLICE_MS = 12;

/** How long a worker may go without replying before it is treated as unavailable. */
export const WORKER_TIMEOUT_MS = 60_000;

export interface ColdBuilderOptions {
  /** Stall timeout for a worker's reply, in ms; tests shorten it. */
  workerTimeoutMs?: number;
}

/** A way to hand the thread back to the browser between slices. */
export interface Yielder {
  next(): Promise<void>;
  close(): void;
}

/**
 * Yields through a macrotask, so the browser can paint and handle input
 * between slices. A MessageChannel round trip is not clamped the way nested
 * `setTimeout(0)` calls are (browsers raise those to 4 ms after a few); where
 * there is none, `setTimeout(0)` does. One channel serves a whole run, opened
 * at the first yield and closed by `close()`.
 */
export function createYielder(): Yielder {
  if (typeof MessageChannel === 'undefined') {
    return { next: () => new Promise((resolve) => setTimeout(resolve, 0)), close: () => undefined };
  }
  let channel: MessageChannel | undefined;
  let wake: (() => void) | undefined;
  return {
    next() {
      return new Promise((resolve) => {
        if (channel === undefined) {
          const opened = new MessageChannel();
          opened.port1.onmessage = () => {
            const resume = wake;
            wake = undefined;
            resume?.();
          };
          channel = opened;
        }
        wake = resolve;
        channel.port2.postMessage(null);
      });
    },
    close() {
      channel?.port1.close();
      channel?.port2.close();
      channel = undefined;
    },
  };
}

function sliceRun(list: EngineList, sliceMs: number): Run {
  let stopped = false;
  const sealed = (async () => {
    const job = createReplayJob(list);
    const yielder = createYielder();
    try {
      while (!job.step(sliceMs)) {
        await yielder.next();
        if (stopped) throw new Error('The build was cancelled.');
      }
    } finally {
      yielder.close();
    }
    return sealSnapshot(job.snapshot());
  })();
  return {
    sealed,
    stop: () => {
      stopped = true;
    },
  };
}

/** The worker could not be started or loaded, as opposed to a replay that failed inside it. */
class WorkerUnavailable extends Error {}

/** The worker's reply as a result: the sealed text, or an error for an error reply or anything malformed. */
function readReply(reply: unknown): string | Error {
  if (typeof reply !== 'object' || reply === null) {
    return new Error('The cold build worker sent no reply object.');
  }
  const { sealed, error } = reply as Record<string, unknown>;
  if (typeof sealed === 'string') return sealed;
  return new Error(typeof error === 'string' ? error : 'The cold build worker sent a malformed reply.');
}

/** The structured clone of a list failed: a fault of that one list, not of the worker. */
function isDataCloneError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'DataCloneError'
  );
}

function workerRun(list: EngineList, timeoutMs: number): Run {
  const worker = new Worker(new URL('./coldBuild.worker.ts', import.meta.url));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const sealed = new Promise<string>((resolve, reject) => {
    // A worker that never replies is as good as one that never loaded.
    timer = setTimeout(() => {
      worker.terminate();
      reject(new WorkerUnavailable('The cold build worker did not reply in time.'));
    }, timeoutMs);
    worker.onmessage = (event: MessageEvent<unknown>) => {
      clearTimeout(timer);
      worker.terminate();
      const result = readReply(event.data);
      if (typeof result === 'string') resolve(result);
      else reject(result);
    };
    worker.onmessageerror = () => {
      clearTimeout(timer);
      worker.terminate();
      reject(new Error('The cold build worker sent a reply that could not be read.'));
    };
    worker.onerror = (event) => {
      event.preventDefault();
      clearTimeout(timer);
      worker.terminate();
      reject(new WorkerUnavailable(event.message));
    };
  });
  try {
    worker.postMessage(list);
  } catch (error) {
    clearTimeout(timer);
    worker.terminate();
    throw error;
  }
  // A replay cannot be interrupted from outside, so a cancelled one ends with its worker.
  return {
    sealed,
    stop: () => {
      clearTimeout(timer);
      worker.terminate();
    },
  };
}

/**
 * A builder from a way to start runs. Every result is opened as a stored
 * snapshot would be, so a build is checked against its list before it is
 * used, and a cancelled run's result or failure is dropped.
 */
function keyedBuilder(start: (list: EngineList) => Run, via: () => ColdBuilder['via']): ColdBuilder {
  const stops = new Map<string, Set<() => void>>();
  return {
    get via() {
      return via();
    },
    build({ key, list }) {
      if (list.events.length === 0) {
        return Promise.reject(new Error('A history with no events has nothing to build.'));
      }
      return new Promise((resolve, reject) => {
        let cancelled = false;
        const run = start(list);
        const stop = (): void => {
          cancelled = true;
          run.stop();
        };
        const forKey = stops.get(key) ?? new Set();
        forKey.add(stop);
        stops.set(key, forKey);
        const finish = (): boolean => {
          forKey.delete(stop);
          if (forKey.size === 0 && stops.get(key) === forKey) stops.delete(key);
          return !cancelled;
        };
        run.sealed.then(
          (text) => {
            if (!finish()) return;
            const snapshot = openSealed(list, text);
            if (snapshot) resolve(snapshot);
            else reject(new Error('The cold build gave a snapshot that does not open for its list.'));
          },
          (error: unknown) => {
            if (finish()) reject(error);
          },
        );
      });
    },
    cancel(key) {
      const forKey = stops.get(key);
      stops.delete(key);
      forKey?.forEach((stop) => stop());
    },
  };
}

/** Cold replay on the main thread, yielding to the browser every `sliceMs`. */
export function createSliceBuilder(sliceMs = DEFAULT_SLICE_MS): ColdBuilder {
  return keyedBuilder(
    (list) => sliceRun(list, sliceMs),
    () => 'slices',
  );
}

/** For tests: replays at once, on the calling thread. */
export function createSyncBuilder(): ColdBuilder {
  return keyedBuilder(
    (list) => {
      const job = createReplayJob(list);
      job.step(Infinity);
      return { sealed: Promise.resolve(sealSnapshot(job.snapshot())), stop: () => undefined };
    },
    () => 'sync',
  );
}

/**
 * Cold replay in a Web Worker (docs/ARCHITECTURE.md 6.11), or in main-thread slices where there
 * is no Worker, or once a worker has failed to start or load (for example a
 * page left open across a deploy, whose worker script is gone), or has gone
 * `workerTimeoutMs` without replying.
 */
export function createColdBuilder({
  workerTimeoutMs = WORKER_TIMEOUT_MS,
}: ColdBuilderOptions = {}): ColdBuilder {
  if (typeof Worker === 'undefined') return createSliceBuilder();
  let workerUsable = true;
  const start = (list: EngineList): Run => {
    if (workerUsable) {
      try {
        const run = workerRun(list, workerTimeoutMs);
        let current: Run = run;
        // A cancel can come between a load failure and its fallback; it stays final.
        let stopped = false;
        const sealed = run.sealed.catch((error: unknown) => {
          if (stopped || !(error instanceof WorkerUnavailable)) throw error;
          workerUsable = false;
          current = sliceRun(list, DEFAULT_SLICE_MS);
          return current.sealed;
        });
        return {
          sealed,
          stop: () => {
            stopped = true;
            current.stop();
          },
        };
      } catch (error) {
        // Only this list failed to clone; the next build can still use a worker.
        if (!isDataCloneError(error)) workerUsable = false;
      }
    }
    return sliceRun(list, DEFAULT_SLICE_MS);
  };
  return keyedBuilder(start, () => (workerUsable ? 'worker' : 'slices'));
}
