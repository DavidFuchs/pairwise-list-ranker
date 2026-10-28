/** Model scale: a strength gap of 1 is a win probability of 1 / (1 + exp(-K)). */
export const K = Math.SQRT2;

/** Prior sd for an unordered list: N(0, 25^2). */
export const UNORDERED_SD = 25;
/** Strength span of the seed ordering for rough and ranked lists. */
export const SEED_SPAN = 80;
/** Prior sd for a rough list, as a fraction of the seed span. */
export const ROUGH_SD_FRACTION = 0.2;
/** Prior sd for a ranked list, as a fraction of the seed span. */
export const RANKED_SD_FRACTION = 0.03;

/** Evidence weights. */
export const PAIR_WEIGHT = 1;
// Calibrated 2026-10-19, see docs/engine-calibration.md "Much better weight".
// No gain over 1..2.5; kept.
export const STRONG_WEIGHT = 1.75;
// Calibrated 2026-10-19, see docs/engine-calibration.md "Draw weight".
// No gain over 0..0.5; kept.
export const DRAW_WEIGHT_EACH_WAY = 0.25;
// Each clear answer counts RECENCY_FACTOR^k, k = later counted clear answers on the same pair the other way.
// 1 is off. Calibrated in docs/engine-calibration.md "Later answers".
export const RECENCY_FACTOR = 0.6;

/** Strengths within one band (Math.round(s / BAND_WIDTH)) count as tied. */
export const BAND_WIDTH = 1e-6;
/** The picker rounds scores to this fraction of the round's best score. */
export const SCORE_GRID = 1e-9;
/** Solver strength error target. */
export const SOLVER_TOLERANCE = 1e-10;

/** Placement width: sd is this fraction of the visible items, clamped to the places below. */
// Calibrated 2026-10-19, see docs/engine-calibration.md "Placement width".
// The rule picked 0.4. The owner chose 0.1 because 0.2 and 0.4 fail the
// checkpoint-precision test (docs/ARCHITECTURE.md 6.5) and make a drag a weak hint that a few answers
// override.
export const PLACEMENT_SD_FRACTION = 0.1;
export const PLACEMENT_SD_MIN_PLACES = 1;
export const PLACEMENT_SD_MAX_PLACES = 25;
/** Floor on the local strength-per-place scale used to turn places into strength. */
export const LOCAL_SCALE_FLOOR = 0.05;
/** Cap on a placement's sd, in strength units. */
export const PLACEMENT_SD_MAX_STRENGTH = 25;

/** Rank offsets the picker considers for a partner. */
export const PICKER_OFFSETS = [
  1, 2, 3, 4, 5, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768,
] as const;
/** Repeat penalty: a pair asked j times before scores 0.3^j of its value. */
export const REPEAT_FACTOR = 0.3;
/** A pair asked this many times is offered again only when every other pair has been too. */
export const MAX_SHOWINGS = 3;
/** A pair whose answers go back and forth is closed once this many clear answers in a row agree. */
export const SPLIT_SETTLED_RUN = 2;
/**
 * The most times a pair still going back and forth is shown. Provisional until
 * docs/engine-calibration.md "Split pairs"; a value of MAX_SHOWINGS turns the rule off.
 */
export const MAX_SHOWINGS_SPLIT = 5;
/** The picker reads the exact flip chance for at most this many of its best-scoring candidates. */
export const PICKER_EXACT_CHECKS = 32;

/** A checkpoint is kept after every placement and every this-many events. */
export const CHECKPOINT_EVERY = 500;
