# Compare against GROUP_REORDERED_WEIGHT-1

Current: GROUP_REORDERED_WEIGHT-1 (overrides {"GROUP_REORDERED_WEIGHT":1}, picker current, seeds 1 2 3 4 5 6).
Scenarios: filter cal-groups.
Groups: the base models (the mean is over them; every other scenario is a guard).
Seeds are paired by number. A run that never reached the gate counts as its last sample (its budget, or fewer on an early stop) and is counted as censored.

Decision: **GROUP_REORDERED_WEIGHT-1** (no gain).

| Candidate                   | Mean change | Censored seeds (candidate / current) | Verdict                                                                                                                |
| --------------------------- | ----------: | -----------------------------------: | ---------------------------------------------------------------------------------------------------------------------- |
| GROUP_REORDERED_WEIGHT-0.25 |      +13.9% |                                0 / 0 | rejected: more than 10% slower on careful, fuzzy, sloppy, typical-unordered-lazy10-n100, typical-unordered-lazy30-n100 |
| GROUP_REORDERED_WEIGHT-0.5  |       +6.5% |                                0 / 0 | no gain: mean +6.5%, not 2% faster                                                                                     |
| GROUP_REORDERED_WEIGHT-0.75 |       +3.9% |                                0 / 0 | no gain: mean +3.9%, not 2% faster                                                                                     |
| GROUP_REORDERED_WEIGHT-1.25 |       +0.2% |                                0 / 0 | no gain: mean +0.2%, not 2% faster                                                                                     |

## GROUP_REORDERED_WEIGHT-0.25

| Scenario                         | Group   |           Gate, current |         Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| -------------------------------- | ------- | ----------------------: | ----------------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-groups-n100    | typical |              66 (0.66n) |              68 (0.68n) |  +3.9% |  1.00 / 1.00 |   0.98 / 0.92 |   0.99 / 0.98 |       |
| typical-unordered-lazy10-n100    | guard   |              68 (0.68n) |              76 (0.76n) | +12.6% |  1.00 / 1.00 |   0.87 / 0.86 |   0.94 / 0.94 |       |
| typical-unordered-lazy30-n100    | guard   |              90 (0.90n) |             108 (1.07n) | +19.2% |  1.00 / 1.00 |   0.83 / 0.80 |   0.94 / 0.92 |       |
| typical-unordered-corrector-n100 | guard   | 800 (8.00n), 6 censored | 643 (6.43n), 1 censored | -19.6% |  0.55 / 0.97 |   0.06 / 0.14 |   0.19 / 0.56 |       |
| careful-unordered-groups-n100    | careful |              66 (0.66n) |              70 (0.70n) |  +6.5% |  1.00 / 1.00 |   1.00 / 0.99 |   1.00 / 0.99 |       |
| careful-rough-groups-n100        | careful |              44 (0.44n) |              58 (0.57n) | +30.8% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-rough-groups-n100        | typical |              51 (0.51n) |              58 (0.58n) | +15.1% |  1.00 / 1.00 |   0.97 / 0.95 |   1.00 / 0.99 |       |
| fuzzy-unordered-groups-n100      | fuzzy   |              81 (0.81n) |              95 (0.95n) | +18.1% |  1.00 / 1.00 |   0.77 / 0.72 |   0.88 / 0.87 |       |
| fuzzy-rough-groups-n100          | fuzzy   |              70 (0.70n) |              78 (0.78n) | +12.6% |  1.00 / 1.00 |   0.80 / 0.74 |   0.87 / 0.88 |       |
| sloppy-unordered-groups-n100     | sloppy  |              70 (0.70n) |              74 (0.74n) |  +6.4% |  1.00 / 1.00 |   0.96 / 0.92 |   0.99 / 0.97 |       |
| sloppy-rough-groups-n100         | sloppy  |              52 (0.52n) |              61 (0.61n) | +17.8% |  1.00 / 1.00 |   0.96 / 0.94 |   1.00 / 0.97 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| typical |  +9.5% |                                0 / 0 |
| careful | +18.7% |                                0 / 0 |
| fuzzy   | +15.4% |                                0 / 0 |
| sloppy  | +12.1% |                                0 / 0 |

## GROUP_REORDERED_WEIGHT-0.5

| Scenario                         | Group   |           Gate, current |         Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| -------------------------------- | ------- | ----------------------: | ----------------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-groups-n100    | typical |              66 (0.66n) |              68 (0.68n) |  +2.9% |  1.00 / 1.00 |   0.98 / 0.98 |   0.99 / 0.99 |       |
| typical-unordered-lazy10-n100    | guard   |              68 (0.68n) |              73 (0.72n) |  +7.4% |  1.00 / 1.00 |   0.87 / 0.87 |   0.94 / 0.95 |       |
| typical-unordered-lazy30-n100    | guard   |              90 (0.90n) |              94 (0.94n) |  +5.1% |  1.00 / 1.00 |   0.83 / 0.83 |   0.94 / 0.94 |       |
| typical-unordered-corrector-n100 | guard   | 800 (8.00n), 6 censored | 773 (7.73n), 2 censored |  -3.3% |  0.55 / 0.90 |   0.06 / 0.10 |   0.19 / 0.42 |       |
| careful-unordered-groups-n100    | careful |              66 (0.66n) |              65 (0.65n) |  -1.0% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| careful-rough-groups-n100        | careful |              44 (0.44n) |              52 (0.52n) | +17.6% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-rough-groups-n100        | typical |              51 (0.51n) |              56 (0.56n) | +10.3% |  1.00 / 1.00 |   0.97 / 0.96 |   1.00 / 0.98 |       |
| fuzzy-unordered-groups-n100      | fuzzy   |              81 (0.81n) |              88 (0.88n) |  +8.5% |  1.00 / 1.00 |   0.77 / 0.75 |   0.88 / 0.87 |       |
| fuzzy-rough-groups-n100          | fuzzy   |              70 (0.70n) |              73 (0.72n) |  +4.3% |  1.00 / 1.00 |   0.80 / 0.78 |   0.87 / 0.89 |       |
| sloppy-unordered-groups-n100     | sloppy  |              70 (0.70n) |              72 (0.72n) |  +3.0% |  1.00 / 1.00 |   0.96 / 0.95 |   0.99 / 0.99 |       |
| sloppy-rough-groups-n100         | sloppy  |              52 (0.52n) |              55 (0.55n) |  +6.7% |  1.00 / 1.00 |   0.96 / 0.97 |   1.00 / 0.99 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| typical |  +6.6% |                                0 / 0 |
| careful |  +8.3% |                                0 / 0 |
| fuzzy   |  +6.4% |                                0 / 0 |
| sloppy  |  +4.8% |                                0 / 0 |

## GROUP_REORDERED_WEIGHT-0.75

| Scenario                         | Group   |           Gate, current |         Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| -------------------------------- | ------- | ----------------------: | ----------------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-groups-n100    | typical |              66 (0.66n) |              69 (0.69n) |  +5.4% |  1.00 / 1.00 |   0.98 / 0.96 |   0.99 / 0.98 |       |
| typical-unordered-lazy10-n100    | guard   |              68 (0.68n) |              71 (0.71n) |  +5.1% |  1.00 / 1.00 |   0.87 / 0.86 |   0.94 / 0.94 |       |
| typical-unordered-lazy30-n100    | guard   |              90 (0.90n) |              91 (0.91n) |  +1.1% |  1.00 / 1.00 |   0.83 / 0.85 |   0.94 / 0.94 |       |
| typical-unordered-corrector-n100 | guard   | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.55 / 0.72 |   0.06 / 0.07 |   0.19 / 0.28 |       |
| careful-unordered-groups-n100    | careful |              66 (0.66n) |              59 (0.59n) |  -9.9% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| careful-rough-groups-n100        | careful |              44 (0.44n) |              48 (0.47n) |  +8.1% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-rough-groups-n100        | typical |              51 (0.51n) |              56 (0.56n) | +10.6% |  1.00 / 1.00 |   0.97 / 0.98 |   1.00 / 0.99 |       |
| fuzzy-unordered-groups-n100      | fuzzy   |              81 (0.81n) |              90 (0.90n) | +11.5% |  1.00 / 1.00 |   0.77 / 0.79 |   0.88 / 0.88 |       |
| fuzzy-rough-groups-n100          | fuzzy   |              70 (0.70n) |              71 (0.71n) |  +1.4% |  1.00 / 1.00 |   0.80 / 0.77 |   0.87 / 0.89 |       |
| sloppy-unordered-groups-n100     | sloppy  |              70 (0.70n) |              70 (0.70n) |  +0.8% |  1.00 / 1.00 |   0.96 / 0.96 |   0.99 / 0.99 |       |
| sloppy-rough-groups-n100         | sloppy  |              52 (0.52n) |              53 (0.53n) |  +3.0% |  1.00 / 1.00 |   0.96 / 0.98 |   1.00 / 0.99 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| typical |  +8.0% |                                0 / 0 |
| careful |  -0.9% |                                0 / 0 |
| fuzzy   |  +6.4% |                                0 / 0 |
| sloppy  |  +1.9% |                                0 / 0 |

## GROUP_REORDERED_WEIGHT-1.25

| Scenario                         | Group   |           Gate, current |         Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| -------------------------------- | ------- | ----------------------: | ----------------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-groups-n100    | typical |              66 (0.66n) |              65 (0.65n) |  -1.0% |  1.00 / 1.00 |   0.98 / 0.97 |   0.99 / 0.99 |       |
| typical-unordered-lazy10-n100    | guard   |              68 (0.68n) |              73 (0.73n) |  +8.6% |  1.00 / 1.00 |   0.87 / 0.84 |   0.94 / 0.92 |       |
| typical-unordered-lazy30-n100    | guard   |              90 (0.90n) |              91 (0.91n) |  +1.6% |  1.00 / 1.00 |   0.83 / 0.78 |   0.94 / 0.91 |       |
| typical-unordered-corrector-n100 | guard   | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.55 / 0.44 |   0.06 / 0.07 |   0.19 / 0.17 |       |
| careful-unordered-groups-n100    | careful |              66 (0.66n) |              65 (0.65n) |  -0.9% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| careful-rough-groups-n100        | careful |              44 (0.44n) |              45 (0.45n) |  +2.3% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-rough-groups-n100        | typical |              51 (0.51n) |              49 (0.49n) |  -2.2% |  1.00 / 1.00 |   0.97 / 0.99 |   1.00 / 0.99 |       |
| fuzzy-unordered-groups-n100      | fuzzy   |              81 (0.81n) |              92 (0.92n) | +13.4% |  1.00 / 1.00 |   0.77 / 0.76 |   0.88 / 0.88 |       |
| fuzzy-rough-groups-n100          | fuzzy   |              70 (0.70n) |              68 (0.68n) |  -2.0% |  1.00 / 1.00 |   0.80 / 0.76 |   0.87 / 0.87 |       |
| sloppy-unordered-groups-n100     | sloppy  |              70 (0.70n) |              68 (0.68n) |  -1.7% |  1.00 / 1.00 |   0.96 / 0.98 |   0.99 / 0.99 |       |
| sloppy-rough-groups-n100         | sloppy  |              52 (0.52n) |              48 (0.48n) |  -6.1% |  1.00 / 1.00 |   0.96 / 0.96 |   1.00 / 0.98 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| typical |  -1.6% |                                0 / 0 |
| careful |  +0.7% |                                0 / 0 |
| fuzzy   |  +5.7% |                                0 / 0 |
| sloppy  |  -3.9% |                                0 / 0 |

within5 and within1 columns are current / candidate, means over the paired seeds. A change is the mean over paired seeds of (candidate - current) / current.
