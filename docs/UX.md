# Pairwise List Ranker UX and Visual Design

## Experience goals

The app should feel:

- polished, modern, and calm
- fast enough that repeated comparisons become almost game-like
- trustworthy when editing structured data
- legible for both lightweight lists and dense object comparisons

This is not a spreadsheet wearing a fake mustache. It should feel like a focused decision tool.

## Product personality

Tone:

- intelligent
- low-friction
- slightly premium
- never noisy

UI language:

- concise labels
- explicit consequences on destructive actions
- clear success/failure feedback for imports and exports
- honest guidance about what is stored locally in the browser
- no em-dashes, anywhere in this project: not in interface copy, not in
  documentation, not in code comments. Where one would fall, use a spaced
  hyphen, a colon, or two sentences.

## Core layout

The app is three screens, in the order the work actually happens.

**`/` - the paste page.** One job: get their data in. It is only intake: the
text box, the samples, file drop and the `Read as` override. `Continue` goes to
setup.

**`/setup` - list setup.** Confirm what we understood, for a new list or for one
that already exists. The same screen is reached from the gear on the ranking
screen's `Your data` panel (named `List setup`). For an existing list the
starting order is shown read-only, since it is fixed when the list is created
(a sorted start reads "Sorted by plays, high to low. Set when this list was
created."); the field choices and the list switcher stay live.

The order picker ("What order is your list in?") offers four choices: **No
particular order**, **Roughly best to worst**, **Ranked best to worst** and
**Sort by a field**. The last shows a field select (only fields that qualify,
or the disabled line "No ordered fields in this list") and a direction radio
group ("High to low" / "Low to high", or "Newest first" / "Oldest first" for
dates). The list starts as roughly in order, by that field, and the card preview
shows the sorted order at once. "Set as default" does not carry a sort.

- center stage: a large text area for pasting, typing, or dropping a file, with
  a `Read as` override beneath it
- right: **What we found** - which array to rank, what its current order means,
  which field titles each card, which field receives the new order, and the one
  primary action

A pasted plain list resolves every question on its own, so the right column
collapses to a count and a button. Questions appear only when the data is
genuinely ambiguous.

**`/rank` - the comparison screen.**

- left rail: list name, what is being ranked, progress, `Start over`
- center stage: pairwise comparison workspace with two large item cards
- right rail: read-only preview with tabs for the ranked view and the formats
  the source can produce

Tablet:

- comparison workspace remains primary
- preview pane becomes collapsible but sticky

Mobile:

- stacked layout
- the paste page puts the text area above the samples
- pairwise cards full width
- preview tabs become a bottom sheet or segmented section beneath the cards

## Main screen regions

### 1. Header

Contains:

- product wordmark/title
- current list name
- local workspace status
- import/export quick actions
- reset workspace action

### 2. Header actions

The rank screen has no left rail. Lists are not named - there is nowhere to save
them to, so a name would be a label for an audience of one - and what is left is
small enough to live in the top bar beside the theme control:

- what is being ranked, beside the wordmark: `movies · shown by title`
- local storage status
- `Start over`, behind an inline confirmation

Progress sits above the cards, and the note about removed items sits with the
export it affects. Field choices live on the setup screen, where the decision is
actually made; the gear on `Your data` leads back to it.

### 3. Comparison stage

Each card owns the decisions about its own item. There is no shared row of
buttons underneath the pair: a detached bank of actions makes the reader map
"left" and "right" back onto two cards on every single comparison, which is the
one thing this screen asks them to do hundreds of times.

Each card is itself the choice: pressing anywhere on it picks that item. That
removes four buttons from a screen whose whole job is picking one of two things.

Each card contains, top to bottom:

- a quiet remove control in the corner: a trash can, drawn in the faint text
  tone until it is hovered or focused, where it turns the red of what it does.
  There is no LEFT/RIGHT marker: which side a card is on is self-evident from
  where it sits.
- the item label, from the label field for object entries
- summary chips for short scalar fields
- a play button, when a field is drawn as an Apple Music preview
- an expandable details region for the rest of the object
- a footer, aligned across both cards, holding:
  - a `Click to choose` hint, always visible: touch devices never hover, and
    the instruction is worth nothing to anyone who has to discover it
  - **Much better**, a compact pill that says in words what it does. An icon
    alone reads as decoration to anyone who has not been told what it means,
    and this button changes how far the ranking moves.

Nested controls stop the press from reaching the card, and the card is not
pressable at all while a delete confirmation is showing. A hairline divider
with a small `or` sits in the gutter between the two cards.

Details belong to the pair, not to a card: one **Show details** switch beside
the _Can't decide | Don't recognize…_ pill opens both at once, because reading one item's fields against
the other's summary is not a comparison. While details are open the summary
chips step aside, since they say the same thing in shorter form.

Removing an item swaps that card's footer for an inline confirmation, so the
question is asked on the card being removed rather than in a separate bar.

Between and below the pair:

- a compact status strip that says only what is true: "312 answers so far". The
  count is a polite live region.
- under it, a quiet progress line with a short bar, in the app's accent colour, that fills as the order
  settles (docs/ARCHITECTURE.md 6.12). Until every item has been compared at least
  once, the bar shows the share of items compared and it says "Can't tell how close you are
  yet. 38 of 120 items haven't been compared." After, it names one of four
  levels: "Rough order so far.", "Taking shape.", "Close. Mostly fine
  adjustments left." or "Changes from here should be small." No percentage and
  nothing that says the list is done or safe to stop. A list that started
  ranked gets no level, and instead says "Every item has been compared.
  Keep going to fix your order where answers disagree." The
  bar is for the eye and the words carry the meaning, so it is outside the
  live region and a screen reader meets only the words.
  The line ends with a "Why?" link. It opens "How close is this order?":
  the line again, a sentence for the level, and up to three spots still in
  doubt, each in terms of the user's own answers with their numbers ("Lisbon
  over Cape Breton Island, answer 15"), with what settles it. A circle of
  answers is drawn as a loop. The window never gives a number beyond answer
  numbers and counts, and never says the user changed their mind.
- a single split pill, **Can't decide | Don't recognize…**, centred - it
  belongs to the pair, not to either item. _Don't recognize…_ arms a choice in
  place: both cards highlight, and the pill becomes _Don't recognize either |
  Cancel_ (docs/ARCHITECTURE.md 10.4)
- a one-line keyboard hint

### 4. Persistent preview pane

Read-only. It shows the user their data, ranked; it never edits it.

Contains:

- tabs: Ranked, plus the formats the source can produce
- a grip on each ranked row for dragging it into place, with `Alt` + arrow keys
  as the keyboard equivalent
- a remove control on each ranked row, the same faint trash can as a card's,
  with the same inline confirmation: removing a row and removing a card are one
  action
- items marked "don't recognize" at the bottom, under a quiet _Didn't
  recognize_ divider, ranked on from the counted items. They can be dragged up
  into the ranking; nothing can be dropped among them
- copy button
- download button
- a monospace, selectable view of the exported document
- a note when removed items are being excluded from the export

Rows slide between positions rather than jumping, so the change after an answer
is visible.

Dragging a row never disturbs the list underneath it: the rows hold still and a
line marks the gap the row will drop into, so the target cannot slide away from
the pointer aiming at it. No line means dropping there would change nothing.
The row goes exactly where it is dropped. Its earlier answers stop counting, so
rows it had been compared with may then shift a place or two; the rows sliding
into place is what tells the user so. One action, one behaviour, whichever route it comes from.

There is no editing of the data once a list is being ranked. Items cannot be
added, and a removed item comes back only with Undo. To rank different data,
`Start over` returns to the paste page; an exported ranking is a good starting
point. The old editable buffer - a text area that may or
may not have been applied to the live list - is gone, because "is what I see
what I have?" is not a question a preview should raise.

## Interaction model

### Comparison flow

1. User sees two items.
2. User chooses left, right, much better left, much better right, can't
   decide, or marks one or both as not recognized.
3. Ranking updates instantly.
4. Preview pane updates instantly.
5. Next pair animates in with minimal delay.

Removal, from a card or a ranked row:

- remove is visually secondary and destructive-styled
- removing an item records no answer for the pair it was in; answers already
  given about it still count for the others
- confirmation is inline for desktop and sheet/modal on mobile
- the confirmation points to _Don't recognize…_ for an item the user simply
  does not know

### One action, one behaviour

An action reachable from more than one place behaves the same from each:
moving a row by drag or by keyboard; removing from a card or a row; undoing
any of them. A difference between routes is a
bug, not a feature, and the copy never has to explain one (docs/ARCHITECTURE.md 6.2).

Undo takes back the user's last action, whatever it was, as one step: an
answer, a mark, a move or a removal.
It is offered when that action changed the list on screen; if it changed
another list, the control says which. After a reload the last action can still
be undone.

The app counts two things, with two words: **answers** (pairs and draws), shown as progress, and **changes** (actions, as Undo counts them),
named when work is about to be lost.

### Changing the data

Removed 2026-10-20 (no Edit data). A list being ranked cannot be edited as text,
and items cannot be added to it. Its starting order is fixed when it is
created. The gear on `Your data` opens the setup screen, where card fields,
"set as default" and switching lists stay live. `Start over` is the way to rank
different data.

### Field roles

For object entries, on the setup screen:

- detect likely scalar fields; preselect only when the choice is safe
- ask the user to choose when several fields are equally plausible
- show a live example of the labels a field would produce
- offer, but never assume, a numeric field to write the new order into

### Drill-in details

Each comparison card includes:

- primary label from the chosen label field
- summary chips for short scalar fields, while details are closed

Details are opened for the pair, from one switch beside the pill, never
for a single card. Expanded details show:

- remaining fields in grouped key/value layout
- collapsible nested structures
- code-style blocks for large text or arrays where needed

### Local workspace behavior

Because the app is browser-only:

- imported and ranked data should feel immediate
- local persistence, if enabled, should be explained in plain English
- export should be prominent enough that users understand it is the portable/saveable artifact
- reset/clear actions should be obvious but never trigger accidentally

## Visual system

### Themes

The app ships light and dark. Dark mode is not an inverted light mode: surfaces
are deep neutral slate rather than black, the accent lightens so it stays
readable, and shadows deepen while the inset highlight almost disappears.

A three-way control in the header selects System, Light, or Dark. System is the
default. A pre-paint script applies a saved choice before the first frame, so
the page never flashes the wrong palette.

### Style direction

Use a refined editorial-meets-product aesthetic:

- soft surfaces
- crisp typography
- restrained shadows
- rounded cards
- strong spacing rhythm
- one saturated accent used intentionally

### Color palette

The interface is mostly neutral. One indigo accent, warmed slightly towards
violet in gradients, is the only saturated colour, and it is reserved for the
primary action and focus rings. There is no second saturated hue: the gold that
once marked a progress meter past 100% went with the meter, since nothing the
app measures can honestly say a list is done.

Both themes are defined as CSS custom properties in `lib/themeCss.ts`. Dark mode
follows the OS setting and can be overridden per visitor; because the palette is
resolved by the stylesheet rather than by React state, both themes render the
same markup.

#### Light

| Token                          | Value                 | Used for                                     |
| ------------------------------ | --------------------- | -------------------------------------------- |
| `--canvas`                     | `#F6F7FB`             | app ground, under a faint indigo/violet wash |
| `--surface`                    | `#FFFFFF`             | panels and cards                             |
| `--surface-muted`              | `#EEF1F8`             | chips                                        |
| `--surface-sunken`             | `#F3F5FA`             | editors, tab groups, inputs                  |
| `--border`                     | `#DEE3EC`             | hairlines                                    |
| `--border-strong`              | `#C7D0DF`             | emphasised edges                             |
| `--text-primary`               | `#131722`             | headings and item labels                     |
| `--text-secondary`             | `#58627A`             | supporting copy                              |
| `--text-faint`                 | `#838DA3`             | metadata, shortcut hints                     |
| `--accent`                     | `#4C63F5`             | primary action, focus ring                   |
| `--accent-strong`              | `#3244D4`             | accent text on light surfaces                |
| `--accent-soft`                | `#EEF1FE`             | "much better", selected states               |
| `--accent-soft-border`         | `#CBD4FD`             | edge of soft accent surfaces                 |
| `--violet`                     | `#7C5CFF`             | gradient partner, canvas wash                |
| `--success` / `--success-text` | `#0F9F6E` / `#0A7350` | positive states                              |
| `--warning` / `--warning-text` | `#D28A12` / `#8A5A0B` | coverage warnings                            |
| `--danger` / `--danger-text`   | `#D14343` / `#B02A2A` | destructive actions                          |

#### Dark

| Token                        | Value                 | Used for                       |
| ---------------------------- | --------------------- | ------------------------------ |
| `--canvas`                   | `#0D1016`             | app ground                     |
| `--surface`                  | `#161A23`             | panels and cards               |
| `--surface-muted`            | `#1E2430`             | chips                          |
| `--surface-sunken`           | `#11151D`             | editors, tab groups, inputs    |
| `--border`                   | `#262D3B`             | hairlines                      |
| `--text-primary`             | `#E9EDF6`             | headings and item labels       |
| `--text-secondary`           | `#9AA5BC`             | supporting copy                |
| `--text-faint`               | `#74809A`             | metadata, shortcut hints       |
| `--accent`                   | `#7C8CFF`             | primary action, focus ring     |
| `--accent-strong`            | `#A0ABFF`             | accent text on dark surfaces   |
| `--accent-soft`              | `#1A2036`             | "much better", selected states |
| `--violet`                   | `#9E7BFF`             | gradient partner, canvas wash  |
| `--danger` / `--danger-text` | `#EE7168` / `#FF9C94` | destructive actions            |

The `*-text` variants exist because the fill colours are tuned for backgrounds
and fall below WCAG AA as small text. Use the text variant for anything under
16px.

### Shading and gradients

Gradients are atmosphere, never decoration. Three, and no more:

1. **Canvas wash** - two large, very low-alpha radial gradients (indigo, then
   violet) anchored off the top edge. It gives the page a light source without
   reading as a coloured background.
2. **Panel and card fill** - a 180° gradient between two near-identical
   neutrals, plus a 1px inset top highlight. Barely perceptible in isolation;
   what stops large surfaces from looking flat.
3. **Primary action** - a 140° indigo gradient, `--accent` to
   `--accent-gradient-end`. Deliberately a single hue family rather than a
   two-tone sweep, so it stays calm next to its twin on the other card.

Elevation is a two-layer shadow: a tight contact shadow plus a wide, soft cast
shadow. On hover, cards lift 2px and the cast shadow picks up accent tint.

The rule above says atmosphere, never decoration. There is one knowing
exception: **Much better** comes up to temperature on hover - the body darkens
to a hot core, the rim runs bright, the label goes pale, and it throws a tight
bloom. It is confined to one control, the strongest verdict in the app, on a
screen the user visits hundreds of times, and it costs nothing until a pointer
asks for it.

This started as literal flames, gradient tongues licking off the top edge, and
it looked cheap. The lesson is worth more than the effect: **draw the light,
not the object.** Fire is high-detail imagery and the button is 110x34px, so
any flame collapses into a few blurred blobs - and an illustrated object on a
surface that is otherwise flat and precise reads as clip art no matter how well
it is drawn. Rendering what heat _does_ - colour, luminance, bloom - costs a
handful of tokens and looks expensive. Reach for illustration here and the
answer is the same next time.

### Typography

Primary type goals:

- excellent readability
- enough personality to feel polished
- strong hierarchy in cards and preview panes

Suggested pairing:

- headings/UI emphasis: Inter SemiBold or Geist Medium
- body/UI text: Inter Regular or Geist Regular
- code/export text: JetBrains Mono or IBM Plex Mono

Type scale:

- app title: 28-32px / 1.1
- section title: 20-24px / 1.2
- card title: 22-26px / 1.2
- body text: 15-16px / 1.5
- small metadata: 12-13px / 1.4
- code/editor text: 13-14px / 1.55

## Component styling

### Comparison cards

- generous padding
- strong title hierarchy
- hover lift plus accent-tinted shadow on desktop; disabled under reduced motion
- footers aligned across both cards regardless of content height
- selected-action feedback should be immediate but tasteful
- when details are expanded, card height may grow without reflow chaos

### Buttons

Hierarchy:

- primary: the comparison card itself - the largest target on the screen, so it
  needs no button inside it. It lifts on hover and dips on press.
- emphasis: **Much better**, a labelled pill in the card's bottom-right corner,
  on the soft accent surface reserved for it.
- secondary: the _Can't decide | Don't recognize…_ pill, drill-in, downloads,
  reorder grips
- tertiary/destructive: remove item, a faint glyph until it is armed
- workspace reset: the one destructive action that is not faint at rest. `Start
over` is the only way out of a list, so it wears a red outline on the plain
  surface and sits behind a hairline that separates it from the header's
  utilities. Arming it fills the outline in. It never takes the accent, so it
  cannot outrank the comparison cards it shares the screen with.

### Choices

Every setting on the setup screen is a segmented `radiogroup` of named options,
as in the theme control, the `Read as` tabs, and the field-role pickers: each
option is a pill on the sunken surface, and the selected one takes the soft
accent fill with accent text.

This holds even for settings that are internally a boolean. A switch states
its off position by omission, so an unlabelled control beside the words
"already ranked" reads as a claim about the list rather than a question about
it - and a switch whose track and thumb both sit within a few percent of the
panel's own luminance states nothing at all. Naming both sides ("No particular
order" / "Best to worst") makes the unchosen option visible and the question
unmistakable. Where a boolean genuinely has no natural name for its off state,
say so in words beside the control rather than reaching for an unlabelled one.

The compact in-place toggles on the rank screen (`Show details`) are the
exception: they carry their own verb, so they say what they will do next
rather than what state they are in.

### Preview modes

Ranked view:

- ranked list with position chips
- compact metadata rows for objects
- subtle transitions on order updates

Format tabs:

- editor-like surface, but read-only and selectable
- monospaced font
- syntax-aware coloring if feasible
- copy/download/import actions pinned near the top

### Local status surfaces

Use small, calm status elements for:

- working locally
- local persistence enabled/disabled
- last local save time if shown

Avoid fake-cloud language. No “sync” badge for a thing that never met a server.

## Motion

Motion should communicate state, not audition for a startup reel.

Use:

- 120-180ms tap/hover transitions
- 180-240ms card swap/fade after comparison
- subtle position shift when rankings change in the ranked view
- reduced-motion fallback for all animated transitions

One exception to "motion communicates state", and it is the only looping
animation in the app:

- **The much-better heat.** Hovering ignites the button in a single 260ms
  overshoot, then hands off to a ~5.2s breath while the pointer stays. The
  drama belongs in the one-shot: a flare that happens once reads as expensive,
  and the same energy spent on a loop reads as cheap. The breath that follows
  swings about a tenth of what a flicker does - if you can catch it moving, it
  is too strong.

  It wants to be slower and shallower than feels right while writing it. A
  glow on a second-long cycle reads as a blinking indicator demanding
  attention; stretched over several seconds it reads as something at
  temperature. It should not be eased, either - easing puts a swell on every
  keyframe, which is precisely the throb it is trying not to be.

Under reduced motion it holds still rather than vanishing: the button keeps a
steady bloom. The colour, not the movement, carries the meaning - so losing the
motion costs nothing.

## Accessibility

Must support:

- full keyboard navigation
- visible focus states
- screen-reader labels for both item cards and every comparison action
- contrast ratios meeting WCAG AA
- reduced motion mode
- large tap targets on touch devices

Keyboard suggestions:

- left arrow: choose left
- right arrow: choose right
- shift + left/right: much better variants
- S: can't decide
- K then L, R or B: don't recognize left, right or both; Escape cancels
- D then L or R: remove left/right with confirmation
- Enter confirms that delete, Escape keeps the item

A shortcut the user cannot see halfway through is a dead end, so the line
under the tray reports the step they are on: after D it asks for a side,
and while a delete waits it names the two keys that answer it. The
confirmation writes those keys on its own buttons as well, because the
delete is the one action reachable both by pointer and by shortcut.

Focus follows the confirmation: it opens with focus, since the control that
opened it is gone by then, and hands focus back to the trash can if the item
is kept. Enter is bound globally there, but stands aside for a focused
button, which says on its face what it does.

## Empty, error, and edge states

No data yet:

- the paste page is the empty state; there is nowhere else to arrive
- a placeholder showing one item per line, and a hint that YAML and JSON work too
- **What we found** reads `Nothing yet` rather than counting to zero, and asks
  none of its questions. A control offering to configure a list that does not
  exist is noise, so every picker withholds itself until its question is real

Import parse error:

- keep user text intact
- show the line number when the format can pinpoint one
- announce it as an alert, and never wipe what they typed

Blocked from ranking:

- one message, from describeReadiness, phrased as the next thing to do
- an empty box comes first and asks for a list; it is not an import that failed,
  and must never be reported as one
- nothing rankable found; only one item; no label field chosen
- the label picker asks for itself, so the message never says it twice
- the message is plain secondary text above the disabled action. It is the next
  step, not an alarm and not the primary action, so it takes neither the danger
  colour nor the accent - and no container: a sunken fill inside a hairline
  border is this app's word for a control, so read-only copy wearing it reads as
  a field waiting to be typed into

Local persistence unavailable:

- app should still function fully in memory
- show a small note that reload persistence is unavailable in the current browser context

Reset workspace:

- explain that current in-browser state will be cleared
- never imply exported files are affected
- outlined in danger at rest so it is findable, filled only once armed, so the
  two steps of the confirmation are told apart by weight and not by copy alone

## Export presentation rules

- the ranked view is default and non-exportable
- the offered formats follow the source: YAML and JSON always, plain text when
  the source was a plain list
- export returns the user's own document, with the ranked array reordered in
  place and every other key untouched
- download filenames are "pairwise", the date and the format extension, e.g. pairwise-2026-08-16.yaml
- copy success should be subtle and immediate
- export controls should feel primary enough that users understand how to keep their work

## Quality bar

A finished screen should feel:

- balanced at 1440px wide
- still clean at 1024px
- readable and tappable on mobile
- visually consistent across comparison, editing, persistence, and export flows

If anything starts looking like an admin panel from a tax portal, redesign it. Ruthlessly.
