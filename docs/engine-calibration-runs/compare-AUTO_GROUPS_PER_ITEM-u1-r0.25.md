# Compare against AUTO_GROUPS_PER_ITEM-u1-r0.5

Current: AUTO_GROUPS_PER_ITEM-u1-r0.5 (overrides {"AUTO_GROUPS_PER_ITEM":{"unordered":1,"rough":0.5}}, picker current, seeds 1 2 3 4 5 6 7 8 9 10 11 12).
Scenarios: filter cal-auto.
Groups: the base models (the mean is over them; every other scenario is a guard).
Seeds are paired by number. A run that never reached the gate counts as its last sample (its budget, or fewer on an early stop) and is counted as censored.

Decision: **AUTO_GROUPS_PER_ITEM-u1-r1** (fewest answers to the gate: -9.5% against AUTO_GROUPS_PER_ITEM-u1-r0.5).

| Candidate                     | Mean change | Censored seeds (candidate / current) | Verdict                                                           |
| ----------------------------- | ----------: | -----------------------------------: | ----------------------------------------------------------------- |
| AUTO_GROUPS_PER_ITEM-u1-r0.25 |      +76.0% |                                0 / 0 | rejected: more than 10% slower on careful, typical, fuzzy, sloppy |
| AUTO_GROUPS_PER_ITEM-u1-r0.75 |       -9.1% |                                0 / 0 | eligible: mean -9.1%                                              |
| AUTO_GROUPS_PER_ITEM-u1-r1    |       -9.5% |                                0 / 0 | chosen: mean -9.5%                                                |
| AUTO_GROUPS_PER_ITEM-u1-r1.25 |       -9.5% |                                0 / 0 | eligible: mean -9.5%                                              |

## AUTO_GROUPS_PER_ITEM-u1-r0.25

| Scenario               | Group   | Gate, current | Gate, candidate |  Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ---------------------- | ------- | ------------: | --------------: | ------: | -----------: | ------------: | ------------: | ----- |
| careful-unordered-n100 | careful |    65 (0.65n) |      65 (0.65n) |   +0.0% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| careful-rough-n100     | careful |    53 (0.53n) |     148 (1.48n) | +181.0% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-unordered-n100 | typical |    68 (0.68n) |      68 (0.68n) |   +0.0% |  1.00 / 1.00 |   0.86 / 0.86 |   0.96 / 0.96 |       |
| typical-rough-n100     | typical |    62 (0.62n) |     155 (1.55n) | +163.8% |  1.00 / 1.00 |   0.84 / 0.84 |   0.95 / 0.95 |       |
| fuzzy-unordered-n100   | fuzzy   |    87 (0.87n) |      87 (0.87n) |   +0.0% |  1.00 / 1.00 |   0.57 / 0.57 |   0.74 / 0.74 |       |
| fuzzy-rough-n100       | fuzzy   |   142 (1.42n) |     249 (2.49n) |  +91.9% |  1.00 / 1.00 |   0.55 / 0.48 |   0.68 / 0.65 |       |
| sloppy-unordered-n100  | sloppy  |    70 (0.70n) |      70 (0.70n) |   +0.0% |  1.00 / 1.00 |   0.82 / 0.82 |   0.93 / 0.93 |       |
| sloppy-rough-n100      | sloppy  |    72 (0.72n) |     180 (1.80n) | +171.0% |  1.00 / 1.00 |   0.82 / 0.71 |   0.92 / 0.90 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| careful | +90.5% |                                0 / 0 |
| typical | +81.9% |                                0 / 0 |
| fuzzy   | +45.9% |                                0 / 0 |
| sloppy  | +85.5% |                                0 / 0 |

## AUTO_GROUPS_PER_ITEM-u1-r0.75

| Scenario               | Group   | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ---------------------- | ------- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| careful-unordered-n100 | careful |    65 (0.65n) |      65 (0.65n) |  +0.0% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| careful-rough-n100     | careful |    53 (0.53n) |      50 (0.50n) |  -4.5% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-unordered-n100 | typical |    68 (0.68n) |      68 (0.68n) |  +0.0% |  1.00 / 1.00 |   0.86 / 0.86 |   0.96 / 0.96 |       |
| typical-rough-n100     | typical |    62 (0.62n) |      54 (0.54n) |  -7.9% |  1.00 / 1.00 |   0.84 / 0.86 |   0.95 / 0.95 |       |
| fuzzy-unordered-n100   | fuzzy   |    87 (0.87n) |      87 (0.87n) |  +0.0% |  1.00 / 1.00 |   0.57 / 0.57 |   0.74 / 0.74 |       |
| fuzzy-rough-n100       | fuzzy   |   142 (1.42n) |      78 (0.78n) | -42.6% |  1.00 / 1.00 |   0.55 / 0.57 |   0.68 / 0.72 |       |
| sloppy-unordered-n100  | sloppy  |    70 (0.70n) |      70 (0.70n) |  +0.0% |  1.00 / 1.00 |   0.82 / 0.82 |   0.93 / 0.93 |       |
| sloppy-rough-n100      | sloppy  |    72 (0.72n) |      55 (0.55n) | -18.2% |  1.00 / 1.00 |   0.82 / 0.82 |   0.92 / 0.91 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| careful |  -2.3% |                                0 / 0 |
| typical |  -3.9% |                                0 / 0 |
| fuzzy   | -21.3% |                                0 / 0 |
| sloppy  |  -9.1% |                                0 / 0 |

## AUTO_GROUPS_PER_ITEM-u1-r1

| Scenario               | Group   | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ---------------------- | ------- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| careful-unordered-n100 | careful |    65 (0.65n) |      65 (0.65n) |  +0.0% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| careful-rough-n100     | careful |    53 (0.53n) |      50 (0.50n) |  -4.5% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-unordered-n100 | typical |    68 (0.68n) |      68 (0.68n) |  +0.0% |  1.00 / 1.00 |   0.86 / 0.86 |   0.96 / 0.96 |       |
| typical-rough-n100     | typical |    62 (0.62n) |      54 (0.54n) |  -7.9% |  1.00 / 1.00 |   0.84 / 0.92 |   0.95 / 0.95 |       |
| fuzzy-unordered-n100   | fuzzy   |    87 (0.87n) |      87 (0.87n) |  +0.0% |  1.00 / 1.00 |   0.57 / 0.57 |   0.74 / 0.74 |       |
| fuzzy-rough-n100       | fuzzy   |   142 (1.42n) |      71 (0.71n) | -45.6% |  1.00 / 1.00 |   0.55 / 0.61 |   0.68 / 0.73 |       |
| sloppy-unordered-n100  | sloppy  |    70 (0.70n) |      70 (0.70n) |  +0.0% |  1.00 / 1.00 |   0.82 / 0.82 |   0.93 / 0.93 |       |
| sloppy-rough-n100      | sloppy  |    72 (0.72n) |      55 (0.55n) | -18.2% |  1.00 / 1.00 |   0.82 / 0.84 |   0.92 / 0.92 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| careful |  -2.3% |                                0 / 0 |
| typical |  -3.9% |                                0 / 0 |
| fuzzy   | -22.8% |                                0 / 0 |
| sloppy  |  -9.1% |                                0 / 0 |

## AUTO_GROUPS_PER_ITEM-u1-r1.25

| Scenario               | Group   | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ---------------------- | ------- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| careful-unordered-n100 | careful |    65 (0.65n) |      65 (0.65n) |  +0.0% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| careful-rough-n100     | careful |    53 (0.53n) |      50 (0.50n) |  -4.5% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-unordered-n100 | typical |    68 (0.68n) |      68 (0.68n) |  +0.0% |  1.00 / 1.00 |   0.86 / 0.86 |   0.96 / 0.96 |       |
| typical-rough-n100     | typical |    62 (0.62n) |      54 (0.54n) |  -7.9% |  1.00 / 1.00 |   0.84 / 0.92 |   0.95 / 0.96 |       |
| fuzzy-unordered-n100   | fuzzy   |    87 (0.87n) |      87 (0.87n) |  +0.0% |  1.00 / 1.00 |   0.57 / 0.57 |   0.74 / 0.74 |       |
| fuzzy-rough-n100       | fuzzy   |   142 (1.42n) |      71 (0.71n) | -45.6% |  1.00 / 1.00 |   0.55 / 0.64 |   0.68 / 0.73 |       |
| sloppy-unordered-n100  | sloppy  |    70 (0.70n) |      70 (0.70n) |  +0.0% |  1.00 / 1.00 |   0.82 / 0.82 |   0.93 / 0.93 |       |
| sloppy-rough-n100      | sloppy  |    72 (0.72n) |      55 (0.55n) | -18.2% |  1.00 / 1.00 |   0.82 / 0.89 |   0.92 / 0.94 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| careful |  -2.3% |                                0 / 0 |
| typical |  -3.9% |                                0 / 0 |
| fuzzy   | -22.8% |                                0 / 0 |
| sloppy  |  -9.1% |                                0 / 0 |

within5 and within1 columns are current / candidate, means over the paired seeds. A change is the mean over paired seeds of (candidate - current) / current.
