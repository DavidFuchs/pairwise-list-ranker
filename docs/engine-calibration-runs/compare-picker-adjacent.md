# Compare against picker-current

Current: picker-current (overrides {}, picker current, seeds 1 2 3 4 5 6 7 8 9 10 11 12).
Scenarios: filter cal-pairs|cal-auto.
Groups: the base models (the mean is over them; every other scenario is a guard).
Seeds are paired by number. A run that never reached the gate counts as its last sample (its budget, or fewer on an early stop) and is counted as censored.

Decision: **picker-current** (no gain).

| Candidate       | Mean change | Censored seeds (candidate / current) | Verdict                                            |
| --------------- | ----------: | -----------------------------------: | -------------------------------------------------- |
| picker-adjacent |      +17.5% |                                0 / 0 | rejected: more than 10% slower on careful, typical |

## picker-adjacent

| Scenario                     | Group   | Gate, current | Gate, candidate |  Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ---------------------------- | ------- | ------------: | --------------: | ------: | -----------: | ------------: | ------------: | ----- |
| careful-unordered-n100       | careful |    65 (0.65n) |     145 (1.45n) | +129.9% |  1.00 / 1.00 |   1.00 / 0.87 |   1.00 / 1.00 |       |
| careful-rough-n100           | careful |    53 (0.53n) |      75 (0.75n) |  +37.9% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-unordered-n100       | typical |    68 (0.68n) |     117 (1.17n) |  +72.6% |  1.00 / 1.00 |   0.86 / 0.85 |   0.96 / 0.98 |       |
| typical-rough-n100           | typical |    62 (0.62n) |      73 (0.73n) |  +21.4% |  1.00 / 1.00 |   0.84 / 0.89 |   0.95 / 0.98 |       |
| fuzzy-unordered-n100         | fuzzy   |    87 (0.87n) |      88 (0.88n) |   +1.7% |  1.00 / 1.00 |   0.57 / 0.60 |   0.74 / 0.75 |       |
| fuzzy-rough-n100             | fuzzy   |   142 (1.42n) |     160 (1.60n) |  +21.8% |  1.00 / 1.00 |   0.55 / 0.55 |   0.68 / 0.70 |       |
| sloppy-unordered-n100        | sloppy  |    70 (0.70n) |      68 (0.68n) |   -3.4% |  1.00 / 1.00 |   0.82 / 0.90 |   0.93 / 0.97 |       |
| sloppy-rough-n100            | sloppy  |    72 (0.72n) |      68 (0.68n) |   -0.8% |  1.00 / 1.00 |   0.82 / 0.85 |   0.92 / 0.96 |       |
| typical-unordered-pairs-n100 | typical |   325 (3.25n) |     322 (3.22n) |   -0.4% |  1.00 / 1.00 |   0.57 / 0.59 |   0.90 / 0.95 |       |
| careful-unordered-pairs-n100 | careful |   363 (3.63n) |     347 (3.47n) |   -4.3% |  1.00 / 1.00 |   0.56 / 0.63 |   1.00 / 1.00 |       |
| careful-rough-pairs-n100     | careful |   290 (2.90n) |     278 (2.78n) |   -3.4% |  1.00 / 1.00 |   0.83 / 0.85 |   1.00 / 1.00 |       |
| typical-rough-pairs-n100     | typical |   282 (2.82n) |     286 (2.86n) |   +1.8% |  1.00 / 1.00 |   0.72 / 0.74 |   0.92 / 0.95 |       |
| fuzzy-unordered-pairs-n100   | fuzzy   |   380 (3.80n) |     376 (3.76n) |   -0.6% |  1.00 / 1.00 |   0.41 / 0.42 |   0.62 / 0.65 |       |
| fuzzy-rough-pairs-n100       | fuzzy   |   342 (3.42n) |     350 (3.50n) |   +2.2% |  1.00 / 1.00 |   0.42 / 0.41 |   0.64 / 0.64 |       |
| sloppy-unordered-pairs-n100  | sloppy  |   453 (4.53n) |     473 (4.73n) |   +5.4% |  0.99 / 0.98 |   0.40 / 0.42 |   0.77 / 0.78 |       |
| sloppy-rough-pairs-n100      | sloppy  |   363 (3.63n) |     351 (3.51n) |   -2.0% |  1.00 / 1.00 |   0.54 / 0.53 |   0.81 / 0.88 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| careful | +40.0% |                                0 / 0 |
| typical | +23.8% |                                0 / 0 |
| fuzzy   |  +6.3% |                                0 / 0 |
| sloppy  |  -0.2% |                                0 / 0 |

within5 and within1 columns are current / candidate, means over the paired seeds. A change is the mean over paired seeds of (candidate - current) / current.
