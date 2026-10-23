import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type ColdBuilder,
  createColdBuilder,
  createSliceBuilder,
  createSyncBuilder,
  WORKER_TIMEOUT_MS,
} from '@/lib/engine/coldBuild';
import { createReplayJob, type EngineState, replay, replayWithStats } from '@/lib/ranking/bt/engine';
import { sealSnapshot } from '@/lib/ranking/bt/sealed';
import type { EngineSnapshot } from '@/lib/ranking/bt/snapshot';
import { benchmarkCorpus, drivenHistory } from '@/tests/helpers/engineCorpus';
import type { UserModel } from '@/tests/helpers/simUser';
import type { EngineList, StartingOrder } from '@/types/rankingEvents';

const STARTS: StartingOrder[] = ['unordered', 'rough', 'ranked'];
const USERS: UserModel[] = ['careful', 'typical', 'fuzzy', 'sloppy'];

/** Driven histories with every kind of event, some ending in a drag so the snapshot carries its earlier prior. */
const histories: { name: string; list: EngineList }[] = [1, 2, 3, 4].map((seed) => {
  const list = drivenHistory({
    n: 12 + seed * 6,
    events: 60 + seed * 25,
    seed,
    user: USERS[seed % USERS.length] as UserModel,
    startingOrder: STARTS[seed % STARTS.length] as StartingOrder,
    mix: { placement: 0.1 },
  });
  if (seed % 2 === 0) return { name: `driven-${seed}`, list };
  const lastDrag = list.events.findLastIndex((event) => event.kind === 'placement');
  return {
    name: `driven-${seed}-ending-in-a-drag`,
    list: { ...list, events: list.events.slice(0, lastDrag + 1) },
  };
});

/** Same displayed order and questions, strengths within 1e-9. */
function expectSameState(actual: EngineState, expected: EngineState): void {
  expect(actual.ranked).toEqual(expected.ranked);
  expect(actual.unrecognized).toEqual(expected.unrecognized);
  expect(actual.nextPair).toEqual(expected.nextPair);
  expect([...actual.strengths.keys()]).toEqual([...expected.strengths.keys()]);
  for (const [item, s] of expected.strengths) expect(actual.strengths.get(item)).toBeCloseTo(s, 9);
  expect(actual.priorSource).toEqual(expected.priorSource);
}

/** The snapshot covers the whole history and a replay started from it equals a fresh one. */
function expectRestoresToReplay(list: EngineList, snapshot: EngineSnapshot): void {
  const started = replayWithStats(list, { snapshot });
  expect(started.fromEvent).toBe(list.events.length);
  expectSameState(started.state, replay(list));
}

/** Settles to 'pending' if the promise has not settled within `ms`. */
function settledWithin(promise: Promise<unknown>, ms: number): Promise<string> {
  return Promise.race([
    promise.then(
      () => 'resolved',
      () => 'rejected',
    ),
    new Promise<string>((resolve) => setTimeout(() => resolve('pending'), ms)),
  ]);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createReplayJob', () => {
  it.each(histories)('its snapshot restores to a state equal to replay ($name)', ({ list }) => {
    const job = createReplayJob(list);
    while (!job.step(1));
    expectRestoresToReplay(list, job.snapshot());
  });

  it('gives the same snapshot whatever the budget, so it is the cold replay itself', () => {
    const { list } = histories[2] as { list: EngineList };
    const snapshots = [0, 0.5, Infinity].map((budget) => {
      const job = createReplayJob(list);
      while (!job.step(budget));
      return job.snapshot();
    });
    expect(snapshots[0]).toEqual(snapshots[2]);
    expect(snapshots[1]).toEqual(snapshots[2]);
  });

  it('a zero budget does one unit of work: each event, then the final fit', () => {
    const { list } = histories[0] as { list: EngineList };
    const job = createReplayJob(list);
    let steps = 1;
    while (!job.step(0)) steps++;
    expect(steps).toBe(list.events.length + 1);
  });

  it.each(histories)('its state equals replay ($name)', ({ list }) => {
    const job = createReplayJob(list);
    expect(() => job.state()).toThrow();
    while (!job.step(1));
    expectSameState(job.state(), replay(list));
  });

  it('has no snapshot before it is done', () => {
    const { list } = histories[0] as { list: EngineList };
    const job = createReplayJob(list);
    job.step(0);
    expect(() => job.snapshot()).toThrow();
  });
});

const builders: [string, () => ColdBuilder][] = [
  ['sync', () => createSyncBuilder()],
  // Slices short enough that these builds take several.
  ['slice', () => createSliceBuilder(0.5)],
  // Node has no Worker, so the cold builder is the slice builder here.
  ['cold', () => createColdBuilder()],
];

describe.each(builders)('the %s builder', (_name, make) => {
  it.each(histories)(
    'the built snapshot restores to a state equal to replay ($name)',
    async ({ name, list }) => {
      const snapshot = await make().build({ key: `${name}:${list.events.length}`, list });
      expectRestoresToReplay(list, snapshot);
    },
  );

  it('rejects a history with no events', async () => {
    const list: EngineList = { originalItemIds: ['a', 'b'], startingOrder: 'unordered', events: [] };
    await expect(make().build({ key: 'empty:0', list })).rejects.toThrow();
  });
});

it('the cold builder falls back to slices where there is no Worker', () => {
  expect(typeof Worker).toBe('undefined');
  expect(createColdBuilder().via).toBe('slices');
});

describe('the slice builder', () => {
  const { list } = histories[3] as { list: EngineList };

  it('cancel stops a slice build and its promise never resolves', async () => {
    const builder = createSliceBuilder(0.1);
    const key = `cancelled:${list.events.length}`;
    const realNow = performance.now.bind(performance);
    // Cancel a few clock readings in (after the build call returns), so it is stopped part way however fast the yields are.
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => {
      if (clock.mock.calls.length === 5) queueMicrotask(() => builder.cancel(key));
      return realNow();
    });
    const build = builder.build({ key, list });
    // The step that was running ends and its yield returns, and no more work follows.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const callsAtCancel = clock.mock.calls.length;
    expect(callsAtCancel).toBeGreaterThanOrEqual(5);
    // A whole build of this history takes well under this.
    expect(await settledWithin(build, 1000)).toBe('pending');
    expect(clock.mock.calls.length, 'no work after cancel').toBe(callsAtCancel);
    clock.mockRestore();
    // The key can be built again afterwards.
    expectRestoresToReplay(list, await builder.build({ key, list }));
  });

  it('cancel leaves builds under other keys running', async () => {
    const builder = createSliceBuilder(0.1);
    const other = builder.build({ key: 'other', list });
    builder.build({ key: 'cancelled', list }).catch(() => undefined);
    builder.cancel('cancelled');
    expectRestoresToReplay(list, await other);
  });

  it('slices yield: a realistic history takes at least 50 steps, none over budget by more than one event', () => {
    const realistic = benchmarkCorpus().find((history) => history.name === 'placements-realistic');
    if (realistic === undefined) throw new Error('placements-realistic is missing from the corpus');
    const { list: big } = realistic;
    const budget = 12;

    // Every clock reading the job takes, so each step is judged by its own readings in the same pass
    // rather than against timings from another one.
    const readings: number[] = [];
    const realNow = performance.now.bind(performance);
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => {
      const now = realNow();
      readings.push(now);
      return now;
    });

    const job = createReplayJob(big);
    let steps = 0;
    try {
      for (let done = false; !done;) {
        readings.length = 0;
        done = job.step(budget);
        steps++;
        // The first reading is the step's start and the rest follow each unit (an event, or the final fit).
        const [start, ...checks] = readings as [number, ...number[]];
        // The step stops at the first check past the budget, so every check before the last is under it:
        // the step overran by at most the one unit that ended it.
        for (const check of checks.slice(0, -1)) expect(check - start).toBeLessThan(budget);
        if (!done) expect(checks.at(-1)! - start).toBeGreaterThanOrEqual(budget);
      }
    } finally {
      clock.mockRestore();
    }
    expect(steps).toBeGreaterThanOrEqual(50);
  }, 120_000);
});

describe('the slice builder yields between slices', () => {
  const { list } = histories[3] as { list: EngineList };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Replaces MessageChannel with one that records each channel and whether its ports were closed. */
  function trackChannels(): { channel: MessageChannel; closed: () => boolean }[] {
    const RealChannel = MessageChannel;
    const made: { channel: MessageChannel; closed: () => boolean }[] = [];
    vi.stubGlobal(
      'MessageChannel',
      class extends RealChannel {
        constructor() {
          super();
          let closes = 0;
          for (const port of [this.port1, this.port2]) {
            const close = port.close.bind(port);
            port.close = () => {
              closes++;
              close();
            };
          }
          made.push({ channel: this, closed: () => closes >= 2 });
        }
      },
    );
    return made;
  }

  it('through a MessageChannel, without touching setTimeout', async () => {
    const made = trackChannels();
    const timer = vi.fn(() => {
      throw new Error('setTimeout is not available to the slice path.');
    });
    vi.stubGlobal('setTimeout', timer);
    const builder = createSliceBuilder(0.1);
    const clock = vi.spyOn(performance, 'now');
    const snapshot = await builder.build({ key: 'a', list });
    // The build took several slices, so it did yield.
    expect(clock.mock.calls.length).toBeGreaterThan(list.events.length);
    expect(timer).not.toHaveBeenCalled();
    expectRestoresToReplay(list, snapshot);
    // One channel for the whole run, closed once it is done.
    expect(made).toHaveLength(1);
    expect(made[0]?.closed()).toBe(true);
  });

  it('closes its channel when the build is cancelled', async () => {
    const made = trackChannels();
    const builder = createSliceBuilder(0.1);
    const build = builder.build({ key: 'a', list });
    build.catch(() => undefined);
    builder.cancel('a');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(made).toHaveLength(1);
    expect(made[0]?.closed()).toBe(true);
  });

  it('falls back to setTimeout where there is no MessageChannel', async () => {
    vi.stubGlobal('MessageChannel', undefined);
    const timer = vi.spyOn(globalThis, 'setTimeout');
    const snapshot = await createSliceBuilder(0.1).build({ key: 'a', list });
    expect(timer.mock.calls.filter(([, delay]) => delay === 0).length).toBeGreaterThan(0);
    expectRestoresToReplay(list, snapshot);
  });
});

/** A Worker the test drives by hand: it records what it was sent and replies only when told to. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  static throwOnPost = false;
  static postError: Error | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onmessageerror: ((event: unknown) => void) | null = null;
  onerror: ((event: { message: string; preventDefault(): void }) => void) | null = null;
  posted: unknown[] = [];
  terminated = false;

  constructor(readonly url: URL) {
    FakeWorker.instances.push(this);
  }

  postMessage(data: unknown): void {
    if (FakeWorker.postError !== null) throw FakeWorker.postError;
    if (FakeWorker.throwOnPost) throw new Error('The list could not be cloned.');
    this.posted.push(data);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** Delivered even after terminate, as a reply already queued would be. */
  reply(data: unknown): void {
    this.onmessage?.({ data });
  }

  fail(message = 'The worker script failed to load.'): void {
    this.onerror?.({ message, preventDefault: () => undefined });
  }
}

/** The sealed text a worker would post back for `list`. */
function sealedFor(list: EngineList): string {
  const job = createReplayJob(list);
  job.step(Infinity);
  return sealSnapshot(job.snapshot());
}

describe('the cold builder with a Worker', () => {
  const { list } = histories[0] as { list: EngineList };
  const { list: other } = histories[1] as { list: EngineList };

  function workerAt(index: number): FakeWorker {
    const worker = FakeWorker.instances[index];
    if (worker === undefined) throw new Error(`No worker ${index} was started.`);
    return worker;
  }

  beforeEach(() => {
    FakeWorker.instances = [];
    FakeWorker.throwOnPost = false;
    FakeWorker.postError = null;
    vi.stubGlobal('Worker', FakeWorker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the list to a worker and resolves with the snapshot it sends back', async () => {
    const builder = createColdBuilder();
    expect(builder.via).toBe('worker');
    const build = builder.build({ key: 'a', list });
    const worker = workerAt(0);
    expect(worker.posted).toEqual([list]);
    worker.reply({ sealed: sealedFor(list) });
    expectRestoresToReplay(list, await build);
    expect(worker.terminated).toBe(true);
  });

  it('an { error } reply rejects, and the builder keeps using workers', async () => {
    const builder = createColdBuilder();
    const build = builder.build({ key: 'a', list });
    workerAt(0).reply({ error: 'The replay failed.' });
    await expect(build).rejects.toThrow('The replay failed.');
    expect(builder.via).toBe('worker');
  });

  it.each([null, 'sealed', 42, {}, { sealed: 7 }])('a malformed reply (%j) rejects', async (reply) => {
    const build = createColdBuilder().build({ key: 'a', list });
    workerAt(0).reply(reply);
    await expect(build).rejects.toThrow();
  });

  it('a reply that cannot be deserialized rejects', async () => {
    const build = createColdBuilder().build({ key: 'a', list });
    const worker = workerAt(0);
    worker.onmessageerror?.({});
    await expect(build).rejects.toThrow();
    expect(worker.terminated).toBe(true);
  });

  it('an error event falls back to slices, for this build and the next', async () => {
    const builder = createColdBuilder();
    const build = builder.build({ key: 'a', list });
    workerAt(0).fail();
    expectRestoresToReplay(list, await build);
    expect(builder.via).toBe('slices');
    expectRestoresToReplay(other, await builder.build({ key: 'b', list: other }));
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it('a postMessage that throws terminates the worker and falls back to slices', async () => {
    FakeWorker.throwOnPost = true;
    const builder = createColdBuilder();
    const build = builder.build({ key: 'a', list });
    expect(workerAt(0).terminated).toBe(true);
    expectRestoresToReplay(list, await build);
    expect(builder.via).toBe('slices');
  });

  it('a cancel followed by a late message is dropped', async () => {
    const builder = createColdBuilder();
    const build = builder.build({ key: 'a', list });
    const worker = workerAt(0);
    builder.cancel('a');
    expect(worker.terminated).toBe(true);
    worker.reply({ sealed: sealedFor(list) });
    expect(await settledWithin(build, 50)).toBe('pending');
  });

  it('two concurrent builds each get their own reply', async () => {
    const builder = createColdBuilder();
    const first = builder.build({ key: 'a', list });
    const second = builder.build({ key: 'b', list: other });
    workerAt(1).reply({ sealed: sealedFor(other) });
    workerAt(0).reply({ sealed: sealedFor(list) });
    expectRestoresToReplay(list, await first);
    expectRestoresToReplay(other, await second);
  });

  it('a cancel racing a queued load failure neither falls back nor stops using workers', async () => {
    const builder = createColdBuilder();
    const build = builder.build({ key: 'a', list });
    const clock = vi.spyOn(performance, 'now');
    // The failure rejects at once; its fallback would run on the next microtask, after this cancel.
    workerAt(0).fail();
    builder.cancel('a');
    expect(await settledWithin(build, 50)).toBe('pending');
    expect(clock, 'no slice replay started').not.toHaveBeenCalled();
    expect(builder.via).toBe('worker');
  });

  describe('a worker that never replies', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('defaults to a 60 second stall timeout', () => {
      expect(WORKER_TIMEOUT_MS).toBe(60_000);
    });

    it('is terminated at the timeout, and the build falls back to slices and turns workers off', async () => {
      const builder = createColdBuilder({ workerTimeoutMs: 1000 });
      const build = builder.build({ key: 'a', list });
      const worker = workerAt(0);
      await vi.advanceTimersByTimeAsync(999);
      expect(worker.terminated).toBe(false);
      expect(builder.via).toBe('worker');
      await vi.advanceTimersByTimeAsync(1);
      expect(worker.terminated).toBe(true);
      expect(builder.via).toBe('slices');
      // The slice fallback needs a clock only if it falls back to setTimeout; MessageChannel needs none.
      expectRestoresToReplay(list, await build);
      expectRestoresToReplay(other, await builder.build({ key: 'b', list: other }));
      expect(FakeWorker.instances).toHaveLength(1);
    });

    it('uses the default timeout when none is given', async () => {
      const builder = createColdBuilder();
      const build = builder.build({ key: 'a', list });
      const worker = workerAt(0);
      await vi.advanceTimersByTimeAsync(WORKER_TIMEOUT_MS - 1);
      expect(worker.terminated).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(worker.terminated).toBe(true);
      expectRestoresToReplay(list, await build);
    });

    it('a reply before the timeout clears the timer, so nothing is terminated twice or turned off', async () => {
      const builder = createColdBuilder({ workerTimeoutMs: 1000 });
      const build = builder.build({ key: 'a', list });
      workerAt(0).reply({ sealed: sealedFor(list) });
      expectRestoresToReplay(list, await build);
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(5000);
      expect(builder.via).toBe('worker');
    });

    it('a late reply after the timeout is dropped and the build resolves once, from the slices', async () => {
      const builder = createColdBuilder({ workerTimeoutMs: 1000 });
      const settled = vi.fn();
      const build = builder.build({ key: 'a', list }).then(settled);
      const worker = workerAt(0);
      await vi.advanceTimersByTimeAsync(1000);
      worker.reply({ sealed: sealedFor(other) });
      await build;
      expect(settled).toHaveBeenCalledTimes(1);
      expect(builder.via).toBe('slices');
    });

    it('a cancel before the timeout clears the timer and stays final', async () => {
      const builder = createColdBuilder({ workerTimeoutMs: 1000 });
      const settled = vi.fn();
      builder.build({ key: 'a', list }).then(settled, settled);
      const worker = workerAt(0);
      builder.cancel('a');
      expect(worker.terminated).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(5000);
      expect(settled).not.toHaveBeenCalled();
      expect(builder.via).toBe('worker');
    });

    it('a cancel racing the timeout neither falls back nor turns workers off', async () => {
      const builder = createColdBuilder({ workerTimeoutMs: 1000 });
      const settled = vi.fn();
      builder.build({ key: 'a', list }).then(settled, settled);
      const clock = vi.spyOn(performance, 'now');
      vi.advanceTimersByTime(1000);
      builder.cancel('a');
      await vi.advanceTimersByTimeAsync(10);
      expect(clock, 'no slice replay started').not.toHaveBeenCalled();
      expect(builder.via).toBe('worker');
      expect(settled).not.toHaveBeenCalled();
    });
  });

  describe('a list that cannot be cloned', () => {
    it('terminates the worker and builds that list in slices, but the next build still uses a worker', async () => {
      FakeWorker.postError = new DOMException('The list could not be cloned.', 'DataCloneError');
      const builder = createColdBuilder();
      const build = builder.build({ key: 'a', list });
      expect(workerAt(0).terminated).toBe(true);
      expectRestoresToReplay(list, await build);
      expect(builder.via).toBe('worker');

      FakeWorker.postError = null;
      const next = builder.build({ key: 'b', list: other });
      expect(FakeWorker.instances).toHaveLength(2);
      workerAt(1).reply({ sealed: sealedFor(other) });
      expectRestoresToReplay(other, await next);
      expect(builder.via).toBe('worker');
    });

    it('recognizes the error by name, so a fake that is not a DOMException counts too', async () => {
      FakeWorker.postError = Object.assign(new Error('clone'), { name: 'DataCloneError' });
      const builder = createColdBuilder();
      expectRestoresToReplay(list, await builder.build({ key: 'a', list }));
      expect(builder.via).toBe('worker');
    });

    it('any other postMessage error still turns workers off', async () => {
      FakeWorker.postError = new DOMException('Not allowed.', 'SecurityError');
      const builder = createColdBuilder();
      expectRestoresToReplay(list, await builder.build({ key: 'a', list }));
      expect(builder.via).toBe('slices');
    });

    it('a Worker that cannot be constructed turns workers off', async () => {
      vi.stubGlobal(
        'Worker',
        class {
          constructor() {
            throw new Error('No worker for you.');
          }
        },
      );
      const builder = createColdBuilder();
      expectRestoresToReplay(list, await builder.build({ key: 'a', list }));
      expect(builder.via).toBe('slices');
    });
  });
});
