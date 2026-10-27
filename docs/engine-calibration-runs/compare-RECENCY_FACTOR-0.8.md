# Compare against RECENCY_FACTOR-1

Current: RECENCY_FACTOR-1 (overrides {"RECENCY_FACTOR":1}, picker current, seeds 1 2 3 4 5 6).
Scenarios: filter cal-[rp][ea].
Groups: each drift scenario its own (the mean is over them; every other scenario is a guard).
Seeds are paired by number. A run that never reached the gate counts as its last sample (its budget, or fewer on an early stop) and is counted as censored.

Decision: **RECENCY_FACTOR-0.3** (fewest answers to the gate: -11.0% against RECENCY_FACTOR-1).

| Candidate          | Mean change | Censored seeds (candidate / current) | Verdict                                                       |
| ------------------ | ----------: | -----------------------------------: | ------------------------------------------------------------- |
| RECENCY_FACTOR-0.8 |       +1.1% |                                0 / 0 | rejected: more than 10% slower on typical-unordered-drift-n12 |
| RECENCY_FACTOR-0.7 |       -1.1% |                                0 / 0 | rejected: more than 10% slower on typical-unordered-drift-n12 |
| RECENCY_FACTOR-0.6 |       -4.5% |                                0 / 0 | eligible: mean -4.5%                                          |
| RECENCY_FACTOR-0.5 |       -5.6% |                                0 / 0 | eligible: mean -5.6%                                          |
| RECENCY_FACTOR-0.3 |      -11.0% |                                0 / 0 | chosen: mean -11.0%                                           |
| RECENCY_FACTOR-0   |       -5.0% |                                0 / 0 | rejected: more than 10% slower on typical-unordered-drift-n12 |

## RECENCY_FACTOR-0.8

| Scenario                              | Group                        |           Gate, current |         Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ------------------------------------- | ---------------------------- | ----------------------: | ----------------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-ranked-n100                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.92 / 0.90 |   0.98 / 0.97 |       |
| typical-ranked-n400                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.79 / 0.79 |   0.91 / 0.90 |       |
| typical-unordered-pairs-n100          | guard                        |             315 (3.15n) |             315 (3.15n) |  +0.0% |  1.00 / 1.00 |   0.65 / 0.65 |   0.94 / 0.94 |       |
| typical-ranked-loose-n100             | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.62 / 0.66 |   0.18 / 0.18 |   0.29 / 0.31 |       |
| typical-ranked-reversed-sections-n100 | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.09 / 0.10 |   0.09 / 0.09 |   0.01 / 0.00 |       |
| careful-unordered-pairs-n100          | guard                        |             334 (3.34n) |             334 (3.34n) |  +0.0% |  1.00 / 1.00 |   0.66 / 0.66 |   1.00 / 1.00 |       |
| careful-rough-pairs-n100              | guard                        |             260 (2.60n) |             260 (2.60n) |  +0.0% |  1.00 / 1.00 |   0.95 / 0.95 |   1.00 / 1.00 |       |
| typical-rough-pairs-n100              | guard                        |             272 (2.72n) |             272 (2.72n) |  +0.0% |  1.00 / 1.00 |   0.74 / 0.74 |   0.95 / 0.95 |       |
| fuzzy-unordered-pairs-n100            | guard                        |             366 (3.66n) |             366 (3.66n) |  +0.0% |  1.00 / 1.00 |   0.38 / 0.38 |   0.67 / 0.64 |       |
| fuzzy-rough-pairs-n100                | guard                        |             372 (3.72n) |             372 (3.72n) |  +0.0% |  0.99 / 1.00 |   0.39 / 0.39 |   0.65 / 0.65 |       |
| sloppy-unordered-pairs-n100           | guard                        |             498 (4.97n) |             498 (4.97n) |  +0.0% |  0.98 / 0.97 |   0.36 / 0.36 |   0.76 / 0.74 |       |
| sloppy-rough-pairs-n100               | guard                        |             333 (3.33n) |             333 (3.33n) |  +0.0% |  1.00 / 1.00 |   0.59 / 0.59 |   0.92 / 0.90 |       |
| typical-unordered-drift-n6            | typical-unordered-drift-n6   |              20 (3.36n) |              18 (2.94n) | -11.8% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-unordered-drift-n12           | typical-unordered-drift-n12  |              27 (2.26n) |              30 (2.53n) | +15.1% |  1.00 / 1.00 |   1.00 / 1.00 |   0.92 / 0.96 |       |
| typical-unordered-drift-n100          | typical-unordered-drift-n100 |             421 (4.21n) |             421 (4.21n) |  +0.0% |  0.99 / 0.99 |   0.46 / 0.46 |   0.49 / 0.49 |       |

| Group                        | Change | Censored seeds (candidate / current) |
| ---------------------------- | -----: | -----------------------------------: |
| typical-unordered-drift-n6   | -11.8% |                                0 / 0 |
| typical-unordered-drift-n12  | +15.1% |                                0 / 0 |
| typical-unordered-drift-n100 |  +0.0% |                                0 / 0 |

## RECENCY_FACTOR-0.7

| Scenario                              | Group                        |           Gate, current |         Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ------------------------------------- | ---------------------------- | ----------------------: | ----------------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-ranked-n100                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.92 / 0.92 |   0.98 / 0.99 |       |
| typical-ranked-n400                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.79 / 0.79 |   0.91 / 0.91 |       |
| typical-unordered-pairs-n100          | guard                        |             315 (3.15n) |             315 (3.15n) |  +0.0% |  1.00 / 1.00 |   0.65 / 0.65 |   0.94 / 0.96 |       |
| typical-ranked-loose-n100             | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.62 / 0.63 |   0.18 / 0.18 |   0.29 / 0.29 |       |
| typical-ranked-reversed-sections-n100 | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.09 / 0.10 |   0.09 / 0.09 |   0.01 / 0.00 |       |
| careful-unordered-pairs-n100          | guard                        |             334 (3.34n) |             334 (3.34n) |  +0.0% |  1.00 / 1.00 |   0.66 / 0.66 |   1.00 / 1.00 |       |
| careful-rough-pairs-n100              | guard                        |             260 (2.60n) |             260 (2.60n) |  +0.0% |  1.00 / 1.00 |   0.95 / 0.95 |   1.00 / 1.00 |       |
| typical-rough-pairs-n100              | guard                        |             272 (2.72n) |             272 (2.72n) |  +0.0% |  1.00 / 1.00 |   0.74 / 0.74 |   0.95 / 0.97 |       |
| fuzzy-unordered-pairs-n100            | guard                        |             366 (3.66n) |             366 (3.66n) |  +0.0% |  1.00 / 1.00 |   0.38 / 0.38 |   0.67 / 0.66 |       |
| fuzzy-rough-pairs-n100                | guard                        |             372 (3.72n) |             372 (3.72n) |  +0.0% |  0.99 / 0.99 |   0.39 / 0.39 |   0.65 / 0.65 |       |
| sloppy-unordered-pairs-n100           | guard                        |             498 (4.97n) |             498 (4.97n) |  +0.0% |  0.98 / 0.98 |   0.36 / 0.36 |   0.76 / 0.76 |       |
| sloppy-rough-pairs-n100               | guard                        |             333 (3.33n) |             333 (3.33n) |  +0.0% |  1.00 / 1.00 |   0.59 / 0.59 |   0.92 / 0.92 |       |
| typical-unordered-drift-n6            | typical-unordered-drift-n6   |              20 (3.36n) |              17 (2.75n) | -18.3% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-unordered-drift-n12           | typical-unordered-drift-n12  |              27 (2.26n) |              30 (2.53n) | +15.1% |  1.00 / 1.00 |   1.00 / 1.00 |   0.92 / 0.96 |       |
| typical-unordered-drift-n100          | typical-unordered-drift-n100 |             421 (4.21n) |             421 (4.21n) |  +0.0% |  0.99 / 0.99 |   0.46 / 0.46 |   0.49 / 0.49 |       |

| Group                        | Change | Censored seeds (candidate / current) |
| ---------------------------- | -----: | -----------------------------------: |
| typical-unordered-drift-n6   | -18.3% |                                0 / 0 |
| typical-unordered-drift-n12  | +15.1% |                                0 / 0 |
| typical-unordered-drift-n100 |  +0.0% |                                0 / 0 |

## RECENCY_FACTOR-0.6

| Scenario                              | Group                        |           Gate, current |         Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ------------------------------------- | ---------------------------- | ----------------------: | ----------------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-ranked-n100                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.92 / 0.91 |   0.98 / 0.98 |       |
| typical-ranked-n400                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.79 / 0.79 |   0.91 / 0.91 |       |
| typical-unordered-pairs-n100          | guard                        |             315 (3.15n) |             315 (3.15n) |  +0.0% |  1.00 / 1.00 |   0.65 / 0.65 |   0.94 / 0.93 |       |
| typical-ranked-loose-n100             | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.62 / 0.63 |   0.18 / 0.18 |   0.29 / 0.30 |       |
| typical-ranked-reversed-sections-n100 | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.09 / 0.13 |   0.09 / 0.09 |   0.01 / 0.01 |       |
| careful-unordered-pairs-n100          | guard                        |             334 (3.34n) |             334 (3.34n) |  +0.0% |  1.00 / 1.00 |   0.66 / 0.66 |   1.00 / 1.00 |       |
| careful-rough-pairs-n100              | guard                        |             260 (2.60n) |             260 (2.60n) |  +0.0% |  1.00 / 1.00 |   0.95 / 0.95 |   1.00 / 1.00 |       |
| typical-rough-pairs-n100              | guard                        |             272 (2.72n) |             272 (2.72n) |  +0.0% |  1.00 / 1.00 |   0.74 / 0.74 |   0.95 / 0.95 |       |
| fuzzy-unordered-pairs-n100            | guard                        |             366 (3.66n) |             366 (3.66n) |  +0.0% |  1.00 / 1.00 |   0.38 / 0.38 |   0.67 / 0.66 |       |
| fuzzy-rough-pairs-n100                | guard                        |             372 (3.72n) |             372 (3.72n) |  +0.0% |  0.99 / 1.00 |   0.39 / 0.39 |   0.65 / 0.65 |       |
| sloppy-unordered-pairs-n100           | guard                        |             498 (4.97n) |             498 (4.97n) |  +0.0% |  0.98 / 0.98 |   0.36 / 0.36 |   0.76 / 0.75 |       |
| sloppy-rough-pairs-n100               | guard                        |             333 (3.33n) |             333 (3.33n) |  +0.0% |  1.00 / 1.00 |   0.59 / 0.59 |   0.92 / 0.92 |       |
| typical-unordered-drift-n6            | typical-unordered-drift-n6   |              20 (3.36n) |              16 (2.64n) | -20.5% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-unordered-drift-n12           | typical-unordered-drift-n12  |              27 (2.26n) |              29 (2.42n) |  +7.0% |  1.00 / 1.00 |   1.00 / 1.00 |   0.92 / 0.96 |       |
| typical-unordered-drift-n100          | typical-unordered-drift-n100 |             421 (4.21n) |             421 (4.21n) |  +0.0% |  0.99 / 0.99 |   0.46 / 0.46 |   0.49 / 0.49 |       |

| Group                        | Change | Censored seeds (candidate / current) |
| ---------------------------- | -----: | -----------------------------------: |
| typical-unordered-drift-n6   | -20.5% |                                0 / 0 |
| typical-unordered-drift-n12  |  +7.0% |                                0 / 0 |
| typical-unordered-drift-n100 |  +0.0% |                                0 / 0 |

## RECENCY_FACTOR-0.5

| Scenario                              | Group                        |           Gate, current |         Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ------------------------------------- | ---------------------------- | ----------------------: | ----------------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-ranked-n100                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.92 / 0.93 |   0.98 / 0.97 |       |
| typical-ranked-n400                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.79 / 0.79 |   0.91 / 0.91 |       |
| typical-unordered-pairs-n100          | guard                        |             315 (3.15n) |             315 (3.15n) |  +0.0% |  1.00 / 1.00 |   0.65 / 0.65 |   0.94 / 0.95 |       |
| typical-ranked-loose-n100             | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.62 / 0.63 |   0.18 / 0.18 |   0.29 / 0.30 |       |
| typical-ranked-reversed-sections-n100 | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.09 / 0.08 |   0.09 / 0.09 |   0.01 / 0.00 |       |
| careful-unordered-pairs-n100          | guard                        |             334 (3.34n) |             334 (3.34n) |  +0.0% |  1.00 / 1.00 |   0.66 / 0.66 |   1.00 / 1.00 |       |
| careful-rough-pairs-n100              | guard                        |             260 (2.60n) |             260 (2.60n) |  +0.0% |  1.00 / 1.00 |   0.95 / 0.95 |   1.00 / 1.00 |       |
| typical-rough-pairs-n100              | guard                        |             272 (2.72n) |             272 (2.72n) |  +0.0% |  1.00 / 1.00 |   0.74 / 0.74 |   0.95 / 0.95 |       |
| fuzzy-unordered-pairs-n100            | guard                        |             366 (3.66n) |             366 (3.66n) |  +0.0% |  1.00 / 1.00 |   0.38 / 0.38 |   0.67 / 0.63 |       |
| fuzzy-rough-pairs-n100                | guard                        |             372 (3.72n) |             372 (3.72n) |  +0.0% |  0.99 / 0.99 |   0.39 / 0.39 |   0.65 / 0.68 |       |
| sloppy-unordered-pairs-n100           | guard                        |             498 (4.97n) |             498 (4.97n) |  +0.0% |  0.98 / 0.98 |   0.36 / 0.36 |   0.76 / 0.77 |       |
| sloppy-rough-pairs-n100               | guard                        |             333 (3.33n) |             333 (3.33n) |  +0.0% |  1.00 / 1.00 |   0.59 / 0.59 |   0.92 / 0.92 |       |
| typical-unordered-drift-n6            | typical-unordered-drift-n6   |              20 (3.36n) |              16 (2.64n) | -20.5% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-unordered-drift-n12           | typical-unordered-drift-n12  |              27 (2.26n) |              28 (2.33n) |  +3.7% |  1.00 / 1.00 |   1.00 / 1.00 |   0.92 / 0.96 |       |
| typical-unordered-drift-n100          | typical-unordered-drift-n100 |             421 (4.21n) |             421 (4.21n) |  +0.0% |  0.99 / 0.99 |   0.46 / 0.46 |   0.49 / 0.49 |       |

| Group                        | Change | Censored seeds (candidate / current) |
| ---------------------------- | -----: | -----------------------------------: |
| typical-unordered-drift-n6   | -20.5% |                                0 / 0 |
| typical-unordered-drift-n12  |  +3.7% |                                0 / 0 |
| typical-unordered-drift-n100 |  +0.0% |                                0 / 0 |

## RECENCY_FACTOR-0.3

| Scenario                              | Group                        |           Gate, current |         Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ------------------------------------- | ---------------------------- | ----------------------: | ----------------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-ranked-n100                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.92 / 0.92 |   0.98 / 0.97 |       |
| typical-ranked-n400                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.79 / 0.79 |   0.91 / 0.90 |       |
| typical-unordered-pairs-n100          | guard                        |             315 (3.15n) |             315 (3.15n) |  +0.0% |  1.00 / 1.00 |   0.65 / 0.65 |   0.94 / 0.93 |       |
| typical-ranked-loose-n100             | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.62 / 0.64 |   0.18 / 0.18 |   0.29 / 0.30 |       |
| typical-ranked-reversed-sections-n100 | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.09 / 0.12 |   0.09 / 0.09 |   0.01 / 0.01 |       |
| careful-unordered-pairs-n100          | guard                        |             334 (3.34n) |             334 (3.34n) |  +0.0% |  1.00 / 1.00 |   0.66 / 0.66 |   1.00 / 1.00 |       |
| careful-rough-pairs-n100              | guard                        |             260 (2.60n) |             260 (2.60n) |  +0.0% |  1.00 / 1.00 |   0.95 / 0.95 |   1.00 / 1.00 |       |
| typical-rough-pairs-n100              | guard                        |             272 (2.72n) |             272 (2.72n) |  +0.0% |  1.00 / 1.00 |   0.74 / 0.74 |   0.95 / 0.94 |       |
| fuzzy-unordered-pairs-n100            | guard                        |             366 (3.66n) |             366 (3.66n) |  +0.0% |  1.00 / 1.00 |   0.38 / 0.38 |   0.67 / 0.64 |       |
| fuzzy-rough-pairs-n100                | guard                        |             372 (3.72n) |             372 (3.72n) |  +0.0% |  0.99 / 1.00 |   0.39 / 0.39 |   0.65 / 0.65 |       |
| sloppy-unordered-pairs-n100           | guard                        |             498 (4.97n) |             498 (4.97n) |  +0.0% |  0.98 / 0.98 |   0.36 / 0.36 |   0.76 / 0.76 |       |
| sloppy-rough-pairs-n100               | guard                        |             333 (3.33n) |             333 (3.33n) |  +0.0% |  1.00 / 1.00 |   0.59 / 0.59 |   0.92 / 0.89 |       |
| typical-unordered-drift-n6            | typical-unordered-drift-n6   |              20 (3.36n) |              13 (2.19n) | -32.2% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-unordered-drift-n12           | typical-unordered-drift-n12  |              27 (2.26n) |              27 (2.22n) |  -0.7% |  1.00 / 1.00 |   1.00 / 1.00 |   0.92 / 0.97 |       |
| typical-unordered-drift-n100          | typical-unordered-drift-n100 |             421 (4.21n) |             421 (4.21n) |  +0.0% |  0.99 / 0.99 |   0.46 / 0.46 |   0.49 / 0.49 |       |

| Group                        | Change | Censored seeds (candidate / current) |
| ---------------------------- | -----: | -----------------------------------: |
| typical-unordered-drift-n6   | -32.2% |                                0 / 0 |
| typical-unordered-drift-n12  |  -0.7% |                                0 / 0 |
| typical-unordered-drift-n100 |  +0.0% |                                0 / 0 |

## RECENCY_FACTOR-0

| Scenario                              | Group                        |           Gate, current |         Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ------------------------------------- | ---------------------------- | ----------------------: | ----------------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-ranked-n100                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.92 / 0.91 |   0.98 / 0.96 |       |
| typical-ranked-n400                   | guard                        |               0 (0.00n) |               0 (0.00n) |  +0.0% |  1.00 / 1.00 |   0.79 / 0.79 |   0.91 / 0.90 |       |
| typical-unordered-pairs-n100          | guard                        |             315 (3.15n) |             315 (3.15n) |  +0.0% |  1.00 / 1.00 |   0.65 / 0.65 |   0.94 / 0.90 |       |
| typical-ranked-loose-n100             | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.62 / 0.62 |   0.18 / 0.18 |   0.29 / 0.30 |       |
| typical-ranked-reversed-sections-n100 | guard                        | 800 (8.00n), 6 censored | 800 (8.00n), 6 censored |  +0.0% |  0.09 / 0.11 |   0.09 / 0.09 |   0.01 / 0.00 |       |
| careful-unordered-pairs-n100          | guard                        |             334 (3.34n) |             334 (3.34n) |  +0.0% |  1.00 / 1.00 |   0.66 / 0.66 |   1.00 / 1.00 |       |
| careful-rough-pairs-n100              | guard                        |             260 (2.60n) |             260 (2.60n) |  +0.0% |  1.00 / 1.00 |   0.95 / 0.95 |   1.00 / 1.00 |       |
| typical-rough-pairs-n100              | guard                        |             272 (2.72n) |             272 (2.72n) |  +0.0% |  1.00 / 1.00 |   0.74 / 0.74 |   0.95 / 0.94 |       |
| fuzzy-unordered-pairs-n100            | guard                        |             366 (3.66n) |             366 (3.66n) |  +0.0% |  1.00 / 1.00 |   0.38 / 0.38 |   0.67 / 0.67 |       |
| fuzzy-rough-pairs-n100                | guard                        |             372 (3.72n) |             372 (3.72n) |  +0.0% |  0.99 / 1.00 |   0.39 / 0.39 |   0.65 / 0.66 |       |
| sloppy-unordered-pairs-n100           | guard                        |             498 (4.97n) |             498 (4.97n) |  +0.0% |  0.98 / 0.98 |   0.36 / 0.36 |   0.76 / 0.76 |       |
| sloppy-rough-pairs-n100               | guard                        |             333 (3.33n) |             333 (3.33n) |  +0.0% |  1.00 / 1.00 |   0.59 / 0.59 |   0.92 / 0.87 |       |
| typical-unordered-drift-n6            | typical-unordered-drift-n6   |              20 (3.36n) |              14 (2.31n) | -28.3% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-unordered-drift-n12           | typical-unordered-drift-n12  |              27 (2.26n) |              29 (2.44n) | +13.3% |  1.00 / 1.00 |   1.00 / 1.00 |   0.92 / 0.97 |       |
| typical-unordered-drift-n100          | typical-unordered-drift-n100 |             421 (4.21n) |             421 (4.21n) |  +0.0% |  0.99 / 0.99 |   0.46 / 0.46 |   0.49 / 0.49 |       |

| Group                        | Change | Censored seeds (candidate / current) |
| ---------------------------- | -----: | -----------------------------------: |
| typical-unordered-drift-n6   | -28.3% |                                0 / 0 |
| typical-unordered-drift-n12  | +13.3% |                                0 / 0 |
| typical-unordered-drift-n100 |  +0.0% |                                0 / 0 |

within5 and within1 columns are current / candidate, means over the paired seeds. A change is the mean over paired seeds of (candidate - current) / current.
