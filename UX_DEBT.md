# UX Debt

A user-experience assessment of the app, with the work it suggests tracked as
tasks. It was made by using the built app in a browser: loading the Movies
sample, ranking by mouse and keyboard, editing data, exporting, starting over,
and switching themes, at a 1440 x 900 desktop size and a 390 x 844 phone size.
It is measured against the app's own goals in `UX.md`: calm, fast enough to feel
game-like, trustworthy with structured data.

## Verdict

On a desktop, the app is good. The core loop works: two cards, click or press
an arrow key, and the ranked list beside it reorders straight away. The data
screen is unusually helpful: it reads YAML, JSON or a plain list, previews a
real card, and explains every field choice in plain words. Undo, skip, "much
better", the progress meter with its honest "this is an estimate" framing, and
the guide in "How it works" are all thoughtful.

It falls short in three places:

1. **Phones.** Comparing is side by side in name only: each card is taller
   than the screen, so every decision means scrolling. The page also scrolls
   sideways, and the setup screen's main button is three screens down.
2. **Speed and steadiness.** The controls move between pairs, because card
   heights change with their content, and the desktop ranking screen does not
   fit a 900px-tall window. Both work against the "almost game-like" goal.
3. **The way out.** The ranked file, which is what the user came for, is only
   reachable by switching to the YAML or JSON tab. Nothing on the default view
   says how to take the result away.

## Status

| # | Task | Area | Priority | Status |
|---|------|------|----------|--------|
| 1 | Stop the page scrolling sideways on phones | Phone | High | Done |
| 2 | Make comparing work on a phone screen | Phone | High | Open |
| 3 | Keep the setup screen's main button in reach on phones | Phone | High | Open |
| 4 | Make Start over say what is lost, offer to save, and disarm itself | Trust | High | Done |
| 5 | Keep the controls still from one pair to the next | Speed | High | Open |
| 6 | Fit the ranking screen in a desktop window | Speed | Medium | Open |
| 7 | Make taking the result away obvious | Flow | High | Open |
| 8 | Do not present an order before there is one | Clarity | Medium | Open |
| 9 | Say what the app does on the first screen | Onboarding | Medium | Open |
| 10 | Show field names as people would write them | Clarity | Medium | Open |
| 11 | Say a shared-slot tip once, not under every field | Clarity | Low | Open |
| 12 | Make the keyboard shortcuts findable | Speed | Medium | Open |
| 13 | Avoid the layout jump when data first arrives | Polish | Low | Open |
| 14 | Plainer progress wording | Clarity | Low | Open |
| 15 | Smooth the theme switch | Polish | Low | Open |
| 16 | Keep rating bars inside narrow cards | Polish | Low | Open |
| 17 | Match the Start over prompt's spoken names to its labels | Accessibility | Low | Done |
| 18 | Calmer placement for Start over | Trust | Low | Open |

Suggested order: 1 and 4 first (small, and one is a bug), then 5, 7 and 2,
which matter most to how the app feels, then the rest.

## What works well

Worth keeping as the app changes:
- Samples on the first screen, so there is something to rank in one click.
- The card preview on the data screen, which shows a real card while fields
  are chosen, and the plain-language notes beside each field choice.
- Whole-card click targets, with "Much better" and delete kept secondary.
- Undo for choices, drags and removals, and Skip for pairs that cannot be
  compared fairly.
- The ranked list reordering beside the cards on every choice, with dragging
  and Alt+arrow keys for placing an item by hand.
- Honest progress: the meter calls itself an estimate and keeps counting past
  100%, and the stability line says when the order is settled enough to export.
- Edits to the data are summarised before they apply, and untouched entries
  keep their ranking.
- Dark mode, once settled, reads well throughout.

## Phones

### 1. The page scrolls sideways

At 390px wide, the header's action row (How it works, theme switch, Start
over, GitHub) is 396px wide, so the whole page pans sideways and the GitHub icon
is cut off. The header already wraps onto two lines there.

Fix: let the action row wrap or shrink, or move the less-used actions (GitHub,
theme) into a menu below a breakpoint. The end-to-end suite already has a
no-sideways-scroll test for long lists; adding the same check at phone width
would keep this fixed.

### 2. Comparing is not side by side

On a phone the two cards stack. With the sample's fields, each card is about
650px tall, so the second card starts more than a screen below the first, and
the ranked list is three screens down. Every decision means scrolling down to
read the other option and back up, which is the opposite of a quick pairwise
choice.

Fix, roughly in order of effort:
- A compact card on narrow screens: picture, title and the first two or three
  fields, with the rest behind the existing "Show details" switch.
- A bar fixed to the bottom of the screen with the two choices (and Skip), so
  a decision never needs a scroll.
- Later, a swipe gesture between the two.

### 3. The setup screen's main button is out of reach

On a phone, the editor, card preview and "What we found" panel stack, which
puts Start ranking (or Apply) around 2,400px down the page.

Fix: pin the main action to the bottom of the screen on narrow widths, with the
readiness line ("Paste, type, or drop your list...") above it.

## Trust

### 4. Start over

Pressing Start over turns the header into Cancel and Confirm, with a banner:
"This clears the list held in this browser. Files you already exported are
untouched." Three problems:
- It does not say what will be lost. With 12 comparisons made, the prompt reads
  the same as with none.
- It does not offer the obvious safety net: save a session first.
- It stays armed. Opening "How it works", pressing Escape and going back to
  ranking all left Cancel and Confirm waiting in the header.

Fix: state the cost ("Your 12 comparisons across 1 list will be lost"), add a
Save session button to the prompt, and disarm it on Escape or on any other
action.

### 18. Start over is always in view

A red-outlined Start over sits in the header on every screen, next to the theme
switch. It is protected by a confirmation, but it is the most prominent button
in the header for the action people want least.

Fix: a quieter style, or a place in a small overflow menu with session actions.

## Speed

### 5. Controls move between pairs

Card heights follow their content: a longer synopsis, more genres or a missing
field changes the height. "Much better", the trash can, Skip and Show details
all move from one pair to the next (Skip moved about 30px between the first
pairs tried). Undo also appears only after the first choice and pushes Skip
sideways. For a task that is meant to be repeated quickly, a target that moves
causes misclicks.

Fix: give both cards the same height within a pair (the taller one's), clamp
long fields, and reserve Undo's space from the start (shown disabled).

### 6. The ranking screen does not fit a desktop window

At 1440 x 900, the page scrolls: the Skip row sits at the bottom edge and the
keyboard hints are below it. The sample turns on 15 card fields, which makes
the cards long.

Fix: reduce what a card shows by default (the samples could pick five or six
fields, leaving the rest in details), and let the card area scroll inside
itself rather than the whole page.

### 12. Keyboard shortcuts are hard to find

The shortcut line ("Arrow keys choose · shift + arrow for much better · S
skips ...") is small grey monospace text below the fold, and it was not visible
until after the first choice in the test session. Keyboard use is the fastest
way through a long list.

Fix: show the arrow-key hint on the cards themselves (a small "←" and "→"), and
put the full list behind a "?" shortcut and in the guide.

## Flow

### 7. Taking the result away

The ranked file is the point of the app, and `UX.md` asks for export to be
prominent. Today Copy and Download appear only after switching the preview to
YAML or JSON; the default Ranked tab has no export at all. Beside them, Save
session and Open session look the same, so four similar buttons sit in a row
without saying which one gives you your list back.

Fix: one clear primary action, such as "Download ranked list", visible on every
tab, with the format chosen inside it. Present Save session as "keep working
later" rather than as a peer of export. When the stability line says the order
is ready, it can carry that button too.

## Clarity

### 8. An order before there is one

Before any comparison, the ranked list shows numbers 1 to 10 and a rating of
1500 for every item, which reads as a ranking that already exists. The ratings
stay on every row afterwards, where they mean little to most people.

Fix: show "Not ranked yet" (or no numbers) until the first comparison, and
show ratings only on hover or in details.

### 9. The first screen does not say what the app does

The first screen says "Add your list" and shows an empty "What we found" panel.
What the app actually does ("puts a list in order by asking you simple
one-on-one questions") is only inside "How it works".

Fix: one line under the title, and a three-step outline (add a list, pick
between pairs, take the ordered list away) in the empty right-hand panel, which
is currently blank.

### 10. Field names as written in the data

Cards and the field picker show raw keys: `rotten_tomatoes`, `box_office_usd`,
`release_date`. They are the user's own names, so they are recognisable, but
they read as code.

Fix: show a readable form ("Rotten tomatoes", "Box office (USD)") on cards,
keeping the raw key in the field picker where it identifies the field.

### 11. The same tip, three times

When several fields share the picture slot, the field picker repeats the same
three-line tip under each of them ("These share the spot beside the title...").

Fix: say it once, above the group, or only under the first field of the slot.

### 14. Progress wording

"7 neighbouring pairs still too close to call" is accurate, but "neighbouring
pairs" is the app's vocabulary, not the user's. The percentage sits in small
type at the far end of the bar.

Fix: something like "7 places in the list are still uncertain", and the
percentage beside the comparison count where the eye already is.

## Polish

### 13. Layout jump when data arrives

The data screen has two columns until there is data, then three, as the card
preview appears. The editor narrows by about 40% the moment a sample loads.

Fix: reserve the preview column from the start, with a short placeholder, or
open it with a transition.

### 15. Theme switch flash

Switching between light and dark briefly shows buttons such as "Edit data" and
"Save session" as pale shapes with unreadable text, before the colours settle.

Fix: switch theme colours without a transition, or transition background and
text together.

### 16. Rating bars overflow narrow cards

On a phone, the `rotten_tomatoes` bar's percentage ("91%") sits outside the
card edge.

Fix: let the bar shrink, or move the figure under the bar below a width.

## Accessibility

### 17. Spoken names that differ from labels

The Start over prompt's buttons read "Cancel" and "Confirm", but their
accessible names are "Keep this list" and "Confirm start over". A voice-control
user saying "click Cancel" will not reach it. The descriptive names are good for
screen readers; the visible labels should match them.

Fix: label the buttons "Keep this list" and "Start over" on screen too.

## Not covered

This pass did not test: a screen reader end to end, touch dragging on a real
phone, very long lists (hundreds of items), dropping files, or the Songs and
Games samples' play and gallery controls. Flag emoji showing as "us United
States" in Chrome on Windows is a known platform limit the field picker already
warns about, so it is not listed.
