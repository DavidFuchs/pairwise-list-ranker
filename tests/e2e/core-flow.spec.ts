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
  const duringDrag = await page.evaluate(async () => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(['Alpha\nBeta\nGamma'], 'list.txt', { type: 'text/plain' }));
    const eventInit = { bubbles: true, cancelable: true, dataTransfer, clientX: 5, clientY: 5 };
    document.body.dispatchEvent(new DragEvent('dragenter', eventInit));
    await new Promise((resolve) => setTimeout(resolve, 50));
    return document.body.textContent?.includes('Drop to import') ?? false;
  });
  expect(duringDrag).toBe(true);
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
  const stillShown = await page.evaluate(async () => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(['x'], 'a.txt', { type: 'text/plain' }));
    document.body.dispatchEvent(
      new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer }),
    );
    await new Promise((resolve) => setTimeout(resolve, 30));

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

  await expect(page.getByText(/^1 comparisons ·/)).toBeVisible();
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
  await expect(alien.getByText('year: 1979')).toBeVisible();
  await expect(arrival.getByText('year: 2016')).toBeVisible();

  await page.getByRole('switch', { name: 'Show details on both cards' }).click();

  // Expanded, both cards show every field in full, and the chosen summary
  // fields stay put above them.
  await expect(alien.getByText('year: 1979')).toBeVisible();
  await expect(arrival.getByText('year: 2016')).toBeVisible();
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

  await expect(page.getByText(/^1 comparisons ·/)).toBeVisible();
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
  await expect(page.getByText(/^1 comparisons ·/)).toBeVisible();

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

test('the controls under the cards never move up from one pair to the next', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Load the movies sample' }).click();
  await page.getByRole('button', { name: 'Start ranking' }).click();

  const skip = page.getByRole('button', { name: 'Skip this pair' });
  const positions: number[] = [];
  for (let pair = 0; pair < 10; pair += 1) {
    await expect(page.getByLabel(/^Choose /).first()).toBeVisible();
    const box = await skip.boundingBox();
    if (box === null) throw new Error('Expected Skip to be laid out.');
    positions.push(Math.round(box.y));
    await page.keyboard.press(pair % 2 === 0 ? 'ArrowLeft' : 'ArrowRight');
    await expect(page.getByText(new RegExp(`^${pair + 1} comparisons ·`))).toBeVisible();
  }

  // Taller pairs may push it down once; nothing ever pulls it back up.
  for (let i = 1; i < positions.length; i += 1) {
    expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]!);
  }
});

test('on a phone, a whole decision fits on one screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Load the movies sample' }).click();
  await page.getByRole('button', { name: 'Start ranking' }).click();

  const cards = page.getByLabel(/^Choose /);
  await expect(cards.first()).toBeVisible();
  await expect(cards.nth(1)).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Skip this pair' })).toBeInViewport({ ratio: 1 });

  // Details are a tap away, and bring back every field the card set aside.
  await page.getByRole('switch', { name: 'Show details on both cards' }).click();
  await expect(cards.first().getByText('rotten_tomatoes:')).toBeVisible();
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
