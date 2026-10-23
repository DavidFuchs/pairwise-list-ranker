import { K } from '@/lib/ranking/bt/constants';
import type { PairTerm } from '@/lib/ranking/bt/evidence';

/**
 * The MAP objective (docs/ARCHITECTURE.md 6.1): weighted pair log-likelihoods plus a Gaussian
 * log-prior on every free slot. Only free slots are variables;
 * a term that touches another slot reads its strength as a constant, and every
 * output at such a slot is 0.
 */
export interface Problem {
  /** Slots being fitted, in arrival sequence. Other slots are fixed and never read. */
  free: Int32Array;
  priorMean: Float64Array; // indexed by slot
  priorVar: Float64Array; // indexed by slot
  pairs: readonly PairTerm[];
}

const INV_K = 1 / K;
const INV_K2 = 1 / (K * K);

/** Free-slot masks, cached per free set so repeated calls on one problem do not allocate. */
const masks = new WeakMap<Int32Array, Uint8Array>();

function freeMask(p: Problem, size: number): Uint8Array {
  const cached = masks.get(p.free);
  if (cached && cached.length === size) return cached;
  const mask = new Uint8Array(size);
  for (const slot of p.free) mask[slot] = 1;
  masks.set(p.free, mask);
  return mask;
}

function at(a: ArrayLike<number>, i: number): number {
  return a[i] ?? 0;
}

/** log(sigmoid(d)) without overflow for large |d|. */
function logSigmoid(d: number): number {
  return d >= 0 ? -Math.log1p(Math.exp(-d)) : d - Math.log1p(Math.exp(d));
}

/** sigmoid(d) without overflow for large |d|. */
function sigmoid(d: number): number {
  if (d >= 0) return 1 / (1 + Math.exp(-d));
  const e = Math.exp(d);
  return e / (1 + e);
}

// value, gradient, hessianTimes and hessianDiagonal are the plain forms of the
// objective. The solver uses compile and evaluate (further down), a faster form
// tested against these.

/** Log-posterior up to a constant (to be maximized). */
export function value(p: Problem, s: Float64Array): number {
  let total = 0;
  for (const slot of p.free) {
    const diff = at(s, slot) - at(p.priorMean, slot);
    total -= (diff * diff) / (2 * at(p.priorVar, slot));
  }
  for (const pair of p.pairs) {
    total += pair.weight * logSigmoid((at(s, pair.winner) - at(s, pair.loser)) * INV_K);
  }
  return total;
}

/** Gradient of value, written into out (indexed by slot; only free slots meaningful). */
export function gradient(p: Problem, s: Float64Array, out: Float64Array): void {
  const mask = freeMask(p, out.length);
  out.fill(0);
  for (const slot of p.free) {
    out[slot] = (at(p.priorMean, slot) - at(s, slot)) / at(p.priorVar, slot);
  }
  for (const pair of p.pairs) {
    // d/dd log sigmoid(d) = sigmoid(-d), the loser's win probability.
    const g = pair.weight * INV_K * sigmoid((at(s, pair.loser) - at(s, pair.winner)) * INV_K);
    if (mask[pair.winner]) out[pair.winner] = at(out, pair.winner) + g;
    if (mask[pair.loser]) out[pair.loser] = at(out, pair.loser) - g;
  }
}

/**
 * A problem flattened for the solver: terms in typed arrays, plus the sparsity
 * pattern of the negative Hessian. Built once per solve; s and the curvature
 * change, the problem does not.
 *
 * Every pair term is shift-invariant, so its curvature is a graph Laplacian: a
 * weight coupling its two slots. Those couplings, in term order, are the
 * Hessian's off-diagonal entries. Each coupling between two free slots is
 * stored in both its rows of a compressed sparse row layout (duplicates kept,
 * as separate entries), each row filled in term order, so a Hessian-vector
 * product is one sequential pass over rows and evaluate can find each entry by
 * replaying the same order.
 */
export interface CompiledProblem {
  problem: Problem;
  size: number;
  /** 1 at free slots. */
  mask: Uint8Array;
  /** Winner then loser, for each pair. */
  pairSlots: Int32Array;
  pairWeight: Float64Array;
  /** Rows by slot: row i holds entries rowStart[i] .. rowStart[i + 1]); column is the other slot. */
  rowStart: Int32Array;
  column: Int32Array;
}

/** An Int32Array of length n, on reuse's memory when it is big enough (its contents are stale). */
function int32(reuse: Int32Array | undefined, n: number): Int32Array {
  if (reuse && reuse.buffer.byteLength >= n * 4) return new Int32Array(reuse.buffer, 0, n);
  // Headroom, so a history that grows by a term at a time does not reallocate every solve.
  return new Int32Array(Math.ceil(n * 1.25) + 16).subarray(0, n);
}

function float64(reuse: Float64Array | undefined, n: number): Float64Array {
  if (reuse && reuse.buffer.byteLength >= n * 8) return new Float64Array(reuse.buffer, 0, n);
  return new Float64Array(Math.ceil(n * 1.25) + 16).subarray(0, n);
}

/**
 * Flattens p for slots 0 .. size - 1. When reuse is given, its memory is
 * recycled: reuse must not be used again.
 */
export function compile(p: Problem, size: number, reuse?: CompiledProblem): CompiledProblem {
  const mask = reuse?.mask.length === size ? reuse.mask : new Uint8Array(size);
  mask.fill(0);
  for (const slot of p.free) mask[slot] = 1;
  const pairs = p.pairs;
  const pairSlots = int32(reuse?.pairSlots, 2 * pairs.length);
  const pairWeight = float64(reuse?.pairWeight, pairs.length);
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i] as PairTerm;
    pairSlots[2 * i] = pair.winner;
    pairSlots[2 * i + 1] = pair.loser;
    pairWeight[i] = pair.weight;
  }

  // Count each row's couplings between free slots, then fill the rows in term order.
  const rowStart = reuse?.rowStart.length === size + 1 ? reuse.rowStart : new Int32Array(size + 1);
  rowStart.fill(0);
  let cursor: Int32Array = new Int32Array(0);
  let column: Int32Array = new Int32Array(0);
  for (let pass = 0; pass < 2; pass++) {
    const counting = pass === 0;
    for (let i = 0; i < pairSlots.length; i += 2) {
      addCoupling(
        counting,
        mask,
        rowStart,
        cursor,
        column,
        pairSlots[i] as number,
        pairSlots[i + 1] as number,
      );
    }
    if (counting) {
      for (let i = 0; i < size; i++) rowStart[i + 1] = (rowStart[i + 1] as number) + (rowStart[i] as number);
      cursor = rowStart.slice(0, size);
      column = int32(reuse?.column, rowStart[size] as number);
    }
  }
  return { problem: p, size, mask, pairSlots, pairWeight, rowStart, column };
}

/** compile's two passes over couplings: count a coupling into its rows, or place it there. */
function addCoupling(
  counting: boolean,
  mask: Uint8Array,
  rowStart: Int32Array,
  cursor: Int32Array,
  column: Int32Array,
  a: number,
  b: number,
): void {
  if (mask[a] !== 1 || mask[b] !== 1) return;
  if (counting) {
    rowStart[a + 1] = (rowStart[a + 1] as number) + 1;
    rowStart[b + 1] = (rowStart[b + 1] as number) + 1;
    return;
  }
  const atA = cursor[a] as number;
  const atB = cursor[b] as number;
  cursor[a] = atA + 1;
  cursor[b] = atB + 1;
  column[atA] = b;
  column[atB] = a;
}

/** The negative Hessian at one point: its diagonal, and a coupling weight per CSR entry (the Hessian holds -weight there). */
export interface Curvature {
  compiled: CompiledProblem;
  /** By slot; 0 at fixed slots. */
  diagonal: Float64Array;
  weight: Float64Array;
}

/** A curvature for cp, to be filled by evaluate. */
export function emptyCurvature(cp: CompiledProblem): Curvature {
  return { compiled: cp, diagonal: new Float64Array(cp.size), weight: new Float64Array(cp.column.length) };
}

/** Below this, a pair's two shared exps sum too small to divide by safely. */
const SAFE_PAIR_SUM = 1e-280;

/** exp(s_i / K - shift) by slot, shared by every term in one evaluation. */
let slotExp = new Float64Array(0);
/** Next CSR entry of each row while evaluate writes curvature. */
let rowCursor = new Int32Array(0);

/**
 * value, its gradient (into grad) and, when curvature is given, the curvature,
 * in one pass over the terms. This is the solver's evaluation, so it is built
 * for speed: one exp per slot serves every term (shifted by the largest
 * strength any term reads, so none overflows), leaving one log per pair.
 * Plain indexing throughout; slots are in range by construction.
 */
export function evaluate(
  cp: CompiledProblem,
  s: Float64Array,
  grad: Float64Array,
  curvature: Curvature | null,
): number {
  const { problem, size, mask, pairSlots, pairWeight, rowStart } = cp;
  const { free, priorMean, priorVar } = problem;
  grad.fill(0);
  let total = 0;
  for (let i = 0; i < free.length; i++) {
    const slot = free[i] as number;
    const variance = priorVar[slot] as number;
    const diff = (s[slot] as number) - (priorMean[slot] as number);
    total -= (diff * diff) / (2 * variance);
    grad[slot] = -diff / variance;
  }

  let top = -Infinity;
  for (let i = 0; i < pairSlots.length; i++) top = Math.max(top, s[pairSlots[i] as number] as number);
  const shift = top * INV_K;
  if (slotExp.length < size) slotExp = new Float64Array(size);
  const shared = slotExp;
  for (let i = 0; i < size; i++) shared[i] = Math.exp((s[i] as number) * INV_K - shift);

  const want = curvature !== null;
  // Curvature outputs; only written when curvature is wanted.
  const diagonal = curvature ? curvature.diagonal : grad;
  const weights = curvature ? curvature.weight : grad;
  if (curvature) {
    diagonal.fill(0);
    for (let i = 0; i < free.length; i++) {
      const slot = free[i] as number;
      diagonal[slot] = 1 / (priorVar[slot] as number);
    }
  }
  // Each row's next entry: couplings come in the order compile filled the rows.
  if (rowCursor.length < size) rowCursor = new Int32Array(size);
  const cursor = rowCursor;
  if (curvature) cursor.set(rowStart.subarray(0, size));

  for (let i = 0; i < pairWeight.length; i++) {
    const winner = pairSlots[2 * i] as number;
    const loser = pairSlots[2 * i + 1] as number;
    const weight = pairWeight[i] as number;
    const a = shared[winner] as number;
    const b = shared[loser] as number;
    const sum = a + b;
    let logWin: number;
    let loserProb: number;
    let spread: number; // sigmoid(d) * sigmoid(-d)
    if (sum >= SAFE_PAIR_SUM) {
      logWin =
        a >= b
          ? -Math.log1p(b / a)
          : ((s[winner] as number) - (s[loser] as number)) * INV_K - Math.log1p(a / b);
      loserProb = b / sum;
      spread = (a / sum) * loserProb;
    } else {
      // Both strengths far below the shift: use the pair's own scale.
      const d = ((s[winner] as number) - (s[loser] as number)) * INV_K;
      const e = Math.exp(-Math.abs(d));
      const log1pE = Math.log1p(e);
      logWin = d >= 0 ? -log1pE : d - log1pE;
      loserProb = d >= 0 ? e / (1 + e) : 1 / (1 + e);
      spread = e / ((1 + e) * (1 + e));
    }
    total += weight * logWin;
    const g = weight * INV_K * loserProb;
    const freeWinner = mask[winner] === 1;
    const freeLoser = mask[loser] === 1;
    if (freeWinner) grad[winner] = (grad[winner] as number) + g;
    if (freeLoser) grad[loser] = (grad[loser] as number) - g;
    if (want) {
      const w = weight * INV_K2 * spread;
      if (freeWinner) diagonal[winner] = (diagonal[winner] as number) + w;
      if (freeLoser) diagonal[loser] = (diagonal[loser] as number) + w;
      if (freeWinner && freeLoser) {
        const atWinner = cursor[winner] as number;
        const atLoser = cursor[loser] as number;
        cursor[winner] = atWinner + 1;
        cursor[loser] = atLoser + 1;
        weights[atWinner] = w;
        weights[atLoser] = w;
      }
    }
  }
  return total;
}

/** The curvature of value at s. Compiles p; the solver compiles once per solve instead. */
export function curvatureAt(p: Problem, s: Float64Array): Curvature {
  const c = emptyCurvature(compile(p, s.length));
  evaluate(c.compiled, s, new Float64Array(s.length), c);
  return c;
}

/**
 * out = H v for the negative Hessian held in c. Components of v at fixed slots
 * are never read. Plain indexing: this is the solver's inner loop.
 */
export function hessianTimesCached(c: Curvature, v: Float64Array, out: Float64Array): void {
  const { diagonal, weight } = c;
  const { rowStart, column, problem } = c.compiled;
  const free = problem.free;
  out.fill(0);
  for (let i = 0; i < free.length; i++) {
    const slot = free[i] as number;
    let sum = (diagonal[slot] as number) * (v[slot] as number);
    const end = rowStart[slot + 1] as number;
    for (let k = rowStart[slot] as number; k < end; k++)
      sum -= (weight[k] as number) * (v[column[k] as number] as number);
    out[slot] = sum;
  }
}

/** out = H v where H is the NEGATIVE Hessian of value (positive definite). */
export function hessianTimes(p: Problem, s: Float64Array, v: Float64Array, out: Float64Array): void {
  const mask = freeMask(p, out.length);
  // Direction components at fixed slots are read as 0: those slots are not variables.
  const dir = (slot: number): number => (mask[slot] ? at(v, slot) : 0);
  out.fill(0);
  for (const slot of p.free) out[slot] = at(v, slot) / at(p.priorVar, slot);
  for (const pair of p.pairs) {
    const win = sigmoid((at(s, pair.winner) - at(s, pair.loser)) * INV_K);
    const lose = sigmoid((at(s, pair.loser) - at(s, pair.winner)) * INV_K);
    const h = pair.weight * INV_K2 * win * lose * (dir(pair.winner) - dir(pair.loser));
    if (mask[pair.winner]) out[pair.winner] = at(out, pair.winner) + h;
    if (mask[pair.loser]) out[pair.loser] = at(out, pair.loser) - h;
  }
}

/** Diagonal of the negative Hessian. u_i = 1 / diag_i (docs/ARCHITECTURE.md 6.1). */
export function hessianDiagonal(p: Problem, s: Float64Array, out: Float64Array): void {
  const mask = freeMask(p, out.length);
  out.fill(0);
  for (const slot of p.free) out[slot] = 1 / at(p.priorVar, slot);
  for (const pair of p.pairs) {
    const win = sigmoid((at(s, pair.winner) - at(s, pair.loser)) * INV_K);
    const lose = sigmoid((at(s, pair.loser) - at(s, pair.winner)) * INV_K);
    const h = pair.weight * INV_K2 * win * lose;
    if (mask[pair.winner]) out[pair.winner] = at(out, pair.winner) + h;
    if (mask[pair.loser]) out[pair.loser] = at(out, pair.loser) + h;
  }
}
