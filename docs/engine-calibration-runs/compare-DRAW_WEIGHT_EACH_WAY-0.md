# Compare against DRAW_WEIGHT_EACH_WAY-0.25

Current: DRAW_WEIGHT_EACH_WAY-0.25 (overrides {"DRAW_WEIGHT_EACH_WAY":0.25}, picker current, seeds 1 2 3 4 5 6).
Scenarios: filter cal-pairs.
Groups: the base models (the mean is over them; every other scenario is a guard).
Seeds are paired by number. A run that never reached the gate counts as its last sample (its budget, or fewer on an early stop) and is counted as censored.

Decision: **DRAW_WEIGHT_EACH_WAY-0.25** (no gain).

| Candidate                | Mean change | Censored seeds (candidate / current) | Verdict                                                  |
| ------------------------ | ----------: | -----------------------------------: | -------------------------------------------------------- |
| DRAW_WEIGHT_EACH_WAY-0   |      +20.1% |                                0 / 0 | rejected: more than 10% slower on typical, fuzzy, sloppy |
| DRAW_WEIGHT_EACH_WAY-0.1 |       +4.0% |                                0 / 0 | no gain: mean +4.0%, not 2% faster                       |
| DRAW_WEIGHT_EACH_WAY-0.4 |       -1.6% |                                0 / 0 | no gain: mean -1.6%, not 2% faster                       |
| DRAW_WEIGHT_EACH_WAY-0.5 |       +0.8% |                                0 / 0 | no gain: mean +0.8%, not 2% faster                       |

## DRAW_WEIGHT_EACH_WAY-0

| Scenario                     | Group   | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ---------------------------- | ------- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-pairs-n100 | typical |   336 (3.36n) |     403 (4.03n) | +20.0% |  1.00 / 1.00 |   0.55 / 0.40 |   0.89 / 0.85 |       |
| careful-unordered-pairs-n100 | careful |   358 (3.58n) |     375 (3.75n) |  +4.8% |  1.00 / 1.00 |   0.57 / 0.51 |   1.00 / 1.00 |       |
| careful-rough-pairs-n100     | careful |   283 (2.83n) |     293 (2.92n) |  +4.0% |  1.00 / 1.00 |   0.84 / 0.83 |   1.00 / 1.00 |       |
| typical-rough-pairs-n100     | typical |   274 (2.74n) |     309 (3.09n) | +12.7% |  1.00 / 1.00 |   0.72 / 0.55 |   0.92 / 0.85 |       |
| fuzzy-unordered-pairs-n100   | fuzzy   |   392 (3.92n) |     536 (5.36n) | +37.4% |  1.00 / 0.98 |   0.41 / 0.29 |   0.61 / 0.53 |       |
| fuzzy-rough-pairs-n100       | fuzzy   |   349 (3.49n) |     429 (4.29n) | +23.1% |  1.00 / 0.99 |   0.40 / 0.36 |   0.64 / 0.55 |       |
| sloppy-unordered-pairs-n100  | sloppy  |   474 (4.74n) |     608 (6.08n) | +29.6% |  0.98 / 0.96 |   0.38 / 0.33 |   0.71 / 0.60 |       |
| sloppy-rough-pairs-n100      | sloppy  |   348 (3.48n) |     441 (4.41n) | +29.2% |  1.00 / 1.00 |   0.57 / 0.45 |   0.81 / 0.73 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| typical | +16.3% |                                0 / 0 |
| careful |  +4.4% |                                0 / 0 |
| fuzzy   | +30.3% |                                0 / 0 |
| sloppy  | +29.4% |                                0 / 0 |

## DRAW_WEIGHT_EACH_WAY-0.1

| Scenario                     | Group   | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ---------------------------- | ------- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-pairs-n100 | typical |   336 (3.36n) |     343 (3.43n) |  +2.3% |  1.00 / 1.00 |   0.55 / 0.51 |   0.89 / 0.88 |       |
| careful-unordered-pairs-n100 | careful |   358 (3.58n) |     370 (3.70n) |  +3.4% |  1.00 / 1.00 |   0.57 / 0.48 |   1.00 / 1.00 |       |
| careful-rough-pairs-n100     | careful |   283 (2.83n) |     278 (2.77n) |  -1.1% |  1.00 / 1.00 |   0.84 / 0.83 |   1.00 / 1.00 |       |
| typical-rough-pairs-n100     | typical |   274 (2.74n) |     286 (2.86n) |  +4.4% |  1.00 / 1.00 |   0.72 / 0.66 |   0.92 / 0.89 |       |
| fuzzy-unordered-pairs-n100   | fuzzy   |   392 (3.92n) |     413 (4.13n) |  +6.0% |  1.00 / 0.99 |   0.41 / 0.37 |   0.61 / 0.56 |       |
| fuzzy-rough-pairs-n100       | fuzzy   |   349 (3.49n) |     343 (3.42n) |  -1.7% |  1.00 / 0.99 |   0.40 / 0.40 |   0.64 / 0.55 |       |
| sloppy-unordered-pairs-n100  | sloppy  |   474 (4.74n) |     517 (5.17n) |  +9.9% |  0.98 / 0.98 |   0.38 / 0.38 |   0.71 / 0.67 |       |
| sloppy-rough-pairs-n100      | sloppy  |   348 (3.48n) |     363 (3.63n) |  +9.3% |  1.00 / 1.00 |   0.57 / 0.53 |   0.81 / 0.79 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| typical |  +3.3% |                                0 / 0 |
| careful |  +1.2% |                                0 / 0 |
| fuzzy   |  +2.1% |                                0 / 0 |
| sloppy  |  +9.6% |                                0 / 0 |

## DRAW_WEIGHT_EACH_WAY-0.4

| Scenario                     | Group   | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ---------------------------- | ------- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-pairs-n100 | typical |   336 (3.36n) |     333 (3.33n) |  -0.9% |  1.00 / 1.00 |   0.55 / 0.54 |   0.89 / 0.87 |       |
| careful-unordered-pairs-n100 | careful |   358 (3.58n) |     354 (3.54n) |  -1.1% |  1.00 / 1.00 |   0.57 / 0.58 |   1.00 / 1.00 |       |
| careful-rough-pairs-n100     | careful |   283 (2.83n) |     281 (2.81n) |  -0.6% |  1.00 / 1.00 |   0.84 / 0.86 |   1.00 / 1.00 |       |
| typical-rough-pairs-n100     | typical |   274 (2.74n) |     271 (2.71n) |  -1.2% |  1.00 / 1.00 |   0.72 / 0.74 |   0.92 / 0.93 |       |
| fuzzy-unordered-pairs-n100   | fuzzy   |   392 (3.92n) |     384 (3.84n) |  -1.3% |  1.00 / 1.00 |   0.41 / 0.39 |   0.61 / 0.64 |       |
| fuzzy-rough-pairs-n100       | fuzzy   |   349 (3.49n) |     329 (3.29n) |  -5.8% |  1.00 / 1.00 |   0.40 / 0.42 |   0.64 / 0.63 |       |
| sloppy-unordered-pairs-n100  | sloppy  |   474 (4.74n) |     464 (4.64n) |  -0.8% |  0.98 / 0.98 |   0.38 / 0.41 |   0.71 / 0.68 |       |
| sloppy-rough-pairs-n100      | sloppy  |   348 (3.48n) |     333 (3.33n) |  -1.1% |  1.00 / 1.00 |   0.57 / 0.54 |   0.81 / 0.87 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| typical |  -1.0% |                                0 / 0 |
| careful |  -0.9% |                                0 / 0 |
| fuzzy   |  -3.6% |                                0 / 0 |
| sloppy  |  -1.0% |                                0 / 0 |

## DRAW_WEIGHT_EACH_WAY-0.5

| Scenario                     | Group   | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ---------------------------- | ------- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| typical-unordered-pairs-n100 | typical |   336 (3.36n) |     335 (3.35n) |  -0.2% |  1.00 / 1.00 |   0.55 / 0.59 |   0.89 / 0.91 |       |
| careful-unordered-pairs-n100 | careful |   358 (3.58n) |     351 (3.51n) |  -2.0% |  1.00 / 1.00 |   0.57 / 0.56 |   1.00 / 1.00 |       |
| careful-rough-pairs-n100     | careful |   283 (2.83n) |     280 (2.80n) |  -0.3% |  1.00 / 1.00 |   0.84 / 0.81 |   1.00 / 1.00 |       |
| typical-rough-pairs-n100     | typical |   274 (2.74n) |     280 (2.80n) |  +2.4% |  1.00 / 1.00 |   0.72 / 0.72 |   0.92 / 0.94 |       |
| fuzzy-unordered-pairs-n100   | fuzzy   |   392 (3.92n) |     389 (3.89n) |  -0.0% |  1.00 / 0.99 |   0.41 / 0.36 |   0.61 / 0.63 |       |
| fuzzy-rough-pairs-n100       | fuzzy   |   349 (3.49n) |     354 (3.54n) |  +1.3% |  1.00 / 0.99 |   0.40 / 0.40 |   0.64 / 0.62 |       |
| sloppy-unordered-pairs-n100  | sloppy  |   474 (4.74n) |     473 (4.73n) |  +2.1% |  0.98 / 0.99 |   0.38 / 0.40 |   0.71 / 0.74 |       |
| sloppy-rough-pairs-n100      | sloppy  |   348 (3.48n) |     342 (3.42n) |  +3.5% |  1.00 / 1.00 |   0.57 / 0.58 |   0.81 / 0.85 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| typical |  +1.1% |                                0 / 0 |
| careful |  -1.2% |                                0 / 0 |
| fuzzy   |  +0.6% |                                0 / 0 |
| sloppy  |  +2.8% |                                0 / 0 |

within5 and within1 columns are current / candidate, means over the paired seeds. A change is the mean over paired seeds of (candidate - current) / current.
