# Engine calibration

How the ranking engine is simulated, how to run it, and the baseline every
calibration is compared with. The release gates it serves are in
docs/ARCHITECTURE.md 11.

> **Pairs only (2026-10-20).** Groups, Auto and the sort mode were removed from
> the app and the engine on 2026-10-20. The sections below on the group weight,
> `G`, `AUTO_GROUPS_PER_ITEM`, the Auto figures, the `cal-auto` and `cal-groups`
> scenarios and the lazy and corrector scenarios are kept as history of the
> grouped engine, and each is labelled as such rather than rewritten. The record
> of the pairs-only engine is "Pairs-only baseline" near the end, and the
> placement width stays 0.1, with the placement test measured after 8n answers
> (the owner's decision of 2026-10-20, see "Placement re-check under pairs
> only").

The harness is `tests/sim/`. It plays simulated users against the real engine
(`EngineSession` and `askNext`), so it cannot drift from the app. An older
standalone script that this harness replaced gave numbers that are not
comparable with the ones here.

## How to run

`npm run sim` runs `tests/sim/baseline.sim.ts`: every scenario for several
seeds, with one test per scenario so a failure names it. It writes
`docs/engine-calibration-runs/<label>.json` once, at the end. Settings come from
environment variables:

| Variable        | Default    | Meaning                                                                                                              |
| --------------- | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| `SIM_LABEL`     | `baseline` | Names the output file.                                                                                               |
| `SIM_SEEDS`     | `3`        | Seeds 1 to this number.                                                                                              |
| `SIM_SIZE`      | `full`     | `ci` (a small set at n = 60, seconds) or `full` (63 scenarios, up to n = 400).                                       |
| `SIM_OVERRIDES` | none       | A JSON object of constants to override for the run (see below).                                                      |
| `SIM_PICKER`    | `current`  | `current` (the engine's own picker) or `adjacent` (the simpler picker of docs/ARCHITECTURE.md 6.7's required check). |
| `SIM_FILTER`    | none       | A regular expression matched against each scenario's name and tags; only the scenarios that match are run.           |

`SIM_OVERRIDES` names constants from `lib/ranking/bt/constants.ts`
(`PAIR_WEIGHT`, `STRONG_WEIGHT`, `DRAW_WEIGHT_EACH_WAY`, `PLACEMENT_SD_FRACTION`,
`REPEAT_FACTOR`, `RECENCY_FACTOR`). An unknown name stops the run (the removed `GROUP_REORDERED_WEIGHT`
and `AUTO_GROUPS_PER_ITEM` included). The run mocks the modules
that define the constants; no production code changes. For example, in bash:

```sh
SIM_LABEL=strong-2 SIM_OVERRIDES='{"STRONG_WEIGHT":2}' npm run sim
```

and in PowerShell:

```powershell
$env:SIM_LABEL='strong-2'; $env:SIM_OVERRIDES='{"STRONG_WEIGHT":2}'; npm run sim
```

Always set `SIM_LABEL` for an override, picker or filter run: the run stops at
load if any of them is set and the label is `baseline`. A run that does not play
every scenario of its size (a filter, a `-t` filter, or a scenario that threw)
writes `<label>.partial.json`, never `<label>.json`, so it cannot replace a full
result. The result file records the overrides, the picker and the filter.

`SIM_PICKER=adjacent` puts `tests/sim/pickers.ts` in the engine's place: a pair
is the two neighbours in displayed order with the largest summed uncertainty
(with the same repeat discount). It is the baseline the real picker must beat
(docs/ARCHITECTURE.md 6.7). Worked example, in bash, comparing the pickers on the pairs
scenarios:

```sh
SIM_LABEL=picker-adjacent SIM_PICKER=adjacent SIM_FILTER='cal-pairs' npm run sim
```

`SIM_FILTER` is a regular expression, tested against the name and against every
tag, so `cal-pairs` selects the pairs family, and `^typical-unordered-n400$`
selects one scenario. A filter that selects nothing stops the run. Worked
example: `SIM_LABEL=lazy SIM_FILTER='lazy' npm run sim` plays the lazy-accepter
scenarios only, into `lazy.partial.json`.

A quick check that the harness works: `SIM_SIZE=ci SIM_SEEDS=1 SIM_LABEL=smoke npm run sim`
(delete `smoke.partial.json` or `smoke.json` afterwards).

Cost: on the machine that made the baseline, a 400-item scenario takes about 15
seconds per seed, and the full run (63 scenarios, 3 seeds) took 13 minutes 34
seconds.

### Sweeping one constant

`scripts/sim-sweep.mjs` runs one engine constant over several values, one
`npm run sim` process per value, so each loads the constants afresh. Each run
writes its own `<label>.json` (the label is `<NAME>-<value>`, for example
`STRONG_WEIGHT-2.5`). The header of the script lists every option: `--constant`,
`--values`, `--filter`, `--seeds`, `--size`, `--parallel` (default 2),
`--picker` and `--dry-run`. Worked example, in bash, with the runs checked first
by `--dry-run`:

```sh
node scripts/sim-sweep.mjs --constant STRONG_WEIGHT --values 1.75,2.5 --filter cal-strong --dry-run
node scripts/sim-sweep.mjs --constant STRONG_WEIGHT --values 1.75,2.5 --filter cal-strong
```

The sweep accepts only the six constants that can still be overridden:
`PAIR_WEIGHT`, `STRONG_WEIGHT`, `DRAW_WEIGHT_EACH_WAY`, `PLACEMENT_SD_FRACTION`,
`REPEAT_FACTOR` and `RECENCY_FACTOR`. Another name stops the sweep before any run. The pairs-only
placement re-check used it this way:

```sh
node scripts/sim-sweep.mjs --constant PLACEMENT_SD_FRACTION --values 0.05,0.1,0.2 --filter cal-placement --seeds 12 --parallel 3
```

On Windows, use `node scripts/sim-sweep.mjs ...` directly, not
`npm run sim:sweep --`. npm passes the arguments through cmd.exe, and a filter
that contains `|` or `&` breaks there.

### Comparing runs

`npm run sim:compare` applies the deciding rule of the calibrations to two or more result
files (the rule is written at the top of `tests/sim/compare.ts`). It reads
`docs/engine-calibration-runs/<label>.json` for each label and writes
`compare-<first candidate>.md` beside them. Settings:

| Variable         | Meaning                                                                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SIM_CURRENT`    | The label of the current value's run (`baseline` is one).                                                                                                                                                        |
| `SIM_CANDIDATES` | A comma list of labels to compare with it.                                                                                                                                                                       |
| `SIM_SCENARIOS`  | Optional: a regular expression, matched as `SIM_FILTER` is, that limits the comparison. Unset compares every scenario of the current file.                                                                       |
| `SIM_GROUPS`     | Optional: `model` (the default: the mean over the four base models, other scenarios are guards), `scenario` (each scenario its own group) or `recency` (each drift scenario its own group, every other a guard). |

In short: seeds are paired by number; a scenario's change is the mean of
(candidate - current) / current over its paired seeds; a candidate more than 10%
slower on any group or guard is rejected, one with more censored seeds in the
deciding set is not eligible, and it must beat the current value by at least 2%
of its mean. Worked example, after the sweep above (the three "Much better"
habits are separate groups, so use `scenario`):

```sh
SIM_CURRENT=STRONG_WEIGHT-1.75 SIM_CANDIDATES=STRONG_WEIGHT-2.5 SIM_SCENARIOS=cal-strong SIM_GROUPS=scenario npm run sim:compare
```

## Scenarios

_History of the grouped engine, except for the pairs, strong, probe and
behaviour scenarios: under pairs only the `-groups-` scenarios, `cal-groups`,
`cal-auto`, `lazy10`, `lazy30` and `corrector` no longer exist, and every base
scenario asks pairs (49 scenarios in all, listed under "Pairs-only baseline")._

Names are stable: a changed scenario gets a new name. Each scenario has `tags`;
`SIM_FILTER` and `SIM_SCENARIOS` match them as well as the name. The full set,
at n = 100 unless noted:

- The four user models (careful, typical, fuzzy, sloppy) in three starting
  orders (unordered, rough, ranked), at n = 100 and n = 400 (24 scenarios, run
  under Auto). Tag `cal-auto` on the unordered and rough ones at n = 100, and
  `strongOften` on the typical unordered one.
- `typical-unordered-groups` and `typical-unordered-pairs`, at n = 100 and
  n = 400: the sort mode forced to groups only or to pairs only. Tags `cal-groups`
  and `cal-pairs` at n = 100.
- `<model>-<unordered|rough>-<groups|pairs>-n100` for the other seven
  model and start combinations: the same two forced modes for every model. Tags
  `cal-groups` and `cal-pairs`. Together with the line above, these are what the
  group weight, draw weight and pair weight calibrations compare (`cal-groups`,
  `cal-pairs`), and what the group count calibration compares (`cal-auto`).
- `typical-unordered-strong-<often|rarely|inconsistent>-pairs-n100`: the three
  "Much better" habits under pairs only, where a strong answer can occur. Tag
  `cal-strong`. See the limits below.
- `typical-unordered-probe-<near|far>-n100`: six probe moves after the first n
  answers, one every 25 answers. Tag `cal-placement`, as are `wrong-moves`,
  `wrong-moves-corrected` and `multi-move`. Since 2026-10-20 the probe-near and
  probe-far scenarios run until
  a further 8n answers after the last probe (n + 125 + 8n, 1025 answers at
  n = 100) rather than 8n, so every probe can be measured 8n answers after its
  move. Up to answer 8n they play exactly as before, so their gate and their 2n
  and 4n figures are unchanged; only the samples after 8n are new.
- The behaviour scenarios, each a typical user under Auto: `lazy10`, `lazy30` and
  `corrector` (tag `cal-groups`), `strong-rarely`, `strong-inconsistent`, `ties`,
  `gaps`, `loose`, `reversed-sections`, `wrong-moves`, `wrong-moves-corrected`,
  `multi-move` and `marked`; plus `lazy30` and `corrector` at n = 400
  (no calibration tag).
- `typical-unordered-drift-n<6|12|100>` (and `-n60` in the `ci` set): a typical
  user whose mind changes partway through. Tag `cal-recency`; see "Later
  answers".

### Probes

A probe is a move the driver makes on purpose: it takes one item and moves it to
another place in the displayed list, a `near` probe within 2% of the list from
the item's true place, a `far` probe more than 25% away. Each is recorded on the
trace in `probes`: `atAnswer`, `kind`, `displacementAtMove`,
`displacementAfter2n`, `displacementAfter4n` and `displacementAfter8n` (the
displacement, as a share of the shown items, right after the move and after a
further 2n, 4n and 8n answers; `null` if the run ended first or the item was no
longer shown). The 4n and 8n fields were added on 2026-10-20: result files
recorded before then lack them, and the compare tool counts a missing field as
not measured. `probesSkipped` counts the moves the driver wanted to make but
could not, because no candidate place gave the displacement asked for (it is 0
in every run of the baseline). `npm run sim:compare` reports, per kind and per
horizon (2n, 4n, 8n), how many probes were made, how many were measured, how
many were back within 5%, the share, and the mean displacement of the measured
ones.

### User noise

The simulated user's perception noise is answer-aligned: the k-th answer of a
run sees the same perception noise whichever question it was asked. That is what
makes paired seeds pair: two runs of the same scenario and seed, with a different
constant or picker, face the same user, so their difference is the engine's and
not the user's luck.

## What a result file holds

`{ label, overrides, picker, filter, seeds, runs: [{ scenario, traces }] }`. Each
trace has:

- `scenario`, `seed`.
- `samples`: one at answer 0, then one at each answer count round(k * n/4) (at
  least 1) up to the budget, and the budget itself if it is not already one of
  those (with a budget of 8n it is the 32nd quarter point, so no extra sample;
  the probe scenarios' budget of 1025 at n = 100 adds one).
  Each has `answers` (answers given), `changes` (every user action so
  far: answers, marks, moves and removals), `asked` (`groups` or `pairs`, the
  question that last answer was given to) and `measures` of the shown order
  against the true one:
  - `mean`, `median`: displacement in places from the item's true span (equal ends
    for a strict order, a range for ties).
  - `worstDecile`: mean displacement of the worst tenth of items.
  - `within5`, `within1`: share of items within max(1, 5% of n) or max(1, 1% of
    n) places of their span.
  - `kendall`: share of truth-ordered pairs the shown order has the right way round.
  - `top20`: share of the shown top min(20, n) that could be in the true top min(20, n).
- `answersToGate`: answers until `within5` first reached 0.9 (the gate), or
  `null` if it never did within the budget (8n answers, more for the probe
  scenarios).
- `probes` and `probesSkipped`: see Probes above.

## Reading the numbers

- Samples are taken every n/4 answers, but the gate uses a denser sampling, every
  max(1, round(n/20)) answers, and starts at answer 0. A list that is already at
  0.9 when the user opens it therefore reports 0, which is what the ranked
  scenarios show.
- `answersToGate` is the first time `within5` crossed 0.9, not a sustained
  result. In `wrong-moves` the gate comes at 70 answers (all three seeds), yet
  `within5` ends at 0.87 (0.87, 0.85, 0.89), because the later wrong moves undo
  it. Read the late samples as well as the gate.
- A run that stops early because no question is left takes no final sample.
- Heavy marking (`markShare`) scores only the items still shown, which makes the
  0.9 gate easier to reach.
- `answersToGate` of `null` means never reached within the budget; the table
  shows `n/a`, and shows it when any seed is `null`.
- The compare tool counts a trace that never reached the gate as its last
  sample's answers, and counts it as censored. Its censored total is one number
  over the whole deciding set, so a reviewer must read the censored column per
  group.

## Baseline

_History of the grouped engine (Auto and groups only). The pairs-only figures are
under "Pairs-only baseline"._

Label `baseline`, no overrides, picker `current`, no filter, seeds 1 to 3, file
[engine-calibration-runs/baseline.json](engine-calibration-runs/baseline.json).
The table gives the mean of `answersToGate` over the seeds, as a count and as a
multiple of n, and the mean `within5` at the last sample. It was regenerated
with the second harness wave (answer-0 sample, answer-aligned noise, Auto
counting the items counted now) and replaces the first baseline, which is not
comparable except as listed below.

| Scenario                                         |   n | Answers to gate | As a multiple of n | within5 at the last sample |
| ------------------------------------------------ | --: | --------------: | -----------------: | -------------------------: |
| careful-unordered-n100                           | 100 |              65 |              0.65n |                       1.00 |
| careful-rough-n100                               | 100 |              45 |              0.45n |                       1.00 |
| careful-ranked-n100                              | 100 |               0 |              0.00n |                       1.00 |
| typical-unordered-n100                           | 100 |              67 |              0.67n |                       1.00 |
| typical-rough-n100                               | 100 |              57 |              0.57n |                       1.00 |
| typical-ranked-n100                              | 100 |               0 |              0.00n |                       1.00 |
| fuzzy-unordered-n100                             | 100 |              82 |              0.82n |                       1.00 |
| fuzzy-rough-n100                                 | 100 |             128 |              1.28n |                       1.00 |
| fuzzy-ranked-n100                                | 100 |               0 |              0.00n |                       1.00 |
| sloppy-unordered-n100                            | 100 |              75 |              0.75n |                       1.00 |
| sloppy-rough-n100                                | 100 |              55 |              0.55n |                       1.00 |
| sloppy-ranked-n100                               | 100 |               0 |              0.00n |                       1.00 |
| careful-unordered-n400                           | 400 |             267 |              0.67n |                       1.00 |
| careful-rough-n400                               | 400 |             207 |              0.52n |                       1.00 |
| careful-ranked-n400                              | 400 |               0 |              0.00n |                       1.00 |
| typical-unordered-n400                           | 400 |             280 |              0.70n |                       1.00 |
| typical-rough-n400                               | 400 |             227 |              0.57n |                       1.00 |
| typical-ranked-n400                              | 400 |               0 |              0.00n |                       1.00 |
| fuzzy-unordered-n400                             | 400 |             400 |              1.00n |                       1.00 |
| fuzzy-rough-n400                                 | 400 |            1000 |              2.50n |                       1.00 |
| fuzzy-ranked-n400                                | 400 |               0 |              0.00n |                       1.00 |
| sloppy-unordered-n400                            | 400 |             293 |              0.73n |                       1.00 |
| sloppy-rough-n400                                | 400 |             227 |              0.57n |                       1.00 |
| sloppy-ranked-n400                               | 400 |               0 |              0.00n |                       1.00 |
| typical-unordered-groups-n100                    | 100 |              67 |              0.67n |                       1.00 |
| typical-unordered-pairs-n100                     | 100 |             342 |              3.42n |                       1.00 |
| typical-unordered-groups-n400                    | 400 |             280 |              0.70n |                       1.00 |
| typical-unordered-pairs-n400                     | 400 |            1427 |              3.57n |                       1.00 |
| typical-unordered-lazy10-n100                    | 100 |              65 |              0.65n |                       1.00 |
| typical-unordered-lazy30-n100                    | 100 |              90 |              0.90n |                       1.00 |
| typical-unordered-corrector-n100                 | 100 |             n/a |                n/a |                       0.53 |
| typical-unordered-strong-rarely-n100             | 100 |              67 |              0.67n |                       1.00 |
| typical-unordered-strong-inconsistent-n100       | 100 |              67 |              0.67n |                       1.00 |
| typical-unordered-ties-n100                      | 100 |              63 |              0.63n |                       1.00 |
| typical-unordered-gaps-n100                      | 100 |             112 |              1.12n |                       0.99 |
| typical-ranked-loose-n100                        | 100 |             n/a |                n/a |                       0.79 |
| typical-ranked-reversed-sections-n100            | 100 |             n/a |                n/a |                       0.94 |
| typical-unordered-wrong-moves-n100               | 100 |              70 |              0.70n |                       0.87 |
| typical-unordered-wrong-moves-corrected-n100     | 100 |              70 |              0.70n |                       1.00 |
| typical-unordered-multi-move-n100                | 100 |              67 |              0.67n |                       1.00 |
| typical-unordered-marked-n100                    | 100 |              68 |              0.68n |                       1.00 |
| typical-unordered-big-edit-n100                  | 100 |              67 |              0.67n |                       1.00 |
| typical-unordered-lazy30-n400                    | 400 |             413 |              1.03n |                       1.00 |
| careful-unordered-groups-n100                    | 100 |              65 |              0.65n |                       1.00 |
| careful-unordered-pairs-n100                     | 100 |             365 |              3.65n |                       1.00 |
| careful-rough-groups-n100                        | 100 |              45 |              0.45n |                       1.00 |
| careful-rough-pairs-n100                         | 100 |             292 |              2.92n |                       1.00 |
| typical-rough-groups-n100                        | 100 |              53 |              0.53n |                       1.00 |
| typical-rough-pairs-n100                         | 100 |             278 |              2.78n |                       1.00 |
| fuzzy-unordered-groups-n100                      | 100 |              82 |              0.82n |                       1.00 |
| fuzzy-unordered-pairs-n100                       | 100 |             397 |              3.97n |                       1.00 |
| fuzzy-rough-groups-n100                          | 100 |              67 |              0.67n |                       1.00 |
| fuzzy-rough-pairs-n100                           | 100 |             348 |              3.48n |                       1.00 |
| sloppy-unordered-groups-n100                     | 100 |              75 |              0.75n |                       1.00 |
| sloppy-unordered-pairs-n100                      | 100 |             503 |              5.03n |                       0.98 |
| sloppy-rough-groups-n100                         | 100 |              53 |              0.53n |                       1.00 |
| sloppy-rough-pairs-n100                          | 100 |             312 |              3.12n |                       1.00 |
| typical-unordered-strong-often-pairs-n100        | 100 |             342 |              3.42n |                       1.00 |
| typical-unordered-strong-rarely-pairs-n100       | 100 |             337 |              3.37n |                       1.00 |
| typical-unordered-strong-inconsistent-pairs-n100 | 100 |             335 |              3.35n |                       1.00 |
| typical-unordered-corrector-n400                 | 400 |             n/a |                n/a |                       0.33 |
| typical-unordered-probe-near-n100                | 100 |              67 |              0.67n |                       1.00 |
| typical-unordered-probe-far-n100                 | 100 |              67 |              0.67n |                       0.95 |

### Release gates

Spec 13.3 sets three gates at 400 items, checked against this baseline:

| Gate                                                       | Limit |     Baseline | Verdict |
| ---------------------------------------------------------- | ----: | -----------: | ------- |
| `typical-unordered-n400` (Auto)                            |  1.5n |  280 (0.70n) | met     |
| `typical-unordered-pairs-n400` (pairs only)                |    6n | 1427 (3.57n) | met     |
| `typical-unordered-lazy30-n400` (30% lazy accepters, Auto) |    3n |  413 (1.03n) | met     |

All three are met with room to spare, before any calibration.

### Against the first baseline

The first baseline came from the older harness (no answer-0 sample, noise tied
to the question asked, Auto counting the items by a different rule). Results
that moved by more than 15% in the mean gate:

- The eight ranked scenarios (`careful`, `typical`, `fuzzy` and `sloppy`, at
  n = 100 and n = 400) went from 5 and 20 answers to 0. Cause: the answer-0
  sample, as expected; nothing about the engine changed.
- `typical-rough-n100` went from 45 to 57 (+26%; seeds 50, 65 and 55 now against
  45, 50 and 40). Likely the answer-aligned noise or Auto's new count; not
  isolated.
- `fuzzy-rough-n100` went from 153 to 128 (-16%), but its seeds are 60, 180 and
  145 now against 80, 130 and 250: the spread is larger than the change, so read
  it as noise.
- `fuzzy-unordered-n400` went from 600 to 400 (-33%; seeds 380, 400 and 420
  against 760, 640 and 400). Likely Auto's new group count; not isolated.
- `sloppy-rough-n400` went from 280 to 227 (-19%; seeds 280, 200 and 200 against
  340, 300 and 200). Same likely cause.
- `typical-ranked-reversed-sections-n100` changed in how it reads, not in its
  numbers: one seed now never reaches the gate (the other two at 760 and 740
  answers), so the table shows `n/a`; the first baseline's seeds reached it at
  785, 800 and 800.

Everything else moved by 15% or less. The three release gates moved by 0%, 1%
and 0%.

## Findings and limits

_Written under the grouped engine; items about Auto, groups, the corrector and
lazy accepters, and the open question below, are history. The open question was
settled on 2026-10-20 in favour of pairs only._

- `typical-unordered-corrector-n100` ends near within5 0.53 with no gate
  reached after 8n answers (seeds 0.40, 0.72 and 0.46), and the n = 400 variant
  ends near 0.33 with no gate either. This looks like the overconfidence the simulation was meant to catch: the engine trusts a group answer that fixed
  only one adjacent pair.
- `typical-ranked-loose-n100` also never reaches the gate (within5 0.79 at the
  end). `typical-ranked-reversed-sections-n100` is censored: two seeds reached
  0.9 at 760 and 740 answers and the budget is 800, so read it as roughly "at the
  budget".
- The base `typical-unordered-strong-rarely-n100` and
  `typical-unordered-strong-inconsistent-n100` (under Auto) are identical to
  `typical-unordered-n100` in all three seeds: a "much better" answer needs a
  perceived gap above 0.3, which the group phase never produces. The pairs-only
  variants (`cal-strong`) do produce them, and reach the gate at 342, 337 and 335
  answers (often, rarely, inconsistent), within 2% of each other. Strong
  answers are scarce even there. They were counted once, at n = 60, seed 1,
  pairs mode only, out of 480 pair answers: often 31 (about 6.5%), inconsistent
  15 (about 3%), rarely 7 (about 1.5%). This was not measured on the baseline
  runs (the trace holds no events), so the signal for `STRONG_WEIGHT` is thin,
  and thinnest for rarely and inconsistent. A calibration of `STRONG_WEIGHT`
  must therefore treat the three habits together and expect "no gain" unless a
  candidate moves them clearly.
- The gate for `multi-move` equals the base scenario's by construction (67
  answers at n = 100), because that feature acts after the gate point (at n and
  4n answers). The `big-edit` scenario, which behaved the same way, was removed
  on 2026-10-20 with Edit data; its recorded rows in the tables are history. The strong variants under Auto equal the
  base for a different reason: no strong answer occurs under Auto (see above).
  The table cannot show the effect of these; read their late samples instead.
- The wrong-moves scenario without correction ends at within5 0.87, and the
  corrected variant recovers to 1.00.
- A `near` probe made at answer n mostly puts the item at its true place: the
  mean displacement right after the move is 0.015 of the list, and all 18 near
  probes are within 5% after 2n answers. It tests correct-ish placement, not a
  perturbation of a settled item. The `far` probes (mean 0.53 at the move) end
  at a mean of 0.31 after 2n answers, and none is back within 5%.
- The driver chooses its marks, removals, multi-move targets and probe items by
  displayed position, so those choices diverge across pickers after the first
  difference. A picker comparison on scenarios with those extras compares
  different edits, not only different questions.
- A seed whose current gate is 0 is skipped by the compare tool (unless the
  candidate's is 0 too), which matters for the ranked scenarios.
- The compare tool counts censored seeds as one total over the deciding set, so
  a candidate can trade one group's censored seeds for another's. Calibration
  reviewers must read the censored column per group.
- `typical-unordered-lazy30-n400` reaches the gate at about 1.03n answers, well
  inside docs/ARCHITECTURE.md 11's 3n.
- Pairs-only needs about 3.4n to 3.6n answers (3.42n at n = 100, 3.57n at
  n = 400) against about 0.67n to 0.70n for groups only; the sloppy user is the
  slowest pairs-only case (5.03n, and within5 0.98 at the end).
- **Open question: is five-card-then-pairs the best design?** Groups only reaches
  the gate in about a fifth of the answers pairs only needs, and Auto at the
  calibrated G equals groups only at the gate (it has not switched yet). The
  harness counts answers, not effort, and cannot show whether pairs help at the
  fine end, so this calibration cannot settle it. It is recorded as an open
  design question in `docs/ARCHITECTURE.md` (section 12) to explore later.

## Values and reasons

One heading per calibration, in the order they were run, each with the
candidates, the value chosen and the reason (all decided 2026-10-19). The
calibrated figures as a whole are under "The calibrated run".

### Group weight

_History: `GROUP_REORDERED_WEIGHT` no longer exists; it was removed with the group question on 2026-10-20._

Calibrated 2026-10-19. `GROUP_REORDERED_WEIGHT` is **0.5** (and
`GROUP_UNCHANGED_WEIGHT` = 0). This is an owner decision made on 2026-10-19
after the deciding rule's "no gain" result: no candidate beat weight 1 by the 2%
the rule asks, so the rule alone would have kept 1. The owner chose 0.5 because
the local corrector is overconfident at 1 (see "Overconfidence check" below).

Sweep: values 0.25, 0.5, 0.75, 1 (current, the reference) and 1.25; filter
`cal-groups` (the groups-only scenarios of the four base models, unordered and
rough, plus the guards `corrector`, `lazy10` and `lazy30`); 6 seeds; `--size full`.
Run times are in the sweep logs, not recorded here. Files:
`engine-calibration-runs/GROUP_REORDERED_WEIGHT-<value>.json` and
[compare-GROUP_REORDERED_WEIGHT-0.25.md](engine-calibration-runs/compare-GROUP_REORDERED_WEIGHT-0.25.md).

Mean answers to the gate, as a multiple of n, per base model (the mean of its
unordered and rough scenarios at n = 100):

| Weight      | typical | careful | fuzzy | sloppy | Mean change vs 1 | Verdict                                                    |
| ----------- | ------: | ------: | ----: | -----: | ---------------: | ---------------------------------------------------------- |
| 0.25        |   0.63n |   0.64n | 0.86n |  0.68n |           +13.9% | rejected: over 10% slower on 3 models and both lazy guards |
| 0.5         |   0.62n |   0.58n | 0.80n |  0.63n |            +6.5% | no gain                                                    |
| 0.75        |   0.63n |   0.53n | 0.80n |  0.62n |            +3.9% | no gain                                                    |
| 1 (current) |   0.58n |   0.55n | 0.75n |  0.61n |                - | kept                                                       |
| 1.25        |   0.57n |   0.55n | 0.80n |  0.58n |            +0.2% | no gain                                                    |

Rule result: 1 stays. On average every lower weight is slower (0.75 is about 1%
faster on careful only), and 1.25 is level with 1 (typical and sloppy are
faster, fuzzy is slower, and the mean is +0.2%), far short of the 2% gain. No
run was censored for any base model, at any weight.
The 0.25 candidate is slower than 10% on careful, fuzzy and sloppy and on the
lazy10 and lazy30 guards.

Overconfidence check (`typical-unordered-corrector-n100`). Only 0.25 and 0.5 reach the gate in this scenario within 8n, and then on
5 and 4 of the 6 seeds; 0.75, 1 and 1.25 fail on all 6 seeds. The final
`within5` rises clearly as the weight falls:

| Weight      | within5 at the last sample | Seeds censored (of 6) | within1 at 8n |
| ----------- | -------------------------: | --------------------: | ------------: |
| 0.25        |                       0.97 |                     1 |          0.56 |
| 0.5         |                       0.90 |                     2 |          0.42 |
| 0.75        |                       0.72 |                     6 |          0.28 |
| 1 (current) |                       0.55 |                     6 |          0.19 |
| 1.25        |                       0.44 |                     6 |          0.17 |

Finding: a lower group weight does limit the overconfidence in the corrector
scenario, but it costs the base models time. The deciding rule scores speed on
the four base models only. The corrector is a guard: it can reject a candidate
but never help one win. So a lower weight can never win because it limits
overconfidence, and the remedy docs/ARCHITECTURE.md 11 names ("if a full Plackett-Luce term at
weight 1 is overconfident for the local corrector, calibrate a lower group
weight") is not reachable by this rule. Side by side:

- At 0.5 the base models are 6.5% slower on average (worst base model careful,
  +8.3%; worst guard lazy10, +7.4%), and the corrector ends at within5 0.90 with
  4 of 6 seeds reaching the gate, against 0.55 and 0 of 6 at weight 1.
- At 0.25 the corrector does better still (within5 0.97, 5 of 6 seeds reach the
  gate), but the candidate is rejected: careful +18.7%, fuzzy +15.4%, sloppy
  +12.1%, lazy10 +12.6% and lazy30 +19.2%.

Decided by the owner (2026-10-19): the final value is **0.5**. The rule could
not pick it, since it scores speed on the four base models only, so the owner
weighed the corrector's overconfidence against the slower base case and chose
the lower weight, as docs/ARCHITECTURE.md 11 allows.

What 0.5 costs: in this sweep the base models are 6.5% slower on average than at
weight 1 (worst base model careful, +8.3%; worst guard lazy10, +7.4%).

What it buys: the corrector ends at within5 0.90 with 4 of 6 seeds reaching the
gate, against 0.55 and 0 of 6 at weight 1. Weight 0.25 would buy more (within5
0.97) but is rejected as too slow.

`engine-calibration-runs/baseline.json` is the reference with weight 1, taken
before this decision. Later sweeps and the final calibrated run use 0.5. The
Auto `G` sweep (`AUTO_GROUPS_PER_ITEM`) and any group-mode comparison must run
after this change, so they see weight 0.5 (they will). No second weight was
added.

### Draw weight

_Measured under the grouped engine (Auto); the value 0.25 is kept and the pairs-only runs use it._

Calibrated 2026-10-19. `DRAW_WEIGHT_EACH_WAY` stays at **0.25** (a draw counts
as a 0.25-weight win each way, 0.5 in total): no candidate beat it by the 2% the
rule asks.

Sweep: values 0, 0.1, 0.25 (current, the reference), 0.4 and 0.5; filter
`cal-pairs` (the pairs-only scenarios of the four base models, unordered and
rough, at n = 100; draws are only given when pairs are asked, and this set has no
guard scenarios); 6 seeds; `--size full`. Each run took under a minute. Files:
`engine-calibration-runs/DRAW_WEIGHT_EACH_WAY-<value>.json` and
[compare-DRAW_WEIGHT_EACH_WAY-0.md](engine-calibration-runs/compare-DRAW_WEIGHT_EACH_WAY-0.md)
(the compare file is named for the first candidate, 0; its reference is 0.25).

Mean answers to the gate, as a multiple of n, per base model (the mean of its
unordered and rough scenarios at n = 100):

| Each-way weight | typical | careful | fuzzy | sloppy | Mean change vs 0.25 | Verdict                                    |
| --------------- | ------: | ------: | ----: | -----: | ------------------: | ------------------------------------------ |
| 0               |   3.56n |   3.34n | 4.83n |  5.25n |              +20.1% | rejected: over 10% slower on 3 base models |
| 0.1             |   3.15n |   3.24n | 3.78n |  4.40n |               +4.0% | no gain                                    |
| 0.25 (current)  |   3.05n |   3.20n | 3.70n |  4.11n |                   - | kept                                       |
| 0.4             |   3.02n |   3.18n | 3.57n |  3.98n |               -1.6% | no gain: faster, but short of the 2% asked |
| 0.5             |   3.08n |   3.15n | 3.72n |  4.08n |               +0.8% | no gain                                    |

Decision: 0.25 stays. The mean change is the mean over paired seeds of the
per-seed relative change, averaged over the four base models, so it is not the
ratio of the table's multiples. Weight 0 (a draw carries no evidence) is clearly
worse: typical +16.3%, fuzzy +30.3% and sloppy +29.4% slower, careful +4.4%.
Weight 0.1 is slower on every base model (typical +3.3%, careful +1.2%, fuzzy
+2.1%, sloppy +9.6%). The two higher weights are level with 0.25: 0.4 is the
best by the mean at 1.6% faster (fuzzy -3.6%, the others about -1%), under the
2% the rule requires, and 0.5 is 0.8% slower on average (careful -1.2%, fuzzy
+0.6%, typical +1.1%, sloppy +2.8%). No run was censored for any base model, at
any weight, so censoring does not favour or hurt any candidate. The
`within5` at the last sample is between 0.96 and 1.00 in every scenario at every
weight, so the answers to the gate are what separates them.

What the rule cannot say: the curve is flat from 0.25 to 0.5, and 0.4 has the
best point estimate. The rule keeps 0.25 because the gain is under its
threshold, not because 0.25 was shown to be better than 0.4. With 6 seeds the
differences among 0.25, 0.4 and 0.5 are too small to resolve.

Share of answers that are draws, for `typical`: in
`typical-unordered-pairs-n100` at seed 1 (current weight), 165 of the 800 pair
answers (8n, the whole budget) are draws, 20.6%. This is a one-off count with the
driver's `observe` on that one scenario and seed, not a baseline measurement.
About one answer in five being a draw is why the weight matters: the gap between
0 and 0.25 is large, while the gaps among 0.25, 0.4 and 0.5 are small.

### Later answers

Calibrated 2026-10-27. `RECENCY_FACTOR` is **0.6**: each clear answer counts
0.6^k of its weight, where k is the number of later clear answers between the
same two items that picked the other one (docs/ARCHITECTURE.md 6.1). Answers
that agree never discount each other, and draws neither discount nor are
discounted. A factor of 1 is off, the behaviour before this change.

Why: on the owner's six-item summer trips list (47 answers), Lisbon and Amalfi
Coast were answered six times, Lisbon in answer 9, Amalfi Coast in 13 and 15,
then Lisbon in 43, 45 and 47. Counted equally that is 4 to 2 and a 34% chance of
the pair being the wrong way round ("could go either way"). At 0.6 it counts
3.36 to 0.43 and the chance is 7.8%, under the 10% the top level needs before it
mentions a pair, with the order unchanged (Banff, Cape Breton Island, Dubrovnik,
Reykjavík, Lisbon, Amalfi Coast). `tests/unit/ranking/bt/laterAnswers.test.ts`
holds that session.

Scenarios: `typical-unordered-drift-n6`, `-n12` and `-n100` (tag `cal-recency`;
see docs/ARCHITECTURE.md 11), where 20% of the items, and at least two, take one
another's values after 4n answers (3n at 100 items). Their gate is the answers
after the change until the order is exactly right (under 26 items) or 90% of
items are within 5% of their new place (100 items); a run that never gets there
counts its answers from the change too (the trace's `gateFrom`). Compared with
`SIM_GROUPS=recency`: each drift scenario decides as its own group, every other
scenario is a guard.

Sweep: values 1 (current, the reference), 0.8, 0.7, 0.6, 0.5, 0.3 and 0; 6
seeds; `--size full`; filter `cal-[rp][ea]`, which selects `cal-recency` and
`cal-pairs` without a `|` (cmd.exe breaks on it) and also catches the
`typical-ranked-*` scenarios (the `cal-ra` in "typical-ranked"), which are
guards. Each run took about 3 minutes. Files:
`engine-calibration-runs/RECENCY_FACTOR-<value>.json` and
[compare-RECENCY_FACTOR-0.8.md](engine-calibration-runs/compare-RECENCY_FACTOR-0.8.md).

The 6-seed short-list gates were too noisy to read: 12 items went +15.1%,
+7.0%, -0.7% and +13.3% at 0.8, 0.6, 0.3 and 0, and the rule rejected 0.8, 0.7
and 0 on that one scenario. The two short scenarios were run again with 40 seeds
(`RECENCY_FACTOR-<value>-short40.json`,
[compare-RECENCY_FACTOR-0.8-short40.md](engine-calibration-runs/compare-RECENCY_FACTOR-0.8-short40.md)).
Mean answers after the change to the exact order, change against 1:

| Factor      | 6 items | 12 items |   Mean | Verdict                                        |
| ----------- | ------: | -------: | -----: | ---------------------------------------------- |
| 1 (current) |       - |        - |      - | off                                            |
| 0.8         |  -10.2% |    -8.1% |  -9.2% | eligible; rejected on 6 seeds                  |
| 0.7         |  -15.3% |   -11.4% | -13.3% | eligible; rejected on 6 seeds                  |
| 0.6         |  -19.0% |   -13.9% | -16.4% | **chosen**                                     |
| 0.5         |  -24.4% |   -21.9% | -23.2% | eligible; a "much better" stray flips a pair   |
| 0.3         |  -32.0% |   -21.9% | -27.0% | best by the rule; one plain stray flips a pair |
| 0           |  -28.1% |    -0.4% | -14.2% | eligible, 2 seeds censored against 3           |

Guards: every `cal-pairs` scenario and the 100-item drift scenario reached the
gate in exactly the same number of answers at every factor (+0.0%). At 100 items
the picker rarely asks a pair twice before the gate, so the rule has nothing to
act on there; it matters on short lists, where every pair comes round again.

Decision: 0.6, not the rule's 0.3. The spec
(docs/superpowers/specs/2026-10-27-later-answers-count-more-design.md) asks
that one stray answer never overturn a settled pair: after three plain answers
one way, a single answer the other way must not tip it. A plain stray needs a
factor above 1/3 (three count 3f against 1); a "much better" stray, which counts
1.75, needs one above 1.75/3, about 0.58. At 0.5 the three count 1.5 against
1.75 and one "much better" misclick would flip the pair; at 0.6 they count 1.8.
0.6 is the fastest factor above that line that the rule finds eligible on both
the 6-seed and the 40-seed runs. It gives up about 7 points against 0.5. After
only two answers one way, one "much better" answer the other way still tips the
pair (1.2 against 1.75), as it would by a plain count at any factor under 0.875;
the spec's line is three. `evidence.test.ts` pins the three-against-one case at
the shipped factor.

Checks at 0.6:

- Users whose mind never changes, on 6 and 12 items, 40 seeds, every user
  model (a one-off run with no drift, not kept): answers to the exact order are
  the same as at 1 (fuzzy at 12 items 27.8 against 27.3, sloppy 33.5 against
  34.1) and the share of pairs the right way round at the end differs by at most
  0.001.
- The short-list levels (lists of 5 to 25 items, every user model, unordered and
  rough, 8 seeds, every answer once every item had been compared; a one-off
  run): the true share within a place at each level is unchanged. "Close" holds a
  mean of 96.5% with 11.0% below 90% (10.8% at 1); the top level 99.4% with 2.1%
  below 90% (2.3% at 1). `tests/unit/sim/progressGate.test.ts` passes.
- `npm run bench:engine`, measured at 0.5 (the code path is the same at any
  factor under 1): a warm answer went from 8.7 ms to 9.9 ms on the benchmark
  list, inside the 100 ms budget (docs/ARCHITECTURE.md 6.11).

What the rule cannot say: the drift scenarios are one kind of change of mind, a
handful of items swapping places at once. A gradual change, or one confined to
the top of the list, was not simulated. And the 100-item scenario shows the
rule does nothing measurable on long lists, so its benefit there is unproven
either way.

### "Much better" weight

_Measured under the grouped engine (Auto); the value 1.75 is kept._

Calibrated 2026-10-19. `STRONG_WEIGHT` stays at **1.75** (a "much better" answer
counts as 1.75 plain pair answers): no candidate beat it by the 2% the rule asks.

Sweep: values 1, 1.25, 1.5, 1.75 (current, the reference), 2 and 2.5; filter
`cal-strong` (exactly three scenarios, all `typical`, unordered start, pairs only,
n = 100: the "Much better" habits `often`, `rarely` and `inconsistent`);
**12 seeds** (the other sweeps used 6); `--size full`; compared with
`SIM_GROUPS=scenario`, so each habit is its own group (the mean is over the three
habits, and the 10% rejection applies to each habit). Why 12 seeds: strong answers
are only a few percent of the pair answers (counts below), so the signal is thin
and more seeds are the cheap remedy. Each run took 45 to 47 seconds. Files:
`engine-calibration-runs/STRONG_WEIGHT-<value>.json` and
[compare-STRONG_WEIGHT-1.md](engine-calibration-runs/compare-STRONG_WEIGHT-1.md)
(named for the first candidate, 1; its reference is 1.75). Only this set was
compared: the base-model scenarios are not in it, so they cannot dilute it.

Mean answers to the gate, as a multiple of n, per habit (12 seeds):

| Weight         | often | rarely | inconsistent | Mean change vs 1.75 | Verdict |
| -------------- | ----: | -----: | -----------: | ------------------: | ------- |
| 1              | 3.43n |  3.43n |        3.43n |               +4.5% | no gain |
| 1.25           | 3.30n |  3.28n |        3.32n |               +0.5% | no gain |
| 1.5            | 3.31n |  3.35n |        3.36n |               +1.8% | no gain |
| 1.75 (current) | 3.25n |  3.24n |        3.39n |                   - | kept    |
| 2              | 3.35n |  3.39n |        3.33n |               +2.2% | no gain |
| 2.5            | 3.32n |  3.31n |        3.30n |               +0.8% | no gain |

Decision: 1.75 stays. The mean change is the mean over paired seeds of the
per-seed relative change, averaged over the three habits, so it is not the ratio
of the table's multiples. No candidate is faster on average: every mean change is
positive (slower), and no candidate was close to the 2% gain. No run was
censored, for any habit at any weight (0 of 12 seeds on both sides, in every
group), so censoring does not favour or hurt any candidate; `within5` at the last
sample is 1.00 in every scenario at every weight. No candidate came near the 10%
rejection (the worst single group is weight 1 on often, +6.0%).

Changes by habit against 1.75 (the paired-seed mean, with its standard error over
the 12 seeds):

| Weight | often          | rarely         | inconsistent   |
| ------ | -------------- | -------------- | -------------- |
| 1      | +6.0% (se 2.6) | +5.9% (se 1.9) | +1.4% (se 2.1) |
| 1.25   | +2.0% (se 2.1) | +1.3% (se 1.7) | -1.7% (se 2.1) |
| 1.5    | +2.4% (se 3.1) | +3.6% (se 2.2) | -0.7% (se 1.4) |
| 2      | +3.6% (se 2.1) | +4.9% (se 1.9) | -1.7% (se 2.2) |
| 2.5    | +2.4% (se 2.0) | +2.3% (se 2.4) | -2.5% (se 2.0) |

What the data can and cannot distinguish. The standard error of each cell is
about 2 percentage points, as large as the 2% threshold, and the gate itself
varies by about 0.14n to 0.19n between seeds (the standard deviation over seeds
at 1.75). So the sweep cannot rank 1.25, 1.5, 1.75, 2 and 2.5: they all sit within
about 2 standard errors of each other, and "no gain" means "no difference shown",
not "1.75 shown best". It also cannot tell the habits apart by weight: at
weights 1.25 to 2.5 the inconsistent habit is slightly faster than at 1.75 (-0.7%
to -2.5%) and the other two slower (+1.3% to +4.9%), but the inconsistent cells
are within 1.3 standard errors of zero and the pattern may be seed noise. The most
that can be said is that weight 1 (a "much better" answer counts no more than a
plain one) is slower than 1.75 on average, by 4.5%, mostly on often and rarely
(+6.0% and +5.9%, about 2.3 and 3.1 standard errors); with three habits and 12
seeds that is suggestive, not firm. A noise check is in the table itself: at
weight 1 the engine treats the three habits identically, and they show the same
gate (3.43n), while at 1.75 they differ by up to 0.15n (3.24n to 3.39n), which is
seed-to-seed trajectory noise, not a habit effect.

Share of pair answers that are strong, measured once with the driver's `observe`
(`left_strong` or `right_strong` outcomes among the pair answers, at the current
weight, seeds 1 to 3, the whole budget of 800 answers per run). This is a one-off
count on these scenarios and seeds, not a baseline measurement, and it replaces
the n = 60 figure in the baseline notes with one at n = 100:

| Habit        | Strong answers (seeds 1, 2, 3) | Share of 2400 pair answers |
| ------------ | -----------------------------: | -------------------------: |
| often        |               64, 55, 58 (177) |                       7.4% |
| rarely       |                10, 10, 13 (33) |                       1.4% |
| inconsistent |                31, 25, 29 (85) |                       3.5% |

Only about 1 answer in 14 (often), 1 in 29 (inconsistent) or 1 in 73 (rarely) is
strong, so a change to the weight touches few answers. That is consistent with
the flat result above: even a weight of 1, which removes the extra weight
altogether, costs only a few percent.

### Placement width

_Measured under the grouped engine (Auto). The pairs-only re-check is at the end of this file, and the width stays 0.1 (owner's decision of 2026-10-20)._

Calibrated 2026-10-19. `PLACEMENT_SD_FRACTION` is **0.1** (it was 0.0125).
This is an owner decision made on 2026-10-19: the calibration's rule picked
0.4, and the owner chose 0.1 over 0.4, 0.2 and the original design's 0.0125 (reasons
below). A moved item's prior sd is 0.1 of the shown items, bounded to 1 to 25
places by `PLACEMENT_SD_MIN_PLACES` and `PLACEMENT_SD_MAX_PLACES`, and then
turned into strength and capped at 25 strength units
(`PLACEMENT_SD_MAX_STRENGTH`, the same as the unordered seed prior's sd).

Spec 6.6 (the prior width step and step 11) now says 10%, with the clamp.

The width's meaning depends on the list size, because it is a fraction of the
visible items clamped to 1 to 25 places: at 0.1, a list under 10 items gets the
1-place floor, n = 100 gets 10 places, and from n = 250 every list gets the
25-place cap (at n = 400 that is 6.25% of the list, not 10%). Every scenario in
this calibration is at n = 100.

This calibration has its own rule, from docs/ARCHITECTURE.md 6.8 step 11 ("an item moved near
its true place stays within 5% of it after a further 2n answers, and one moved
far from it can still be brought back by consistent answers"), not the gate-time
rule of the other calibrations:

- For each value, `nearShare` and `farShare` are the shares of `near` and `far`
  probes whose `displacementAfter2n` is at most 0.05, over the probes with a
  measured value. The value with the highest `nearShare + farShare` wins.
- Among the values within 0.02 of that best sum, the one with the fewest answers
  to the gate in `typical-unordered-multi-move-n100` (paired by seed, as the
  compare tool does) is chosen; if they are still tied (a difference under 2% of
  the mean), the current value stays.
- A value that makes any other scenario of the set (`wrong-moves`,
  `wrong-moves-corrected`, `multi-move`) more than 10% slower to the gate than
  the current value is rejected.
- If the winner is the largest or smallest value swept, the grid is extended one
  step in that direction and the rule applied again (a procedure rule added
  during this calibration).

Sweep: filter `cal-placement` (five scenarios, all `typical`, unordered start,
Auto, n = 100: `probe-near`, `probe-far`, `wrong-moves`, `wrong-moves-corrected`
and `multi-move`); **12 seeds**, because each probe scenario makes only six
probes per run; `--size full`; compared with `SIM_GROUPS=scenario`, since none
of these is a base-model scenario. Group weight 0.5 (the owner's decision above)
is in every run. It ran in three rounds: 0.005, 0.0125 (current, the reference),
0.025 and 0.05 first (0.05 won at the edge); then 0.1 and 0.2 (0.2 won at the
edge); then 0.4. Each run took 1 minute 1 second to 1 minute 18 seconds. Files:
`engine-calibration-runs/PLACEMENT_SD_FRACTION-<value>-grouped.json` and
[compare-PLACEMENT_SD_FRACTION-0.005.md](engine-calibration-runs/compare-PLACEMENT_SD_FRACTION-0.005.md)
(named for the first candidate, 0.005; its reference is 0.0125, and it holds all
six candidates). The result files were renamed on 2026-10-20, with `-grouped`
added, to make room for the pairs-only re-check (see "Placement re-check under
pairs only"); the `label` inside each file and the labels in the compare file
are the old names. To compare them again, use the new names, for example
`SIM_CURRENT=PLACEMENT_SD_FRACTION-0.0125-grouped`. The compare file's "Decision" line is the gate-time rule ("no
gain" for every candidate, since no gate moved by 2%); it is not this
calibration's rule, which is applied below from the probe shares the same file
lists.

Every probe was measured (72 near and 72 far at each value, none `null`), and
`probesSkipped` is 0 in every trace of every file (total 0 at each value). No
seed was censored in any scenario at any value: every run reached the gate.

The rule's inputs, with the effective prior sd at n = 100. The places are
clamp(fraction x 100, 1, 25), from `placementPrior` in
`lib/ranking/bt/priors.ts`. The sd in strength units is min(places x local
scale, 25), where the local scale is the median adjacent strength gap within a
few places of the drop (at least the whole-list median gap, and at least 0.05),
so it depends on the state. It was measured once, at every placement of seeds 1
to 12 in all five scenarios (1104 placements per value), by reading the placed
item's uncertainty right after its placement event (its prior variance, since it
has no counted evidence yet); the local scale there is about 0.57 strength per
place (median; about 0.46 to 0.9 from the 10th to the 90th percentile), and the
list's strength span is about 66.

| Fraction        | Places at n = 100      | sd in strength, median (10th to 90th percentile) | Placements at the 25-strength cap | near kept     | far kept      |   Sum |
| --------------- | ---------------------- | -----------------------------------------------: | --------------------------------: | ------------- | ------------- | ----: |
| 0.005           | 1 (0.5, raised to 1)   |                              0.57 (0.46 to 0.91) |                         0 of 1104 | 71/72 (0.986) | 6/72 (0.083)  | 1.069 |
| 0.0125 (former) | 1.25                   |                              0.71 (0.58 to 1.14) |                         0 of 1104 | 71/72 (0.986) | 5/72 (0.069)  | 1.056 |
| 0.025           | 2.5                    |                              1.44 (1.14 to 2.27) |                         0 of 1104 | 72/72 (1.000) | 6/72 (0.083)  | 1.083 |
| 0.05            | 5                      |                              2.83 (2.27 to 4.64) |                         0 of 1104 | 72/72 (1.000) | 8/72 (0.111)  | 1.111 |
| 0.1 (chosen)    | 10                     |                              5.65 (4.38 to 8.88) |                         0 of 1104 | 72/72 (1.000) | 56/72 (0.778) | 1.778 |
| 0.2             | 20                     |                               11.9 (9.3 to 19.6) |                 44 of 1104 (4.0%) | 72/72 (1.000) | 70/72 (0.972) | 1.972 |
| 0.4             | 25 (40, clamped to 25) |                              15.0 (11.6 to 23.2) |                 91 of 1104 (8.2%) | 72/72 (1.000) | 72/72 (1.000) | 2.000 |

No two values are identical because of a clamp at n = 100: 0.005 is the 1-place
floor rather than 0.5 places, and 0.4 is the 25-place cap rather than 40, but
each still differs from its neighbours. Any fraction of 0.25 or more would give
the same results as 0.4 at n = 100, so the grid cannot usefully go past 0.4
there.

Findings next to the rule, at every value (means over the 12 seeds; gate
changes are the paired mean against 0.0125, with the standard error over seeds):

| Fraction        | far mean displacement after 2n | wrong-moves within5 at the last sample | multi-move within1 at 8n | multi-move gate | wrong-moves gate change | wrong-moves-corrected gate change |
| --------------- | -----------------------------: | -------------------------------------: | -----------------------: | --------------: | ----------------------: | --------------------------------: |
| 0.005           |                           0.26 |                                 0.8375 |                    0.901 |           0.68n |                    0.0% |                              0.0% |
| 0.0125 (former) |                           0.27 |                                 0.8408 |                    0.885 |           0.68n |                       - |                                 - |
| 0.025           |                           0.24 |                                 0.8300 |                    0.892 |           0.68n |          +0.7% (se 1.3) |                    +0.6% (se 0.6) |
| 0.05            |                           0.21 |                                 0.8958 |                    0.878 |           0.68n |          -0.5% (se 1.0) |                    +1.2% (se 1.2) |
| 0.1 (chosen)    |                           0.04 |                                 0.9950 |                    0.853 |           0.68n |          -1.2% (se 2.6) |                    +2.0% (se 1.4) |
| 0.2             |                           0.01 |                                 1.0000 |                    0.849 |           0.68n |          -0.4% (se 1.8) |                    +4.3% (se 2.3) |
| 0.4             |                           0.01 |                                 1.0000 |                    0.853 |           0.68n |          +0.3% (se 1.9) |                    +6.8% (se 2.6) |

Rule result: 0.4. Over the first round 0.05 won (sum 1.111, against 1.083 at
0.025), at the edge of the grid. Over the six values of the second round 0.2 won
(1.972, against 1.778 at 0.1), again at the edge. With 0.4 added it wins with the
highest possible sum, 2.000, and 0.2 is 0.028 behind, outside the 0.02 band, so
the time step was never reached. No value is rejected: the largest slowdown is
`wrong-moves-corrected` at 0.4, +6.8%, inside the 10% limit.

Decided by the owner (2026-10-19): the final value is **0.1**. Why not the
rule's 0.4, or 0.2:

- Both fail the docs/ARCHITECTURE.md 6.5 test that a checkpoint's strengths equal a fresh replay
  ("checkpoints hold fitted strengths", `tests/unit/ranking/bt/engine.test.ts`):
  at 0.4 both the cold-built and the warm-built cases fail, and at 0.2 the
  warm-built one does, with differences of 1.3e-9 (0.2) and 2.2e-9 and 5.4e-10
  (0.4) against the 5e-10 the test allows (the solver tolerance is 1e-10). Passing would need a looser
  tolerance or a solver change. At 0.1 the test passes.
- They make a drag a weak hint that a few answers override: at 0.2 a placed item's
  sd is about 12 strength units (median), and up to the unordered prior's 25.
- 0.4 is the 25-place clamp at n = 100, so it does not test a fraction at all
  there; any fraction of 0.25 or more is identical.
- At 0.4, three small-list priors tests also fail (the 1-place floor and the
  evidence-free scale tests, because small lists no longer get the 1-place floor:
  a drop into 3 shown items gives 1.6 places and into 4 gives 2; and the
  median-gap test, because its sd reaches the 25-strength cap).

What 0.1 buys, against 0.0125 (paired by seed and probe):

- Far probes: 56 of 72 back within 5% after 2n answers, against 5 of 72; their
  mean displacement after 2n is 0.04 of the list against 0.27 (paired difference
  -0.232, standard error 0.018).
- Near probes: 72 of 72 kept, against 71 of 72.
- The uncorrected `wrong-moves` scenario no longer decays: within5 at the last
  sample is 0.995 against 0.841 (paired difference +0.154, standard error 0.013,
  higher on all 12 seeds), and within1 at 8n is 0.83 against 0.35.
- `probe-far` ends at within5 1.00 against 0.95.

What 0.1 costs, against 0.0125:

- `multi-move` within1 at 8n is 0.853 against 0.885 (paired difference -0.032,
  standard error 0.010, lower on 11 of 12 seeds). Its moves are correct moves (each
  item put between its true neighbours), so a wider prior trusts a correct drag
  less. Its within5 at the last sample is 1.00, against 0.99.
- `wrong-moves-corrected` reaches the gate 2.0% later (standard error 1.4),
  within noise; the slowdown grows with the width (+4.3% at 0.2, +6.8% at 0.4).
- Against 0.2 and 0.4, it leaves 16 of 72 far probes outside 5% after 2n (14 and
  16 more than those values leave).

The far half of docs/ARCHITECTURE.md 6.8 step 11 ("can still be brought back by consistent
answers") is met only partly at 0.1: 56 of 72 far probes (0.78) are back within
5% after 2n answers; the first probe of each run, made at answer n, is the
hardest (7 of 12, against 9 or 10 of 12 for the later ones). The near half is met
(72 of 72).

What the data can and cannot distinguish. Across the narrow values, the shares
rest on a handful of probes (5 to 8 far probes of 72, binomial standard error
about 0.03 to 0.04), so 0.005, 0.0125, 0.025 and 0.05 cannot be ranked by the rule;
0.05 is better than 0.0125 only on the continuous measures (far probes 0.066
nearer, standard error 0.019). The step to 0.1 and beyond is large and clear (56,
70 and 72 far probes of 72). The multi-move cost is about the same at 0.1, 0.2
and 0.4 (0.849 to 0.853), so the data do not show a cost that grows past 0.1 on
that measure; the corrected-wrong-moves slowdown does grow, but each cell is
within about 2.6 standard errors of zero. The gate cannot separate any values in
this set: the gate in `multi-move` and in both probe scenarios is identical at
every value, seed by seed (mean 68.3 answers, 0.68n), because their first move
comes at answer n = 100, after every seed has reached the gate (at 55 to 75
answers). Only `wrong-moves` and `wrong-moves-corrected`, whose first move comes
at answer 50, show a gate difference. The simulated user's answers are
consistent with the truth, so the probes reward a prior wide enough for answers
to overrule a drag; the data do not show how much a real user's deliberate drag
should count, which is the judgement behind choosing 0.1 over the rule's 0.4.
Finally, everything here is at n = 100; at other sizes the fraction gives other
place counts (see above), and those were not measured.

Findings at the former width (0.0125), kept for the record: the uncorrected
`wrong-moves` scenario's within5 was 0.99 at answer 100 and fell as the wrong
moves (one every 50 answers) built up, with only small rises between samples (at
most 0.005), to 0.84 at 800 answers, without recovering; the baseline's "0 of 18
far probes back within 5%" is reproduced over seeds 1 to 3 at 0.0125 (0 of 18;
18 of 18 at 0.2 and 0.4, 16 of 18 at 0.1). Near probes mostly put the item at its
true place (mean displacement 0.011 to 0.013 of the list right after the move,
at every value), so the near share tests that a correct-ish placement is kept,
not that a settled item survives a disturbance.

### Picker comparison

_Measured under the grouped engine; the adjacent-window group picker it mentions no longer exists._

Kept: the current picker (`PICKER_OFFSETS` = 1, 2, 3, 4, 5, 6, 8, 12, 16, 24, 32, 48,
64, 96, 128, 192, 256, 384, 512, 768) and `REPEAT_FACTOR` = 0.3. Decided 2026-10-19,
docs/ARCHITECTURE.md 6.7 rule. No code changed.

**Picker.** The simpler "adjacent" picker (`SIM_PICKER=adjacent`) was run against the
current one on `cal-pairs` and `cal-auto`, 12 seeds, n = 100, with the calibrated
values so far (`picker-current` and `picker-adjacent`, compared in
`compare-picker-adjacent.md`). The deciding rule rejects it: more than 10% slower on
careful (+40.0%) and typical (+23.8%), and +17.5% on the mean over the four base
models (fuzzy +6.3%, sloppy -0.2%). All of the loss is in Auto, where the picker's
reach decides how fast the groups find the gate:

| Auto scenario     |     Current |    Adjacent |  Change |
| ----------------- | ----------: | ----------: | ------: |
| careful-unordered |  65 (0.65n) | 145 (1.45n) | +129.9% |
| typical-unordered |  68 (0.68n) | 117 (1.17n) |  +72.6% |
| careful-rough     |  53 (0.53n) |  75 (0.75n) |  +37.9% |
| typical-rough     |  62 (0.62n) |  73 (0.73n) |  +21.4% |
| fuzzy-rough       | 142 (1.42n) | 160 (1.60n) |  +21.8% |

In pairs-only mode the two are level: the pairs scenarios moved between -4.3% and
+5.4%, with no pattern (the mean change is within noise), and within1 at 8n is equal or
a little higher with adjacent. So the current picker earns its keep in Auto, not in
pairs. No run was censored.

**`REPEAT_FACTOR`** at 0.1, 0.3 (current) and 0.5 on `cal-pairs`, 12 seeds
(`compare-REPEAT_FACTOR-0.1.md`): 0.1 is +0.2% and 0.5 is +0.5% against 0.3, so there
is no gain from either and 0.3 stays. The factor does not matter at this size.

### G

_History: `G` and `AUTO_GROUPS_PER_ITEM` were removed with Auto on 2026-10-20._

Chosen: `AUTO_GROUPS_PER_ITEM` = { unordered: 1, rough: 1 } (unordered kept, rough
raised from 0.5). Decided 2026-10-19, 12 seeds, n = 100, `cal-auto` with the
`cal-groups` scenarios as the groups-throughout reference. Files:
`AUTO_GROUPS_PER_ITEM-u<unordered>-r<rough>.json`, `compare-AUTO_GROUPS_PER_ITEM-u0.5-r0.5.md`
(unordered) and `compare-AUTO_GROUPS_PER_ITEM-u1-r0.25.md` (rough).

G is the number of groups Auto asks per counted item before it switches to pairs, one
value per starting order. The earlier design's rule: Auto's answers to the gate must be within
20% of asking groups the whole way (same model and starting order) for every base
model, and among the values that pass, the deciding rule picks.

**Unordered** (rough held at 0.5): 0.5, 0.75, 1 (current), 1.25, 1.5.

| Model   | Groups only | G 0.5 | G 0.75 | G 1 | G 1.25 | G 1.5 |
| ------- | ----------: | ----: | -----: | --: | -----: | ----: |
| careful |          65 |   116 |     65 |  65 |     65 |    65 |
| typical |          68 |   108 |     68 |  68 |     68 |    68 |
| fuzzy   |          87 |   191 |    116 |  87 |     87 |    87 |
| sloppy  |          70 |   125 |     70 |  70 |     70 |    70 |

0.5 is more than 10% slower on every model and 0.75 on fuzzy (+33%), so both fail.
1, 1.25 and 1.5 are identical to the answer: the gate is reached before 1 group per item
is used up, so a larger G changes nothing. 1 stays (no gain), and Auto equals
groups-only at it. No run was censored.

**Rough** (unordered held at 1): 0.25, 0.5 (current), 0.75, 1, 1.25.

| Model   | Groups only | G 0.25 | G 0.5 | G 0.75 | G 1 | G 1.25 |
| ------- | ----------: | -----: | ----: | -----: | --: | -----: |
| careful |          50 |    148 |    53 |     50 |  50 |     50 |
| typical |          54 |    155 |    62 |     54 |  54 |     54 |
| fuzzy   |          71 |    249 |   142 |     78 |  71 |     71 |
| sloppy  |          55 |    180 |    72 |     55 |  55 |     55 |

At the current 0.5 the 20% rule fails on fuzzy (142 against 71, +100%) and sloppy (72
against 55, +31%); 0.25 fails on every model. 0.75 passes everywhere (fuzzy +10%), and
1 and 1.25 match groups-only exactly. The deciding rule picked 1: the mean over the base
models is 9.5% faster than 0.5 (0.75 is 9.1% faster), with no model slower. 1.25 ties
1, so 1 is not an edge result and the cheaper value is kept.

within1 after the same number of answers (4n and 8n) for the rough start, 0.5 and then 1:
typical 0.84 and 0.95, then 0.92 and 0.95; fuzzy 0.55 and 0.68, then 0.61 and 0.73;
sloppy 0.82 and 0.92, then 0.84 and 0.92; careful 1.00 throughout. A larger G does not
hurt accuracy at 8n and helps a little at 4n.

## The calibrated run

_History of the grouped engine (`calibrated.json`)._

Label `calibrated`, no overrides (the chosen values are in the code), picker
`current`, every scenario, seeds 1 to 3, file
[engine-calibration-runs/calibrated.json](engine-calibration-runs/calibrated.json).
Compared with `baseline` in `compare-calibrated.md`. The values chosen, from the
sections above:

| Constant                 |     Baseline |   Calibrated | Result                               |
| ------------------------ | -----------: | -----------: | ------------------------------------ |
| `GROUP_REORDERED_WEIGHT` |            1 |          0.5 | owner decision (the rule kept 1)     |
| `DRAW_WEIGHT_EACH_WAY`   |         0.25 |         0.25 | no gain                              |
| `STRONG_WEIGHT`          |         1.75 |         1.75 | no gain                              |
| `PLACEMENT_SD_FRACTION`  |       0.0125 |          0.1 | owner decision (the rule picked 0.4) |
| picker, `REPEAT_FACTOR`  | current, 0.3 | current, 0.3 | the current picker wins              |
| `AUTO_GROUPS_PER_ITEM`   |      1 / 0.5 |        1 / 1 | rough raised                         |

The baseline was taken with Auto's `G` at rough 0.5 and the placement width at
0.0125, so the table below mixes the effects of all the changes above.

### Release gates at 400 items

| Gate                                                                     |               Limit |                   Baseline |                                                    Calibrated | Verdict                                     |
| ------------------------------------------------------------------------ | ------------------: | -------------------------: | ------------------------------------------------------------: | ------------------------------------------- |
| `typical-unordered-n400` (Auto)                                          |                1.5n |                280 (0.70n) |                                                   280 (0.70n) | met                                         |
| `typical-unordered-pairs-n400` (pairs only)                              |                  6n |               1427 (3.57n) |                                                  1427 (3.57n) | met                                         |
| `typical-unordered-lazy30-n400` (30% lazy accepters, Auto)               |                  3n |                413 (1.03n) |                                                   427 (1.07n) | met                                         |
| Placement test (docs/ARCHITECTURE.md 6.8 step 11), n = 100, seeds 1 to 3 | near and far shares | near 18 of 18, far 0 of 18 | near 18 of 18, far 16 of 18 (12 seeds: 72 of 72 and 56 of 72) | near met; far partly met (0.78 at 12 seeds) |

The placement gate is the one with a gap: a far-moved item is brought back within
5% in 78% of the 12-seed probes at width 0.1, against 100% at 0.4. The owner
accepted that for the checkpoint-precision reasons in "Placement width". The CI
test sets its floor at the recorded share less 0.1.

### Against the baseline

The mean change over the four base models is +0.6% (no model more than 10%
slower on its own scenarios). Base-model scenarios that moved by more than 10%:

- `fuzzy-rough-n100`: 128 to 75 (-33%) and `fuzzy-rough-n400`: 1000 to 360
  (-63%), from Auto's rough `G` (see "G").
- `careful-rough-n100`: 45 to 53 (+20%), `fuzzy-unordered-n100`: 82 to 93
  (+15%) and `fuzzy-unordered-n400`: 400 to 460 (+16%). Three seeds each, so the
  spread is of the same order as the change; not isolated.

Guard scenarios that moved by more than 10%: `typical-unordered-lazy10-n100`
(65 to 73, +13%) and `typical-unordered-gaps-n100` (112 to 133, +24%). Gaps is
the one to watch: it also falls at 8n (within1 0.62 to 0.57). The corrector
scenario still does not reach the gate within its budget (n = 400: 3 of 3 runs
censored, as in the baseline), though its final within5 rises (0.33 to 0.78 at
n = 400; 0.53 to 0.87 at n = 100), which is the effect of the 0.5 group weight.
Uncorrected wrong moves (`wrong-moves`) end at within5 0.99 against 0.87.

## Pairs-only baseline

Recorded 2026-10-20, once the engine was pairs only (no group question, no
Auto, no Plackett-Luce terms). Label `pairs-baseline`, no overrides, picker
`current`, every scenario of the full set (49 now), seeds 1 to 3, file
[engine-calibration-runs/pairs-baseline.json](engine-calibration-runs/pairs-baseline.json).
The run took 6 minutes 38 seconds (alongside the placement sweep below). Values:
those of "The calibrated run", with the group weight and Auto's `G` gone.

Every base scenario now asks pairs only, so it plays the same game as its
`-pairs-` name. Mean answers to the gate over the three seeds, as a count and a
multiple of n:

| Model   | unordered, n = 100 | rough, n = 100 | ranked, n = 100 | unordered, n = 400 | rough, n = 400 | ranked, n = 400 |
| ------- | -----------------: | -------------: | --------------: | -----------------: | -------------: | --------------: |
| careful |        365 (3.65n) |    292 (2.92n) |               0 |       1520 (3.80n) |   1153 (2.88n) |               0 |
| typical |        342 (3.42n) |    278 (2.78n) |               0 |       1427 (3.57n) |   1153 (2.88n) |               0 |
| fuzzy   |        397 (3.97n) |    348 (3.48n) |               0 |       1873 (4.68n) |   1700 (4.25n) |               0 |
| sloppy  |        503 (5.03n) |    312 (3.12n) |               0 |       1993 (4.98n) |   1387 (3.47n) |               0 |

Per model, the mean of the unordered and rough scenarios: careful 3.28n,
typical 3.10n, fuzzy 3.73n and sloppy 4.08n at n = 100; careful 3.34n, typical
3.23n, fuzzy 4.47n and sloppy 4.22n at n = 400. No base run was censored.
`within5` at the last sample is 1.00 everywhere except sloppy unordered (0.98 at
both sizes), fuzzy unordered at n = 400 (0.98) and fuzzy and sloppy rough at
n = 400 (0.99).

The other scenarios, at n = 100 (`typical`, unordered unless named):

| Scenario                 |                 Answers to gate | within5 at the last sample |
| ------------------------ | ------------------------------: | -------------------------: |
| strong-rarely            |                     337 (3.37n) |                       1.00 |
| strong-inconsistent      |                     335 (3.35n) |                       1.00 |
| ties                     |                     275 (2.75n) |                       1.00 |
| gaps                     |                     408 (4.08n) |                       0.98 |
| ranked-loose             |           n/a (3 of 3 censored) |                       0.79 |
| ranked-reversed-sections | n/a (1 of 3 censored; 760, 740) |                       0.94 |
| wrong-moves              |                     685 (6.85n) |                       0.95 |
| wrong-moves-corrected    |                     393 (3.93n) |                       0.99 |
| multi-move               |                     413 (4.13n) |                       0.99 |
| marked                   |                     307 (3.07n) |                       1.00 |
| big-edit                 |                     342 (3.42n) |                       1.00 |
| probe-near               |                     333 (3.33n) |                       1.00 |
| probe-far                |                     478 (4.78n) |                       0.98 |

Against `calibrated.json` (the grouped engine): every scenario that was already
pairs only there (`typical-unordered-pairs-*`, the other `-pairs-` scenarios and
`cal-strong`) is identical, sample by sample and seed by seed, and so are the
ranked base scenarios (0 answers) and `loose` and `reversed-sections`. So
removing the group machinery changed nothing in the pairs game. Everything else
moved because it no longer asks groups: the base scenarios went from about 0.5n
to 1.5n under Auto to the 2.8n to 5.0n above.

### Release gates, pairs only

Spec 13.3's Auto gate (1.5n) and lazy30 gate (3n) are removed with the group
question. What stays:

| Gate                                                                  | Limit               | Pairs-only baseline                  | Verdict       |
| --------------------------------------------------------------------- | ------------------- | ------------------------------------ | ------------- |
| `typical-unordered-pairs-n400` (pairs only)                           | 6n                  | 1427 (3.57n; seeds 1400, 1400, 1480) | met           |
| Placement test (docs/ARCHITECTURE.md 6.8 step 11), n = 100, seeds 1-3 | near and far shares | near 14 of 18, far 1 of 18, after 2n | not met at 2n |

`typical-unordered-n400` is now the same game as the pairs gate (1427, 3.57n).
The placement test is measured after 8n answers at width 0.1 (the owner's
decision of 2026-10-20): see the re-check below. Its two tests are in
`tests/unit/sim/gates.test.ts`.

### Placement re-check under pairs only

Sweep:
`node scripts/sim-sweep.mjs --constant PLACEMENT_SD_FRACTION --values 0.0125,0.025,0.05,0.1,0.2,0.4 --filter cal-placement --seeds 12 --parallel 3`,
then the compare tool with 0.1 (the current value) as the reference and
`SIM_GROUPS=scenario` (each scenario its own group, as in "Placement width"):
`SIM_GROUPS=scenario SIM_CURRENT=PLACEMENT_SD_FRACTION-0.1 SIM_CANDIDATES=PLACEMENT_SD_FRACTION-0.0125,PLACEMENT_SD_FRACTION-0.025,PLACEMENT_SD_FRACTION-0.05,PLACEMENT_SD_FRACTION-0.2,PLACEMENT_SD_FRACTION-0.4 SIM_SCENARIOS=cal-placement npm run sim:compare`.
Each run took 47 to 50 seconds. Files:
`engine-calibration-runs/PLACEMENT_SD_FRACTION-<value>.json` (the grouped
engine's runs of the same labels are now `-grouped.json`) and
[compare-PLACEMENT_SD_FRACTION-0.0125.md](engine-calibration-runs/compare-PLACEMENT_SD_FRACTION-0.0125.md)
(named for the first candidate; its reference is 0.1). Seeds 1 to 3 of the 0.1
run are identical to the same seeds of `pairs-baseline`.

The probe scenarios now run until 8n answers after their last probe (see
Scenarios), so every probe is measured at every horizon: 72 near and 72 far
probes per value, all 72 measured at 2n, 4n and 8n, none skipped. Probes are
made at answers 100, 125, ..., 225.

Probes back within 5% of their true place (kept, of 72), and the mean
displacement of the 72 as a share of the list, a further 2n, 4n and 8n answers
after the move:

| Fraction  | near 2n | near 4n | near 8n | far 2n | far 4n | far 8n | near mean 2n | near mean 4n | near mean 8n | far mean 2n | far mean 4n | far mean 8n |
| --------- | ------: | ------: | ------: | -----: | -----: | -----: | -----------: | -----------: | -----------: | ----------: | ----------: | ----------: |
| 0.0125    |      42 |      37 |      55 |      5 |      7 |     14 |        0.054 |        0.060 |        0.037 |       0.280 |       0.257 |       0.215 |
| 0.025     |      37 |      34 |      59 |      4 |      4 |      9 |        0.058 |        0.063 |        0.033 |       0.326 |       0.295 |       0.233 |
| 0.05      |      39 |      44 |      68 |      1 |      7 |     19 |        0.054 |        0.055 |        0.021 |       0.336 |       0.290 |       0.170 |
| 0.1 (now) |      51 |      63 |      72 |      6 |     21 |     47 |        0.046 |        0.028 |        0.012 |       0.301 |       0.223 |       0.087 |
| 0.2       |      64 |      69 |      72 |     15 |     36 |     70 |        0.025 |        0.015 |        0.006 |       0.243 |       0.114 |       0.020 |
| 0.4       |      62 |      69 |      72 |     18 |     54 |     70 |        0.028 |        0.015 |        0.007 |       0.198 |       0.073 |       0.013 |

The grouped engine at 0.1 gave near 72 and far 56 of 72 after 2n.

Why pairs differ so much: a probe is made at answers n to 2.25n, but pairs only
reaches the gate at about 3.4n, so the list is far from settled when the item is
moved. At the moment of the move the whole list's `within5` is only about 0.40
(0.35 to 0.41 at every value), and 2n later it is about 0.90 (probe-near) and
0.79 (probe-far) at 0.1. A near probe is therefore placed among neighbours whose
own places are still wrong, and at 2n it is back within 5% less often than the
average item of the list (51 of 72, 0.71, against the list's 0.90 at 0.1). Under
Auto the groups had settled the list (the gate at about 0.7n) before the first
probe. The far probe made first, at answer n, is the hardest one here too: at
0.1 the far probes kept after 8n are 5, 8, 8, 8, 8 and 10 of 12, from the first
probe to the sixth.

Gate times against 0.1 (the paired mean change over the 12 seeds; censored seeds
in brackets when there are any; 0.1 itself has one censored `wrong-moves` seed):

| Fraction | wrong-moves | wrong-moves-corrected |  multi-move |  probe-near |   probe-far |   Mean | Verdict of the gate-time rule |
| -------- | ----------: | --------------------: | ----------: | ----------: | ----------: | -----: | ----------------------------- |
| 0.0125   |  +16.1% (5) |                 +1.6% |       +2.1% |       +7.2% |      +19.3% |  +9.3% | rejected (over 10% on 2)      |
| 0.025    |  +25.0% (9) |                 +3.5% |       +3.7% |      +10.6% |      +21.0% | +12.8% | rejected (over 10% on 3)      |
| 0.05     |  +19.3% (5) |                 +4.9% |       -2.0% |       +5.9% |      +17.0% |  +9.0% | rejected (over 10% on 2)      |
| 0.1      | 568 (5.67n) |           377 (3.77n) | 410 (4.10n) | 342 (3.42n) | 450 (4.50n) |      - | reference                     |
| 0.2      |      -15.8% |                 -3.3% |       -8.9% |       +0.7% |       -5.9% |  -6.6% | eligible                      |
| 0.4      |      -18.4% |                 -3.3% |       -7.0% |       +2.4% |       -9.3% |  -7.1% | chosen by the gate-time rule  |

Unlike under Auto, where every probe came after the gate, the probes here come
before it, so the width moves the gate in the probe scenarios too. Other figures
(means over the 12 seeds, 0.0125 to 0.4): `wrong-moves` ends at `within5` 0.82,
0.79, 0.85, 0.92, 0.995 and 0.993; `multi-move` `within1` at 8n is 0.70, 0.73,
0.76, 0.77, 0.77 and 0.81. Under the grouped engine a wider width cost
`multi-move` a little `within1` at 8n; under pairs only it gains.

Checkpoint precision ("checkpoints hold fitted strengths",
`tests/unit/ranking/bt/engine.test.ts`), with the constant edited and the test
file run: it passes at 0.0125, 0.025, 0.05 and 0.1; at 0.2 and 0.4 the
warm-built case fails (differences of 9.1e-10 and 6.6e-10 against the 5e-10 the
test allows). The cold-built case now passes at 0.4, which it did not under the
grouped engine. The priors tests and the pairs golden fixture also fail at 0.2
and 0.4, as they must (they record the value), so they say nothing about
precision.

No value was changed.

**Decision (owner, 2026-10-20).** `PLACEMENT_SD_FRACTION` stays 0.1. Under pairs
only the placement horizon is a further 8n answers, not 2n, because a probe is
made while the list is still settling. The CI floors in
`tests/unit/sim/gates.test.ts` are the 12-seed shares at width 0.1 and 8n less
0.1: near 72 of 72 (1.00) gives 0.9, far 47 of 72 (0.653) gives 0.55. The
2-seed, n = 100 shares in CI are near 1.00 and far 0.667. With the constant
set to 0.0125 the near share drops to 0.667 and the far share to 0.25, and at
0.05 the far share is 0.25, so the tests fail where the width is wrong.

## Progress levels

The progress line (docs/ARCHITECTURE.md 6.12) says how close the shown order is, in
four levels, from `expectedDisorder` in `lib/ranking/bt/progress.ts`. This
section records how the signal and the levels were chosen. The release gate is
`tests/unit/sim/progressGate.test.ts`.

### Method

`tests/sim/signals.sim.ts` plays the real engine against the four named user
models and writes one row every n/10 answers: the true accuracy (share of items
within 5% of their true place, mean displacement, Kendall), the answers per
item, whether every shown item has been in an answered pair, and each candidate
signal. The environment chooses the sizes, seeds, starting orders, import
qualities and a "messy" history (10% of items marked "don't recognize", a wrong
move every n/2 answers corrected n/10 later, five entries moved every n
answers): `SIGNALS_OUT` (the file), `SIGNALS_SIZES`, `SIGNALS_SEEDS`,
`SIGNALS_ORDERS`, `SIGNALS_QUALITY` and `SIGNALS_MESSY`. The rows are analysed
offline and are not kept. "Ready" below means 90% of items within 5% of their
true place.

The candidates were: the answers per item (the baseline any signal has to
beat); the movement of the shown order over the last 5%, 10% and 25% of n
answers; the engine's expected disorder, from its strengths and uncertainties,
with the uncertainties as they are and multiplied by 4; the share of recent
answers that went against the order shown before them; and combinations of
these, fitted on three user models and scored on the fourth.

### What separates ready from not ready

Area under the ROC curve for telling a checkpoint at "ready" from one that is
not, with every item compared (100% is perfect, 50% a coin flip):

| Signal                          | All | Careful | Typical | Fuzzy | Sloppy |
| ------------------------------- | --: | ------: | ------: | ----: | -----: |
| Answers per item (baseline)     | 95% |     98% |     99% |   97% |    89% |
| Movement of the order (best)    | 92% |     94% |     95% |   91% |    94% |
| Engine expected disorder        | 96% |     99% |     99% |   92% |    95% |
| Answers contradicting the order | 76% |     85% |     83% |   68% |    66% |

The disorder is the best single signal and beats movement everywhere, but it is
only a point or two better than counting answers, so its value is that it is
read from the list at hand. The contradiction rate varies little between user
types (0.28 to 0.36) and added nothing in any combination. Fitted combinations
did not beat disorder with answers per item.

A single yes or no does not survive noisy users: with one threshold chosen to be
wrong at most 10% of the time overall, fuzzy and sloppy users are told "ready"
wrongly about 20% of the time, because they sit just under the 90% line. That is
why the display is levels and not a verdict.

### The levels

Disorder is not calibrated as a number (a predicted 16% within 5% averaged 55%
in fact), but bucketed it means the same thing at every size and for every user
type. The true share of items within 5% of their place, by disorder, with the
worst tenth of checkpoints in brackets (unordered and rough starts):

| Disorder      | 30 to 200 | 400 clean | 800 clean | 400 messy | 800 messy |
| ------------- | --------: | --------: | --------: | --------: | --------: |
| under 0.02    | 99% [96%] | 98% [94%] | 98% [95%] | 99% [95%] | 98% [95%] |
| 0.02 to 0.03  | 97% [90%] | 95% [88%] | 95% [87%] | 95% [88%] | 95% [87%] |
| 0.03 to 0.045 | 87% [71%] | 86% [70%] | 86% [68%] | 87% [74%] | 85% [71%] |
| 0.045 to 0.07 | 68% [48%] | 66% [49%] | 67% [49%] | 68% [51%] | 66% [50%] |
| over 0.07     | 40% [19%] | 38% [19%] | 38% [18%] | 38% [18%] | 37% [18%] |

By user type on the lists of 400 and 800 items, the 0.02 to 0.03 band averaged
99% for careful and typical users and 89% to 91% for fuzzy and sloppy ones, and
the 0.03 to 0.045 band 92% to 93% against 81% to 82%. The wording is therefore
modest. The two middle bands were merged into the single level "Taking shape"
because "Getting close" was too generous on a rough start with reversed sections
(an average of 69%), which is the case of a list sorted by a weak field.

The shipped levels and their ceilings on the disorder: level 0, "Rough order so
far.", above 0.07; level 1, "Taking shape.", 0.025 to 0.07; level 2, "Close.
Mostly fine adjustments left.", 0.02 to 0.025; level 3, "Changes from here
should be small.", under 0.02. A level falls back only once the disorder is 10%
past its ceiling. "Close" began at 0.03 until the picker changed on 2026-10-26
(see "Flip chances"): with the new picker the 0.025 to 0.03 band had 14% of
checkpoints below 85% of items near their place, and the progress gate failed.

### Where there is no level

Share of checkpoints, with every item compared, at which a level claimed more
than it should: the top level under 90% of items near their place, and "Close"
under 85%.

| Start and import                      | Top level wrong | "Close" wrong | Notes                                                                 |
| ------------------------------------- | --------------: | ------------: | --------------------------------------------------------------------- |
| Unordered or rough, honest, 30 to 800 |              0% |            4% | Shipped.                                                              |
| Rough, loose import                   |              0% |            3% | Shipped; the lower levels ran lower.                                  |
| Rough, reversed sections              |              0% |            6% | Shipped; the lower levels ran far lower.                              |
| Ranked, honest                        |              0% |            0% |                                                                       |
| Ranked, loose import                  |            100% |           98% | True accuracy about 47% to 51%.                                       |
| Ranked, reversed sections             |            100% |           88% | True accuracy about 27% to 33%.                                       |
| Under 26 items, unordered or rough    |              0% |            0% | With the per-list ceilings, too pessimistic; see "Short lists" below. |
| Under 26 items, ranked                |              7% |           47% |                                                                       |

The engine trusts a ranked start so strongly that a bad import reads as close
however the answers go, and comparing every item once does not change that, so a
list that started ranked gets no level. It gets the first stage ("Can't tell
how close you are yet") and then says it cannot tell because of the ranked
start. The words are about what the app can know and not about the list's true
state. Answers that went against the shown order separated honest ranked
imports (0 to 3% against) from loose or reversed ones (20 to 30%) on average,
but a tenth of bad imports read 0, so it was not made a level.

### Short lists

_Revised 2026-10-26: short lists now read each pair's chance from the answers;
see "Flip chances" below. The first table is the one the shipped ceilings come
from; the Gaussian figures after it are kept as history._

Lists under 26 items are measured against a window of one place, so the same
per-list disorder means a much smaller share of items out of place. In expected
places out (the disorder times the list length) the relation is about the same
at every small size and import quality. Checked on 5, 6, 8, 10, 15, 20 and 25
items, 8 seeds, every user model, unordered, rough and reversed-section starts,
at every answer once every item had been compared, with the exact chances and
the current picker, the share of items within a place of their true one:

| Places out | Mean | Share below 90% | Share below 85% |
| ---------- | ---: | --------------: | --------------: |
| under 0.1  | 100% |              0% |              0% |
| 0.1 to 0.2 |  99% |              3% |              2% |
| 0.2 to 0.3 |  98% |              8% |              4% |
| 0.3 to 0.4 |  97% |             10% |              7% |
| 0.4 to 0.5 |  93% |             20% |             16% |
| 0.5 to 0.6 |  90% |             36% |             28% |
| 0.6 to 0.8 |  86% |             50% |             42% |
| 0.8 to 1   |  77% |             69% |             62% |
| 1 to 1.4   |  65% |             88% |             81% |
| 1.4 to 2   |  56% |             96% |             93% |
| over 2     |  40% |            100% |            100% |

The shipped ceilings are 1.0, 0.4 and 0.25 places: "Rough order so far" from 1.0
up (about 53% within a place), "Taking shape" 0.4 to 1.0 (about 87%), "Close"
0.25 to 0.4 (about 97%), "Changes from here should be small" under 0.25
(99.6%). At each size on its own the top level held a mean of at least 99% with
at most 3.1% below 90%, and "Close" a mean of at least 95.6% with at most 10.9%
below 85%; a "Close" ceiling of 0.5 put 10 and 20 items at 13.7% below 85%,
over the 12% floor. The disorder is worked out with no cap for these lists.

Median answers to reach each level, unordered and rough starts, on the same
seeds:

| Items | Before: "Close" | Before: top | Now: "Close" | Now: top |
| ----: | --------------: | ----------: | -----------: | -------: |
|     5 |               6 |          22 |            5 |        6 |
|     6 |               8 |          31 |            8 |        8 |
|     8 |              14 |          40 |           13 |       14 |
|    10 |              23 |          60 |           19 |       20 |
|    15 |              44 |          87 |           38 |       43 |
|    20 |              67 |   not in 6n |           61 |       74 |
|    25 |              96 |   not in 6n |           92 |      112 |

"Before" is the Gaussian estimate with the old picker and ceilings of 1.4, 0.8
and 0.5 places. Its levels were more accurate than their words need ("Close"
98.8%, the top 100%) because the estimate doubted every item that had won or
lost each answer, and the old picker kept asking about those items.

The Gaussian figures the old ceilings came from, 8 to 25 items, 20 seeds:

| Places out | Mean | Share below 90% | Share below 85% |
| ---------- | ---: | --------------: | --------------: |
| under 0.5  | 100% |              0% |              0% |
| 0.5 to 0.7 |  99% |              2% |              1% |
| 0.7 to 0.9 |  97% |              9% |              6% |
| 0.9 to 1.1 |  89% |             35% |             26% |
| 1.1 to 1.4 |  81% |             54% |             45% |
| 1.4 to 2   |  72% |             71% |             63% |
| over 2     |  47% |             96% |             95% |

A field sort is stored as a rough start (`initialStartingOrder: 'rough'`, with
the items in the field's order), so the rough rows above stand for it.

### Checking the levels

The thresholds are not generated. To check or move them, run
`tests/sim/signals.sim.ts` with the settings above and compare with the tables.
`tests/unit/sim/progressGate.test.ts` replays 60-item lists for every user model
and fails if the top two levels stop meeting their floors (a mean of 95% and at
most 6% below 90% for the top level; a mean of 90% and at most 12% below 85% for
"Close") or if the levels stop rising with the accuracy.

### Flip chances

_Decided 2026-10-26. Code: `lib/ranking/bt/flips.ts`, the picker in
`lib/ranking/bt/picker.ts`, `disorderOfState` in `lib/ranking/bt/progress.ts`._

**The complaint.** A six-item list of trips read "Taking shape" after 24
answers, and the last nine questions all paired the top item (which had won
all ten of its answers) or the bottom one with items already settled. The only
real doubt was a loop of three in the middle (A over B, B over C, C over A, one
answer each), and no question after the loop closed went back to it.

**The cause.** The engine's uncertainty for an item is 1 / H_ii, a Gaussian
around the fitted strength. An item that always wins has a one-sided
posterior: surely above the items it beat, unsure only how far. The Gaussian
is symmetric, so it puts as much weight on the impossible side. On that list,
after the loop closed, the chance that the top item was below the second:

| Estimate                                        | Chance |
| ----------------------------------------------- | -----: |
| Gaussian from each item's uncertainty (shipped) |    23% |
| Gaussian on the gap, full covariance            |    23% |
| Gaussian matched to the posterior's mean and sd |   7.8% |
| Exact, by Metropolis sampling of the posterior  |   0.7% |
| Exact along the pair's gap, margin-weighted     |   0.5% |
| Exact along the pair's gap, equal movement      |   1.5% |

No symmetric curve fits a one-sided posterior: even a perfect moment match
(what expectation propagation and TrueSkill aim for) was ten times too high.
The old picker made it worse: it scored each item's own uncertainty, which is
widest for the always-winning item, so it kept asking about it.

**The chance.** For a pair, `flips.ts` follows the true log posterior along
the line where the upper item rises and the lower falls, in proportion to
their uncertainties, with every other item held at its fitted strength, and
integrates it on both sides of the point where the gap closes. For a Gaussian
posterior this gives the Gaussian chance. On a five-item test history it
matches a brute-force integral to three decimals; on the six-item list, at the
answer where the exact sampler read two pairs at 32% and 36%, it read 35% and
38%. The integration grid does not move with the strengths, and the step the
gap closes in is split with one more look at the curve, so the result moves
smoothly: the picker compares scores to a part in 1e9, and a grid that shifted
with the gap broke warm and fresh agreement. For the same reason the Gaussian
estimate now uses only the lower tail of the normal (the two-sided Abramowitz
and Stegun form steps by about 1e-9 at 0).

**The picker.** Score = chance the pair is the wrong way round times
`p (1 - p) / c2 * (u_A + u_B)`, the Gaussian chance for every candidate and the
exact one for the 32 best (docs/ARCHITECTURE.md 6.7). On `cal-pairs`, 12 seeds,
n = 100, against the old picker (`picker-before-flips` and `picker-flips`,
compared in `compare-picker-flips.md`): -2.5% answers to the gate over the four
base models (careful -7.4%, typical -2.7%, fuzzy +0.1%, sloppy 0.0%), within1
at 8n equal or higher in every scenario, nothing censored. A pair shown three
times is offered again only when every other pair has been too, so a loop the
user cannot call is not asked forever.

Moved items, 12 seeds at n = 100 (`probe-before-flips` and `probe-flips`): near
probes kept 72 of 72 before and after, far probes 47 of 72 before and 48 of 72
after. The CI gate had used seeds 1 and 2 (12 far probes), where the share
swings by chance (8 of 12 before, 6 of 12 after, against a floor of 0.55); it
now uses seeds 1 to 6 (23 of 36 before, 22 of 36 after).

**The levels.** Short lists use the exact chances, with the ceilings in "Short
lists" above. Lists of 26 items and more keep the Gaussian estimate: with the
exact chances, one set of ceilings was too generous at 30 items (8.7% of
top-level checkpoints below 90%) and too strict at 100 (the top level at 600
answers against 550), while the Gaussian estimate means about the same at every
size from 26 up. With the new picker its "Close" ceiling moved from 0.03 to
0.025. On 30, 60 and 100 items, 4 seeds, every user model, unordered, rough and
reversed-section starts, the share of items within 5% of their place averaged
40%, 80%, 96% and 99% at the four levels, and the median answers to the top
level were 132, 282 and 500 (before: not within 6n, 354 and 550).

On the trips list the line now reads the top level from the eleventh answer,
"Taking shape" once the loop closes (0.54 places out, the loop alone), and the
next question is one of the loop's pairs; answered, one more answer brings back
"Close" and three bring back the top level.

**Cost.** At 1,000 items and 10,000 answers (unthrottled Node, `PERF=1`), a warm
pair append went from a median of 6.5 ms to 7.3 ms, and with 80% draws from
6.5 ms to 8.1 ms; replays and snapshot opens were unchanged within noise. A
`cal-pairs` sim run took 141 s against 54 s, since at n = 100 the fit is cheap
and the evidence copy and the 32 exact chances are most of each answer.
