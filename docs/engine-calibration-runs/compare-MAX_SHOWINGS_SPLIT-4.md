# Compare against MAX_SHOWINGS_SPLIT-3

Current: MAX_SHOWINGS_SPLIT-3 (overrides {"MAX_SHOWINGS_SPLIT":3}, picker current, seeds 1 2 3 4 5 6).
Scenarios: every scenario of the current file.
Groups: each drift scenario its own (the mean is over them; every other scenario is a guard).
Seeds are paired by number. A run that never reached the gate counts as its last sample (its budget, or fewer on an early stop) and is counted as censored.

Decision: **MAX_SHOWINGS_SPLIT-3** (no gain).

| Candidate            | Mean change | Censored seeds (candidate / current) | Verdict                            |
| -------------------- | ----------: | -----------------------------------: | ---------------------------------- |
| MAX_SHOWINGS_SPLIT-4 |       -0.6% |                                0 / 0 | no gain: mean -0.6%, not 2% faster |
| MAX_SHOWINGS_SPLIT-5 |       +1.3% |                                0 / 0 | no gain: mean +1.3%, not 2% faster |
| MAX_SHOWINGS_SPLIT-6 |       +1.3% |                                0 / 0 | no gain: mean +1.3%, not 2% faster |
| MAX_SHOWINGS_SPLIT-8 |       +1.3% |                                0 / 0 | no gain: mean +1.3%, not 2% faster |

## MAX_SHOWINGS_SPLIT-4

| Scenario                              | Group                        |           Gate, current |         Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Top spot rests | Notes |
| ------------------------------------- | ---------------------------- | ----------------------: | ----------------------: | -----: | -----------: | ------------: | ------------: | -------------: | ----- |
| typical-ranked-n100                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.91 / 0.91 |   0.98 / 0.97 |    0.00 / 0.00 |       |
| typical-ranked-n400                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.79 / 0.79 |   0.91 / 0.91 |    0.00 / 0.00 |       |
| typical-unordered-pairs-n100          | guard                        |             315 (3.15n) |             315 (3.15n) |  +0.0% |  1.00 / 1.00 |   0.65 / 0.65 |   0.93 / 0.93 |    0.00 / 0.00 |       |
| typical-ranked-loose-n100             | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.63 / 0.63 |   0.18 / 0.18 |   0.30 / 0.30 |    0.00 / 0.00 |       |
| typical-ranked-reversed-sections-n100 | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.13 / 0.13 |   0.09 / 0.09 |   0.01 / 0.01 |    0.00 / 0.00 |       |
| careful-unordered-pairs-n100          | guard                        |             334 (3.34n) |             334 (3.34n) |  +0.0% |  1.00 / 1.00 |   0.66 / 0.66 |   1.00 / 1.00 |    0.00 / 0.00 |       |
| careful-rough-pairs-n100              | guard                        |             260 (2.60n) |             260 (2.60n) |  +0.0% |  1.00 / 1.00 |   0.95 / 0.95 |   1.00 / 1.00 |    0.00 / 0.00 |       |
| typical-rough-pairs-n100              | guard                        |             272 (2.72n) |             272 (2.72n) |  +0.0% |  1.00 / 1.00 |   0.74 / 0.74 |   0.95 / 0.95 |    0.00 / 0.00 |       |
| fuzzy-unordered-pairs-n100            | guard                        |             366 (3.66n) |             366 (3.66n) |  +0.0% |  1.00 / 1.00 |   0.38 / 0.38 |   0.66 / 0.66 |    0.00 / 0.00 |       |
| fuzzy-rough-pairs-n100                | guard                        |             372 (3.72n) |             372 (3.72n) |  +0.0% |  1.00 / 1.00 |   0.39 / 0.39 |   0.65 / 0.65 |    0.00 / 0.00 |       |
| sloppy-unordered-pairs-n100           | guard                        |             498 (4.97n) |             498 (4.97n) |  +0.0% |  0.98 / 0.98 |   0.36 / 0.36 |   0.75 / 0.75 |    0.00 / 0.00 |       |
| sloppy-rough-pairs-n100               | guard                        |             333 (3.33n) |             333 (3.33n) |  +0.0% |  1.00 / 1.00 |   0.59 / 0.59 |   0.92 / 0.92 |    0.00 / 0.00 |       |
| typical-unordered-drift-n6            | typical-unordered-drift-n6   |              16 (2.64n) |              15 (2.42n) |  -7.0% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |      n/a / n/a |       |
| typical-unordered-drift-n12           | typical-unordered-drift-n12  |              29 (2.42n) |              29 (2.40n) |  +5.3% |  1.00 / 1.00 |   1.00 / 1.00 |   0.96 / 0.96 |    0.00 / 0.00 |       |
| typical-unordered-drift-n100          | typical-unordered-drift-n100 |             421 (4.21n) |             421 (4.21n) |  +0.0% |  0.99 / 0.99 |   0.46 / 0.46 |   0.49 / 0.49 |      n/a / n/a |       |

| Group                        | Change | Censored seeds (candidate / current) |
| ---------------------------- | -----: | -----------------------------------: |
| typical-unordered-drift-n6   |  -7.0% |                                0 / 0 |
| typical-unordered-drift-n12  |  +5.3% |                                0 / 0 |
| typical-unordered-drift-n100 |  +0.0% |                                0 / 0 |

## MAX_SHOWINGS_SPLIT-5

| Scenario                              | Group                        |           Gate, current |         Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Top spot rests | Notes |
| ------------------------------------- | ---------------------------- | ----------------------: | ----------------------: | -----: | -----------: | ------------: | ------------: | -------------: | ----- |
| typical-ranked-n100                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.91 / 0.91 |   0.98 / 0.97 |    0.00 / 0.00 |       |
| typical-ranked-n400                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.79 / 0.79 |   0.91 / 0.91 |    0.00 / 0.00 |       |
| typical-unordered-pairs-n100          | guard                        |             315 (3.15n) |             315 (3.15n) |  +0.0% |  1.00 / 1.00 |   0.65 / 0.65 |   0.93 / 0.93 |    0.00 / 0.00 |       |
| typical-ranked-loose-n100             | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.63 / 0.63 |   0.18 / 0.18 |   0.30 / 0.30 |    0.00 / 0.00 |       |
| typical-ranked-reversed-sections-n100 | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.13 / 0.13 |   0.09 / 0.09 |   0.01 / 0.01 |    0.00 / 0.00 |       |
| careful-unordered-pairs-n100          | guard                        |             334 (3.34n) |             334 (3.34n) |  +0.0% |  1.00 / 1.00 |   0.66 / 0.66 |   1.00 / 1.00 |    0.00 / 0.00 |       |
| careful-rough-pairs-n100              | guard                        |             260 (2.60n) |             260 (2.60n) |  +0.0% |  1.00 / 1.00 |   0.95 / 0.95 |   1.00 / 1.00 |    0.00 / 0.00 |       |
| typical-rough-pairs-n100              | guard                        |             272 (2.72n) |             272 (2.72n) |  +0.0% |  1.00 / 1.00 |   0.74 / 0.74 |   0.95 / 0.95 |    0.00 / 0.00 |       |
| fuzzy-unordered-pairs-n100            | guard                        |             366 (3.66n) |             366 (3.66n) |  +0.0% |  1.00 / 1.00 |   0.38 / 0.38 |   0.66 / 0.66 |    0.00 / 0.00 |       |
| fuzzy-rough-pairs-n100                | guard                        |             372 (3.72n) |             372 (3.72n) |  +0.0% |  1.00 / 1.00 |   0.39 / 0.39 |   0.65 / 0.65 |    0.00 / 0.00 |       |
| sloppy-unordered-pairs-n100           | guard                        |             498 (4.97n) |             498 (4.97n) |  +0.0% |  0.98 / 0.98 |   0.36 / 0.36 |   0.75 / 0.75 |    0.00 / 0.00 |       |
| sloppy-rough-pairs-n100               | guard                        |             333 (3.33n) |             333 (3.33n) |  +0.0% |  1.00 / 1.00 |   0.59 / 0.59 |   0.92 / 0.92 |    0.00 / 0.00 |       |
| typical-unordered-drift-n6            | typical-unordered-drift-n6   |              16 (2.64n) |              15 (2.53n) |  -2.3% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |      n/a / n/a |       |
| typical-unordered-drift-n12           | typical-unordered-drift-n12  |              29 (2.42n) |              29 (2.44n) |  +6.1% |  1.00 / 1.00 |   1.00 / 1.00 |   0.96 / 0.96 |    0.00 / 0.00 |       |
| typical-unordered-drift-n100          | typical-unordered-drift-n100 |             421 (4.21n) |             421 (4.21n) |  +0.0% |  0.99 / 0.99 |   0.46 / 0.46 |   0.49 / 0.49 |      n/a / n/a |       |

| Group                        | Change | Censored seeds (candidate / current) |
| ---------------------------- | -----: | -----------------------------------: |
| typical-unordered-drift-n6   |  -2.3% |                                0 / 0 |
| typical-unordered-drift-n12  |  +6.1% |                                0 / 0 |
| typical-unordered-drift-n100 |  +0.0% |                                0 / 0 |

## MAX_SHOWINGS_SPLIT-6

| Scenario                              | Group                        |           Gate, current |         Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Top spot rests | Notes |
| ------------------------------------- | ---------------------------- | ----------------------: | ----------------------: | -----: | -----------: | ------------: | ------------: | -------------: | ----- |
| typical-ranked-n100                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.91 / 0.91 |   0.98 / 0.97 |    0.00 / 0.00 |       |
| typical-ranked-n400                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.79 / 0.79 |   0.91 / 0.91 |    0.00 / 0.00 |       |
| typical-unordered-pairs-n100          | guard                        |             315 (3.15n) |             315 (3.15n) |  +0.0% |  1.00 / 1.00 |   0.65 / 0.65 |   0.93 / 0.93 |    0.00 / 0.00 |       |
| typical-ranked-loose-n100             | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.63 / 0.63 |   0.18 / 0.18 |   0.30 / 0.30 |    0.00 / 0.00 |       |
| typical-ranked-reversed-sections-n100 | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.13 / 0.13 |   0.09 / 0.09 |   0.01 / 0.01 |    0.00 / 0.00 |       |
| careful-unordered-pairs-n100          | guard                        |             334 (3.34n) |             334 (3.34n) |  +0.0% |  1.00 / 1.00 |   0.66 / 0.66 |   1.00 / 1.00 |    0.00 / 0.00 |       |
| careful-rough-pairs-n100              | guard                        |             260 (2.60n) |             260 (2.60n) |  +0.0% |  1.00 / 1.00 |   0.95 / 0.95 |   1.00 / 1.00 |    0.00 / 0.00 |       |
| typical-rough-pairs-n100              | guard                        |             272 (2.72n) |             272 (2.72n) |  +0.0% |  1.00 / 1.00 |   0.74 / 0.74 |   0.95 / 0.95 |    0.00 / 0.00 |       |
| fuzzy-unordered-pairs-n100            | guard                        |             366 (3.66n) |             366 (3.66n) |  +0.0% |  1.00 / 1.00 |   0.38 / 0.38 |   0.66 / 0.66 |    0.00 / 0.00 |       |
| fuzzy-rough-pairs-n100                | guard                        |             372 (3.72n) |             372 (3.72n) |  +0.0% |  1.00 / 1.00 |   0.39 / 0.39 |   0.65 / 0.65 |    0.00 / 0.00 |       |
| sloppy-unordered-pairs-n100           | guard                        |             498 (4.97n) |             498 (4.97n) |  +0.0% |  0.98 / 0.98 |   0.36 / 0.36 |   0.75 / 0.75 |    0.00 / 0.00 |       |
| sloppy-rough-pairs-n100               | guard                        |             333 (3.33n) |             333 (3.33n) |  +0.0% |  1.00 / 1.00 |   0.59 / 0.59 |   0.92 / 0.92 |    0.00 / 0.00 |       |
| typical-unordered-drift-n6            | typical-unordered-drift-n6   |              16 (2.64n) |              15 (2.53n) |  -2.3% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |      n/a / n/a |       |
| typical-unordered-drift-n12           | typical-unordered-drift-n12  |              29 (2.42n) |              29 (2.44n) |  +6.1% |  1.00 / 1.00 |   1.00 / 1.00 |   0.96 / 0.96 |    0.00 / 0.00 |       |
| typical-unordered-drift-n100          | typical-unordered-drift-n100 |             421 (4.21n) |             421 (4.21n) |  +0.0% |  0.99 / 0.99 |   0.46 / 0.46 |   0.49 / 0.49 |      n/a / n/a |       |

| Group                        | Change | Censored seeds (candidate / current) |
| ---------------------------- | -----: | -----------------------------------: |
| typical-unordered-drift-n6   |  -2.3% |                                0 / 0 |
| typical-unordered-drift-n12  |  +6.1% |                                0 / 0 |
| typical-unordered-drift-n100 |  +0.0% |                                0 / 0 |

## MAX_SHOWINGS_SPLIT-8

| Scenario                              | Group                        |           Gate, current |         Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Top spot rests | Notes |
| ------------------------------------- | ---------------------------- | ----------------------: | ----------------------: | -----: | -----------: | ------------: | ------------: | -------------: | ----- |
| typical-ranked-n100                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.91 / 0.91 |   0.98 / 0.97 |    0.00 / 0.00 |       |
| typical-ranked-n400                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.79 / 0.79 |   0.91 / 0.91 |    0.00 / 0.00 |       |
| typical-unordered-pairs-n100          | guard                        |             315 (3.15n) |             315 (3.15n) |  +0.0% |  1.00 / 1.00 |   0.65 / 0.65 |   0.93 / 0.93 |    0.00 / 0.00 |       |
| typical-ranked-loose-n100             | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.63 / 0.63 |   0.18 / 0.18 |   0.30 / 0.30 |    0.00 / 0.00 |       |
| typical-ranked-reversed-sections-n100 | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.13 / 0.13 |   0.09 / 0.09 |   0.01 / 0.01 |    0.00 / 0.00 |       |
| careful-unordered-pairs-n100          | guard                        |             334 (3.34n) |             334 (3.34n) |  +0.0% |  1.00 / 1.00 |   0.66 / 0.66 |   1.00 / 1.00 |    0.00 / 0.00 |       |
| careful-rough-pairs-n100              | guard                        |             260 (2.60n) |             260 (2.60n) |  +0.0% |  1.00 / 1.00 |   0.95 / 0.95 |   1.00 / 1.00 |    0.00 / 0.00 |       |
| typical-rough-pairs-n100              | guard                        |             272 (2.72n) |             272 (2.72n) |  +0.0% |  1.00 / 1.00 |   0.74 / 0.74 |   0.95 / 0.95 |    0.00 / 0.00 |       |
| fuzzy-unordered-pairs-n100            | guard                        |             366 (3.66n) |             366 (3.66n) |  +0.0% |  1.00 / 1.00 |   0.38 / 0.38 |   0.66 / 0.66 |    0.00 / 0.00 |       |
| fuzzy-rough-pairs-n100                | guard                        |             372 (3.72n) |             372 (3.72n) |  +0.0% |  1.00 / 1.00 |   0.39 / 0.39 |   0.65 / 0.65 |    0.00 / 0.00 |       |
| sloppy-unordered-pairs-n100           | guard                        |             498 (4.97n) |             498 (4.97n) |  +0.0% |  0.98 / 0.98 |   0.36 / 0.36 |   0.75 / 0.75 |    0.00 / 0.00 |       |
| sloppy-rough-pairs-n100               | guard                        |             333 (3.33n) |             333 (3.33n) |  +0.0% |  1.00 / 1.00 |   0.59 / 0.59 |   0.92 / 0.92 |    0.00 / 0.00 |       |
| typical-unordered-drift-n6            | typical-unordered-drift-n6   |              16 (2.64n) |              15 (2.53n) |  -2.3% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |      n/a / n/a |       |
| typical-unordered-drift-n12           | typical-unordered-drift-n12  |              29 (2.42n) |              29 (2.44n) |  +6.1% |  1.00 / 1.00 |   1.00 / 1.00 |   0.96 / 0.96 |    0.00 / 0.00 |       |
| typical-unordered-drift-n100          | typical-unordered-drift-n100 |             421 (4.21n) |             421 (4.21n) |  +0.0% |  0.99 / 0.99 |   0.46 / 0.46 |   0.49 / 0.49 |      n/a / n/a |       |

| Group                        | Change | Censored seeds (candidate / current) |
| ---------------------------- | -----: | -----------------------------------: |
| typical-unordered-drift-n6   |  -2.3% |                                0 / 0 |
| typical-unordered-drift-n12  |  +6.1% |                                0 / 0 |
| typical-unordered-drift-n100 |  +0.0% |                                0 / 0 |

within5 and within1 columns are current / candidate, means over the paired seeds. Top spot rests is the share of runs where, at the first answer reaching the top level, the one pair left in doubt is one the picker will not ask again (runs that never had such a pair are left out). A change is the mean over paired seeds of (candidate - current) / current.
