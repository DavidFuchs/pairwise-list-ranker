# Compare against AUTO_GROUPS_PER_ITEM-u1-r0.5

Current: AUTO_GROUPS_PER_ITEM-u1-r0.5 (overrides {"AUTO_GROUPS_PER_ITEM":{"unordered":1,"rough":0.5}}, picker current, seeds 1 2 3 4 5 6 7 8 9 10 11 12).
Scenarios: filter cal-auto.
Groups: the base models (the mean is over them; every other scenario is a guard).
Seeds are paired by number. A run that never reached the gate counts as its last sample (its budget, or fewer on an early stop) and is counted as censored.

Decision: **AUTO_GROUPS_PER_ITEM-u1-r0.5** (no gain).

| Candidate                       | Mean change | Censored seeds (candidate / current) | Verdict                                                           |
| ------------------------------- | ----------: | -----------------------------------: | ----------------------------------------------------------------- |
| AUTO_GROUPS_PER_ITEM-u0.5-r0.5  |      +42.2% |                                0 / 0 | rejected: more than 10% slower on careful, typical, fuzzy, sloppy |
| AUTO_GROUPS_PER_ITEM-u0.75-r0.5 |       +4.1% |                                0 / 0 | rejected: more than 10% slower on fuzzy                           |
| AUTO_GROUPS_PER_ITEM-u1.25-r0.5 |       +0.0% |                                0 / 0 | no gain: mean +0.0%, not 2% faster                                |
| AUTO_GROUPS_PER_ITEM-u1.5-r0.5  |       +0.0% |                                0 / 0 | no gain: mean +0.0%, not 2% faster                                |

## AUTO_GROUPS_PER_ITEM-u0.5-r0.5

| Scenario               | Group   | Gate, current | Gate, candidate |  Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ---------------------- | ------- | ------------: | --------------: | ------: | -----------: | ------------: | ------------: | ----- |
| careful-unordered-n100 | careful |    65 (0.65n) |     116 (1.16n) |  +79.2% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| careful-rough-n100     | careful |    53 (0.53n) |      53 (0.53n) |   +0.0% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-unordered-n100 | typical |    68 (0.68n) |     108 (1.08n) |  +58.4% |  1.00 / 1.00 |   0.86 / 0.86 |   0.96 / 0.94 |       |
| typical-rough-n100     | typical |    62 (0.62n) |      62 (0.62n) |   +0.0% |  1.00 / 1.00 |   0.84 / 0.84 |   0.95 / 0.95 |       |
| fuzzy-unordered-n100   | fuzzy   |    87 (0.87n) |     191 (1.91n) | +121.6% |  1.00 / 1.00 |   0.57 / 0.54 |   0.74 / 0.67 |       |
| fuzzy-rough-n100       | fuzzy   |   142 (1.42n) |     142 (1.42n) |   +0.0% |  1.00 / 1.00 |   0.55 / 0.55 |   0.68 / 0.68 |       |
| sloppy-unordered-n100  | sloppy  |    70 (0.70n) |     125 (1.25n) |  +78.2% |  1.00 / 1.00 |   0.82 / 0.77 |   0.93 / 0.88 |       |
| sloppy-rough-n100      | sloppy  |    72 (0.72n) |      72 (0.72n) |   +0.0% |  1.00 / 1.00 |   0.82 / 0.82 |   0.92 / 0.92 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| careful | +39.6% |                                0 / 0 |
| typical | +29.2% |                                0 / 0 |
| fuzzy   | +60.8% |                                0 / 0 |
| sloppy  | +39.1% |                                0 / 0 |

## AUTO_GROUPS_PER_ITEM-u0.75-r0.5

| Scenario               | Group   | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ---------------------- | ------- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| careful-unordered-n100 | careful |    65 (0.65n) |      65 (0.65n) |  +0.0% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| careful-rough-n100     | careful |    53 (0.53n) |      53 (0.53n) |  +0.0% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-unordered-n100 | typical |    68 (0.68n) |      68 (0.68n) |  +0.0% |  1.00 / 1.00 |   0.86 / 0.86 |   0.96 / 0.96 |       |
| typical-rough-n100     | typical |    62 (0.62n) |      62 (0.62n) |  +0.0% |  1.00 / 1.00 |   0.84 / 0.84 |   0.95 / 0.95 |       |
| fuzzy-unordered-n100   | fuzzy   |    87 (0.87n) |     116 (1.16n) | +33.0% |  1.00 / 1.00 |   0.57 / 0.56 |   0.74 / 0.66 |       |
| fuzzy-rough-n100       | fuzzy   |   142 (1.42n) |     142 (1.42n) |  +0.0% |  1.00 / 1.00 |   0.55 / 0.55 |   0.68 / 0.68 |       |
| sloppy-unordered-n100  | sloppy  |    70 (0.70n) |      70 (0.70n) |  +0.0% |  1.00 / 1.00 |   0.82 / 0.81 |   0.93 / 0.91 |       |
| sloppy-rough-n100      | sloppy  |    72 (0.72n) |      72 (0.72n) |  +0.0% |  1.00 / 1.00 |   0.82 / 0.82 |   0.92 / 0.92 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| careful |  +0.0% |                                0 / 0 |
| typical |  +0.0% |                                0 / 0 |
| fuzzy   | +16.5% |                                0 / 0 |
| sloppy  |  +0.0% |                                0 / 0 |

## AUTO_GROUPS_PER_ITEM-u1.25-r0.5

| Scenario               | Group   | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ---------------------- | ------- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| careful-unordered-n100 | careful |    65 (0.65n) |      65 (0.65n) |  +0.0% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| careful-rough-n100     | careful |    53 (0.53n) |      53 (0.53n) |  +0.0% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-unordered-n100 | typical |    68 (0.68n) |      68 (0.68n) |  +0.0% |  1.00 / 1.00 |   0.86 / 0.91 |   0.96 / 0.97 |       |
| typical-rough-n100     | typical |    62 (0.62n) |      62 (0.62n) |  +0.0% |  1.00 / 1.00 |   0.84 / 0.84 |   0.95 / 0.95 |       |
| fuzzy-unordered-n100   | fuzzy   |    87 (0.87n) |      87 (0.87n) |  +0.0% |  1.00 / 1.00 |   0.57 / 0.60 |   0.74 / 0.69 |       |
| fuzzy-rough-n100       | fuzzy   |   142 (1.42n) |     142 (1.42n) |  +0.0% |  1.00 / 1.00 |   0.55 / 0.55 |   0.68 / 0.68 |       |
| sloppy-unordered-n100  | sloppy  |    70 (0.70n) |      70 (0.70n) |  +0.0% |  1.00 / 1.00 |   0.82 / 0.83 |   0.93 / 0.91 |       |
| sloppy-rough-n100      | sloppy  |    72 (0.72n) |      72 (0.72n) |  +0.0% |  1.00 / 1.00 |   0.82 / 0.82 |   0.92 / 0.92 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| careful |  +0.0% |                                0 / 0 |
| typical |  +0.0% |                                0 / 0 |
| fuzzy   |  +0.0% |                                0 / 0 |
| sloppy  |  +0.0% |                                0 / 0 |

## AUTO_GROUPS_PER_ITEM-u1.5-r0.5

| Scenario               | Group   | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |
| ---------------------- | ------- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |
| careful-unordered-n100 | careful |    65 (0.65n) |      65 (0.65n) |  +0.0% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| careful-rough-n100     | careful |    53 (0.53n) |      53 (0.53n) |  +0.0% |  1.00 / 1.00 |   1.00 / 1.00 |   1.00 / 1.00 |       |
| typical-unordered-n100 | typical |    68 (0.68n) |      68 (0.68n) |  +0.0% |  1.00 / 1.00 |   0.86 / 0.91 |   0.96 / 0.96 |       |
| typical-rough-n100     | typical |    62 (0.62n) |      62 (0.62n) |  +0.0% |  1.00 / 1.00 |   0.84 / 0.84 |   0.95 / 0.95 |       |
| fuzzy-unordered-n100   | fuzzy   |    87 (0.87n) |      87 (0.87n) |  +0.0% |  1.00 / 1.00 |   0.57 / 0.62 |   0.74 / 0.72 |       |
| fuzzy-rough-n100       | fuzzy   |   142 (1.42n) |     142 (1.42n) |  +0.0% |  1.00 / 1.00 |   0.55 / 0.55 |   0.68 / 0.68 |       |
| sloppy-unordered-n100  | sloppy  |    70 (0.70n) |      70 (0.70n) |  +0.0% |  1.00 / 1.00 |   0.82 / 0.85 |   0.93 / 0.91 |       |
| sloppy-rough-n100      | sloppy  |    72 (0.72n) |      72 (0.72n) |  +0.0% |  1.00 / 1.00 |   0.82 / 0.82 |   0.92 / 0.92 |       |

| Group   | Change | Censored seeds (candidate / current) |
| ------- | -----: | -----------------------------------: |
| careful |  +0.0% |                                0 / 0 |
| typical |  +0.0% |                                0 / 0 |
| fuzzy   |  +0.0% |                                0 / 0 |
| sloppy  |  +0.0% |                                0 / 0 |

within5 and within1 columns are current / candidate, means over the paired seeds. A change is the mean over paired seeds of (candidate - current) / current.
