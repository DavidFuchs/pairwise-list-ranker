# Compare against STRONG_WEIGHT-1.75

Current: STRONG_WEIGHT-1.75 (overrides {"STRONG_WEIGHT":1.75}, picker current, seeds 1 2 3 4 5 6 7 8 9 10 11 12).
Scenarios: filter cal-strong.
Groups: each scenario its own (the mean is over every compared scenario).
Seeds are paired by number. A run that never reached the gate counts as its last sample (its budget, or fewer on an early stop) and is counted as censored.

Decision: **STRONG_WEIGHT-1.75** (no gain).

| Candidate          | Mean change | Censored seeds (candidate / current) | Verdict                            |
| ------------------ | ----------: | -----------------------------------: | ---------------------------------- |
| STRONG_WEIGHT-1    |       +4.5% |                                0 / 0 | no gain: mean +4.5%, not 2% faster |
| STRONG_WEIGHT-1.25 |       +0.5% |                                0 / 0 | no gain: mean +0.5%, not 2% faster |
| STRONG_WEIGHT-1.5  |       +1.8% |                                0 / 0 | no gain: mean +1.8%, not 2% faster |
| STRONG_WEIGHT-2    |       +2.2% |                                0 / 0 | no gain: mean +2.2%, not 2% faster |
| STRONG_WEIGHT-2.5  |       +0.8% |                                0 / 0 | no gain: mean +0.8%, not 2% faster |

## STRONG_WEIGHT-1

| Scenario                                         | Group                                            | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ------------------------------------------------ | ------------------------------------------------ | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-strong-often-pairs-n100        | typical-unordered-strong-often-pairs-n100        |   325 (3.25n) |     343 (3.43n) |  +6.0% |  1.00 / 1.00 |   0.57 / 0.55 |   0.90 / 0.91 |       |
| typical-unordered-strong-rarely-pairs-n100       | typical-unordered-strong-rarely-pairs-n100       |   324 (3.24n) |     343 (3.43n) |  +5.9% |  1.00 / 1.00 |   0.59 / 0.55 |   0.90 / 0.91 |       |
| typical-unordered-strong-inconsistent-pairs-n100 | typical-unordered-strong-inconsistent-pairs-n100 |   339 (3.39n) |     343 (3.43n) |  +1.4% |  1.00 / 1.00 |   0.58 / 0.55 |   0.90 / 0.91 |       |

| Group                                            | Change | Censored seeds (candidate / current) |
| ------------------------------------------------ | -----: | -----------------------------------: |
| typical-unordered-strong-often-pairs-n100        |  +6.0% |                                0 / 0 |
| typical-unordered-strong-rarely-pairs-n100       |  +5.9% |                                0 / 0 |
| typical-unordered-strong-inconsistent-pairs-n100 |  +1.4% |                                0 / 0 |

## STRONG_WEIGHT-1.25

| Scenario                                         | Group                                            | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ------------------------------------------------ | ------------------------------------------------ | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-strong-often-pairs-n100        | typical-unordered-strong-often-pairs-n100        |   325 (3.25n) |     330 (3.30n) |  +2.0% |  1.00 / 1.00 |   0.57 / 0.57 |   0.90 / 0.91 |       |
| typical-unordered-strong-rarely-pairs-n100       | typical-unordered-strong-rarely-pairs-n100       |   324 (3.24n) |     328 (3.28n) |  +1.3% |  1.00 / 1.00 |   0.59 / 0.57 |   0.90 / 0.90 |       |
| typical-unordered-strong-inconsistent-pairs-n100 | typical-unordered-strong-inconsistent-pairs-n100 |   339 (3.39n) |     332 (3.32n) |  -1.7% |  1.00 / 1.00 |   0.58 / 0.57 |   0.90 / 0.90 |       |

| Group                                            | Change | Censored seeds (candidate / current) |
| ------------------------------------------------ | -----: | -----------------------------------: |
| typical-unordered-strong-often-pairs-n100        |  +2.0% |                                0 / 0 |
| typical-unordered-strong-rarely-pairs-n100       |  +1.3% |                                0 / 0 |
| typical-unordered-strong-inconsistent-pairs-n100 |  -1.7% |                                0 / 0 |

## STRONG_WEIGHT-1.5

| Scenario                                         | Group                                            | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ------------------------------------------------ | ------------------------------------------------ | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-strong-often-pairs-n100        | typical-unordered-strong-often-pairs-n100        |   325 (3.25n) |     331 (3.31n) |  +2.4% |  1.00 / 1.00 |   0.57 / 0.56 |   0.90 / 0.90 |       |
| typical-unordered-strong-rarely-pairs-n100       | typical-unordered-strong-rarely-pairs-n100       |   324 (3.24n) |     335 (3.35n) |  +3.6% |  1.00 / 1.00 |   0.59 / 0.57 |   0.90 / 0.91 |       |
| typical-unordered-strong-inconsistent-pairs-n100 | typical-unordered-strong-inconsistent-pairs-n100 |   339 (3.39n) |     336 (3.36n) |  -0.7% |  1.00 / 1.00 |   0.58 / 0.56 |   0.90 / 0.88 |       |

| Group                                            | Change | Censored seeds (candidate / current) |
| ------------------------------------------------ | -----: | -----------------------------------: |
| typical-unordered-strong-often-pairs-n100        |  +2.4% |                                0 / 0 |
| typical-unordered-strong-rarely-pairs-n100       |  +3.6% |                                0 / 0 |
| typical-unordered-strong-inconsistent-pairs-n100 |  -0.7% |                                0 / 0 |

## STRONG_WEIGHT-2

| Scenario                                         | Group                                            | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ------------------------------------------------ | ------------------------------------------------ | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-strong-often-pairs-n100        | typical-unordered-strong-often-pairs-n100        |   325 (3.25n) |     335 (3.35n) |  +3.6% |  1.00 / 1.00 |   0.57 / 0.55 |   0.90 / 0.90 |       |
| typical-unordered-strong-rarely-pairs-n100       | typical-unordered-strong-rarely-pairs-n100       |   324 (3.24n) |     339 (3.39n) |  +4.9% |  1.00 / 1.00 |   0.59 / 0.55 |   0.90 / 0.91 |       |
| typical-unordered-strong-inconsistent-pairs-n100 | typical-unordered-strong-inconsistent-pairs-n100 |   339 (3.39n) |     333 (3.33n) |  -1.7% |  1.00 / 1.00 |   0.58 / 0.55 |   0.90 / 0.89 |       |

| Group                                            | Change | Censored seeds (candidate / current) |
| ------------------------------------------------ | -----: | -----------------------------------: |
| typical-unordered-strong-often-pairs-n100        |  +3.6% |                                0 / 0 |
| typical-unordered-strong-rarely-pairs-n100       |  +4.9% |                                0 / 0 |
| typical-unordered-strong-inconsistent-pairs-n100 |  -1.7% |                                0 / 0 |

## STRONG_WEIGHT-2.5

| Scenario                                         | Group                                            | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ------------------------------------------------ | ------------------------------------------------ | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-strong-often-pairs-n100        | typical-unordered-strong-often-pairs-n100        |   325 (3.25n) |     332 (3.32n) |  +2.4% |  1.00 / 1.00 |   0.57 / 0.56 |   0.90 / 0.90 |       |
| typical-unordered-strong-rarely-pairs-n100       | typical-unordered-strong-rarely-pairs-n100       |   324 (3.24n) |     331 (3.31n) |  +2.3% |  1.00 / 1.00 |   0.59 / 0.58 |   0.90 / 0.88 |       |
| typical-unordered-strong-inconsistent-pairs-n100 | typical-unordered-strong-inconsistent-pairs-n100 |   339 (3.39n) |     330 (3.30n) |  -2.5% |  1.00 / 1.00 |   0.58 / 0.57 |   0.90 / 0.91 |       |

| Group                                            | Change | Censored seeds (candidate / current) |
| ------------------------------------------------ | -----: | -----------------------------------: |
| typical-unordered-strong-often-pairs-n100        |  +2.4% |                                0 / 0 |
| typical-unordered-strong-rarely-pairs-n100       |  +2.3% |                                0 / 0 |
| typical-unordered-strong-inconsistent-pairs-n100 |  -2.5% |                                0 / 0 |

within5 and within1 columns are current / candidate, means over the paired seeds. A change is the mean over paired seeds of (candidate - current) / current.
