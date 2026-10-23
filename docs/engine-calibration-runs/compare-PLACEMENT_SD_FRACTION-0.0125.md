# Compare against PLACEMENT_SD_FRACTION-0.1

Current: PLACEMENT_SD_FRACTION-0.1 (overrides {"PLACEMENT_SD_FRACTION":0.1}, picker current, seeds 1 2 3 4 5 6 7 8 9 10 11 12).
Scenarios: filter cal-placement.
Groups: each scenario its own (the mean is over every compared scenario).
Seeds are paired by number. A run that never reached the gate counts as its last sample (its budget, or fewer on an early stop) and is counted as censored.

Decision: **PLACEMENT_SD_FRACTION-0.4** (fewest answers to the gate: -7.1% against PLACEMENT_SD_FRACTION-0.1).

| Candidate                    | Mean change | Censored seeds (candidate / current) | Verdict                                                                                                                                   |
| ---------------------------- | ----------: | -----------------------------------: | ----------------------------------------------------------------------------------------------------------------------------------------- |
| PLACEMENT_SD_FRACTION-0.0125 |       +9.3% |                                5 / 1 | rejected: more than 10% slower on typical-unordered-wrong-moves-n100, typical-unordered-probe-far-n100                                    |
| PLACEMENT_SD_FRACTION-0.025  |      +12.8% |                                9 / 1 | rejected: more than 10% slower on typical-unordered-wrong-moves-n100, typical-unordered-probe-near-n100, typical-unordered-probe-far-n100 |
| PLACEMENT_SD_FRACTION-0.05   |       +9.0% |                                5 / 1 | rejected: more than 10% slower on typical-unordered-wrong-moves-n100, typical-unordered-probe-far-n100                                    |
| PLACEMENT_SD_FRACTION-0.2    |       -6.6% |                                0 / 1 | eligible: mean -6.6%                                                                                                                      |
| PLACEMENT_SD_FRACTION-0.4    |       -7.1% |                                0 / 1 | chosen: mean -7.1%                                                                                                                        |

## PLACEMENT_SD_FRACTION-0.0125

| Scenario                                     | Group                                        |           Gate, current |         Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| -------------------------------------------- | -------------------------------------------- | ----------------------: | ----------------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-wrong-moves-n100           | typical-unordered-wrong-moves-n100           | 568 (5.67n), 1 censored | 635 (6.35n), 5 censored | +16.1% |  0.92 / 0.82 |   0.37 / 0.38 |   0.62 / 0.37 |       |
| typical-unordered-wrong-moves-corrected-n100 | typical-unordered-wrong-moves-corrected-n100 |             377 (3.77n) |             382 (3.82n) |  +1.6% |  0.99 / 0.98 |   0.49 / 0.49 |   0.83 / 0.78 |       |
| typical-unordered-multi-move-n100            | typical-unordered-multi-move-n100            |             410 (4.10n) |             418 (4.18n) |  +2.1% |  0.99 / 0.96 |   0.41 / 0.42 |   0.77 / 0.70 |       |
| typical-unordered-probe-near-n100            | typical-unordered-probe-near-n100            |             342 (3.42n) |             365 (3.65n) |  +7.2% |  1.00 / 0.99 |   0.55 / 0.47 |   0.88 / 0.79 |       |
| typical-unordered-probe-far-n100             | typical-unordered-probe-far-n100             |             450 (4.50n) |             528 (5.28n) | +19.3% |  0.98 / 0.95 |   0.40 / 0.39 |   0.70 / 0.61 |       |

| Group                                        | Change | Censored seeds (candidate / current) |
| -------------------------------------------- | -----: | -----------------------------------: |
| typical-unordered-wrong-moves-n100           | +16.1% |                                5 / 1 |
| typical-unordered-wrong-moves-corrected-n100 |  +1.6% |                                0 / 0 |
| typical-unordered-multi-move-n100            |  +2.1% |                                0 / 0 |
| typical-unordered-probe-near-n100            |  +7.2% |                                0 / 0 |
| typical-unordered-probe-far-n100             | +19.3% |                                0 / 0 |

Probes back within 5% of their true place a further 2n, 4n and 8n answers after the move (a probe is measured at a horizon only if the run lasted that long and the item was still shown):

| Side      | Kind | Horizon | Made | Measured | Kept | Share | Mean displacement |
| --------- | ---- | ------- | ---: | -------: | ---: | ----: | ----------------: |
| current   | near | 2n      |   72 |       72 |   51 |  0.71 |             0.046 |
| current   | near | 4n      |   72 |       72 |   63 |  0.88 |             0.028 |
| current   | near | 8n      |   72 |       72 |   72 |  1.00 |             0.012 |
| current   | far  | 2n      |   72 |       72 |    6 |  0.08 |             0.301 |
| current   | far  | 4n      |   72 |       72 |   21 |  0.29 |             0.223 |
| current   | far  | 8n      |   72 |       72 |   47 |  0.65 |             0.087 |
| candidate | near | 2n      |   72 |       72 |   42 |  0.58 |             0.054 |
| candidate | near | 4n      |   72 |       72 |   37 |  0.51 |             0.060 |
| candidate | near | 8n      |   72 |       72 |   55 |  0.76 |             0.037 |
| candidate | far  | 2n      |   72 |       72 |    5 |  0.07 |             0.280 |
| candidate | far  | 4n      |   72 |       72 |    7 |  0.10 |             0.257 |
| candidate | far  | 8n      |   72 |       72 |   14 |  0.19 |             0.215 |

Probe moves skipped: current 0, candidate 0.

## PLACEMENT_SD_FRACTION-0.025

| Scenario                                     | Group                                        |           Gate, current |         Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| -------------------------------------------- | -------------------------------------------- | ----------------------: | ----------------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-wrong-moves-n100           | typical-unordered-wrong-moves-n100           | 568 (5.67n), 1 censored | 699 (6.99n), 9 censored | +25.0% |  0.92 / 0.79 |   0.37 / 0.36 |   0.62 / 0.34 |       |
| typical-unordered-wrong-moves-corrected-n100 | typical-unordered-wrong-moves-corrected-n100 |             377 (3.77n) |             388 (3.88n) |  +3.5% |  0.99 / 0.98 |   0.49 / 0.48 |   0.83 / 0.79 |       |
| typical-unordered-multi-move-n100            | typical-unordered-multi-move-n100            |             410 (4.10n) |             422 (4.22n) |  +3.7% |  0.99 / 0.97 |   0.41 / 0.43 |   0.77 / 0.73 |       |
| typical-unordered-probe-near-n100            | typical-unordered-probe-near-n100            |             342 (3.42n) |             377 (3.77n) | +10.6% |  1.00 / 0.99 |   0.55 / 0.49 |   0.88 / 0.79 |       |
| typical-unordered-probe-far-n100             | typical-unordered-probe-far-n100             |             450 (4.50n) |             532 (5.32n) | +21.0% |  0.98 / 0.94 |   0.40 / 0.39 |   0.70 / 0.57 |       |

| Group                                        | Change | Censored seeds (candidate / current) |
| -------------------------------------------- | -----: | -----------------------------------: |
| typical-unordered-wrong-moves-n100           | +25.0% |                                9 / 1 |
| typical-unordered-wrong-moves-corrected-n100 |  +3.5% |                                0 / 0 |
| typical-unordered-multi-move-n100            |  +3.7% |                                0 / 0 |
| typical-unordered-probe-near-n100            | +10.6% |                                0 / 0 |
| typical-unordered-probe-far-n100             | +21.0% |                                0 / 0 |

Probes back within 5% of their true place a further 2n, 4n and 8n answers after the move (a probe is measured at a horizon only if the run lasted that long and the item was still shown):

| Side      | Kind | Horizon | Made | Measured | Kept | Share | Mean displacement |
| --------- | ---- | ------- | ---: | -------: | ---: | ----: | ----------------: |
| current   | near | 2n      |   72 |       72 |   51 |  0.71 |             0.046 |
| current   | near | 4n      |   72 |       72 |   63 |  0.88 |             0.028 |
| current   | near | 8n      |   72 |       72 |   72 |  1.00 |             0.012 |
| current   | far  | 2n      |   72 |       72 |    6 |  0.08 |             0.301 |
| current   | far  | 4n      |   72 |       72 |   21 |  0.29 |             0.223 |
| current   | far  | 8n      |   72 |       72 |   47 |  0.65 |             0.087 |
| candidate | near | 2n      |   72 |       72 |   37 |  0.51 |             0.058 |
| candidate | near | 4n      |   72 |       72 |   34 |  0.47 |             0.063 |
| candidate | near | 8n      |   72 |       72 |   59 |  0.82 |             0.033 |
| candidate | far  | 2n      |   72 |       72 |    4 |  0.06 |             0.326 |
| candidate | far  | 4n      |   72 |       72 |    4 |  0.06 |             0.295 |
| candidate | far  | 8n      |   72 |       72 |    9 |  0.13 |             0.233 |

Probe moves skipped: current 0, candidate 0.

## PLACEMENT_SD_FRACTION-0.05

| Scenario                                     | Group                                        |           Gate, current |         Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| -------------------------------------------- | -------------------------------------------- | ----------------------: | ----------------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-wrong-moves-n100           | typical-unordered-wrong-moves-n100           | 568 (5.67n), 1 censored | 655 (6.55n), 5 censored | +19.3% |  0.92 / 0.85 |   0.37 / 0.34 |   0.62 / 0.37 |       |
| typical-unordered-wrong-moves-corrected-n100 | typical-unordered-wrong-moves-corrected-n100 |             377 (3.77n) |             394 (3.94n) |  +4.9% |  0.99 / 0.99 |   0.49 / 0.45 |   0.83 / 0.80 |       |
| typical-unordered-multi-move-n100            | typical-unordered-multi-move-n100            |             410 (4.10n) |             400 (4.00n) |  -2.0% |  0.99 / 0.98 |   0.41 / 0.45 |   0.77 / 0.76 |       |
| typical-unordered-probe-near-n100            | typical-unordered-probe-near-n100            |             342 (3.42n) |             360 (3.60n) |  +5.9% |  1.00 / 1.00 |   0.55 / 0.48 |   0.88 / 0.85 |       |
| typical-unordered-probe-far-n100             | typical-unordered-probe-far-n100             |             450 (4.50n) |             526 (5.26n) | +17.0% |  0.98 / 0.96 |   0.40 / 0.40 |   0.70 / 0.63 |       |

| Group                                        | Change | Censored seeds (candidate / current) |
| -------------------------------------------- | -----: | -----------------------------------: |
| typical-unordered-wrong-moves-n100           | +19.3% |                                5 / 1 |
| typical-unordered-wrong-moves-corrected-n100 |  +4.9% |                                0 / 0 |
| typical-unordered-multi-move-n100            |  -2.0% |                                0 / 0 |
| typical-unordered-probe-near-n100            |  +5.9% |                                0 / 0 |
| typical-unordered-probe-far-n100             | +17.0% |                                0 / 0 |

Probes back within 5% of their true place a further 2n, 4n and 8n answers after the move (a probe is measured at a horizon only if the run lasted that long and the item was still shown):

| Side      | Kind | Horizon | Made | Measured | Kept | Share | Mean displacement |
| --------- | ---- | ------- | ---: | -------: | ---: | ----: | ----------------: |
| current   | near | 2n      |   72 |       72 |   51 |  0.71 |             0.046 |
| current   | near | 4n      |   72 |       72 |   63 |  0.88 |             0.028 |
| current   | near | 8n      |   72 |       72 |   72 |  1.00 |             0.012 |
| current   | far  | 2n      |   72 |       72 |    6 |  0.08 |             0.301 |
| current   | far  | 4n      |   72 |       72 |   21 |  0.29 |             0.223 |
| current   | far  | 8n      |   72 |       72 |   47 |  0.65 |             0.087 |
| candidate | near | 2n      |   72 |       72 |   39 |  0.54 |             0.054 |
| candidate | near | 4n      |   72 |       72 |   44 |  0.61 |             0.055 |
| candidate | near | 8n      |   72 |       72 |   68 |  0.94 |             0.021 |
| candidate | far  | 2n      |   72 |       72 |    1 |  0.01 |             0.336 |
| candidate | far  | 4n      |   72 |       72 |    7 |  0.10 |             0.290 |
| candidate | far  | 8n      |   72 |       72 |   19 |  0.26 |             0.170 |

Probe moves skipped: current 0, candidate 0.

## PLACEMENT_SD_FRACTION-0.2

| Scenario                                     | Group                                        |           Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| -------------------------------------------- | -------------------------------------------- | ----------------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-wrong-moves-n100           | typical-unordered-wrong-moves-n100           | 568 (5.67n), 1 censored |     448 (4.48n) | -15.8% |  0.92 / 1.00 |   0.37 / 0.41 |   0.62 / 0.82 |       |
| typical-unordered-wrong-moves-corrected-n100 | typical-unordered-wrong-moves-corrected-n100 |             377 (3.77n) |     363 (3.63n) |  -3.3% |  0.99 / 1.00 |   0.49 / 0.50 |   0.83 / 0.82 |       |
| typical-unordered-multi-move-n100            | typical-unordered-multi-move-n100            |             410 (4.10n) |     372 (3.72n) |  -8.9% |  0.99 / 1.00 |   0.41 / 0.47 |   0.77 / 0.77 |       |
| typical-unordered-probe-near-n100            | typical-unordered-probe-near-n100            |             342 (3.42n) |     343 (3.43n) |  +0.7% |  1.00 / 1.00 |   0.55 / 0.55 |   0.88 / 0.91 |       |
| typical-unordered-probe-far-n100             | typical-unordered-probe-far-n100             |             450 (4.50n) |     419 (4.19n) |  -5.9% |  0.98 / 1.00 |   0.40 / 0.43 |   0.70 / 0.86 |       |

| Group                                        | Change | Censored seeds (candidate / current) |
| -------------------------------------------- | -----: | -----------------------------------: |
| typical-unordered-wrong-moves-n100           | -15.8% |                                0 / 1 |
| typical-unordered-wrong-moves-corrected-n100 |  -3.3% |                                0 / 0 |
| typical-unordered-multi-move-n100            |  -8.9% |                                0 / 0 |
| typical-unordered-probe-near-n100            |  +0.7% |                                0 / 0 |
| typical-unordered-probe-far-n100             |  -5.9% |                                0 / 0 |

Probes back within 5% of their true place a further 2n, 4n and 8n answers after the move (a probe is measured at a horizon only if the run lasted that long and the item was still shown):

| Side      | Kind | Horizon | Made | Measured | Kept | Share | Mean displacement |
| --------- | ---- | ------- | ---: | -------: | ---: | ----: | ----------------: |
| current   | near | 2n      |   72 |       72 |   51 |  0.71 |             0.046 |
| current   | near | 4n      |   72 |       72 |   63 |  0.88 |             0.028 |
| current   | near | 8n      |   72 |       72 |   72 |  1.00 |             0.012 |
| current   | far  | 2n      |   72 |       72 |    6 |  0.08 |             0.301 |
| current   | far  | 4n      |   72 |       72 |   21 |  0.29 |             0.223 |
| current   | far  | 8n      |   72 |       72 |   47 |  0.65 |             0.087 |
| candidate | near | 2n      |   72 |       72 |   64 |  0.89 |             0.025 |
| candidate | near | 4n      |   72 |       72 |   69 |  0.96 |             0.015 |
| candidate | near | 8n      |   72 |       72 |   72 |  1.00 |             0.006 |
| candidate | far  | 2n      |   72 |       72 |   15 |  0.21 |             0.243 |
| candidate | far  | 4n      |   72 |       72 |   36 |  0.50 |             0.114 |
| candidate | far  | 8n      |   72 |       72 |   70 |  0.97 |             0.020 |

Probe moves skipped: current 0, candidate 0.

## PLACEMENT_SD_FRACTION-0.4

| Scenario                                     | Group                                        |           Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| -------------------------------------------- | -------------------------------------------- | ----------------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-wrong-moves-n100           | typical-unordered-wrong-moves-n100           | 568 (5.67n), 1 censored |     437 (4.37n) | -18.4% |  0.92 / 0.99 |   0.37 / 0.42 |   0.62 / 0.82 |       |
| typical-unordered-wrong-moves-corrected-n100 | typical-unordered-wrong-moves-corrected-n100 |             377 (3.77n) |     362 (3.62n) |  -3.3% |  0.99 / 1.00 |   0.49 / 0.48 |   0.83 / 0.83 |       |
| typical-unordered-multi-move-n100            | typical-unordered-multi-move-n100            |             410 (4.10n) |     378 (3.78n) |  -7.0% |  0.99 / 1.00 |   0.41 / 0.45 |   0.77 / 0.81 |       |
| typical-unordered-probe-near-n100            | typical-unordered-probe-near-n100            |             342 (3.42n) |     349 (3.49n) |  +2.4% |  1.00 / 1.00 |   0.55 / 0.55 |   0.88 / 0.92 |       |
| typical-unordered-probe-far-n100             | typical-unordered-probe-far-n100             |             450 (4.50n) |     400 (4.00n) |  -9.3% |  0.98 / 1.00 |   0.40 / 0.41 |   0.70 / 0.87 |       |

| Group                                        | Change | Censored seeds (candidate / current) |
| -------------------------------------------- | -----: | -----------------------------------: |
| typical-unordered-wrong-moves-n100           | -18.4% |                                0 / 1 |
| typical-unordered-wrong-moves-corrected-n100 |  -3.3% |                                0 / 0 |
| typical-unordered-multi-move-n100            |  -7.0% |                                0 / 0 |
| typical-unordered-probe-near-n100            |  +2.4% |                                0 / 0 |
| typical-unordered-probe-far-n100             |  -9.3% |                                0 / 0 |

Probes back within 5% of their true place a further 2n, 4n and 8n answers after the move (a probe is measured at a horizon only if the run lasted that long and the item was still shown):

| Side      | Kind | Horizon | Made | Measured | Kept | Share | Mean displacement |
| --------- | ---- | ------- | ---: | -------: | ---: | ----: | ----------------: |
| current   | near | 2n      |   72 |       72 |   51 |  0.71 |             0.046 |
| current   | near | 4n      |   72 |       72 |   63 |  0.88 |             0.028 |
| current   | near | 8n      |   72 |       72 |   72 |  1.00 |             0.012 |
| current   | far  | 2n      |   72 |       72 |    6 |  0.08 |             0.301 |
| current   | far  | 4n      |   72 |       72 |   21 |  0.29 |             0.223 |
| current   | far  | 8n      |   72 |       72 |   47 |  0.65 |             0.087 |
| candidate | near | 2n      |   72 |       72 |   62 |  0.86 |             0.028 |
| candidate | near | 4n      |   72 |       72 |   69 |  0.96 |             0.015 |
| candidate | near | 8n      |   72 |       72 |   72 |  1.00 |             0.007 |
| candidate | far  | 2n      |   72 |       72 |   18 |  0.25 |             0.198 |
| candidate | far  | 4n      |   72 |       72 |   54 |  0.75 |             0.073 |
| candidate | far  | 8n      |   72 |       72 |   70 |  0.97 |             0.013 |

Probe moves skipped: current 0, candidate 0.

within5 and within1 columns are current / candidate, means over the paired seeds. A change is the mean over paired seeds of (candidate - current) / current.
