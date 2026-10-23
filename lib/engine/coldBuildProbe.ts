import { createColdBuilder } from '@/lib/engine/coldBuild';
import { replay } from '@/lib/ranking/bt/engine';
import type { EngineList } from '@/types/rankingEvents';

/** What the probe reports: where the build ran, what it covered, and the ranking it restores to. */
export interface ColdBuildProbeResult {
  via: 'worker' | 'slices' | 'sync';
  coveredEvents: number;
  ranked: string[];
}

declare global {
  interface Window {
    __pairwiseColdBuild?: (list: EngineList) => Promise<ColdBuildProbeResult>;
  }
}

/**
 * For the end-to-end tests: lets them run a cold build in the exported site,
 * where only the real bundle shows whether the worker was bundled and loads.
 * Installed only when the page is opened with `?e2e-hooks`, so an ordinary
 * visit carries no test hook.
 */
export function installColdBuildProbe(): void {
  if (typeof window === 'undefined' || !window.location.search.includes('e2e-hooks')) return;
  window.__pairwiseColdBuild = async (list) => {
    const builder = createColdBuilder();
    const snapshot = await builder.build({ key: 'probe', list });
    return {
      via: builder.via,
      coveredEvents: snapshot.eventIds.length,
      ranked: replay(list, { snapshot }).ranked,
    };
  };
}
