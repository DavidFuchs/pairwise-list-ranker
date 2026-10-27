# Compare against RECENCY_FACTOR-1-short40

Current: RECENCY_FACTOR-1-short40 (overrides {"RECENCY_FACTOR":1}, picker current, seeds 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40).
Scenarios: every scenario of the current file.
Groups: each drift scenario its own (the mean is over them; every other scenario is a guard).
Seeds are paired by number. A run that never reached the gate counts as its last sample (its budget, or fewer on an early stop) and is counted as censored.

Decision: **RECENCY_FACTOR-0.3-short40** (fewest answers to the gate: -27.6% against RECENCY_FACTOR-1-short40).

| Candidate                  | Mean change | Censored seeds (candidate / current) | Verdict               |
| -------------------------- | ----------: | -----------------------------------: | --------------------- |
| RECENCY_FACTOR-0.8-short40 |       -9.6% |                                1 / 3 | eligible: mean -9.6%  |
| RECENCY_FACTOR-0.6-short40 |      -16.7% |                                1 / 3 | eligible: mean -16.7% |
| RECENCY_FACTOR-0.5-short40 |      -23.6% |                                0 / 3 | eligible: mean -23.6% |
| RECENCY_FACTOR-0.3-short40 |      -27.6% |                                0 / 3 | chosen: mean -27.6%   |
| RECENCY_FACTOR-0-short40   |      -14.3% |                                2 / 3 | eligible: mean -14.3% |

## RECENCY_FACTOR-0.8-short40

| Scenario                    | Group                       |          Gate, current |        Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| --------------------------- | --------------------------- | ---------------------: | ---------------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-drift-n6  | typical-unordered-drift-n6  |             21 (3.53n) |             19 (3.13n) | -10.2% |  1.00 / 1.00 |   1.00 / 1.00 |   0.98 / 0.99 |       |
| typical-unordered-drift-n12 | typical-unordered-drift-n12 | 50 (4.17n), 3 censored | 41 (3.45n), 1 censored |  -9.1% |  1.00 / 1.00 |   1.00 / 1.00 |   0.95 / 0.97 |       |

| Group                       | Change | Censored seeds (candidate / current) |
| --------------------------- | -----: | -----------------------------------: |
| typical-unordered-drift-n6  | -10.2% |                                0 / 0 |
| typical-unordered-drift-n12 |  -9.1% |                                1 / 3 |

## RECENCY_FACTOR-0.6-short40

| Scenario                    | Group                       |          Gate, current |        Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| --------------------------- | --------------------------- | ---------------------: | ---------------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-drift-n6  | typical-unordered-drift-n6  |             21 (3.53n) |             17 (2.82n) | -19.0% |  1.00 / 1.00 |   1.00 / 1.00 |   0.98 / 0.99 |       |
| typical-unordered-drift-n12 | typical-unordered-drift-n12 | 50 (4.17n), 3 censored | 38 (3.19n), 1 censored | -14.5% |  1.00 / 1.00 |   1.00 / 1.00 |   0.95 / 0.97 |       |

| Group                       | Change | Censored seeds (candidate / current) |
| --------------------------- | -----: | -----------------------------------: |
| typical-unordered-drift-n6  | -19.0% |                                0 / 0 |
| typical-unordered-drift-n12 | -14.5% |                                1 / 3 |

## RECENCY_FACTOR-0.5-short40

| Scenario                    | Group                       |          Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| --------------------------- | --------------------------- | ---------------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-drift-n6  | typical-unordered-drift-n6  |             21 (3.53n) |      16 (2.66n) | -24.4% |  1.00 / 1.00 |   1.00 / 1.00 |   0.98 / 0.98 |       |
| typical-unordered-drift-n12 | typical-unordered-drift-n12 | 50 (4.17n), 3 censored |      33 (2.74n) | -22.8% |  1.00 / 1.00 |   1.00 / 1.00 |   0.95 / 0.98 |       |

| Group                       | Change | Censored seeds (candidate / current) |
| --------------------------- | -----: | -----------------------------------: |
| typical-unordered-drift-n6  | -24.4% |                                0 / 0 |
| typical-unordered-drift-n12 | -22.8% |                                0 / 3 |

## RECENCY_FACTOR-0.3-short40

| Scenario                    | Group                       |          Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| --------------------------- | --------------------------- | ---------------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-drift-n6  | typical-unordered-drift-n6  |             21 (3.53n) |      14 (2.35n) | -32.0% |  1.00 / 1.00 |   1.00 / 1.00 |   0.98 / 0.98 |       |
| typical-unordered-drift-n12 | typical-unordered-drift-n12 | 50 (4.17n), 3 censored |      33 (2.72n) | -23.1% |  1.00 / 1.00 |   1.00 / 1.00 |   0.95 / 0.98 |       |

| Group                       | Change | Censored seeds (candidate / current) |
| --------------------------- | -----: | -----------------------------------: |
| typical-unordered-drift-n6  | -32.0% |                                0 / 0 |
| typical-unordered-drift-n12 | -23.1% |                                0 / 3 |

## RECENCY_FACTOR-0-short40

| Scenario                    | Group                       |          Gate, current |        Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| --------------------------- | --------------------------- | ---------------------: | ---------------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-drift-n6  | typical-unordered-drift-n6  |             21 (3.53n) |             15 (2.49n) | -28.1% |  1.00 / 1.00 |   1.00 / 1.00 |   0.98 / 0.99 |       |
| typical-unordered-drift-n12 | typical-unordered-drift-n12 | 50 (4.17n), 3 censored | 40 (3.35n), 2 censored |  -0.5% |  1.00 / 1.00 |   1.00 / 1.00 |   0.95 / 0.98 |       |

| Group                       | Change | Censored seeds (candidate / current) |
| --------------------------- | -----: | -----------------------------------: |
| typical-unordered-drift-n6  | -28.1% |                                0 / 0 |
| typical-unordered-drift-n12 |  -0.5% |                                2 / 3 |

within5 and within1 columns are current / candidate, means over the paired seeds. A change is the mean over paired seeds of (candidate - current) / current.
