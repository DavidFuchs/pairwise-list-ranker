# Compare against MAX_SHOWINGS_SPLIT-3-short40

Current: MAX_SHOWINGS_SPLIT-3-short40 (overrides {"MAX_SHOWINGS_SPLIT":3}, picker current, seeds 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40).
Scenarios: every scenario of the current file.
Groups: each drift scenario its own (the mean is over them; every other scenario is a guard).
Seeds are paired by number. A run that never reached the gate counts as its last sample (its budget, or fewer on an early stop) and is counted as censored.

Decision: **MAX_SHOWINGS_SPLIT-3-short40** (no gain).

| Candidate                    | Mean change | Censored seeds (candidate / current) | Verdict                            |
| ---------------------------- | ----------: | -----------------------------------: | ---------------------------------- |
| MAX_SHOWINGS_SPLIT-4-short40 |       +0.2% |                                1 / 1 | no gain: mean +0.2%, not 2% faster |
| MAX_SHOWINGS_SPLIT-5-short40 |       +3.1% |                                1 / 1 | no gain: mean +3.1%, not 2% faster |
| MAX_SHOWINGS_SPLIT-6-short40 |       +3.1% |                                1 / 1 | no gain: mean +3.1%, not 2% faster |
| MAX_SHOWINGS_SPLIT-8-short40 |       +3.1% |                                1 / 1 | no gain: mean +3.1%, not 2% faster |

## MAX_SHOWINGS_SPLIT-4-short40

| Scenario                    | Group                       |          Gate, current |        Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Top spot rests | Notes |
| --------------------------- | --------------------------- | ---------------------: | ---------------------: | -----: | -----------: | ------------: | ------------: | -------------: | ----- |
| typical-unordered-drift-n6  | typical-unordered-drift-n6  |             17 (2.82n) |             17 (2.76n) |  -1.0% |  1.00 / 1.00 |   1.00 / 1.00 |   0.99 / 0.98 |      n/a / n/a |       |
| typical-unordered-drift-n12 | typical-unordered-drift-n12 | 37 (3.09n), 1 censored | 36 (3.01n), 1 censored |  +1.4% |  1.00 / 1.00 |   1.00 / 1.00 |   0.97 / 0.97 |    0.00 / 0.00 |       |

| Group                       | Change | Censored seeds (candidate / current) |
| --------------------------- | -----: | -----------------------------------: |
| typical-unordered-drift-n6  |  -1.0% |                                0 / 0 |
| typical-unordered-drift-n12 |  +1.4% |                                1 / 1 |

## MAX_SHOWINGS_SPLIT-5-short40

| Scenario                    | Group                       |          Gate, current |        Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Top spot rests | Notes |
| --------------------------- | --------------------------- | ---------------------: | ---------------------: | -----: | -----------: | ------------: | ------------: | -------------: | ----- |
| typical-unordered-drift-n6  | typical-unordered-drift-n6  |             17 (2.82n) |             17 (2.89n) |  +4.5% |  1.00 / 1.00 |   1.00 / 1.00 |   0.99 / 0.99 |      n/a / n/a |       |
| typical-unordered-drift-n12 | typical-unordered-drift-n12 | 37 (3.09n), 1 censored | 36 (3.03n), 1 censored |  +1.7% |  1.00 / 1.00 |   1.00 / 1.00 |   0.97 / 0.97 |    0.00 / 0.00 |       |

| Group                       | Change | Censored seeds (candidate / current) |
| --------------------------- | -----: | -----------------------------------: |
| typical-unordered-drift-n6  |  +4.5% |                                0 / 0 |
| typical-unordered-drift-n12 |  +1.7% |                                1 / 1 |

## MAX_SHOWINGS_SPLIT-6-short40

| Scenario                    | Group                       |          Gate, current |        Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Top spot rests | Notes |
| --------------------------- | --------------------------- | ---------------------: | ---------------------: | -----: | -----------: | ------------: | ------------: | -------------: | ----- |
| typical-unordered-drift-n6  | typical-unordered-drift-n6  |             17 (2.82n) |             17 (2.89n) |  +4.5% |  1.00 / 1.00 |   1.00 / 1.00 |   0.99 / 0.99 |      n/a / n/a |       |
| typical-unordered-drift-n12 | typical-unordered-drift-n12 | 37 (3.09n), 1 censored | 36 (3.03n), 1 censored |  +1.7% |  1.00 / 1.00 |   1.00 / 1.00 |   0.97 / 0.97 |    0.00 / 0.00 |       |

| Group                       | Change | Censored seeds (candidate / current) |
| --------------------------- | -----: | -----------------------------------: |
| typical-unordered-drift-n6  |  +4.5% |                                0 / 0 |
| typical-unordered-drift-n12 |  +1.7% |                                1 / 1 |

## MAX_SHOWINGS_SPLIT-8-short40

| Scenario                    | Group                       |          Gate, current |        Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Top spot rests | Notes |
| --------------------------- | --------------------------- | ---------------------: | ---------------------: | -----: | -----------: | ------------: | ------------: | -------------: | ----- |
| typical-unordered-drift-n6  | typical-unordered-drift-n6  |             17 (2.82n) |             17 (2.89n) |  +4.5% |  1.00 / 1.00 |   1.00 / 1.00 |   0.99 / 0.99 |      n/a / n/a |       |
| typical-unordered-drift-n12 | typical-unordered-drift-n12 | 37 (3.09n), 1 censored | 36 (3.03n), 1 censored |  +1.7% |  1.00 / 1.00 |   1.00 / 1.00 |   0.97 / 0.97 |    0.00 / 0.00 |       |

| Group                       | Change | Censored seeds (candidate / current) |
| --------------------------- | -----: | -----------------------------------: |
| typical-unordered-drift-n6  |  +4.5% |                                0 / 0 |
| typical-unordered-drift-n12 |  +1.7% |                                1 / 1 |

within5 and within1 columns are current / candidate, means over the paired seeds. Top spot rests is the share of runs where, at the first answer reaching the top level, the one pair left in doubt is one the picker will not ask again (runs that never had such a pair are left out). A change is the mean over paired seeds of (candidate - current) / current.
