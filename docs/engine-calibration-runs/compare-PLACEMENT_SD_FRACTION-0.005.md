# Compare against PLACEMENT_SD_FRACTION-0.0125

Current: PLACEMENT_SD_FRACTION-0.0125 (overrides {"PLACEMENT_SD_FRACTION":0.0125}, picker current, seeds 1 2 3 4 5 6 7 8 9 10 11 12).
Scenarios: filter cal-placement.
Groups: each scenario its own (the mean is over every compared scenario).
Seeds are paired by number. A run that never reached the gate counts as its last sample (its budget, or fewer on an early stop) and is counted as censored.

Decision: **PLACEMENT_SD_FRACTION-0.0125** (no gain).

| Candidate                   | Mean change | Censored seeds (candidate / current) | Verdict                            |
| --------------------------- | ----------: | -----------------------------------: | ---------------------------------- |
| PLACEMENT_SD_FRACTION-0.005 |       +0.0% |                                0 / 0 | no gain: mean +0.0%, not 2% faster |
| PLACEMENT_SD_FRACTION-0.025 |       +0.3% |                                0 / 0 | no gain: mean +0.3%, not 2% faster |
| PLACEMENT_SD_FRACTION-0.05  |       +0.1% |                                0 / 0 | no gain: mean +0.1%, not 2% faster |
| PLACEMENT_SD_FRACTION-0.1   |       +0.1% |                                0 / 0 | no gain: mean +0.1%, not 2% faster |
| PLACEMENT_SD_FRACTION-0.2   |       +0.8% |                                0 / 0 | no gain: mean +0.8%, not 2% faster |
| PLACEMENT_SD_FRACTION-0.4   |       +1.4% |                                0 / 0 | no gain: mean +1.4%, not 2% faster |

## PLACEMENT_SD_FRACTION-0.005

| Scenario                                     | Group                                        | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| -------------------------------------------- | -------------------------------------------- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-wrong-moves-n100           | typical-unordered-wrong-moves-n100           |    69 (0.69n) |      69 (0.69n) |  +0.0% |  0.84 / 0.84 |   0.53 / 0.53 |   0.35 / 0.32 |       |
| typical-unordered-wrong-moves-corrected-n100 | typical-unordered-wrong-moves-corrected-n100 |    67 (0.67n) |      67 (0.67n) |  +0.0% |  1.00 / 1.00 |   0.82 / 0.82 |   0.90 / 0.91 |       |
| typical-unordered-multi-move-n100            | typical-unordered-multi-move-n100            |    68 (0.68n) |      68 (0.68n) |  +0.0% |  0.99 / 1.00 |   0.81 / 0.81 |   0.88 / 0.90 |       |
| typical-unordered-probe-near-n100            | typical-unordered-probe-near-n100            |    68 (0.68n) |      68 (0.68n) |  +0.0% |  1.00 / 1.00 |   0.81 / 0.80 |   0.93 / 0.92 |       |
| typical-unordered-probe-far-n100             | typical-unordered-probe-far-n100             |    68 (0.68n) |      68 (0.68n) |  +0.0% |  0.95 / 0.95 |   0.58 / 0.58 |   0.59 / 0.60 |       |

| Group                                        | Change | Censored seeds (candidate / current) |
| -------------------------------------------- | -----: | -----------------------------------: |
| typical-unordered-wrong-moves-n100           |  +0.0% |                                0 / 0 |
| typical-unordered-wrong-moves-corrected-n100 |  +0.0% |                                0 / 0 |
| typical-unordered-multi-move-n100            |  +0.0% |                                0 / 0 |
| typical-unordered-probe-near-n100            |  +0.0% |                                0 / 0 |
| typical-unordered-probe-far-n100             |  +0.0% |                                0 / 0 |

Probes back within 5% after 2n answers:

- current: near 71 of 72 (0.99), 72 made; far 5 of 72 (0.07), 72 made; 0 skipped
- candidate: near 71 of 72 (0.99), 72 made; far 6 of 72 (0.08), 72 made; 0 skipped

## PLACEMENT_SD_FRACTION-0.025

| Scenario                                     | Group                                        | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| -------------------------------------------- | -------------------------------------------- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-wrong-moves-n100           | typical-unordered-wrong-moves-n100           |    69 (0.69n) |      70 (0.70n) |  +0.7% |  0.84 / 0.83 |   0.53 / 0.52 |   0.35 / 0.33 |       |
| typical-unordered-wrong-moves-corrected-n100 | typical-unordered-wrong-moves-corrected-n100 |    67 (0.67n) |      68 (0.68n) |  +0.6% |  1.00 / 1.00 |   0.82 / 0.84 |   0.90 / 0.90 |       |
| typical-unordered-multi-move-n100            | typical-unordered-multi-move-n100            |    68 (0.68n) |      68 (0.68n) |  +0.0% |  0.99 / 1.00 |   0.81 / 0.83 |   0.88 / 0.89 |       |
| typical-unordered-probe-near-n100            | typical-unordered-probe-near-n100            |    68 (0.68n) |      68 (0.68n) |  +0.0% |  1.00 / 1.00 |   0.81 / 0.85 |   0.93 / 0.94 |       |
| typical-unordered-probe-far-n100             | typical-unordered-probe-far-n100             |    68 (0.68n) |      68 (0.68n) |  +0.0% |  0.95 / 0.95 |   0.58 / 0.56 |   0.59 / 0.64 |       |

| Group                                        | Change | Censored seeds (candidate / current) |
| -------------------------------------------- | -----: | -----------------------------------: |
| typical-unordered-wrong-moves-n100           |  +0.7% |                                0 / 0 |
| typical-unordered-wrong-moves-corrected-n100 |  +0.6% |                                0 / 0 |
| typical-unordered-multi-move-n100            |  +0.0% |                                0 / 0 |
| typical-unordered-probe-near-n100            |  +0.0% |                                0 / 0 |
| typical-unordered-probe-far-n100             |  +0.0% |                                0 / 0 |

Probes back within 5% after 2n answers:

- current: near 71 of 72 (0.99), 72 made; far 5 of 72 (0.07), 72 made; 0 skipped
- candidate: near 72 of 72 (1.00), 72 made; far 6 of 72 (0.08), 72 made; 0 skipped

## PLACEMENT_SD_FRACTION-0.05

| Scenario                                     | Group                                        | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| -------------------------------------------- | -------------------------------------------- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-wrong-moves-n100           | typical-unordered-wrong-moves-n100           |    69 (0.69n) |      69 (0.69n) |  -0.5% |  0.84 / 0.90 |   0.53 / 0.58 |   0.35 / 0.51 |       |
| typical-unordered-wrong-moves-corrected-n100 | typical-unordered-wrong-moves-corrected-n100 |    67 (0.67n) |      68 (0.68n) |  +1.2% |  1.00 / 1.00 |   0.82 / 0.85 |   0.90 / 0.91 |       |
| typical-unordered-multi-move-n100            | typical-unordered-multi-move-n100            |    68 (0.68n) |      68 (0.68n) |  +0.0% |  0.99 / 1.00 |   0.81 / 0.82 |   0.88 / 0.88 |       |
| typical-unordered-probe-near-n100            | typical-unordered-probe-near-n100            |    68 (0.68n) |      68 (0.68n) |  +0.0% |  1.00 / 1.00 |   0.81 / 0.84 |   0.93 / 0.95 |       |
| typical-unordered-probe-far-n100             | typical-unordered-probe-far-n100             |    68 (0.68n) |      68 (0.68n) |  +0.0% |  0.95 / 0.97 |   0.58 / 0.59 |   0.59 / 0.71 |       |

| Group                                        | Change | Censored seeds (candidate / current) |
| -------------------------------------------- | -----: | -----------------------------------: |
| typical-unordered-wrong-moves-n100           |  -0.5% |                                0 / 0 |
| typical-unordered-wrong-moves-corrected-n100 |  +1.2% |                                0 / 0 |
| typical-unordered-multi-move-n100            |  +0.0% |                                0 / 0 |
| typical-unordered-probe-near-n100            |  +0.0% |                                0 / 0 |
| typical-unordered-probe-far-n100             |  +0.0% |                                0 / 0 |

Probes back within 5% after 2n answers:

- current: near 71 of 72 (0.99), 72 made; far 5 of 72 (0.07), 72 made; 0 skipped
- candidate: near 72 of 72 (1.00), 72 made; far 8 of 72 (0.11), 72 made; 0 skipped

## PLACEMENT_SD_FRACTION-0.1

| Scenario                                     | Group                                        | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| -------------------------------------------- | -------------------------------------------- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-wrong-moves-n100           | typical-unordered-wrong-moves-n100           |    69 (0.69n) |      68 (0.68n) |  -1.2% |  0.84 / 0.99 |   0.53 / 0.76 |   0.35 / 0.83 |       |
| typical-unordered-wrong-moves-corrected-n100 | typical-unordered-wrong-moves-corrected-n100 |    67 (0.67n) |      68 (0.68n) |  +2.0% |  1.00 / 1.00 |   0.82 / 0.85 |   0.90 / 0.90 |       |
| typical-unordered-multi-move-n100            | typical-unordered-multi-move-n100            |    68 (0.68n) |      68 (0.68n) |  +0.0% |  0.99 / 1.00 |   0.81 / 0.81 |   0.88 / 0.85 |       |
| typical-unordered-probe-near-n100            | typical-unordered-probe-near-n100            |    68 (0.68n) |      68 (0.68n) |  +0.0% |  1.00 / 1.00 |   0.81 / 0.87 |   0.93 / 0.94 |       |
| typical-unordered-probe-far-n100             | typical-unordered-probe-far-n100             |    68 (0.68n) |      68 (0.68n) |  +0.0% |  0.95 / 1.00 |   0.58 / 0.78 |   0.59 / 0.93 |       |

| Group                                        | Change | Censored seeds (candidate / current) |
| -------------------------------------------- | -----: | -----------------------------------: |
| typical-unordered-wrong-moves-n100           |  -1.2% |                                0 / 0 |
| typical-unordered-wrong-moves-corrected-n100 |  +2.0% |                                0 / 0 |
| typical-unordered-multi-move-n100            |  +0.0% |                                0 / 0 |
| typical-unordered-probe-near-n100            |  +0.0% |                                0 / 0 |
| typical-unordered-probe-far-n100             |  +0.0% |                                0 / 0 |

Probes back within 5% after 2n answers:

- current: near 71 of 72 (0.99), 72 made; far 5 of 72 (0.07), 72 made; 0 skipped
- candidate: near 72 of 72 (1.00), 72 made; far 56 of 72 (0.78), 72 made; 0 skipped

## PLACEMENT_SD_FRACTION-0.2

| Scenario                                     | Group                                        | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| -------------------------------------------- | -------------------------------------------- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-wrong-moves-n100           | typical-unordered-wrong-moves-n100           |    69 (0.69n) |      69 (0.69n) |  -0.4% |  0.84 / 1.00 |   0.53 / 0.82 |   0.35 / 0.89 |       |
| typical-unordered-wrong-moves-corrected-n100 | typical-unordered-wrong-moves-corrected-n100 |    67 (0.67n) |      70 (0.70n) |  +4.3% |  1.00 / 1.00 |   0.82 / 0.82 |   0.90 / 0.89 |       |
| typical-unordered-multi-move-n100            | typical-unordered-multi-move-n100            |    68 (0.68n) |      68 (0.68n) |  +0.0% |  0.99 / 1.00 |   0.81 / 0.82 |   0.88 / 0.85 |       |
| typical-unordered-probe-near-n100            | typical-unordered-probe-near-n100            |    68 (0.68n) |      68 (0.68n) |  +0.0% |  1.00 / 1.00 |   0.81 / 0.84 |   0.93 / 0.96 |       |
| typical-unordered-probe-far-n100             | typical-unordered-probe-far-n100             |    68 (0.68n) |      68 (0.68n) |  +0.0% |  0.95 / 1.00 |   0.58 / 0.83 |   0.59 / 0.95 |       |

| Group                                        | Change | Censored seeds (candidate / current) |
| -------------------------------------------- | -----: | -----------------------------------: |
| typical-unordered-wrong-moves-n100           |  -0.4% |                                0 / 0 |
| typical-unordered-wrong-moves-corrected-n100 |  +4.3% |                                0 / 0 |
| typical-unordered-multi-move-n100            |  +0.0% |                                0 / 0 |
| typical-unordered-probe-near-n100            |  +0.0% |                                0 / 0 |
| typical-unordered-probe-far-n100             |  +0.0% |                                0 / 0 |

Probes back within 5% after 2n answers:

- current: near 71 of 72 (0.99), 72 made; far 5 of 72 (0.07), 72 made; 0 skipped
- candidate: near 72 of 72 (1.00), 72 made; far 70 of 72 (0.97), 72 made; 0 skipped

## PLACEMENT_SD_FRACTION-0.4

| Scenario                                     | Group                                        | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| -------------------------------------------- | -------------------------------------------- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-wrong-moves-n100           | typical-unordered-wrong-moves-n100           |    69 (0.69n) |      69 (0.69n) |  +0.3% |  0.84 / 1.00 |   0.53 / 0.83 |   0.35 / 0.91 |       |
| typical-unordered-wrong-moves-corrected-n100 | typical-unordered-wrong-moves-corrected-n100 |    67 (0.67n) |      72 (0.72n) |  +6.8% |  1.00 / 1.00 |   0.82 / 0.81 |   0.90 / 0.90 |       |
| typical-unordered-multi-move-n100            | typical-unordered-multi-move-n100            |    68 (0.68n) |      68 (0.68n) |  +0.0% |  0.99 / 1.00 |   0.81 / 0.82 |   0.88 / 0.85 |       |
| typical-unordered-probe-near-n100            | typical-unordered-probe-near-n100            |    68 (0.68n) |      68 (0.68n) |  +0.0% |  1.00 / 1.00 |   0.81 / 0.84 |   0.93 / 0.94 |       |
| typical-unordered-probe-far-n100             | typical-unordered-probe-far-n100             |    68 (0.68n) |      68 (0.68n) |  +0.0% |  0.95 / 1.00 |   0.58 / 0.82 |   0.59 / 0.94 |       |

| Group                                        | Change | Censored seeds (candidate / current) |
| -------------------------------------------- | -----: | -----------------------------------: |
| typical-unordered-wrong-moves-n100           |  +0.3% |                                0 / 0 |
| typical-unordered-wrong-moves-corrected-n100 |  +6.8% |                                0 / 0 |
| typical-unordered-multi-move-n100            |  +0.0% |                                0 / 0 |
| typical-unordered-probe-near-n100            |  +0.0% |                                0 / 0 |
| typical-unordered-probe-far-n100             |  +0.0% |                                0 / 0 |

Probes back within 5% after 2n answers:

- current: near 71 of 72 (0.99), 72 made; far 5 of 72 (0.07), 72 made; 0 skipped
- candidate: near 72 of 72 (1.00), 72 made; far 72 of 72 (1.00), 72 made; 0 skipped

within5 and within1 columns are current / candidate, means over the paired seeds. A change is the mean over paired seeds of (candidate - current) / current.
