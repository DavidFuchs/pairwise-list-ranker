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

## Core layout

Desktop default:
- left rail: list metadata, sort-field control, add-item controls, and workspace actions
- center stage: pairwise comparison workspace with two large item cards
- right rail: persistent preview pane with mode tabs for GUI, YAML, JSON, Markdown

Tablet:
- comparison workspace remains primary
- preview pane becomes collapsible but sticky

Mobile:
- stacked layout
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

### 2. Control rail

Contains:
- list title and description
- list type badge: Simple list / Object list
- sort-field picker for object lists
- add item button
- remove/edit list actions
- local persistence controls if enabled

### 3. Comparison stage

Each card owns the decisions about its own item. There is no shared row of
buttons underneath the pair: a detached bank of actions makes the reader map
"left" and "right" back onto two cards on every single comparison, which is the
one thing this screen asks them to do hundreds of times.

Each card contains, top to bottom:
- a side marker (LEFT / RIGHT) and a quiet remove control in the corner
- the item label, from the sort field for object lists
- summary chips for short scalar fields
- an expandable details region for the rest of the object
- a footer, aligned across both cards, holding:
  - **Choose** — full width, the accent gradient, the only loud element
  - **Much better** — a soft accent strip beneath it

Removing an item swaps that card's footer for an inline confirmation, so the
question is asked on the card being removed rather than in a separate bar.

Between and below the pair:
- a compact status strip: comparisons made, item count, and a progress meter
- a single **Skip this pair** pill, centred — it belongs to the pair, not to
  either item
- a one-line keyboard hint

### 4. Persistent preview pane

Contains:
- mode tabs: GUI / YAML / JSON / Markdown
- copy button
- download button
- editable text area in YAML/JSON/Markdown modes
- import/apply button for pasted text
- parse diagnostics area

## Interaction model

### Comparison flow

1. User sees two items.
2. User chooses left, right, much better left, much better right, or skip.
3. Ranking updates instantly.
4. Preview pane updates instantly.
5. Next pair animates in with minimal delay.

Deletion from comparison:
- delete is visually secondary and destructive-styled
- deleting either item skips ranking for that pair
- confirmation is inline for desktop and sheet/modal on mobile

### Adding items

Simple list:
- inline single-text input
- quick-add with Enter

Object list:
- add object button opens structured editor
- allow paste of JSON/YAML object into the object editor
- validate before commit

### Sort field selection

For object lists:
- detect likely scalar fields
- ask the user to choose one when multiple valid candidates exist
- show a live example of how the selected field changes card titles and ranked preview labels

### Drill-in details

Each comparison card includes:
- primary label from the chosen sort field
- optional subtitle from a secondary summary rule
- expand details action

Expanded details should show:
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
primary action, the progress meter, and focus rings.

Both themes are defined as CSS custom properties in `lib/themeCss.ts`. Dark mode
follows the OS setting and can be overridden per visitor; because the palette is
resolved by the stylesheet rather than by React state, both themes render the
same markup.

#### Light

| Token | Value | Used for |
| --- | --- | --- |
| `--canvas` | `#F6F7FB` | app ground, under a faint indigo/violet wash |
| `--surface` | `#FFFFFF` | panels and cards |
| `--surface-muted` | `#EEF1F8` | chips, meter track |
| `--surface-sunken` | `#F3F5FA` | editors, tab groups, inputs |
| `--border` | `#DEE3EC` | hairlines |
| `--border-strong` | `#C7D0DF` | emphasised edges |
| `--text-primary` | `#131722` | headings and item labels |
| `--text-secondary` | `#58627A` | supporting copy |
| `--text-faint` | `#838DA3` | metadata, shortcut hints |
| `--accent` | `#4C63F5` | primary action, focus ring |
| `--accent-strong` | `#3244D4` | accent text on light surfaces |
| `--accent-soft` | `#EEF1FE` | "much better", selected states |
| `--accent-soft-border` | `#CBD4FD` | edge of soft accent surfaces |
| `--violet` | `#7C5CFF` | gradient partner, canvas wash |
| `--success` / `--success-text` | `#0F9F6E` / `#0A7350` | positive states |
| `--warning` / `--warning-text` | `#D28A12` / `#8A5A0B` | coverage warnings |
| `--danger` / `--danger-text` | `#D14343` / `#B02A2A` | destructive actions |

#### Dark

| Token | Value | Used for |
| --- | --- | --- |
| `--canvas` | `#0D1016` | app ground |
| `--surface` | `#161A23` | panels and cards |
| `--surface-muted` | `#1E2430` | chips, meter track |
| `--surface-sunken` | `#11151D` | editors, tab groups, inputs |
| `--border` | `#262D3B` | hairlines |
| `--text-primary` | `#E9EDF6` | headings and item labels |
| `--text-secondary` | `#9AA5BC` | supporting copy |
| `--text-faint` | `#74809A` | metadata, shortcut hints |
| `--accent` | `#7C8CFF` | primary action, focus ring |
| `--accent-strong` | `#A0ABFF` | accent text on dark surfaces |
| `--accent-soft` | `#1A2036` | "much better", selected states |
| `--violet` | `#9E7BFF` | gradient partner, canvas wash |
| `--danger` / `--danger-text` | `#EE7168` / `#FF9C94` | destructive actions |

The `*-text` variants exist because the fill colours are tuned for backgrounds
and fall below WCAG AA as small text. Use the text variant for anything under
16px.

### Shading and gradients

Gradients are atmosphere, never decoration. Four, and no more:

1. **Canvas wash** — two large, very low-alpha radial gradients (indigo, then
   violet) anchored off the top edge. It gives the page a light source without
   reading as a coloured background.
2. **Panel and card fill** — a 180° gradient between two near-identical
   neutrals, plus a 1px inset top highlight. Barely perceptible in isolation;
   what stops large surfaces from looking flat.
3. **Primary action** — a 140° indigo gradient, `--accent` to
   `--accent-gradient-end`. Deliberately a single hue family rather than a
   two-tone sweep, so it stays calm next to its twin on the other card.
4. **Progress meter** — indigo to violet across the filled width, the one place
   the full accent range appears.

Elevation is a two-layer shadow: a tight contact shadow plus a wide, soft cast
shadow. On hover, cards lift 2px and the cast shadow picks up accent tint.

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
- primary: **Choose**, inside its card, carrying the accent gradient
- emphasis: **Much better**, a soft accent surface directly below Choose —
  distinct, but never louder than the primary
- secondary: skip, drill-in, add item, downloads
- tertiary/destructive: remove item, a faint glyph until it is armed

### Preview modes

GUI preview:
- ranked list with position chips
- compact metadata rows for objects
- subtle transitions on order updates

Text modes:
- editor-like surface
- monospaced font
- syntax-aware coloring if feasible
- copy/download/import actions pinned near the top

### Local status surfaces

Use small, calm status elements for:
- working locally
- local persistence enabled/disabled
- last local save time if shown
- unsaved text-mode edits waiting for import/apply

Avoid fake-cloud language. No “sync” badge for a thing that never met a server.

## Motion

Motion should communicate state, not audition for a startup reel.

Use:
- 120-180ms tap/hover transitions
- 180-240ms card swap/fade after comparison
- subtle position shift when rankings change in GUI preview
- reduced-motion fallback for all animated transitions

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
- S: skip
- D then L or R: delete left/right with confirmation

## Empty, error, and edge states

Empty list:
- elegant onboarding panel
- sample import snippets for YAML, JSON, Markdown
- clear explanation that everything starts from pasted/imported data

Import parse error:
- keep user text intact
- show exact line/field diagnostics
- explain expected structure without wiping edits

Object list without selected sort field:
- block ranking until chosen
- show candidate fields and examples

Local persistence unavailable:
- app should still function fully in memory
- show a small note that reload persistence is unavailable in the current browser context

Reset workspace:
- explain that current in-browser state will be cleared
- never imply exported files are affected

## Export presentation rules

- GUI preview is default and non-exportable
- YAML/JSON/Markdown are the only exportable modes
- download filenames should include list slug, format, and date
- copy success should be subtle and immediate
- export controls should feel primary enough that users understand how to keep their work

## Quality bar

A finished screen should feel:
- balanced at 1440px wide
- still clean at 1024px
- readable and tappable on mobile
- visually consistent across comparison, editing, persistence, and export flows

If anything starts looking like an admin panel from a tax portal, redesign it. Ruthlessly.