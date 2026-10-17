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

| #   | Task                                                                | Area          | Priority | Status |
| --- | ------------------------------------------------------------------- | ------------- | -------- | ------ |
| 1   | Stop the page scrolling sideways on phones                          | Phone         | High     | Done   |
| 2   | Make comparing work on a phone screen                               | Phone         | High     | Done   |
| 3   | Keep the setup screen's main button in reach on phones              | Phone         | High     | Done   |
| 4   | Make Start over say what is lost, offer to save, and disarm itself  | Trust         | High     | Done   |
| 5   | Keep the controls still from one pair to the next                   | Speed         | High     | Done   |
| 6   | Fit the ranking screen in a desktop window                          | Speed         | Medium   | Done   |
| 7   | Make taking the result away obvious                                 | Flow          | High     | Done   |
| 8   | Do not present an order before there is one                         | Clarity       | Medium   | Done   |
| 9   | Say what the app does on the first screen                           | Onboarding    | Medium   | Done   |
| 10  | Show field names as people would write them                         | Clarity       | Medium   | Done   |
| 11  | Say a shared-slot tip once, not under every field                   | Clarity       | Low      | Done   |
| 12  | Make the keyboard shortcuts findable                                | Speed         | Medium   | Done   |
| 13  | Avoid the layout jump when data first arrives                       | Polish        | Low      | Done   |
| 14  | Plainer progress wording                                            | Clarity       | Low      | Done   |
| 15  | Smooth the theme switch                                             | Polish        | Low      | Done   |
| 16  | Keep rating bars inside narrow cards                                | Polish        | Low      | Done   |
| 17  | Match the Start over prompt's spoken names to its labels            | Accessibility | Low      | Done   |
| 18  | Calmer placement for Start over                                     | Trust         | Low      | Done   |
| 19  | Stop the setup panel scrolling inside the page on phones            | Phone         | Medium   | Done   |
| 20  | Give every page a title                                             | Accessibility | High     | Done   |
| 21  | Mark section titles as headings                                     | Accessibility | High     | Done   |
| 22  | Give the choice cards a role screen readers will announce           | Accessibility | Medium   | Done   |
| 23  | Make dragging a ranked row work with a finger                       | Phone         | High     | Done   |
| 24  | Refuse files that are not text, and ask before replacing the editor | Trust         | High     | Done   |
| 25  | Handle a file dropped on the ranking screen                         | Trust         | Medium   | Open   |
| 26  | Scroll the ranked list while dragging near its edge                 | Long lists    | Medium   | Open   |
| 27  | Set expectations on long lists                                      | Long lists    | Medium   | Open   |
| 28  | Drop a unit from a field name its renderer already shows            | Clarity       | Low      | Open   |
| 29  | Keep a field name on one line beside a long link                    | Polish        | Low      | Open   |
| 30  | Put all content inside a landmark                                   | Accessibility | Low      | Open   |

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

Done with the first of these, which turned out to be enough. When the pair
stacks, each card goes compact: a 72px picture, a two-line title, the first
two chosen fields, no "Click to choose" bar and no minimum height. The gap
around "or" tightens, and the GitHub link and header divider give way below
480px, so the header is one row of actions. At 390 x 844 both cards, both
"Much better" buttons, Undo and Skip now fit on one screen; before, the second
card started more than a screen down. Show details brings every field back.
An end-to-end test holds the one-screen fit.

### 3. The setup screen's main button is out of reach

On a phone, the editor, card preview and "What we found" panel stack, which
puts Start ranking (or Apply) around 2,400px down the page.

Fix: pin the main action to the bottom of the screen on narrow widths, with the
readiness line ("Paste, type, or drop your list...") above it.

Done: once the columns stack, the shell holds a dock under the scrolling page,
and the data screen puts its button and readiness line there (`StartCta`). The
panel leaves out its own copy while docked. A CSS `position: fixed` was tried
first and does not work: the scroll view's content has a transform, which pins
fixed elements to it rather than to the window.

### 19. The setup panel scrolls inside the page

Found while fixing 3. On a phone, the "What we found" panel keeps the fixed
height it has as a desktop sidebar and scrolls inside itself, so the page
scrolls and so does a box within it. On a touch screen it is easy to scroll
the wrong one, and the panel's last settings sit behind its own scroll.

Fix: once the columns stack, let the panel take the height of its content and
scroll with the page.

Done: while the shell is docking, the sidebar takes the height of its content
and the panel lays its settings out without a scroll of its own. The rank
screen keeps its bounded sidebar, which its windowed list needs.

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

Done: Start over is a plain header button like "How it works". The red is kept
for its confirmation, where the list is actually at stake.

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

Done differently: the cards and the samples stay as they are, since the
fields on a card are the user's choice. Instead "Edit data" moved onto the
status line beside the counts, where it had a row to itself, and the tray
under the cards tightened. At 1440 x 900 the Movies sample no longer scrolls,
with Skip and the shortcut line on screen. A very tall pair can still push
past the window; the cards keep what the user chose to show.

### 12. Keyboard shortcuts are hard to find

The shortcut line ("Arrow keys choose · shift + arrow for much better · S
skips ...") is small grey monospace text below the fold, and it was not visible
until after the first choice in the test session. Keyboard use is the fastest
way through a long list.

Fix: show the arrow-key hint on the cards themselves (a small "←" and "→"), and
put the full list behind a "?" shortcut and in the guide.

Done in part: the line is now on screen at desktop size (see 6), in the body
font rather than faint monospace, with each key drawn as a keycap. The cards
themselves stay free of keys, a deliberate earlier choice covered by tests
("title-first cards"). A "?" overlay is still open if wanted.

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

Done: until the list has a decision, rows show no rating and the sidebar says
"Not ranked yet: this is the order you gave", or "Your order, as given" for a
list marked already ranked. Positions stay, since they are what a drag moves.
Ratings appear with the first decision.

### 9. The first screen does not say what the app does

The first screen says "Add your list" and shows an empty "What we found" panel.
What the app actually does ("puts a list in order by asking you simple
one-on-one questions") is only inside "How it works".

Fix: one line under the title, and a three-step outline (add a list, pick
between pairs, take the ordered list away) in the empty right-hand panel, which
is currently blank.

Done: the empty "What we found" panel now opens with "Pairwise puts a list in
order by asking you about two items at a time, instead of sorting the whole
thing at once", then the three steps. It gives way as soon as there is text.

### 10. Field names as written in the data

Cards and the field picker show raw keys: `rotten_tomatoes`, `box_office_usd`,
`release_date`. They are the user's own names, so they are recognisable, but
they read as code.

Fix: show a readable form ("Rotten tomatoes", "Box office (USD)") on cards,
keeping the raw key in the field picker where it identifies the field.

Done: `fieldLabel` turns snake, kebab and camel case into words in sentence
case, keeps letter-words such as USD, IMDB and URL in capitals, and leaves a
name that already has spaces as written. Cards, badges and the ranked list's
meta line use it; the field picker and the details view keep raw keys.

### 11. The same tip, three times

When several fields share the picture slot, the field picker repeats the same
three-line tip under each of them ("These share the spot beside the title...").

Fix: say it once, above the group, or only under the first field of the slot.

Done: the first field of a shared slot carries the tip and the ordered list;
each later one says where it falls in one line, such as "2nd of 3 pictures
beside the title, after poster_url".

### 14. Progress wording

"7 neighbouring pairs still too close to call" is accurate, but "neighbouring
pairs" is the app's vocabulary, not the user's. The percentage sits in small
type at the far end of the bar.

Fix: something like "7 places in the list are still uncertain", and the
percentage beside the comparison count where the eye already is.

Done: the line reads "7 places in the order are still close calls" (and "Every
item is settled against its neighbours" once none are), the percentage sits in
the count line in a stronger weight, and the count says "1 comparison" rather
than "1 comparisons".

## Polish

### 13. Layout jump when data arrives

The data screen has two columns until there is data, then three, as the card
preview appears. The editor narrows by about 40% the moment a sample loads.

Fix: reserve the preview column from the start, with a short placeholder, or
open it with a transition.

Done: on a wide screen the card preview column is there from the start, with
"Your items will show here as cards" until there is a list, and plain lists now
preview as title-only cards too. The editor keeps one width (499px at
1440 x 900) whether the box is empty, holds a plain list, or holds objects.

### 15. Theme switch flash

Switching between light and dark briefly shows buttons such as "Edit data" and
"Save session" as pale shapes with unreadable text, before the colours settle.

Fix: switch theme colours without a transition, or transition background and
text together.

Done: switching the theme, from the toggle or by the operating system, sets
`data-theme-switching` on the page for one frame, during which transitions are
off. Thirty milliseconds after pressing the dark toggle, a button already
shows its final colour.

### 16. Rating bars overflow narrow cards

On a phone, the `rotten_tomatoes` bar's percentage ("91%") sits outside the
card edge.

Fix: let the bar shrink, or move the figure under the bar below a width.

Done: a rating's row wraps like tags and pills do, so on a narrow card the bar
or stars move under the field name. With details open at 390px, nothing runs
past either card.

## Accessibility

### 17. Spoken names that differ from labels

The Start over prompt's buttons read "Cancel" and "Confirm", but their
accessible names are "Keep this list" and "Confirm start over". A voice-control
user saying "click Cancel" will not reach it. The descriptive names are good for
screen readers; the visible labels should match them.

Fix: label the buttons "Keep this list" and "Start over" on screen too.

## Second pass

The areas the first pass left out, tested in the built app: the accessibility
tree and an axe scan (no screen reader could be driven from here, so this is
what one would read, not a recording of one), real touch input on an emulated
iPhone 13, a 500-item list, files dropped and chosen, and the Songs and Games
samples' play buttons and galleries.

### What works

- Every control has a clear accessible name: cards ("Choose The Hurt Locker"),
  pictures ("The Hurt Locker, picture 1 of 5"), the progress bar, the theme
  switch, and the reorder handles, which also explain Alt and the arrow keys.
- A focused card is chosen with Enter, and focus stays on the left card as the
  next pair arrives, so a keyboard user can keep going without hunting for it.
- On 500 items a choice takes 11 ms (16 ms at worst).
- Play buttons switch to Stop, play one clip at a time, stop when their card is
  replaced, and never choose the card. Gallery arrows step through pictures
  without choosing it either.
- Every picture in the Songs and Games samples loads: album art, Steam banners
  and YouTube thumbnails.

### 20. No page title

Neither page has a `<title>`. The browser tab shows a bare address, and a screen
reader announces no page name on arrival. The axe scan rates this serious.

Fix: a title per screen, such as "Pairwise: add a list" and "Pairwise: Movies".

Done: "Pairwise: add a list", "Pairwise: edit data" and "Pairwise: ranking
movies" (named after the list), set with Expo Router's `Head`. The HTML shell
carries "Pairwise" for the moment before the app runs. An end-to-end test
checks each.

### 21. No headings

"Add your list", "What we found", "Card previews", "Your data" and each card's
title are plain text, and there is no top-level heading. Screen reader users
mostly move around a page by heading, so the page reads as one long run.

Fix: `role="heading"` with levels: the app name or screen as level 1, panels as
level 2, card titles as level 3.

Done: "Pairwise" is the level 1 heading; "Add your list", "Card previews", "What
we found" and "Your data" are level 2, as are the two cards' titles while
ranking; the setup panel's sections ("Rank which list?", "What order is your
list in?", "Fields", "Write the new order into") and the preview cards' titles
are level 3. React Native Web renders these as real `h1` to `h3` elements. An
end-to-end test checks them.

### 22. The choice card's name may not be read

The card's label ("Choose The Hurt Locker") sits on an element with no role. It
cannot be a button, since it holds buttons of its own, but ARIA does not allow
a name on a generic element, and several screen readers ignore one there. The
card may then not be announced as something to choose.

Fix: give the card `role="group"` with its name, and make the title (or a
visually quiet "Choose" control) a real button inside it.

Done, the first half: the card is a group named "Choose The Hurt Locker", which
ARIA allows, so it is announced, and Enter on the focused card still chooses
it. A real button inside the card is still open if a screen reader is found to
need one; this pass could not test with one.

### 23. Dragging a ranked row does not work with a finger

With real touch input on an emulated phone, dragging the grip scrolled the page
by 179 px and moved nothing. The grip asks for `touch-action: none`, but React
Native Web gives every pressable a `touch-action: manipulation` class that comes
later in the stylesheet and wins, so the browser takes the finger for a scroll
and cancels the drag. The grip is also 18 x 25 px, under the usual 44 px for a
touch target.

Fix: set `touchAction: 'none'` in the grip's own style (the sidebar divider
already does this), and widen its hit area to 44 px.

Done: the grip sets `touchAction: 'none'` in its own style and spans the full
height of the row, 36 px wide. A touch end-to-end test drags a row with real
touch input on an emulated iPhone; it fails on the old grip.

### 24. A non-text file is pasted in as text

Dropping a PNG on the setup screen put its bytes into the editor, which read
them as a four-item plain list, with no warning. The file picker has no type
filter, so choosing one does the same. Either way the file also replaces
whatever was in the editor without asking, so a mistaken drop loses typed work.

Fix: accept text, YAML and JSON in the picker; refuse a file whose contents are
not text with a short message; and ask, or allow undo, before replacing text
that is already there.

Done: the picker offers text, YAML and JSON. `readTextFile` refuses a file that
states a non-text type, or whose first 4 KB hold a NUL or undecodable bytes,
with `"photo.png" is not a text file. Pairwise reads plain lists, YAML and
JSON.` A file that would replace text already in the box asks first, and an
empty box is filled straight away.

### 25. A file dropped on the ranking screen

Found by reading the code rather than by testing: a real drop from the
operating system cannot be simulated here. Only the setup screen listens for
dropped files. On the ranking screen the browser's default applies, which is
usually to open the file in place of the app.

Fix: on the ranking screen, take a dropped session file as Open session does,
and quietly ignore anything else.

### 26. Long lists: dragging stops at the edge of what is shown

The ranked list has no auto-scroll while dragging, so a row can only be dropped
among the rows on screen, and Alt with an arrow key moves it one place per
press. Moving item 400 of 500 to the top takes dozens of drags or hundreds of
key presses.

Fix: scroll the list while a drag is held near its top or bottom edge, and
consider "move to top" and "move to bottom" on the row.

### 27. Long lists: no sense of how long this takes

After 40 choices on 500 items the meter reads 1%, and the status line says
"499 places in the order are still close calls". The estimate behind the meter
is about 4,500 comparisons, which nothing says up front, so progress looks
stalled.

Fix: say the scale when a long list starts ("about 4,500 choices to settle 500
items; the order is usable well before that"), and show how many places have
settled rather than how many have not.

### 28. A unit in the name that the value already shows

`duration_sec` now reads "Duration sec: 2:51": the field name says seconds, but
the duration renderer already shows minutes and seconds.

Fix: when a renderer reformats a value, drop a trailing unit word (sec, secs,
seconds, ms) from its label.

### 29. A field name wrapping beside a long link

A link field such as `store_url` shows its name as "Store" and "URL:" on two
lines, because the long link beside it takes the room.

Fix: keep the name on one line and let the link truncate or wrap below it.

### 30. Content outside a landmark

The axe scan of the ranking screen found one block of content outside any
landmark. It named it only by a generated class, so which block it is still
needs finding.

Fix: find it, and place it inside the banner, the main region or the sidebar.

### Still not covered

A screen reader driven end to end (NVDA or VoiceOver), and touch on a physical
phone rather than an emulated one. Flag emoji showing as "us United States" in
Chrome on Windows is a known platform limit the field picker already warns
about.
