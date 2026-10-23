import { type ColdBuilder, createSyncBuilder } from '@/lib/engine/coldBuild';
import { createEngineCache } from '@/lib/engine/engineCache';
import type * as EngineHostModule from '@/lib/engine/engineHost';
import type { EngineSnapshot } from '@/lib/ranking/bt/snapshot';

/**
 * For `vi.mock('@/lib/engine/engineHost', ...)` in screen tests: the module
 * with its app-wide host swapped for one that builds through `builder` (a
 * sync build by default) and caches nothing. The app-wide list store and
 * `useEngineView` then both use it.
 *
 *     vi.mock('@/lib/engine/engineHost', async (importOriginal) => {
 *       const { engineHostModule } = await import('@/tests/helpers/engineHost');
 *       return engineHostModule(await importOriginal());
 *     });
 */
export function engineHostModule(
  actual: typeof EngineHostModule,
  builder: ColdBuilder = createSyncBuilder(),
): typeof EngineHostModule {
  const host = actual.createEngineHost({ builder, cache: createEngineCache(null) });
  function useEngineView() {
    return actual.useEngineView(host);
  }
  return { ...actual, engineHost: host, useEngineView };
}

/** Cold builds that wait for the test: `release()` finishes every build started so far. */
export interface HeldBuilds {
  builder: ColdBuilder;
  /** Builds started and not yet released. */
  readonly pending: number;
  release(): void;
}

export function heldBuilds(): HeldBuilds {
  const inner = createSyncBuilder();
  let waiting: (() => void)[] = [];
  return {
    builder: {
      via: 'sync',
      build(request) {
        return new Promise<EngineSnapshot>((resolve, reject) => {
          waiting.push(() => inner.build(request).then(resolve, reject));
        });
      },
      cancel: () => undefined,
    },
    get pending() {
      return waiting.length;
    },
    release() {
      const now = waiting;
      waiting = [];
      now.forEach((finish) => finish());
    },
  };
}
