# Manual QA pass

Automated coverage runs with `npm run test` (unit, component, integration) and
`npm run e2e` (Chromium against the real static build). This document covers
what those cannot: judgement about how the app feels, and behaviour that depends
on a real browser, a real screen size, or real assistive technology.

Run through this before a release.

## Setup

```bash
npm run build:web
npx serve dist -l 4173
```

Test in a normal window and a private window (private mode is the realistic
"storage is blocked" case).

## 1. First run

- [ ] The page loads with no console errors or warnings.
- [ ] The onboarding panel explains that everything starts from pasted data.
- [ ] Sample snippets for YAML, JSON, and Markdown are readable.
- [ ] The GUI tab is selected and shows an empty-state message.

## 2. Import

- [ ] A YAML bullet list imports as a simple list.
- [ ] A JSON array of objects imports as an object list.
- [ ] An app-exported Markdown document re-imports unchanged.
- [ ] Pasting invalid text shows a line-numbered error, keeps the text, and
      leaves the current list untouched.
- [ ] Correcting the text and importing again recovers cleanly.
- [ ] A large list (500+ items) imports without the UI locking up.

## 3. Ranking

- [ ] Choosing a winner reorders the preview immediately.
- [ ] "Much better" moves an item further than a normal win.
- [ ] Skip advances to a new pair and changes no ratings.
- [ ] The same pair is not offered twice in a row while alternatives exist.
- [ ] Deleting from a card asks for confirmation first.
- [ ] Deleting does not record a comparison for that pair.
- [ ] Ranking still works with exactly two items left.
- [ ] With one item left, the deck explains why there is nothing to compare.

## 4. Object lists

- [ ] A list with an obvious `title`/`name` field is labelled without asking.
- [ ] A list with two equally plausible text fields blocks ranking and asks.
- [ ] Picking a field titles the cards and the ranked preview immediately.
- [ ] Changing the field relabels everything.
- [ ] Fields that are arrays or nested objects are not offered as labels.
- [ ] Card drill-in shows every other field, nested values included.
- [ ] Exports contain the fields that are not the label.

## 5. Preview and export

- [ ] GUI mode offers no copy or download, and cannot be edited.
- [ ] YAML, JSON, and Markdown all render the current ranking, best first.
- [ ] Copy puts the exact preview text on the clipboard.
- [ ] Download produces `slug-YYYY-MM-DD.ext` and the file opens correctly.
- [ ] Downloaded YAML/JSON/Markdown re-import without loss.

## 6. Persistence

- [ ] After a change, "Last saved" appears in the workspace panel.
- [ ] Reloading restores the list, the ranking, and the selected tab.
- [ ] Clearing the workspace empties it and survives a reload.
- [ ] In a private window that blocks storage, the app still works and says
      plainly that the list will not be kept.
- [ ] Corrupting the `pairwise-list-ranker:workspace:v1` key by hand and
      reloading starts a clean workspace instead of breaking.

## 7. Keyboard

- [ ] Left/right arrows choose; shift + arrow marks a much-better win.
- [ ] `S` skips; `D` then `L`/`R` arms a delete; Enter confirms, Escape cancels.
- [ ] Shortcuts do nothing while typing in the editor or the add-item field.
- [ ] Tab order runs header → rail → comparison → preview.
- [ ] Every control shows a visible focus ring.
- [ ] The whole core flow is completable without a mouse.

## 8. Screen reader

Test with VoiceOver (macOS), NVDA (Windows), or TalkBack (Android).

- [ ] Landmarks announce as banner, main, and complementary.
- [ ] Each card announces its side and label.
- [ ] Every action button has a name that identifies its item.
- [ ] A new pair is announced after each decision.
- [ ] Import errors are announced as an alert.
- [ ] The progress meter reports a percentage, not an unlabelled bar.

## 9. Layout

Check 1440, 1280, 1024, 820, and 390 px wide.

- [ ] 1440: three columns, balanced, nothing off-screen.
- [ ] 1280: still three columns or a clean two-column fallback.
- [ ] 1024/820: the preview drops below the comparison area intact.
- [ ] 390: everything stacks, cards are full width, tap targets stay large.
- [ ] No horizontal page scrollbar at any width.
- [ ] Long item labels and long field values wrap instead of overflowing.

## 10. Themes

- [ ] With the OS set to dark, the app loads dark with no flash of light.
- [ ] With the OS set to light, the app loads light.
- [ ] The header control switches between System, Light, and Dark.
- [ ] A chosen theme survives a reload, and still applies before first paint.
- [ ] Returning to System follows the OS again, immediately.
- [ ] Changing the theme in one tab moves other open tabs.
- [ ] In dark mode: card gradients, the accent button, and the progress meter
      all read correctly, and no surface is pure black or pure white.
- [ ] Error, warning, and success text is legible in both themes.

## 11. Motion and appearance

- [ ] The card swap reads as a new pair, not a text flicker.
- [ ] With "reduce motion" enabled at the OS level, transitions do not animate
      and nothing is left invisible.
- [ ] Text meets WCAG AA against its background, including error and warning
      text and the small monospace metadata.
- [ ] Nothing looks like an admin panel from a tax portal.
