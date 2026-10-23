# Compare against baseline

Current: baseline (overrides {}, picker current, seeds 1 2 3).
Scenarios: every scenario of the current file.
Groups: the base models (the mean is over them; every other scenario is a guard).
Seeds are paired by number. A run that never reached the gate counts as its last sample (its budget, or fewer on an early stop) and is counted as censored.

Decision: **baseline** (no gain).

| Candidate  | Mean change | Censored seeds (candidate / current) | Verdict                                                                                      |
| ---------- | ----------: | -----------------------------------: | -------------------------------------------------------------------------------------------- |
| calibrated |       +0.6% |                                0 / 0 | rejected: more than 10% slower on typical-unordered-lazy10-n100, typical-unordered-gaps-n100 |

## calibrated

| Scenario                                         | Group   |            Gate, current |          Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ------------------------------------------------ | ------- | -----------------------: | -----------------------: | -----: | -----------: | ------------: | ------------: | ----- |
| careful-unordered-n100                           | careful |               65 (0.65n) |               65 (0.65n) |  +0.2% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| careful-rough-n100                               | careful |               45 (0.45n) |               53 (0.53n) | +19.9% |  1.00 / 1.00 |   1.00 / 0.99 |   1.00 / 1.00 |       |
| careful-ranked-n100                              | careful |                0 (0.00n) |                0 (0.00n) |  +0.0% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-unordered-n100                           | typical |               67 (0.67n) |               70 (0.70n) |  +4.9% |  1.00 / 1.00 |   0.91 / 0.85 |   0.97 / 0.95 |       |
| typical-rough-n100                               | typical |               57 (0.57n) |               55 (0.55n) |  -2.3% |  1.00 / 1.00 |   0.87 / 0.91 |   0.94 / 0.94 |       |
| typical-ranked-n100                              | typical |                0 (0.00n) |                0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.93 / 0.93 |   0.98 / 0.98 |       |
| fuzzy-unordered-n100                             | fuzzy   |               82 (0.82n) |               93 (0.93n) | +14.5% |  1.00 / 1.00 |   0.57 / 0.59 |   0.67 / 0.76 |       |
| fuzzy-rough-n100                                 | fuzzy   |              128 (1.28n) |               75 (0.75n) | -33.0% |  1.00 / 1.00 |   0.51 / 0.58 |   0.73 / 0.68 |       |
| fuzzy-ranked-n100                                | fuzzy   |                0 (0.00n) |                0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.73 / 0.73 |   0.77 / 0.77 |       |
| sloppy-unordered-n100                            | sloppy  |               75 (0.75n) |               72 (0.72n) |  -4.3% |  1.00 / 1.00 |   0.86 / 0.85 |   0.93 / 0.92 |       |
| sloppy-rough-n100                                | sloppy  |               55 (0.55n) |               55 (0.55n) |  -0.3% |  1.00 / 1.00 |   0.81 / 0.83 |   0.95 / 0.91 |       |
| sloppy-ranked-n100                               | sloppy  |                0 (0.00n) |                0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.88 / 0.88 |   0.95 / 0.95 |       |
| careful-unordered-n400                           | careful |              267 (0.67n) |              273 (0.68n) |  +2.6% |  1.00 / 1.00 |   1.00 / 0.98 |   1.00 / 1.00 |       |
| careful-rough-n400                               | careful |              207 (0.52n) |              220 (0.55n) |  +6.7% |  1.00 / 1.00 |   0.99 / 1.00 |   1.00 / 1.00 |       |
| careful-ranked-n400                              | careful |                0 (0.00n) |                0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.99 / 0.99 |   1.00 / 1.00 |       |
| typical-unordered-n400                           | typical |              280 (0.70n) |              280 (0.70n) |  +0.0% |  1.00 / 1.00 |   0.79 / 0.77 |   0.91 / 0.91 |       |
| typical-rough-n400                               | typical |              227 (0.57n) |              220 (0.55n) |  -2.3% |  1.00 / 1.00 |   0.71 / 0.83 |   0.89 / 0.92 |       |
| typical-ranked-n400                              | typical |                0 (0.00n) |                0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.78 / 0.78 |   0.91 / 0.91 |       |
| fuzzy-unordered-n400                             | fuzzy   |              400 (1.00n) |              460 (1.15n) | +16.0% |  1.00 / 1.00 |   0.42 / 0.44 |   0.55 / 0.57 |       |
| fuzzy-rough-n400                                 | fuzzy   |             1000 (2.50n) |              360 (0.90n) | -63.3% |  1.00 / 1.00 |   0.34 / 0.45 |   0.46 / 0.58 |       |
| fuzzy-ranked-n400                                | fuzzy   |                0 (0.00n) |                0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.53 / 0.53 |   0.63 / 0.63 |       |
| sloppy-unordered-n400                            | sloppy  |              293 (0.73n) |              313 (0.78n) |  +6.8% |  1.00 / 1.00 |   0.75 / 0.75 |   0.88 / 0.87 |       |
| sloppy-rough-n400                                | sloppy  |              227 (0.57n) |              233 (0.58n) |  +5.2% |  1.00 / 1.00 |   0.68 / 0.79 |   0.86 / 0.89 |       |
| sloppy-ranked-n400                               | sloppy  |                0 (0.00n) |                0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.78 / 0.78 |   0.90 / 0.90 |       |
| typical-unordered-groups-n100                    | typical |               67 (0.67n) |               70 (0.70n) |  +4.9% |  1.00 / 1.00 |   0.97 / 0.99 |   0.99 / 1.00 |       |
| typical-unordered-pairs-n100                     | typical |              342 (3.42n) |              342 (3.42n) |  +0.0% |  1.00 / 1.00 |   0.56 / 0.56 |   0.90 / 0.90 |       |
| typical-unordered-groups-n400                    | typical |              280 (0.70n) |              280 (0.70n) |  +0.0% |  1.00 / 1.00 |   0.94 / 0.93 |   0.99 / 0.98 |       |
| typical-unordered-pairs-n400                     | typical |             1427 (3.57n) |             1427 (3.57n) |  +0.0% |  1.00 / 1.00 |   0.40 / 0.40 |   0.80 / 0.80 |       |
| typical-unordered-lazy10-n100                    | guard   |               65 (0.65n) |               73 (0.73n) | +12.8% |  1.00 / 1.00 |   0.88 / 0.90 |   0.95 / 0.95 |       |
| typical-unordered-lazy30-n100                    | guard   |               90 (0.90n) |               90 (0.90n) |  +0.7% |  1.00 / 1.00 |   0.82 / 0.85 |   0.95 / 0.94 |       |
| typical-unordered-corrector-n100                 | guard   |  800 (8.00n), 3 censored |  800 (8.00n), 2 censored |  +0.0% |  0.53 / 0.87 |   0.06 / 0.09 |   0.19 / 0.37 |       |
| typical-unordered-strong-rarely-n100             | guard   |               67 (0.67n) |               70 (0.70n) |  +4.9% |  1.00 / 1.00 |   0.91 / 0.85 |   0.97 / 0.95 |       |
| typical-unordered-strong-inconsistent-n100       | guard   |               67 (0.67n) |               70 (0.70n) |  +4.9% |  1.00 / 1.00 |   0.91 / 0.85 |   0.97 / 0.95 |       |
| typical-unordered-ties-n100                      | guard   |               63 (0.63n) |               62 (0.62n) |  -2.4% |  1.00 / 1.00 |   0.99 / 0.98 |   1.00 / 0.99 |       |
| typical-unordered-gaps-n100                      | guard   |              112 (1.12n) |              133 (1.33n) | +23.8% |  0.99 / 0.99 |   0.47 / 0.52 |   0.62 / 0.57 |       |
| typical-ranked-loose-n100                        | guard   |  800 (8.00n), 3 censored |  800 (8.00n), 3 censored |  +0.0% |  0.79 / 0.79 |   0.17 / 0.17 |   0.37 / 0.37 |       |
| typical-ranked-reversed-sections-n100            | guard   |  767 (7.67n), 1 censored |  767 (7.67n), 1 censored |  +0.0% |  0.94 / 0.94 |   0.06 / 0.06 |   0.65 / 0.65 |       |
| typical-unordered-wrong-moves-n100               | guard   |               70 (0.70n) |               68 (0.68n) |  -2.4% |  0.87 / 0.99 |   0.52 / 0.76 |   0.36 / 0.83 |       |
| typical-unordered-wrong-moves-corrected-n100     | guard   |               70 (0.70n) |               67 (0.67n) |  -4.8% |  1.00 / 1.00 |   0.88 / 0.88 |   0.91 / 0.93 |       |
| typical-unordered-multi-move-n100                | guard   |               67 (0.67n) |               70 (0.70n) |  +4.9% |  1.00 / 1.00 |   0.85 / 0.82 |   0.94 / 0.88 |       |
| typical-unordered-marked-n100                    | guard   |               68 (0.68n) |               67 (0.67n) |  -2.4% |  1.00 / 1.00 |   0.94 / 0.95 |   0.98 / 0.99 |       |
| typical-unordered-big-edit-n100                  | guard   |               67 (0.67n) |               70 (0.70n) |  +4.9% |  1.00 / 1.00 |   0.91 / 0.85 |   0.81 / 0.81 |       |
| typical-unordered-lazy30-n400                    | guard   |              413 (1.03n) |              427 (1.07n) |  +3.2% |  1.00 / 1.00 |   0.70 / 0.68 |   0.88 / 0.87 |       |
| careful-unordered-groups-n100                    | careful |               65 (0.65n) |               65 (0.65n) |  +0.2% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| careful-unordered-pairs-n100                     | careful |              365 (3.65n) |              365 (3.65n) |  +0.0% |  1.00 / 1.00 |   0.57 / 0.57 |   1.00 / 1.00 |       |
| careful-rough-groups-n100                        | careful |               45 (0.45n) |               53 (0.53n) | +19.9% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 0.99 |       |
| careful-rough-pairs-n100                         | careful |              292 (2.92n) |              292 (2.92n) |  +0.0% |  1.00 / 1.00 |   0.82 / 0.82 |   1.00 / 1.00 |       |
| typical-rough-groups-n100                        | typical |               53 (0.53n) |               55 (0.55n) |  +3.3% |  1.00 / 1.00 |   0.98 / 0.97 |   1.00 / 0.98 |       |
| typical-rough-pairs-n100                         | typical |              278 (2.78n) |              278 (2.78n) |  +0.0% |  1.00 / 1.00 |   0.73 / 0.73 |   0.91 / 0.91 |       |
| fuzzy-unordered-groups-n100                      | fuzzy   |               82 (0.82n) |               93 (0.93n) | +14.5% |  1.00 / 1.00 |   0.78 / 0.71 |   0.89 / 0.87 |       |
| fuzzy-unordered-pairs-n100                       | fuzzy   |              397 (3.97n) |              397 (3.97n) |  +0.0% |  1.00 / 1.00 |   0.41 / 0.41 |   0.65 / 0.65 |       |
| fuzzy-rough-groups-n100                          | fuzzy   |               67 (0.67n) |               75 (0.75n) | +12.7% |  1.00 / 1.00 |   0.79 / 0.81 |   0.87 / 0.86 |       |
| fuzzy-rough-pairs-n100                           | fuzzy   |              348 (3.48n) |              348 (3.48n) |  +0.0% |  1.00 / 1.00 |   0.40 / 0.40 |   0.67 / 0.67 |       |
| sloppy-unordered-groups-n100                     | sloppy  |               75 (0.75n) |               72 (0.72n) |  -4.3% |  1.00 / 1.00 |   0.95 / 0.94 |   0.99 / 0.98 |       |
| sloppy-unordered-pairs-n100                      | sloppy  |              503 (5.03n) |              503 (5.03n) |  +0.0% |  0.98 / 0.98 |   0.38 / 0.38 |   0.64 / 0.64 |       |
| sloppy-rough-groups-n100                         | sloppy  |               53 (0.53n) |               55 (0.55n) |  +3.0% |  1.00 / 1.00 |   0.96 / 0.96 |   1.00 / 0.98 |       |
| sloppy-rough-pairs-n100                          | sloppy  |              312 (3.12n) |              312 (3.12n) |  +0.0% |  1.00 / 1.00 |   0.57 / 0.57 |   0.78 / 0.78 |       |
| typical-unordered-strong-often-pairs-n100        | guard   |              342 (3.42n) |              342 (3.42n) |  +0.0% |  1.00 / 1.00 |   0.56 / 0.56 |   0.90 / 0.90 |       |
| typical-unordered-strong-rarely-pairs-n100       | guard   |              337 (3.37n) |              337 (3.37n) |  +0.0% |  1.00 / 1.00 |   0.57 / 0.57 |   0.92 / 0.92 |       |
| typical-unordered-strong-inconsistent-pairs-n100 | guard   |              335 (3.35n) |              335 (3.35n) |  +0.0% |  1.00 / 1.00 |   0.60 / 0.60 |   0.91 / 0.91 |       |
| typical-unordered-corrector-n400                 | guard   | 3200 (8.00n), 3 censored | 3200 (8.00n), 3 censored |  +0.0% |  0.33 / 0.78 |   0.05 / 0.05 |   0.09 / 0.29 |       |
| typical-unordered-probe-near-n100                | guard   |               67 (0.67n) |               70 (0.70n) |  +4.9% |  1.00 / 1.00 |   0.91 / 0.84 |   0.97 / 0.94 |       |
| typical-unordered-probe-far-n100                 | guard   |               67 (0.67n) |               70 (0.70n) |  +4.9% |  0.95 / 1.00 |   0.58 / 0.78 |   0.58 / 0.91 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| careful |  +4.9% |                                0 / 0 |
| typical |  +0.7% |                                0 / 0 |
| fuzzy   |  -3.9% |                                0 / 0 |
| sloppy  |  +0.6% |                                0 / 0 |

Probes back within 5% after 2n answers:

- current: near 18 of 18 (1.00), 18 made; far 0 of 18 (0.00), 18 made; 0 skipped
- candidate: near 18 of 18 (1.00), 18 made; far 16 of 18 (0.89), 18 made; 0 skipped

within5 and within1 columns are current / candidate, means over the paired seeds. A change is the mean over paired seeds of (candidate - current) / current.
