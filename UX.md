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

Contains:
- two balanced comparison cards
- a compact progress/status strip
- primary actions:
  - Choose left
  - Choose right
  - Left is much better
  - Right is much better
  - Skip
  - Delete left
  - Delete right
- optional details toggle for object drill-in

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

### Style direction

Use a refined editorial-meets-product aesthetic:
- soft surfaces
- crisp typography
- restrained shadows
- rounded cards
- strong spacing rhythm
- one saturated accent used intentionally

### Color palette

Base:
- background: warm off-white or cool near-white
- elevated surface: pure white or very light neutral
- text primary: deep charcoal
- text secondary: muted slate
- border: soft gray with low contrast

Accent:
- primary accent: deep cobalt or indigo
- success accent: emerald
- warning accent: amber
- destructive accent: crimson

Suggested palette:
- canvas: `#F6F7FB`
- surface: `#FFFFFF`
- surface-muted: `#EEF1F7`
- text-primary: `#111827`
- text-secondary: `#5B6474`
- border: `#D9DFEA`
- accent: `#345CFF`
- accent-strong: `#2446D8`
- success: `#0F9F6E`
- warning: `#D28A12`
- danger: `#D14343`

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
- hover/focus elevation on desktop
- selected-action feedback should be immediate but tasteful
- when details are expanded, card height may grow without reflow chaos

### Buttons

Hierarchy:
- primary: choose left/right
- secondary: skip, drill-in, add item
- tertiary/destructive: delete item
- nuanced emphasis variant: much better actions, visually distinct but not louder than primary winners

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