import { SOLVER_TOLERANCE } from '@/lib/ranking/bt/constants';
import {
  compile,
  type CompiledProblem,
  type Curvature,
  evaluate,
  hessianTimesCached,
  type Problem,
} from '@/lib/ranking/bt/objective';

export interface SolveResult {
  iterations: number;
  converged: boolean;
  /**
   * With wantDiagonal: the negative Hessian diagonal at the returned strengths,
   * indexed by slot (0 at fixed slots), so u_i = 1 / diagonal[i] (docs/ARCHITECTURE.md 6.1).
   * Absent when the solve stopped on a non-finite value.
   */
  diagonal?: Float64Array;
}

export interface SolveOptions {
  maxIterations?: number;
  onIteration?: (value: number) => void;
  /** Hand back the curvature diagonal at the result, which the solve has mostly computed already. */
  wantDiagonal?: boolean;
}

/** Converged once no Newton step moves a strength by this much: a tenth of the strength error target. */
const STEP_TOLERANCE = SOLVER_TOLERANCE / 10;
/**
 * About twice the most any benchmark corpus solve needs: 51 iterations, for a
 * session build of the `edits` history, which a cap of 50 missed.
 */
const DEFAULT_MAX_ITERATIONS = 100;
/** Backtracking gives up below this step fraction: no representable increase is left. */
const MIN_STEP_FRACTION = 1e-10;
/**
 * CG stops once the preconditioned residual, its estimate of the error left in
 * the step, is below this everywhere: a tenth of STEP_TOLERANCE.
 */
const STEP_ERROR = STEP_TOLERANCE / 10;
/** Target number of coarse blocks in the preconditioner. */
const COARSE_BLOCKS = 64;
/**
 * Steps smaller than this keep the current curvature. The Hessian then lags by
 * a relative amount of about the step size, so each Newton step still gains
 * about that many digits, without the cost of rebuilding the curvature.
 */
const CURVATURE_REUSE_STEP = 1e-3;
/** The coarse preconditioner is rebuilt once strengths have moved this far since it was built. */
const COARSE_REBUILD_DISTANCE = 1;

/** Scratch for solves, indexed by slot unless noted. Entries at fixed slots stay 0. */
interface Workspace {
  size: number;
  grad: Float64Array;
  trialGrad: Float64Array;
  step: Float64Array;
  residual: Float64Array;
  precond: Float64Array;
  search: Float64Array;
  product: Float64Array;
  trial: Float64Array;
  diagonal: Float64Array;
  /** The last solve's compiled problem, whose memory the next compile recycles. */
  compiled: CompiledProblem | undefined;
  /** Curvature weights per CSR entry; grown to the largest problem seen. */
  weight: Float64Array;
  /** Free slots in strength order; the coarse block of each slot. */
  order: Int32Array;
  block: Int32Array;
  /** Cholesky factor (row-major, lower) of the coarse matrix, and a coarse vector. */
  coarse: Float64Array;
  coarseVector: Float64Array;
  /** Conjugate gradient state between startStep and continueStep calls. */
  cg: { rz: number; residualNorm: number; target: number; largestEstimate: number };
}

function workspace(size: number): Workspace {
  return {
    size,
    grad: new Float64Array(size),
    trialGrad: new Float64Array(size),
    step: new Float64Array(size),
    residual: new Float64Array(size),
    precond: new Float64Array(size),
    search: new Float64Array(size),
    product: new Float64Array(size),
    trial: new Float64Array(size),
    diagonal: new Float64Array(size),
    compiled: undefined,
    weight: new Float64Array(0),
    order: new Int32Array(size),
    block: new Int32Array(size),
    coarse: new Float64Array(0),
    coarseVector: new Float64Array(0),
    cg: { rz: 0, residualNorm: 0, target: 0, largestEstimate: 0 },
  };
}

/**
 * One workspace kept between solves, so a warm re-solve allocates little. Every
 * buffer is written before it is read, so results never depend on it.
 */
let cached: Workspace | undefined;
let cachedBusy = false;

/**
 * Builds the coarse half of the preconditioner. Free slots are sorted by
 * strength and cut into about COARSE_BLOCKS runs; the coarse matrix is the
 * Hessian summed over those runs, solved exactly. Comparisons couple items of
 * similar strength, so the slow modes left by a diagonal preconditioner are
 * smooth in strength order, which is what block sums capture. Returns the
 * number of blocks, or 0 if the coarse matrix could not be factored.
 */
function buildCoarse(cp: CompiledProblem, s: Float64Array, c: Curvature, w: Workspace): number {
  const free = cp.problem.free;
  const n = free.length;
  const order = w.order.subarray(0, n);
  order.set(free);
  order.sort((a, b) => (s[a] as number) - (s[b] as number) || a - b);
  const blockSize = Math.max(1, Math.ceil(n / COARSE_BLOCKS));
  const blocks = Math.ceil(n / blockSize);
  const block = w.block;
  for (let rank = 0; rank < n; rank++) block[order[rank] as number] = Math.floor(rank / blockSize);
  if (w.coarse.length < blocks * blocks) {
    w.coarse = new Float64Array(blocks * blocks);
    w.coarseVector = new Float64Array(blocks);
  }
  const a = w.coarse;
  a.fill(0, 0, blocks * blocks);
  const { rowStart, column } = cp;
  const { diagonal, weight } = c;
  for (let i = 0; i < n; i++) {
    const slot = free[i] as number;
    const own = block[slot] as number;
    const row = own * blocks;
    a[row + own] = (a[row + own] as number) + (diagonal[slot] as number);
    const end = rowStart[slot + 1] as number;
    for (let k = rowStart[slot] as number; k < end; k++) {
      const entry = row + (block[column[k] as number] as number);
      a[entry] = (a[entry] as number) - (weight[k] as number);
    }
  }
  // In-place Cholesky: the lower triangle becomes L with A = L L^T.
  for (let j = 0; j < blocks; j++) {
    let pivot = a[j * blocks + j] as number;
    for (let k = 0; k < j; k++) pivot -= (a[j * blocks + k] as number) * (a[j * blocks + k] as number);
    if (!(pivot > 0)) return 0;
    const root = Math.sqrt(pivot);
    a[j * blocks + j] = root;
    for (let i = j + 1; i < blocks; i++) {
      let sum = a[i * blocks + j] as number;
      for (let k = 0; k < j; k++) sum -= (a[i * blocks + k] as number) * (a[j * blocks + k] as number);
      a[i * blocks + j] = sum / root;
    }
  }
  return blocks;
}

/** precond = M^-1 residual: Jacobi plus the coarse correction, over free slots. */
function precondition(free: Int32Array, c: Curvature, w: Workspace, blocks: number): void {
  const { residual, precond, block, coarse, coarseVector } = w;
  const diagonal = c.diagonal;
  for (let i = 0; i < free.length; i++) {
    const slot = free[i] as number;
    precond[slot] = (residual[slot] as number) / (diagonal[slot] as number);
  }
  if (blocks === 0) return;
  coarseVector.fill(0, 0, blocks);
  for (let i = 0; i < free.length; i++) {
    const slot = free[i] as number;
    const b = block[slot] as number;
    coarseVector[b] = (coarseVector[b] as number) + (residual[slot] as number);
  }
  for (let i = 0; i < blocks; i++) {
    let sum = coarseVector[i] as number;
    for (let k = 0; k < i; k++) sum -= (coarse[i * blocks + k] as number) * (coarseVector[k] as number);
    coarseVector[i] = sum / (coarse[i * blocks + i] as number);
  }
  for (let i = blocks - 1; i >= 0; i--) {
    let sum = coarseVector[i] as number;
    for (let k = i + 1; k < blocks; k++)
      sum -= (coarse[k * blocks + i] as number) * (coarseVector[k] as number);
    coarseVector[i] = sum / (coarse[i * blocks + i] as number);
  }
  for (let i = 0; i < free.length; i++) {
    const slot = free[i] as number;
    precond[slot] = (precond[slot] as number) + (coarseVector[block[slot] as number] as number);
  }
}

/**
 * Starts solving H step = grad by preconditioned conjugate gradient over free
 * slots, from step = 0. H is positive definite (every free slot has a proper
 * prior), so CG is well defined. continueStep runs the iterations; the state
 * between calls lives in the workspace, so a step can be refined further.
 */
function startStep(free: Int32Array, c: Curvature, w: Workspace, blocks: number): void {
  const { grad, step, residual, precond, search } = w;
  let gradNorm2 = 0;
  for (let i = 0; i < free.length; i++) {
    const slot = free[i] as number;
    const g = grad[slot] as number;
    gradNorm2 += g * g;
    step[slot] = 0;
    residual[slot] = g;
  }
  const gradNorm = Math.sqrt(gradNorm2);
  precondition(free, c, w, blocks);
  let rz = 0;
  let largestEstimate = 0;
  for (let i = 0; i < free.length; i++) {
    const slot = free[i] as number;
    const z = precond[slot] as number;
    search[slot] = z;
    rz += (residual[slot] as number) * z;
    largestEstimate = Math.max(largestEstimate, Math.abs(z));
  }
  w.cg = { rz, residualNorm: gradNorm, target: gradNorm * Math.min(0.1, gradNorm), largestEstimate };
}

/**
 * Runs CG iterations on the step begun by startStep. Returns true once the step
 * is certified: H's smallest eigenvalue is at least the smallest prior
 * precision, so a residual r leaves an error of at most |r| times the largest
 * prior variance, and certifiedResidual makes that at most STEP_TOLERANCE.
 *
 * Uncertified, CG stops early, which is all a Newton step on the way needs:
 * when the residual is a small fraction of the gradient (a fraction that
 * shrinks with the gradient, keeping Newton superlinear), or when the
 * preconditioned residual, CG's own estimate of the error left in the step, is
 * under STEP_ERROR everywhere. That estimate trusts the preconditioner, which
 * can understate the error a hundredfold on stiff chains of comparisons, so
 * convergence is only ever declared on a certified step.
 */
function continueStep(
  free: Int32Array,
  c: Curvature,
  w: Workspace,
  blocks: number,
  certifiedResidual: number,
  certify: boolean,
): boolean {
  const { step, residual, precond, search, product } = w;
  const state = w.cg;
  const maxIterations = 2 * free.length + 10;
  for (let k = 0; ; k++) {
    if (state.residualNorm <= certifiedResidual) return true;
    if (!certify && (state.residualNorm <= state.target || state.largestEstimate <= STEP_ERROR)) return false;
    if (k === maxIterations) return false;
    hessianTimesCached(c, search, product);
    let curvature = 0;
    for (let i = 0; i < free.length; i++) {
      const slot = free[i] as number;
      curvature += (search[slot] as number) * (product[slot] as number);
    }
    if (!(curvature > 0)) return false;
    const alpha = state.rz / curvature;
    let residualNorm2 = 0;
    for (let i = 0; i < free.length; i++) {
      const slot = free[i] as number;
      step[slot] = (step[slot] as number) + alpha * (search[slot] as number);
      const r = (residual[slot] as number) - alpha * (product[slot] as number);
      residual[slot] = r;
      residualNorm2 += r * r;
    }
    precondition(free, c, w, blocks);
    let rzNext = 0;
    let largestEstimate = 0;
    for (let i = 0; i < free.length; i++) {
      const slot = free[i] as number;
      const z = precond[slot] as number;
      rzNext += (residual[slot] as number) * z;
      largestEstimate = Math.max(largestEstimate, Math.abs(z));
    }
    const beta = rzNext / state.rz;
    for (let i = 0; i < free.length; i++) {
      const slot = free[i] as number;
      search[slot] = (precond[slot] as number) + beta * (search[slot] as number);
    }
    state.rz = rzNext;
    state.residualNorm = Math.sqrt(residualNorm2);
    state.largestEstimate = largestEstimate;
  }
}

/** The largest |step_i| over free slots, and grad . step. */
function measureStep(free: Int32Array, w: Workspace): { largest: number; slope: number } {
  let largest = 0;
  let slope = 0;
  for (let i = 0; i < free.length; i++) {
    const slot = free[i] as number;
    const d = w.step[slot] as number;
    // NaN must not be lost to Math.max: it fails the stopping test and the line search.
    largest = Number.isNaN(d) ? NaN : Math.max(largest, Math.abs(d));
    slope += (w.grad[slot] as number) * d;
  }
  return { largest, slope };
}

function allFinite(a: Float64Array, free: Int32Array): boolean {
  for (let i = 0; i < free.length; i++) if (!Number.isFinite(a[free[i] as number])) return false;
  return true;
}

/**
 * Maximizes value in place, warm-starting from s (docs/ARCHITECTURE.md 6.5): damped Newton with
 * preconditioned CG inner solves and a backtracking line search, so the
 * objective never decreases. Stops once the largest Newton step is under
 * STEP_TOLERANCE, or when no uphill step is left at machine precision. Only
 * free slots of s are written. A non-finite value or gradient stops the solve
 * unconverged.
 */
export function solve(p: Problem, s: Float64Array, options: SolveOptions = {}): SolveResult {
  // A solve started from onIteration gets its own workspace.
  if (cachedBusy) return run(p, s, workspace(s.length), options);
  if (cached?.size !== s.length) cached = workspace(s.length);
  cachedBusy = true;
  try {
    return run(p, s, cached, options);
  } finally {
    cachedBusy = false;
  }
}

function run(p: Problem, s: Float64Array, w: Workspace, options: SolveOptions): SolveResult {
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const free = p.free;
  let largestVar = 0;
  for (let i = 0; i < free.length; i++)
    largestVar = Math.max(largestVar, p.priorVar[free[i] as number] as number);
  const certifiedResidual = STEP_TOLERANCE / largestVar;

  const cp = compile(p, s.length, w.compiled);
  w.compiled = cp;
  if (w.weight.length < cp.column.length) w.weight = new Float64Array(cp.column.length);
  const c: Curvature = { compiled: cp, diagonal: w.diagonal, weight: w.weight };
  w.trial.set(s);
  let current = evaluate(cp, s, w.grad, c);
  if (!Number.isFinite(current) || !allFinite(w.grad, free)) return { iterations: 0, converged: false };
  // Whether c is the curvature at s: tiny steps keep the old one, and a rejected trial may overwrite it.
  let curvatureAtS = true;
  const finish = (iterations: number, converged: boolean): SolveResult => {
    if (!options.wantDiagonal) return { iterations, converged };
    if (!curvatureAtS) evaluate(cp, s, w.trialGrad, c);
    return { iterations, converged, diagonal: c.diagonal.slice() };
  };
  let blocks = buildCoarse(cp, s, c, w);
  let movedSinceCoarse = 0;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    startStep(free, c, w, blocks);
    let certified = continueStep(free, c, w, blocks, certifiedResidual, false);
    let { largest, slope } = measureStep(free, w);
    if (largest < STEP_TOLERANCE && !certified) {
      // About to stop: refine the step until its error is bounded, then test it again.
      certified = continueStep(free, c, w, blocks, certifiedResidual, true);
      ({ largest, slope } = measureStep(free, w));
    }
    if (largest < STEP_TOLERANCE && certified) return finish(iteration, true);
    const { grad, step, trial } = w;

    // Each trial is evaluated with its gradient and, unless the step is tiny,
    // its curvature: the last trial evaluated is the one accepted.
    const refresh = largest > CURVATURE_REUSE_STEP;
    let fraction = 1;
    let next: number;
    for (;;) {
      for (let i = 0; i < free.length; i++) {
        const slot = free[i] as number;
        trial[slot] = (s[slot] as number) + fraction * (step[slot] as number);
      }
      if (refresh) curvatureAtS = false;
      next = evaluate(cp, trial, w.trialGrad, refresh ? c : null);
      if (!Number.isFinite(next)) return { iterations: iteration, converged: false };
      if (next > current) break;
      // Near the optimum the gain falls below the rounding error of value, so
      // judge the step by slopes, which stay accurate. The objective is concave
      // along the step: an uphill slope at the trial point proves the step went
      // uphill. Failing that, the trapezoid estimate of the gain (exact for the
      // quadratic the objective is this close in) must not be negative, while
      // value agrees to rounding.
      let trialSlope = 0;
      for (let i = 0; i < free.length; i++) {
        const slot = free[i] as number;
        trialSlope += (w.trialGrad[slot] as number) * (step[slot] as number);
      }
      const withinRounding = current - next <= 1e-12 * Math.abs(current);
      if (trialSlope >= 0 || (withinRounding && slope + trialSlope >= 0)) {
        // The step went uphill; a lower computed value is rounding.
        next = Math.max(next, current);
        break;
      }
      fraction /= 2;
      // No increase is left to find: s is the optimum to machine precision.
      if (fraction < MIN_STEP_FRACTION) return finish(iteration, true);
    }
    curvatureAtS = refresh;
    for (let i = 0; i < free.length; i++) {
      const slot = free[i] as number;
      s[slot] = trial[slot] as number;
    }
    current = next;
    w.grad = w.trialGrad;
    w.trialGrad = grad;
    if (!Number.isFinite(current) || !allFinite(w.grad, free)) {
      return { iterations: iteration + 1, converged: false };
    }
    movedSinceCoarse += fraction * largest;
    if (refresh && movedSinceCoarse > COARSE_REBUILD_DISTANCE) {
      blocks = buildCoarse(cp, s, c, w);
      movedSinceCoarse = 0;
    }
    options.onIteration?.(current);
  }
  return finish(maxIterations, false);
}
