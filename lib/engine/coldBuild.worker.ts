/**
 * The cold builder's worker: replays a list from the priors and posts back
 * the sealed snapshot. The main thread opens it like any stored snapshot, so
 * nothing from here is trusted without the same checks.
 */
import type { ColdBuildReply } from '@/lib/engine/coldBuild';
import { createReplayJob } from '@/lib/ranking/bt/engine';
import { sealSnapshot } from '@/lib/ranking/bt/sealed';
import type { EngineList } from '@/types/rankingEvents';

/** The parts of the worker's global scope used here; the project's types are the DOM's, not a worker's. */
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<EngineList>) => void) | null;
  postMessage(reply: ColdBuildReply): void;
};

scope.onmessage = (event) => {
  let reply: ColdBuildReply;
  try {
    const job = createReplayJob(event.data);
    job.step(Infinity);
    reply = { sealed: sealSnapshot(job.snapshot()) };
  } catch (error) {
    reply = { error: error instanceof Error ? error.message : String(error) };
  }
  scope.postMessage(reply);
};
