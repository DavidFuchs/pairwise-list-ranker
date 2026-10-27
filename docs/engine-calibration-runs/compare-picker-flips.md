# Compare against picker-before-flips

Current: picker-before-flips (overrides {}, picker current, seeds 1 2 3 4 5 6 7 8 9 10 11 12).
Scenarios: every scenario of the current file.
Groups: the base models (the mean is over them; every other scenario is a guard).
Seeds are paired by number. A run that never reached the gate counts as its last sample (its budget, or fewer on an early stop) and is counted as censored.

Decision: **picker-flips** (fewest answers to the gate: -2.5% against picker-before-flips).

| Candidate    | Mean change | Censored seeds (candidate / current) | Verdict            |
| ------------ | ----------: | -----------------------------------: | ------------------ |
| picker-flips |       -2.5% |                                0 / 0 | chosen: mean -2.5% |

## picker-flips

| Scenario                     | Group   | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ---------------------------- | ------- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-pairs-n100 | typical |   325 (3.25n) |     315 (3.15n) |  -2.8% |  1.00 / 1.00 |   0.57 / 0.63 |   0.90 / 0.93 |       |
| careful-unordered-pairs-n100 | careful |   363 (3.63n) |     338 (3.38n) |  -6.6% |  1.00 / 1.00 |   0.56 / 0.66 |   1.00 / 1.00 |       |
| careful-rough-pairs-n100     | careful |   290 (2.90n) |     264 (2.64n) |  -8.1% |  1.00 / 1.00 |   0.83 / 0.93 |   1.00 / 1.00 |       |
| typical-rough-pairs-n100     | typical |   282 (2.82n) |     274 (2.74n) |  -2.6% |  1.00 / 1.00 |   0.72 / 0.74 |   0.92 / 0.96 |       |
| fuzzy-unordered-pairs-n100   | fuzzy   |   380 (3.80n) |     356 (3.56n) |  -5.6% |  1.00 / 1.00 |   0.41 / 0.40 |   0.62 / 0.67 |       |
| fuzzy-rough-pairs-n100       | fuzzy   |   342 (3.42n) |     361 (3.61n) |  +5.9% |  1.00 / 1.00 |   0.42 / 0.42 |   0.64 / 0.66 |       |
| sloppy-unordered-pairs-n100  | sloppy  |   453 (4.53n) |     467 (4.67n) |  +3.6% |  0.99 / 0.98 |   0.40 / 0.39 |   0.77 / 0.79 |       |
| sloppy-rough-pairs-n100      | sloppy  |   363 (3.63n) |     336 (3.36n) |  -3.6% |  1.00 / 1.00 |   0.54 / 0.57 |   0.81 / 0.91 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| typical |  -2.7% |                                0 / 0 |
| careful |  -7.4% |                                0 / 0 |
| fuzzy   |  +0.1% |                                0 / 0 |
| sloppy  |  +0.0% |                                0 / 0 |

within5 and within1 columns are current / candidate, means over the paired seeds. A change is the mean over paired seeds of (candidate - current) / current.
