# Tech Debt

Open technical work, tracked as tasks. Finished items are removed; git history
keeps them. Numbers are kept stable, since commits refer to them.

## 1. Calibrate a future-change signal for ranking progress

The current four-level progress meter is calibrated against how close the
current ranking is to a simulated true order. Users can reasonably read its
bar as a completion meter, even though it does not directly predict whether
the order will move with more answers. Investigate replacing or reframing it
with a signal about expected future movement, and avoid presenting that signal
as completion.

### Initial feasibility experiment (2026-10-22)

A temporary, uncommitted simulation used the existing careful, typical, fuzzy
and sloppy user personas on 60-item lists, with unordered, rough, and
reversed-section starts. It sampled after every 60 answers once all currently
ranked items had appeared in at least one answered pair. For each checkpoint,
it continued the same persona for another 30 or 60 answers. Deletion variants
removed 40% of the current ranking after the first 60 answers, either from the
bottom or uniformly at random. Accuracy was measured on the survivors.

"Large change" was defined for this exploration as at least 10% of the
surviving items moving by more than 5% of the list's positions over the
forecast horizon. The existing `expectedDisorder` signal distinguished large
from smaller future changes with AUC about 0.97 across the tested checkpoints
(0.5 is chance, 1 is perfect). At level 3, observed large-change rates were:

| Deletion pattern | 30 more answers | 60 more answers |
| ---------------- | --------------: | --------------: |
| None             |             0.0% |             0.0% |
| Bottom 40%       |             0.0% |             0.0% |
| Random 40%       |             0.4% |             0.8% |

At level 2, observed rates were 0.5% / 2.1% with no deletion, 1.2% / 2.4% for
bottom deletion, and 5.9% / 7.8% for random deletion. Counts per level and
condition were finite (for example, level 3 had 177 no-deletion, 144 bottom,
and 258 random-deletion checkpoints at the 30-answer horizon), so zero observed
events are not guarantees. The lower level-3 random-deletion rate than level 2
suggests the relationship between this signal and future movement may vary
with deletion pattern; it should be rechecked with more seeds and larger
samples before interpretation.

These are feasibility results, not a calibrated user promise. They cover one
list size, a small set of starting orders and deletion rules, independent
simulated answer noise, and users who continue answering as the same persona.
The 5%-of-list movement rule scales with list size and may not match what users
mean by a noticeable change. Answers beyond the forecast horizon can still
move the ranking; the sample does not include manual moves or deletions during
the forecast period.

### Next work

- Choose a user-understandable definition of noticeable change (items moved,
  number of places, order inversions, and/or top-of-list stability) and forecast
  horizon (fixed number of answers or list-size-relative).
- Expand simulation across list sizes, truth shapes/ties, starting order and
  quality, persona mixtures or changing behavior, deletion shares and patterns
  (bottom, random, top, and targeted), and edits during the forecast horizon.
- Measure calibration and uncertainty by persona, horizon, deletion pattern,
  and signal band; compare disorder with simpler baselines such as answers per
  item. Keep held-out seeds/scenarios for validation.
- Only then decide whether the current disorder can support predictive wording
  or a new signal is needed. Do not present the current four-quarter bar as
  completion or claim a numeric future-change probability before validation.
