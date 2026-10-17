import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

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
  await expect(page.getByRole('button', { name: 'Start ranking' })).toHaveAttribute('aria-disabled', 'true');
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
  await page.getByRole('button', { name: 'Start ranking' }).click();

  await expect(page.getByLabel(/^Choose /).first()).toBeVisible();
  await page
    .getByLabel(/^Choose /)
    .first()
    .click();

  await page.getByRole('tab', { name: 'Plain list' }).click();
  await expect(page.getByLabel('list export')).toContainText('Tacos');
});

test('keeps the whole document when ranking one array inside it', async ({ page }) => {
  await enterData(page, FILMS);
  await page.getByRole('button', { name: 'Start ranking' }).click();

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
  await page.getByRole('button', { name: 'Start ranking' }).click();
  await expect(page.getByRole('button', { name: 'Edit data' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit data' })).toBeVisible();

  await page.getByRole('button', { name: 'Start over' }).click();
  await page.getByRole('button', { name: 'Confirm start over' }).click();

  await expect(page.getByLabel('Your list')).toBeVisible();
});

test('edits the data mid-run and keeps the rankings', async ({ page }) => {
  await enterData(page, DINNERS);
  await page.getByRole('button', { name: 'Start ranking' }).click();
  await page
    .getByLabel(/^Choose /)
    .first()
    .click();

  await page.getByRole('button', { name: 'Edit data' }).click();
  await enterData(page, `${DINNERS}\nUdon`);
  await page.getByRole('button', { name: 'Apply edits' }).click();

  await expect(page.getByText(/4 items unchanged/)).toBeVisible();
  await expect(page.getByText(/1 item added/)).toBeVisible();
});

test('chooses by clicking anywhere on a card', async ({ page }) => {
  await enterData(page, DINNERS);
  await page.getByRole('button', { name: 'Start ranking' }).click();

  await expect(page.getByText(/^0 comparisons ·/)).toBeVisible();
  await page
    .getByLabel(/^Choose /)
    .first()
    .click();

  await expect(page.getByText(/^1 comparison ·/)).toBeVisible();
});

/**
 * jsdom cannot prove this: React Native's responder system may already stop the
 * press, but only a real browser has the DOM click bubbling that the guard is
 * there to defeat.
 */
test('pressing a control inside a card does not cast a vote', async ({ page }) => {
  await enterData(page, FILMS);
  await page.getByRole('button', { name: 'Start ranking' }).click();

  await expect(page.getByText(/^0 comparisons ·/)).toBeVisible();
  // The delete control is the remaining control nested inside the press area.
  await page
    .getByRole('button', { name: /^Delete / })
    .first()
    .click();

  await expect(page.getByRole('button', { name: /^Confirm deleting / })).toBeVisible();
  await expect(page.getByText(/^0 comparisons ·/)).toBeVisible();
});

test('details open on both cards from one toggle', async ({ page }) => {
  await enterData(page, FILMS);
  // A card shows only its title until a field is ticked for it.
  await page.getByRole('checkbox', { name: 'Show year on cards' }).click();
  await page.getByRole('button', { name: 'Start ranking' }).click();

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
  await page.getByRole('button', { name: 'Start ranking' }).click();

  await page
    .getByRole('button', { name: /is much better$/ })
    .first()
    .click();

  await expect(page.getByText(/^1 comparison ·/)).toBeVisible();
});

test('choice cards return to one row after rotating back to landscape', async ({ page }) => {
  await page.setViewportSize({ width: 1194, height: 834 });
  await enterData(page, DINNERS);
  await page.getByRole('button', { name: 'Start ranking' }).click();

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

test('reordering by hand adds to the comparisons instead of discarding them', async ({ page }) => {
  await enterData(page, DINNERS);
  await page.getByRole('button', { name: 'Start ranking' }).click();
  await page
    .getByLabel(/^Choose /)
    .first()
    .click();
  await expect(page.getByText(/^1 comparison ·/)).toBeVisible();

  // Keyboard reordering is the same commit path as a drop, and is stable to drive.
  await page
    .getByRole('button', { name: /^Reorder / })
    .first()
    .focus();
  await page.keyboard.press('Alt+ArrowDown');

  // The move is recorded as one placement beside its new neighbour, so the
  // earlier pick survives rather than being thrown away and re-seeded.
  await expect(page.getByText(/^2 comparisons ·/)).toBeVisible();
});

test('reordering applies immediately, with no confirmation to clear', async ({ page }) => {
  await enterData(page, DINNERS);
  await page.getByRole('button', { name: 'Start ranking' }).click();

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
  await page.getByRole('button', { name: 'Start ranking' }).click();

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
  await page.getByRole('button', { name: 'Start ranking' }).click();

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
  await page.getByRole('button', { name: 'Start ranking' }).click();

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
  await page.getByRole('button', { name: 'Start ranking' }).click();

  await page.getByRole('button', { name: /^Reorder Curry/ }).focus();
  await page.keyboard.press('Alt+Home');
  await expect(page.getByRole('listitem').first()).toContainText('Curry');

  await page.getByRole('button', { name: /^Reorder Curry/ }).focus();
  await page.keyboard.press('Alt+End');
  await expect(page.getByRole('listitem').last()).toContainText('Curry');
});

test('a file dropped on the ranking screen opens a saved session, and nothing else', async ({ page }) => {
  await page.getByRole('button', { name: 'Load the movies sample' }).click();
  await page.getByRole('button', { name: 'Start ranking' }).click();
  await page
    .getByLabel(/^Choose /)
    .first()
    .click();
  await expect(page.getByText(/^1 comparison ·/)).toBeVisible();

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
    page.getByText('"notes.json" is not a saved session. To rank a new list, use Edit data.'),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/rank$/);
  await page.getByRole('button', { name: 'Dismiss' }).click();

  await startFileDrag(page, 'Drop a saved session to open it');
  await dropFile(page, 'movies-session.json', session);
  // There is a decision on the line, so it asks before replacing anything.
  await page.getByRole('button', { name: 'Replace with the saved session' }).click();
  await expect(page.getByText(/^Opened the session: 10 items · 1 decision/)).toBeVisible();
});

test('editing an entry leaves it where the user put it', async ({ page }) => {
  await enterData(page, DINNERS);
  await page.getByRole('button', { name: 'Start ranking' }).click();
  await expect(page.getByRole('listitem').first()).toContainText('Tacos');

  await page.getByRole('button', { name: 'Edit data' }).click();
  await enterData(page, 'Tostadas\nRamen\nCurry\nPho');
  await page.getByRole('button', { name: 'Apply edits' }).click();
  await page.getByRole('button', { name: /^Apply edits$/ }).click();

  // The edited entry keeps first place rather than falling to the bottom.
  await expect(page.getByRole('listitem').first()).toContainText('Tostadas');
});

test('reordering the text is reported as an order change', async ({ page }) => {
  await enterData(page, DINNERS);
  await page.getByRole('button', { name: 'Start ranking' }).click();

  await page.getByRole('button', { name: 'Edit data' }).click();
  await enterData(page, 'Pho\nCurry\nRamen\nTacos');
  await page.getByRole('button', { name: 'Apply edits' }).click();

  await expect(page.getByText(/order changed/i)).toBeVisible();
  await expect(page.getByText(/nothing changed/i)).toBeHidden();

  await page.getByRole('button', { name: /^Apply edits$/ }).click();

  await expect(page.getByRole('listitem').first()).toContainText('Pho');
});

test('a long list does not make the layout flicker or the page scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const songs = Array.from({ length: 800 }, (_, i) => `Song number ${i}`).join('\n');
  await enterData(page, songs);
  await page.getByRole('button', { name: 'Start ranking' }).click();
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
  await page.getByRole('button', { name: 'Load the movies sample' }).click();
  const overflowsX = () =>
    page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(await overflowsX()).toBe(false);

  await page.getByRole('button', { name: 'Start ranking' }).click();
  await expect(page.getByLabel(/^Choose /).first()).toBeVisible();
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
  await page.getByRole('button', { name: 'Load the movies sample' }).click();
  await page.getByRole('button', { name: 'Start ranking' }).click();

  const skip = page.getByRole('button', { name: 'Skip this pair' });
  const positions: number[] = [];
  for (let pair = 0; pair < 10; pair += 1) {
    await expect(page.getByLabel(/^Choose /).first()).toBeVisible();
    positions.push(await settledTop(skip));
    await page.keyboard.press(pair % 2 === 0 ? 'ArrowLeft' : 'ArrowRight');
    await expect(page.getByText(new RegExp(`^${pair + 1} comparisons? ·`))).toBeVisible();
  }

  // Taller pairs may push it down once; nothing ever pulls it back up.
  for (let i = 1; i < positions.length; i += 1) {
    expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]!);
  }
});

test('on a phone, a stacked card shows every chosen field', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Load the movies sample' }).click();
  // The sample shows a dozen fields, more than two cards can hold on one
  // screen, and the preview says so before ranking starts.
  await expect(page.getByText(/^Some pairs will not fit on this screen together/)).toBeVisible();
  await page.getByRole('button', { name: 'Start ranking' }).click();

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
    await page.getByRole('button', { name: 'Load the movies sample' }).click();
    const preview = page.locator('[data-surface="card"]').first();
    await expect(preview.locator('img').first()).toBeVisible();
    const previewed = await pictureWidth(preview);

    await page.getByRole('button', { name: 'Start ranking' }).click();
    const card = page.getByLabel(/^Choose /).first();
    await expect(card.locator('img').first()).toBeVisible();
    expect(await pictureWidth(card), `picture size at ${width} x ${height}`).toBe(previewed);

    await context.close();
  }
});

test('a field name stays on one line beside a long link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Load the games sample' }).click();
  await page.getByRole('button', { name: 'Start ranking' }).click();
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
  await page.getByRole('button', { name: 'Load the movies sample' }).click();

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
  await page.getByRole('button', { name: 'Load the movies sample' }).click();
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
  await page.getByRole('button', { name: 'Load the movies sample' }).click();
  await page.getByRole('button', { name: 'Start ranking' }).click();

  await expect(page.getByLabel(/^Choose /).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip this pair' })).toBeInViewport({ ratio: 1 });
});

test('every page names itself in the title', async ({ page }) => {
  await expect(page).toHaveTitle('Pairwise: add a list');

  await page.getByRole('button', { name: 'Load the movies sample' }).click();
  await page.getByRole('button', { name: 'Start ranking' }).click();
  await expect(page).toHaveTitle('Pairwise: ranking movies');

  await page.getByRole('button', { name: 'Edit data' }).click();
  await expect(page).toHaveTitle('Pairwise: edit data');
});

test('each screen is laid out under headings a screen reader can jump between', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Pairwise' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Add your list' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'What we found' })).toBeVisible();

  await page.getByRole('button', { name: 'Load the movies sample' }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Fields' })).toBeVisible();

  await page.getByRole('button', { name: 'Start ranking' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Your data' })).toBeVisible();
  // Each card is titled by a heading, so the pair can be read one item at a time.
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(3);
});

test('everything on screen sits inside a landmark', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Load the movies sample' }).click();

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

  await page.getByRole('button', { name: 'Start ranking' }).click();
  await expect(page.getByLabel(/^Choose /).first()).toBeVisible();
  expect(await outside()).toEqual([]);
});

test('each card is a named group a keyboard user can choose with Enter', async ({ page }) => {
  await enterData(page, DINNERS);
  await page.getByRole('button', { name: 'Start ranking' }).click();

  const cards = page.getByRole('group', { name: /^Choose / });
  await expect(cards).toHaveCount(2);

  await cards.first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/^1 comparison ·/)).toBeVisible();
  // Focus stays on the left card as the next pair arrives.
  await expect(cards.first()).toBeFocused();
});
