# Compare against REPEAT_FACTOR-0.3

Current: REPEAT_FACTOR-0.3 (overrides {"REPEAT_FACTOR":0.3}, picker current, seeds 1 2 3 4 5 6 7 8 9 10 11 12).
Scenarios: filter cal-pairs.
Groups: the base models (the mean is over them; every other scenario is a guard).
Seeds are paired by number. A run that never reached the gate counts as its last sample (its budget, or fewer on an early stop) and is counted as censored.

Decision: **REPEAT_FACTOR-0.3** (no gain).

| Candidate         | Mean change | Censored seeds (candidate / current) | Verdict                            |
| ----------------- | ----------: | -----------------------------------: | ---------------------------------- |
| REPEAT_FACTOR-0.1 |       +0.2% |                                0 / 0 | no gain: mean +0.2%, not 2% faster |
| REPEAT_FACTOR-0.5 |       +0.5% |                                0 / 0 | no gain: mean +0.5%, not 2% faster |

## REPEAT_FACTOR-0.1

| Scenario                     | Group   | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ---------------------------- | ------- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-pairs-n100 | typical |   325 (3.25n) |     325 (3.25n) |  +0.0% |  1.00 / 1.00 |   0.57 / 0.57 |   0.90 / 0.90 |       |
| careful-unordered-pairs-n100 | careful |   363 (3.63n) |     363 (3.63n) |  +0.0% |  1.00 / 1.00 |   0.56 / 0.56 |   1.00 / 1.00 |       |
| careful-rough-pairs-n100     | careful |   290 (2.90n) |     290 (2.90n) |  +0.0% |  1.00 / 1.00 |   0.83 / 0.83 |   1.00 / 1.00 |       |
| typical-rough-pairs-n100     | typical |   282 (2.82n) |     282 (2.82n) |  +0.0% |  1.00 / 1.00 |   0.72 / 0.71 |   0.92 / 0.91 |       |
| fuzzy-unordered-pairs-n100   | fuzzy   |   380 (3.80n) |     380 (3.80n) |  +0.0% |  1.00 / 1.00 |   0.41 / 0.41 |   0.62 / 0.62 |       |
| fuzzy-rough-pairs-n100       | fuzzy   |   342 (3.42n) |     342 (3.42n) |  +0.0% |  1.00 / 1.00 |   0.42 / 0.42 |   0.64 / 0.65 |       |
| sloppy-unordered-pairs-n100  | sloppy  |   453 (4.53n) |     460 (4.60n) |  +1.6% |  0.99 / 0.99 |   0.40 / 0.40 |   0.77 / 0.77 |       |
| sloppy-rough-pairs-n100      | sloppy  |   363 (3.63n) |     364 (3.64n) |  +0.2% |  1.00 / 1.00 |   0.54 / 0.55 |   0.81 / 0.81 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| typical |  +0.0% |                                0 / 0 |
| careful |  +0.0% |                                0 / 0 |
| fuzzy   |  +0.0% |                                0 / 0 |
| sloppy  |  +0.9% |                                0 / 0 |

## REPEAT_FACTOR-0.5

| Scenario                     | Group   | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ---------------------------- | ------- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-pairs-n100 | typical |   325 (3.25n) |     325 (3.25n) |  -0.0% |  1.00 / 1.00 |   0.57 / 0.59 |   0.90 / 0.91 |       |
| careful-unordered-pairs-n100 | careful |   363 (3.63n) |     360 (3.60n) |  -0.6% |  1.00 / 1.00 |   0.56 / 0.58 |   1.00 / 1.00 |       |
| careful-rough-pairs-n100     | careful |   290 (2.90n) |     290 (2.90n) |  +0.0% |  1.00 / 1.00 |   0.83 / 0.81 |   1.00 / 1.00 |       |
| typical-rough-pairs-n100     | typical |   282 (2.82n) |     283 (2.83n) |  +0.3% |  1.00 / 1.00 |   0.72 / 0.72 |   0.92 / 0.94 |       |
| fuzzy-unordered-pairs-n100   | fuzzy   |   380 (3.80n) |     380 (3.80n) |  +0.0% |  1.00 / 1.00 |   0.41 / 0.41 |   0.62 / 0.62 |       |
| fuzzy-rough-pairs-n100       | fuzzy   |   342 (3.42n) |     342 (3.42n) |  +0.0% |  1.00 / 1.00 |   0.42 / 0.42 |   0.64 / 0.66 |       |
| sloppy-unordered-pairs-n100  | sloppy  |   453 (4.53n) |     461 (4.61n) |  +2.0% |  0.99 / 0.99 |   0.40 / 0.41 |   0.77 / 0.76 |       |
| sloppy-rough-pairs-n100      | sloppy  |   363 (3.63n) |     370 (3.70n) |  +2.0% |  1.00 / 1.00 |   0.54 / 0.55 |   0.81 / 0.84 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| typical |  +0.2% |                                0 / 0 |
| careful |  -0.3% |                                0 / 0 |
| fuzzy   |  +0.0% |                                0 / 0 |
| sloppy  |  +2.0% |                                0 / 0 |

within5 and within1 columns are current / candidate, means over the paired seeds. A change is the mean over paired seeds of (candidate - current) / current.
