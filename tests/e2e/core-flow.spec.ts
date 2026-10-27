import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { replay } from '@/lib/ranking/bt/engine';
import { drivenHistory } from '@/tests/helpers/engineCorpus';

const DINNERS = ['Tacos', 'Ramen', 'Curry', 'Pho'].join('\n');

/** A document whose ranked array sits beside metadata the app must preserve. */
const FILMS = `version: 3
owner: david
movies:
  - title: Alien
    year: 1979
    order: 2
  - title: Arrival
    year: 2016
    order: 1
notes: personal picks`;

async function enterData(page: Page, text: string) {
  await page.getByLabel('Your list').fill(text);
}

/** Opens the sample menu on the paste page and loads one of its samples. */
async function loadSample(page: Page, name: string) {
  await page.getByRole('button', { name: 'Try a sample list' }).click();
  await page.getByRole('menuitem', { name: `Load the ${name} sample` }).click();
}

/** From the paste page to the list setup screen. */
async function continueToSetup(page: Page) {
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: 'Start ranking' })).toBeVisible();
}

/** Takes the pasted text through setup, as it is, to the ranking. */
async function startRanking(page: Page) {
  // A test that set the list up first is already past the paste page.
  if ((await page.getByRole('button', { name: 'Continue' }).count()) > 0) await continueToSetup(page);
  await page.getByRole('button', { name: 'Start ranking' }).click();
}

/**
 * Starts a simulated OS file drag on the page body and waits for the overlay.
 * The page-wide drop target is attached once the app hydrates, which the
 * static page can trail on a slow machine, so the dragenter is repeated until
 * the app answers it rather than sent once and missed.
 */
async function startFileDrag(page: Page, overlay = 'Drop to import') {
  await expect
    .poll(() =>
      page.evaluate(async (overlayText) => {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File(['x'], 'a.txt', { type: 'text/plain' }));
        const eventInit = { bubbles: true, cancelable: true, dataTransfer, clientX: 5, clientY: 5 };
        document.body.dispatchEvent(new DragEvent('dragenter', eventInit));
        await new Promise((resolve) => setTimeout(resolve, 50));
        return document.body.textContent?.includes(overlayText) ?? false;
      }, overlay),
    )
    .toBe(true);
}

/** Drops a file on the page body, the way a browser hands over one dragged in from the system. */
async function dropFile(page: Page, name: string, text: string) {
  await page.evaluate(
    ({ fileName, fileText }) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([fileText], fileName, { type: 'application/json' }));
      const eventInit = { bubbles: true, cancelable: true, dataTransfer, clientX: 5, clientY: 5 };
      document.body.dispatchEvent(new DragEvent('dragover', eventInit));
      document.body.dispatchEvent(new DragEvent('drop', eventInit));
    },
    { fileName: name, fileText: text },
  );
}

async function chooseCardRows(page: Page) {
  const cards = page.getByLabel(/^Choose /);
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  if (first === null || second === null) throw new Error('Expected both choice cards to be laid out.');
  return { firstY: first.y, secondY: second.y };
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  // Every test gets a clean browser workspace.
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  (page as Page & { consoleErrors: string[] }).consoleErrors = errors;
});

test('first run asks for data before anything else', async ({ page }) => {
  await expect(page.getByLabel('Your list')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveAttribute('aria-disabled', 'true');
});

test('dragging a file anywhere on the page shows a drop overlay and imports on release', async ({ page }) => {
  // No <input type=file> equivalent for a raw OS drag, so the drag is
  // simulated the way a browser's own DragEvent carries files: a DataTransfer
  // holding a File, dispatched on the page body - far from the "Choose a
  // file" control - to prove the whole page is the target, not just that
  // control's own small zone.
  await startFileDrag(page);
  await expect(page.getByText('Drop to import')).toBeVisible();

  const imported = await page.evaluate(async () => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(['Alpha\nBeta\nGamma'], 'list.txt', { type: 'text/plain' }));
    const eventInit = { bubbles: true, cancelable: true, dataTransfer, clientX: 5, clientY: 5 };
    document.body.dispatchEvent(new DragEvent('dragover', eventInit));
    document.body.dispatchEvent(new DragEvent('drop', eventInit));

    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      textareaValue: (document.querySelector('textarea') as HTMLTextAreaElement | null)?.value ?? null,
      overlayGone: !(document.body.textContent?.includes('Drop to import') ?? false),
    };
  });

  expect(imported.textareaValue).toBe('Alpha\nBeta\nGamma');
  expect(imported.overlayGone).toBe(true);
  await expect(page.getByLabel('Your list')).toHaveValue('Alpha\nBeta\nGamma');
});

test('dragging a file out of the window without dropping clears the overlay', async ({ page }) => {
  // A browser reports no relatedTarget on the dragleave that fires when the
  // pointer leaves the window entirely - that, not a `drop`, is what has to
  // clear the overlay here, since the drag is abandoned rather than released.
  await startFileDrag(page);

  const stillShown = await page.evaluate(async () => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(['x'], 'a.txt', { type: 'text/plain' }));
    document.body.dispatchEvent(
      new DragEvent('dragleave', { bubbles: true, cancelable: true, dataTransfer, relatedTarget: null }),
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    return document.body.textContent?.includes('Drop to import') ?? false;
  });

  expect(stillShown).toBe(false);
  await expect(page.getByText('Drop to import')).toBeHidden();
});

test('ranks a plain list and exports it', async ({ page }) => {
  await enterData(page, DINNERS);
  await startRanking(page);

  await expect(page.getByLabel(/^Choose /).first()).toBeVisible();
  await page
    .getByLabel(/^Choose /)
    .first()
    .click();

  await page.getByRole('tab', { name: 'Plain list' }).click();
  await expect(page.getByLabel('list export')).toContainText('Tacos');
});

/** Thirty items, so the progress line has a stage to count down. */
const THIRTY_ITEMS = Array.from({ length: 30 }, (_, index) => `Item ${index + 1}`).join('\n');
const CANT_TELL = /Can't tell how close you are yet/;
const A_LEVEL =
  /Rough order so far|Taking shape|Close\. Mostly fine adjustments left|Changes from here should be small/;

/** Answers with the arrow keys until the status line no longer says it cannot tell how close the order is. */
async function answerUntilEveryItemIsCompared(page: Page) {
  for (let answered = 0; answered < 60; answered++) {
    if ((await page.getByText(CANT_TELL).count()) === 0) return;
    await page.keyboard.press(answered % 2 === 0 ? 'ArrowLeft' : 'ArrowRight');
  }
}

test('a new list says it cannot tell how close the order is, and counts the items left to compare', async ({
  page,
}) => {
  await enterData(page, THIRTY_ITEMS);
  await continueToSetup(page);
  await page.getByRole('radio', { name: 'The list is in no particular order' }).click();
  await startRanking(page);

  await expect(
    page.getByText("Can't tell how close you are yet. 30 of 30 items haven't been compared."),
  ).toBeVisible();

  await page.keyboard.press('ArrowLeft');
  await expect(page.getByText(/28 of 30 items haven't been compared/)).toBeVisible();
});

test('once every item has been compared the progress line names a level, and keeps it after a reload', async ({
  page,
}) => {
  await enterData(page, THIRTY_ITEMS);
  await continueToSetup(page);
  await page.getByRole('radio', { name: 'The list is in no particular order' }).click();
  await startRanking(page);
  await expect(page.getByText(CANT_TELL)).toBeVisible();

  await answerUntilEveryItemIsCompared(page);

  await expect(page.getByText(A_LEVEL)).toBeVisible();
  await expect(page.getByText(CANT_TELL)).toHaveCount(0);

  await page.reload();
  await expect(page.getByText(A_LEVEL)).toBeVisible();
});

test('"Why?" on the progress line opens a window about the level, and closes again', async ({ page }) => {
  await enterData(page, THIRTY_ITEMS);
  await continueToSetup(page);
  await page.getByRole('radio', { name: 'The list is in no particular order' }).click();
  await startRanking(page);

  await page.getByRole('link', { name: 'Why is the order at this stage?' }).click();
  await expect(page.getByText('How close is this order?')).toBeVisible();
  await expect(page.getByText('Keep answering to bring them in.')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).last().click();
  await expect(page.getByText('How close is this order?')).toHaveCount(0);

  await answerUntilEveryItemIsCompared(page);
  await page.getByRole('link', { name: 'Why is the order at this stage?' }).click();
  await expect(page.getByText('How close is this order?')).toBeVisible();
  await expect(page.getByText("The details aren't ready yet.")).toHaveCount(0);
});

test('a list that arrives ranked says it cannot tell yet, and then says nothing more', async ({ page }) => {
  await enterData(page, THIRTY_ITEMS);
  await continueToSetup(page);
  await page.getByRole('radio', { name: 'The list is already ranked, best to worst' }).click();
  await startRanking(page);
  await expect(page.getByText(CANT_TELL)).toBeVisible();

  await answerUntilEveryItemIsCompared(page);

  await expect(page.getByText(/answers so far/)).toBeVisible();
  await expect(page.getByText(CANT_TELL)).toHaveCount(0);
  await expect(page.getByText(A_LEVEL)).toHaveCount(0);
});

test('a list sorted by a field starts ranked in that field order', async ({ page }) => {
  await enterData(
    page,
    `- title: Low
  plays: 5
- title: Top
  plays: 90
- title: Middle
  plays: 40
- title: High
  plays: 70`,
  );
  await continueToSetup(page);
  await page.getByRole('radio', { name: 'Sort by a field' }).click();
  await page.getByRole('radio', { name: 'High to low' }).click();
  await startRanking(page);

  const reorder = page.getByRole('button', { name: /^Reorder / });
  await expect(reorder).toHaveCount(4);
  const names = await reorder.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
  const order = names.map((name) => (name ?? '').replace(/^Reorder /, '').split(',')[0]);
  expect(order).toEqual(['Top', 'High', 'Middle', 'Low']);
});

test('keeps the whole document when ranking one array inside it', async ({ page }) => {
  await enterData(page, FILMS);
  await startRanking(page);

  await page.getByRole('tab', { name: 'YAML' }).click();
  const exported = page.getByLabel('yaml export');

  await expect(exported).toContainText('version: 3');
  await expect(exported).toContainText('owner: david');
  await expect(exported).toContainText('notes: personal picks');
  // The recognised ordering field is rewritten to match the new order.
  await expect(exported).toContainText('order: 1');
});

test('resumes after a reload, then can start over', async ({ page }) => {
  await enterData(page, DINNERS);
  await startRanking(page);
  await expect(page.getByRole('button', { name: "Can't decide" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: "Can't decide" })).toBeVisible();

  await page.getByRole('button', { name: 'Start over' }).click();
  await page.getByRole('button', { name: 'Confirm start over' }).click();

  await expect(page.getByLabel('Your list')).toBeVisible();
});

test('the gear opens the setup of a list in progress, and Save returns to ranking with the answers kept', async ({
  page,
}) => {
  await enterData(page, DINNERS);
  await startRanking(page);
  await page
    .getByLabel(/^Choose /)
    .first()
    .click();
  await expect(page.getByText('1 answer so far')).toBeVisible();

  await page.getByRole('button', { name: 'List setup' }).click();
  await expect(page).toHaveURL(/\/setup$/);

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/rank$/);
  await expect(page.getByText('1 answer so far')).toBeVisible();
});

test('Start over, on the ranking screen, leaves an empty paste page for new data', async ({ page }) => {
  await enterData(page, DINNERS);
  await startRanking(page);
  await expect(page.getByRole('button', { name: "Can't decide" })).toBeVisible();

  await page.getByRole('button', { name: 'Start over' }).click();
  await page.getByRole('button', { name: 'Confirm start over' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel('Your list')).toHaveValue('');
});

test('chooses by clicking anywhere on a card', async ({ page }) => {
  await enterData(page, DINNERS);
  await startRanking(page);

  await expect(page.getByText('0 answers so far')).toBeVisible();
  await page
    .getByLabel(/^Choose /)
    .first()
    .click();

  await expect(page.getByText('1 answer so far')).toBeVisible();
});

/**
 * jsdom cannot prove this: React Native's responder system may already stop the
 * press, but only a real browser has the DOM click bubbling that the guard is
 * there to defeat.
 */
test('pressing a control inside a card does not cast a vote', async ({ page }) => {
  await enterData(page, FILMS);
  await startRanking(page);

  await expect(page.getByText('0 answers so far')).toBeVisible();
  // The delete control is the remaining control nested inside the press area.
  await page
    .getByRole('button', { name: /^Delete / })
    .first()
    .click();

  await expect(page.getByRole('button', { name: /^Confirm deleting / })).toBeVisible();
  await expect(page.getByText('0 answers so far')).toBeVisible();
});

test('details open on both cards from one toggle', async ({ page }) => {
  await enterData(page, FILMS);
  // A card shows only its title until a field is ticked for it.
  await continueToSetup(page);
  await page.getByRole('checkbox', { name: 'Show year on cards' }).click();
  await startRanking(page);

  // Scoped to the cards: the ranked list shows the same fields in its own rows.
  const alien = page.getByLabel('Choose Alien');
  const arrival = page.getByLabel('Choose Arrival');

  // Collapsed, each card summarises its fields as chips.
  await expect(alien.getByText('Year: 1979')).toBeVisible();
  await expect(arrival.getByText('Year: 2016')).toBeVisible();

  await page.getByRole('switch', { name: 'Show details on both cards' }).click();

  // Expanded, both cards show every field in full, and the chosen summary
  // fields stay put above them.
  await expect(alien.getByText('Year: 1979')).toBeVisible();
  await expect(arrival.getByText('Year: 2016')).toBeVisible();
  await expect(alien.getByText('1979', { exact: true })).toBeVisible();
  await expect(arrival.getByText('2016', { exact: true })).toBeVisible();
});

test('much better records a strong win in one click', async ({ page }) => {
  await enterData(page, DINNERS);
  await startRanking(page);

  await page
    .getByRole('button', { name: /is much better$/ })
    .first()
    .click();

  await expect(page.getByText('1 answer so far')).toBeVisible();
});

test('choice cards return to one row after rotating back to landscape', async ({ page }) => {
  await page.setViewportSize({ width: 1194, height: 834 });
  await enterData(page, DINNERS);
  await startRanking(page);

  await expect
    .poll(async () => {
      const { firstY, secondY } = await chooseCardRows(page);
      return Math.abs(firstY - secondY) < 4;
    })
    .toBe(true);

  await page.setViewportSize({ width: 834, height: 1194 });
  await expect
    .poll(async () => {
      const { firstY, secondY } = await chooseCardRows(page);
      return Math.abs(firstY - secondY) >= 4;
    })
    .toBe(true);

  await page.setViewportSize({ width: 1194, height: 834 });
  await expect
    .poll(async () => {
      const { firstY, secondY } = await chooseCardRows(page);
      return Math.abs(firstY - secondY) < 4;
    })
    .toBe(true);
});

test('reordering by hand adds to the history instead of discarding the answers', async ({ page }) => {
  await enterData(page, DINNERS);
  await startRanking(page);
  await page
    .getByLabel(/^Choose /)
    .first()
    .click();
  await expect(page.getByText('1 answer so far')).toBeVisible();

  // Keyboard reordering is the same commit path as a drop, and is stable to drive.
  await page
    .getByRole('button', { name: /^Reorder / })
    .first()
    .focus();
  await page.keyboard.press('Alt+ArrowDown');

  // The move is recorded as one placement beside its new neighbour, so the
  // earlier pick survives rather than being thrown away and re-seeded. A
  // placement is not an answer, so the count stays; an undo takes back the
  // move alone, and the answer before it is still there.
  await expect(page.getByText('1 answer so far')).toBeVisible();
  await page.getByRole('button', { name: 'Undo last change' }).click();
  await expect(page.getByText('1 answer so far')).toBeVisible();
  await page.getByRole('button', { name: 'Undo last change' }).click();
  await expect(page.getByText('0 answers so far')).toBeVisible();
});

test('reordering applies immediately, with no confirmation to clear', async ({ page }) => {
  await enterData(page, DINNERS);
  await startRanking(page);

  await page.getByRole('button', { name: /^Reorder Tacos/ }).focus();
  await page.keyboard.press('Alt+ArrowDown');

  await expect(page.getByRole('button', { name: /^Reorder Tacos, position 2/ })).toBeVisible();
});

/**
 * The pointer path cannot be exercised in jsdom, which has no layout. It also
 * had a real bug: rows are measured against the scrolling content while
 * pointer events report viewport coordinates, and mixing the two sent every
 * drag to the last row.
 */
test('a drag shows where the row will land, and moves it on release', async ({ page }) => {
  await enterData(page, DINNERS);
  await startRanking(page);

  const rows = page.getByRole('listitem');
  await expect(rows.first()).toContainText('Tacos');

  const grip = page.getByRole('button', { name: /^Reorder Tacos/ });
  const box = await grip.boundingBox();
  if (box === null) throw new Error('The grip should be laid out.');

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 40, { steps: 5 });
  await page.mouse.move(x, y + 80, { steps: 5 });

  // The line marks the destination; the rows themselves hold still.
  await expect(page.locator('[data-insertion]')).toBeVisible();
  await expect(rows.first()).toContainText('Tacos');

  await page.mouse.up();

  await expect(page.locator('[data-insertion]')).toBeHidden();
  await expect(rows.first()).toContainText('Ramen');
  await expect(rows.nth(1)).toContainText('Tacos');
});

test('a drag that goes nowhere leaves the order alone', async ({ page }) => {
  await enterData(page, DINNERS);
  await startRanking(page);

  const grip = page.getByRole('button', { name: /^Reorder Tacos/ });
  const box = await grip.boundingBox();
  if (box === null) throw new Error('The grip should be laid out.');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 4, { steps: 3 });

  // No line, because dropping here would change nothing.
  await expect(page.locator('[data-insertion]')).toBeHidden();
  await page.mouse.up();

  await expect(page.getByRole('listitem').first()).toContainText('Tacos');
});

test('a row held at the edge of the list carries it past the rows on screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await enterData(page, Array.from({ length: 300 }, (_, i) => `Item ${i + 1}`).join('\n'));
  await startRanking(page);

  const list = page.getByRole('list');
  const grip = page.getByRole('button', { name: /^Reorder Item 1,/ });
  const listBox = await list.boundingBox();
  const gripBox = await grip.boundingBox();
  if (listBox === null || gripBox === null) throw new Error('The list should be laid out.');

  const x = gripBox.x + gripBox.width / 2;
  await page.mouse.move(x, gripBox.y + gripBox.height / 2);
  await page.mouse.down();
  // Held just inside the bottom edge, the list scrolls on its own.
  await page.mouse.move(x, listBox.y + listBox.height - 4, { steps: 10 });
  await expect.poll(() => list.evaluate((el) => el.scrollTop), { timeout: 5000 }).toBeGreaterThan(2000);
  await page.mouse.up();

  const label = await page.getByRole('button', { name: /^Reorder Item 1,/ }).getAttribute('aria-label');
  const position = Number(/position (\d+)/.exec(label ?? '')?.[1]);
  // Far below the eight or so rows the sidebar shows at once.
  expect(position).toBeGreaterThan(30);
});

test('alt with Home or End sends a row to the top or bottom of the list', async ({ page }) => {
  await enterData(page, DINNERS);
  await startRanking(page);

  await page.getByRole('button', { name: /^Reorder Curry/ }).focus();
  await page.keyboard.press('Alt+Home');
  await expect(page.getByRole('listitem').first()).toContainText('Curry');

  await page.getByRole('button', { name: /^Reorder Curry/ }).focus();
  await page.keyboard.press('Alt+End');
  await expect(page.getByRole('listitem').last()).toContainText('Curry');
});

test('a file dropped on the ranking screen opens a saved session, and nothing else', async ({ page }) => {
  await loadSample(page, 'movies');
  await startRanking(page);
  await page
    .getByLabel(/^Choose /)
    .first()
    .click();
  await expect(page.getByText('1 answer so far')).toBeVisible();

  // Keeps the file Save session writes, to drop back on the page.
  await page.evaluate(() => {
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob) => {
      (window as Window & { savedBlob?: Blob }).savedBlob = blob;
      return create(blob);
    };
  });
  await page.getByRole('button', { name: 'Save this session to a file' }).click();
  const session = await page.evaluate(
    () => (window as Window & { savedBlob?: Blob }).savedBlob?.text() ?? '',
  );
  expect(session).toContain('pairwise-list-ranker-session');

  await startFileDrag(page, 'Drop a saved session to open it');
  await dropFile(page, 'notes.json', '["Tacos", "Ramen"]');
  await expect(
    page.getByText('"notes.json" is not a saved session. To rank a new list, use Start over and paste it.'),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/rank$/);
  await page.getByRole('button', { name: 'Dismiss' }).click();

  await startFileDrag(page, 'Drop a saved session to open it');
  await dropFile(page, 'pairwise-session.json', session);
  // There is a decision on the line, so it asks before replacing anything.
  await page.getByRole('button', { name: 'Replace with the saved session' }).click();
  await expect(page.getByText(/^Opened the session: 10 items · 1 change/)).toBeVisible();
});

test('a long list does not make the layout flicker or the page scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const songs = Array.from({ length: 800 }, (_, i) => `Song number ${i}`).join('\n');
  await enterData(page, songs);
  await startRanking(page);
  await expect(page.getByRole('region', { name: 'Current ranking' })).toBeVisible();

  // The loop this guards against: a page scrollbar appearing narrows the
  // layout, which changes the content height, which removes the scrollbar.
  // Sample the preview's width over time; a loop would show more than one value.
  const widths = new Set<number>();
  for (let i = 0; i < 20; i += 1) {
    const box = await page.getByRole('region', { name: 'Current ranking' }).boundingBox();
    if (box !== null) widths.add(Math.round(box.width));
    await page.waitForTimeout(50);
  }
  expect(widths.size).toBe(1);

  // Windowed: nowhere near all 800 rows are in the DOM.
  const mounted = await page.getByRole('listitem').count();
  expect(mounted).toBeLessThan(120);

  const overflowX = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflowX).toBe(false);
});

test('a phone-width screen never scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadSample(page, 'movies');
  const overflowsX = () =>
    page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(await overflowsX()).toBe(false);

  await startRanking(page);
  await expect(page.getByLabel(/^Choose /).first()).toBeVisible();
  expect(await overflowsX()).toBe(false);
  // The shortcut line wraps between keycaps, never through one or past the edge.
  const keycaps = await page.locator('[data-keycap]').evaluateAll((caps) =>
    caps.map((cap) => {
      const rects = [...cap.getClientRects()];
      return {
        text: cap.textContent,
        pieces: rects.length,
        inside: rects.every((rect) => rect.left >= 0 && rect.right <= window.innerWidth),
      };
    }),
  );
  expect(keycaps.length).toBeGreaterThan(0);
  for (const cap of keycaps) expect(cap, `keycap ${cap.text}`).toMatchObject({ pieces: 1, inside: true });
  expect(await overflowsX()).toBe(false);

  // The start-over prompt adds buttons to the header, which is when it was widest.
  await page.getByRole('button', { name: 'Start over' }).click();
  expect(await overflowsX()).toBe(false);
});

/**
 * Where an element comes to rest. A new pair lays out over a frame or two, and
 * under load a single reading can catch it part way; the settled position is
 * the one a pointer aims at.
 */
async function settledTop(locator: import('@playwright/test').Locator): Promise<number> {
  let previous: number | null = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const box = await locator.boundingBox();
    if (box === null) throw new Error('Expected the element to be laid out.');
    const top = Math.round(box.y);
    if (top === previous) return top;
    previous = top;
    await locator.page().waitForTimeout(100);
  }
  throw new Error('The element never settled.');
}

test('the controls under the cards never move up from one pair to the next', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loadSample(page, 'movies');
  await startRanking(page);

  const skip = page.getByRole('button', { name: "Can't decide" });
  const positions: number[] = [];
  for (let pair = 0; pair < 10; pair += 1) {
    await expect(page.getByLabel(/^Choose /).first()).toBeVisible();
    positions.push(await settledTop(skip));
    await page.keyboard.press(pair % 2 === 0 ? 'ArrowLeft' : 'ArrowRight');
    await expect(page.getByText(new RegExp(`^${pair + 1} answers? so far$`))).toBeVisible();
  }

  // Taller pairs may push it down once; nothing ever pulls it back up.
  for (let i = 1; i < positions.length; i += 1) {
    expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]!);
  }
});

test('on a phone, a stacked card shows every chosen field', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadSample(page, 'movies');
  // The sample shows a dozen fields, more than two cards can hold on one
  // screen, and the preview says so before ranking starts.
  await continueToSetup(page);
  await expect(page.getByText(/^Some pairs will not fit on this screen together/)).toBeVisible();
  await startRanking(page);

  const card = page.getByLabel(/^Choose /).first();
  await expect(card.getByText('Rotten tomatoes:')).toBeVisible();
  await expect(card.getByText('IMDB URL:')).toBeVisible();
});

test('the card preview draws the cards the ranking screen will', async ({ browser }) => {
  const pictureWidth = (scope: ReturnType<Page['locator']>) =>
    scope
      .locator('img')
      .first()
      .evaluate((img) => Math.round(img.getBoundingClientRect().width));

  for (const [width, height] of [
    [1440, 900],
    [1180, 820],
    [1024, 768],
    [820, 1180],
    [390, 844],
  ] as const) {
    // A fresh browser each time, so no saved list sends the page to ranking.
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto('/');
    await loadSample(page, 'movies');
    await continueToSetup(page);
    const preview = page.locator('[data-surface="card"]').first();
    await expect(preview.locator('img').first()).toBeVisible();
    const previewed = await pictureWidth(preview);

    await startRanking(page);
    const card = page.getByLabel(/^Choose /).first();
    await expect(card.locator('img').first()).toBeVisible();
    expect(await pictureWidth(card), `picture size at ${width} x ${height}`).toBe(previewed);

    await context.close();
  }
});

test('a field name stays on one line beside a long link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadSample(page, 'games');
  await startRanking(page);
  await page.getByRole('switch', { name: 'Show details on both cards' }).click();

  const name = page
    .getByLabel(/^Choose /)
    .first()
    .getByText('Store URL:', { exact: true });
  await expect(name).toBeVisible();
  const { height, fontSize } = await name.evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    fontSize: parseFloat(getComputedStyle(el).fontSize),
  }));
  expect(height).toBeLessThan(fontSize * 2);
});

test('on a phone, the setup screen keeps its main button on screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadSample(page, 'movies');
  await continueToSetup(page);

  const start = page.getByRole('button', { name: 'Start ranking' });
  await expect(start).toHaveCount(1);
  await expect(start).toBeInViewport({ ratio: 1 });

  await page.mouse.wheel(0, 3000);
  await expect(start).toBeInViewport({ ratio: 1 });

  await start.click();
  await expect(page).toHaveURL(/\/rank$/);
});

test('on a phone, the setup screen scrolls as one page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadSample(page, 'movies');
  await continueToSetup(page);
  await expect(page.getByText('What we found')).toBeVisible();

  // Only the page itself scrolls: no box inside it with a scroll of its own.
  const scrollers = await page.evaluate(
    () =>
      [...document.querySelectorAll('div')].filter(
        (el) =>
          el.scrollHeight > el.clientHeight + 10 &&
          ['auto', 'scroll'].includes(getComputedStyle(el).overflowY),
      ).length,
  );
  expect(scrollers).toBe(1);
});

test('on a desktop window, the controls under the cards are on screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loadSample(page, 'movies');
  await startRanking(page);

  await expect(page.getByRole('button', { name: "Can't decide" })).toBeInViewport({ ratio: 1 });
});

test('every page names itself in the title', async ({ page }) => {
  await expect(page).toHaveTitle('Pairwise: add a list');

  await loadSample(page, 'movies');
  await startRanking(page);
  await expect(page).toHaveTitle('Pairwise: ranking movies');

  await page.getByRole('button', { name: 'List setup' }).click();
  await expect(page).toHaveTitle('Pairwise: list setup');
});

test('each screen is laid out under headings a screen reader can jump between', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Pairwise' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Add your list' })).toBeVisible();

  await loadSample(page, 'movies');
  await continueToSetup(page);
  await expect(page.getByRole('heading', { level: 2, name: 'What we found' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Fields' })).toBeVisible();

  await startRanking(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Your data' })).toBeVisible();
  // Each card is titled by a heading, so the pair can be read one item at a time.
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(3);
});

test('everything on screen sits inside a landmark', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loadSample(page, 'movies');

  // What axe's "region" rule asks: no visible text or control outside the
  // banner, the main region or the sidebar. The sidebar's resize handle,
  // which only the split view has, was the one thing that strayed.
  const outside = () =>
    page.evaluate(() => {
      const landmark = '[role="banner"], [role="main"], [role="complementary"], header, main, aside';
      const visible = (el: Element) => {
        const box = el.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      };
      return [...document.body.querySelectorAll('[role], button, input, textarea, a')]
        .concat(
          [...document.body.querySelectorAll('div, span')].filter((el) =>
            [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent!.trim() !== ''),
          ),
        )
        .filter(
          (el) => visible(el) && el.closest(landmark) === null && el.closest('[role="dialog"]') === null,
        )
        .map((el) => el.getAttribute('aria-label') ?? el.textContent?.slice(0, 40) ?? el.tagName);
    });

  await expect(page.getByRole('separator', { name: 'Resize sidebar' })).toBeVisible();
  expect(await outside()).toEqual([]);

  await startRanking(page);
  await expect(page.getByLabel(/^Choose /).first()).toBeVisible();
  expect(await outside()).toEqual([]);
  expect(await outside()).toEqual([]);
});

test('each card is a named group a keyboard user can choose with Enter', async ({ page }) => {
  await enterData(page, DINNERS);
  await startRanking(page);

  const cards = page.getByRole('group', { name: /^Choose / });
  await expect(cards).toHaveCount(2);

  await cards.first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('1 answer so far')).toBeVisible();
  // Focus stays on the left card as the next pair arrives.
  await expect(cards.first()).toBeFocused();
});

const TWELVE = [
  'Alpha',
  'Bravo',
  'Charlie',
  'Delta',
  'Echo',
  'Foxtrot',
  'Golf',
  'Hotel',
  'India',
  'Juliet',
  'Kilo',
  'Lima',
];

test('"Don\'t recognize…" moves an item under "Didn\'t recognize"', async ({ page }) => {
  await enterData(page, DINNERS);
  await startRanking(page);

  const left = page.getByLabel(/^Choose /).first();
  const name = ((await left.getAttribute('aria-label')) ?? '').replace(/^Choose /, '');
  await expect(page.getByRole('button', { name: new RegExp(`^Reorder ${name},`) })).toBeVisible();

  await page.getByRole('button', { name: "Don't recognize…" }).click();
  await page.getByLabel(`Don't recognize ${name}`).click();

  await expect(page.getByText("Didn't recognize", { exact: true })).toBeVisible();
  await expect(page.getByRole('listitem').last()).toContainText(name);
  await expect(page.getByRole('button', { name: new RegExp(`^Reorder ${name},`) })).toHaveCount(0);
  // A mark is not an answer.
  await expect(page.getByText('0 answers so far')).toBeVisible();
});

/** The name of the button drawn at a point on the page, if any. */
async function buttonAt(page: Page, x: number, y: number): Promise<string | null> {
  return page.evaluate(
    ([px, py]) =>
      document.elementFromPoint(px!, py!)?.closest('[role="button"]')?.getAttribute('aria-label') ?? null,
    [x, y],
  );
}

for (const [screenName, size] of [
  ['a wide screen', { width: 1440, height: 900 }],
  ['a phone', { width: 390, height: 844 }],
  ['a 360px phone', { width: 360, height: 780 }],
  ['a 320px phone', { width: 320, height: 640 }],
] as const) {
  test(`on ${screenName}, a second click where "Don't recognize…" was pressed is Cancel`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await enterData(page, TWELVE.join('\n'));
    await startRanking(page);
    await expect(page.getByLabel(/^Choose /).first()).toBeVisible();

    // Every half sits whole between the screen's edges, armed or not.
    for (const armed of [false, true]) {
      if (armed) await page.getByRole('button', { name: "Don't recognize…" }).click();
      const names = armed ? ["Don't recognize either", 'Cancel'] : ["Can't decide", "Don't recognize…"];
      for (const name of names) {
        const half = await page.getByRole('button', { name, exact: true }).boundingBox();
        if (half === null) throw new Error(`Expected "${name}" to be laid out.`);
        expect(half.x, name).toBeGreaterThanOrEqual(0);
        expect(half.x + half.width, name).toBeLessThanOrEqual(size.width);
      }
      if (armed) await page.getByRole('button', { name: 'Cancel' }).click();
    }
    // Across the half, edge to edge: wherever the pointer was, it is over Cancel.
    for (const across of [0.05, 0.5, 0.95]) {
      const arm = page.getByRole('button', { name: "Don't recognize…" });
      await arm.scrollIntoViewIfNeeded();
      const box = await arm.boundingBox();
      if (box === null) throw new Error('Expected "Don\'t recognize…" to be laid out.');
      const x = box.x + box.width * across;
      const y = box.y + box.height / 2;
      await page.mouse.click(x, y);
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

      expect(await buttonAt(page, x, y), `${across} across`).toBe('Cancel');
      await page.mouse.click(x, y);
      await expect(page.getByRole('button', { name: "Don't recognize…" })).toBeVisible();
    }
    // Nothing was marked.
    await expect(page.getByText("Didn't recognize", { exact: true })).toHaveCount(0);
  });
}

/** Marks the left card's item "don't recognize" and returns its name. */
async function markLeftCard(page: Page): Promise<string> {
  const left = page.getByLabel(/^Choose /).first();
  const name = ((await left.getAttribute('aria-label')) ?? '').replace(/^Choose /, '');
  await expect(page.getByRole('button', { name: new RegExp(`^Reorder ${name},`) })).toBeVisible();
  await page.getByRole('button', { name: "Don't recognize…" }).click();
  await page.getByLabel(`Don't recognize ${name}`).click();
  await expect(page.getByRole('button', { name: new RegExp(`^Move ${name} back`) })).toBeVisible();
  return name;
}

async function centreOf(locator: import('@playwright/test').Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('Expected it to be laid out.');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, top: box.y };
}

test('a "Didn\'t recognize" row dragged up rejoins the ranking where it was dropped, and undo puts it back under the divider', async ({
  page,
}) => {
  await enterData(page, DINNERS);
  await startRanking(page);
  const name = await markLeftCard(page);

  const rows = page.getByRole('listitem');
  const above = (await rows.nth(0).textContent()) ?? '';
  const below = (await rows.nth(1).textContent()) ?? '';
  const grip = await centreOf(page.getByRole('button', { name: new RegExp(`^Move ${name} back`) }));
  const target = await centreOf(rows.nth(1));

  // Just inside the top of the second ranked row: the gap between the first two.
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x, target.top + 10, { steps: 10 });
  await expect(page.locator('[data-insertion]')).toBeVisible();
  await page.mouse.up();

  await expect(page.getByText("Didn't recognize", { exact: true })).toBeHidden();
  await expect(rows.nth(1)).toContainText(name);
  expect(await rows.nth(0).textContent()).toBe(above);
  expect((await rows.nth(2).textContent())?.replace(/\d/g, '')).toBe(below.replace(/\d/g, ''));
  // A placement is not an answer.
  await expect(page.getByText('0 answers so far')).toBeVisible();

  await page.getByRole('button', { name: 'Undo last change' }).click();
  await expect(page.getByText("Didn't recognize", { exact: true })).toBeVisible();
  await expect(rows.last()).toContainText(name);
  await expect(page.getByRole('button', { name: new RegExp(`^Move ${name} back`) })).toBeVisible();
});

test('dropped inside its own section, it stays and nothing is recorded', async ({ page }) => {
  await enterData(page, DINNERS);
  await startRanking(page);
  const name = await markLeftCard(page);

  const grip = await centreOf(page.getByRole('button', { name: new RegExp(`^Move ${name} back`) }));
  const divider = await centreOf(page.getByText("Didn't recognize", { exact: true }));

  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x, grip.y + 6, { steps: 3 });
  await expect(page.locator('[data-insertion]')).toBeHidden();
  await page.mouse.move(grip.x, divider.y, { steps: 5 });
  await expect(page.locator('[data-insertion]')).toBeHidden();
  await page.mouse.up();

  await expect(page.getByText("Didn't recognize", { exact: true })).toBeVisible();
  await expect(page.getByRole('listitem').last()).toContainText(name);
  // Nothing was recorded: one undo takes back the mark itself.
  await page.getByRole('button', { name: 'Undo last change' }).click();
  await expect(page.getByText("Didn't recognize", { exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: new RegExp(`^Reorder ${name},`) })).toBeVisible();
});

test('a cold build runs in a Web Worker in the exported site and restores to the replay', async ({
  page,
}) => {
  const list = drivenHistory({ n: 30, events: 150, seed: 11, user: 'typical', mix: { placement: 0.05 } });
  const workers: string[] = [];
  page.on('worker', (worker) => workers.push(worker.url()));
  // An ordinary visit carries no test hook.
  expect(await page.evaluate(() => typeof window.__pairwiseColdBuild)).toBe('undefined');
  // The probe is installed only for a page opened with ?e2e-hooks.
  await page.goto('/?e2e-hooks');
  await page.waitForFunction(() => window.__pairwiseColdBuild !== undefined);

  const result = await page.evaluate((history) => window.__pairwiseColdBuild?.(history), list);

  expect(result?.via).toBe('worker');
  expect(workers).toHaveLength(1);
  expect(result?.coveredEvents).toBe(list.events.length);
  expect(result?.ranked).toEqual(replay(list).ranked);
});

test('a cold build falls back to main-thread slices when the worker script cannot load', async ({ page }) => {
  // As for a page left open across a deploy, whose worker script is gone.
  await page.route(/\/coldBuild-[0-9a-f]+\.js$/, (route) => route.fulfill({ status: 404 }));
  const list = drivenHistory({ n: 20, events: 80, seed: 12, user: 'typical', mix: { placement: 0.05 } });
  // The probe is installed only for a page opened with ?e2e-hooks.
  await page.goto('/?e2e-hooks');
  await page.waitForFunction(() => window.__pairwiseColdBuild !== undefined);

  const result = await page.evaluate((history) => window.__pairwiseColdBuild?.(history), list);

  expect(result?.via).toBe('slices');
  expect(result?.coveredEvents).toBe(list.events.length);
  expect(result?.ranked).toEqual(replay(list).ranked);
});
