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
  await expect(page.getByRole('button', { name: 'Start ranking' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
});

test('ranks a plain list and exports it', async ({ page }) => {
  await enterData(page, DINNERS);
  await page.getByRole('button', { name: 'Start ranking' }).click();

  await expect(page.getByLabel(/^Choose /).first()).toBeVisible();
  await page.getByLabel(/^Choose /).first().click();

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
  await page.getByLabel(/^Choose /).first().click();

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
  await page.getByLabel(/^Choose /).first().click();

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
  await page.getByRole('button', { name: /^Delete / }).first().click();

  await expect(page.getByRole('button', { name: /^Confirm deleting / })).toBeVisible();
  await expect(page.getByText(/^0 comparisons ·/)).toBeVisible();
});

test('details open on both cards from one toggle', async ({ page }) => {
  await enterData(page, FILMS);
  await page.getByRole('button', { name: 'Start ranking' }).click();

  // Scoped to the cards: the ranked list shows the same fields in its own rows.
  const alien = page.getByLabel('Choose Alien');
  const arrival = page.getByLabel('Choose Arrival');

  // Collapsed, each card summarises its fields as chips.
  await expect(alien.getByText('year: 1979')).toBeVisible();
  await expect(arrival.getByText('year: 2016')).toBeVisible();

  await page.getByRole('switch', { name: 'Show details on both cards' }).click();

  // Expanded, both cards show the fields in full and the chips step aside.
  await expect(alien.getByText('year: 1979')).toBeHidden();
  await expect(arrival.getByText('year: 2016')).toBeHidden();
  await expect(alien.getByText('1979', { exact: true })).toBeVisible();
  await expect(arrival.getByText('2016', { exact: true })).toBeVisible();
});

test('much better records a strong win in one click', async ({ page }) => {
  await enterData(page, DINNERS);
  await page.getByRole('button', { name: 'Start ranking' }).click();

  await page.getByRole('button', { name: /is much better$/ }).first().click();

  await expect(page.getByText(/^1 comparisons ·/)).toBeVisible();
});

test('reordering by hand restarts the ranking', async ({ page }) => {
  await enterData(page, DINNERS);
  await page.getByRole('button', { name: 'Start ranking' }).click();
  await page.getByLabel(/^Choose /).first().click();
  await expect(page.getByText(/^1 comparisons ·/)).toBeVisible();

  // Keyboard reordering is the same commit path as a drop, and is stable to drive.
  await page.getByRole('button', { name: /^Reorder / }).first().focus();
  await page.keyboard.press('Alt+ArrowDown');

  await expect(page.getByText(/starts a new ranking session/)).toBeVisible();
  await page.getByRole('button', { name: 'Reorder and restart' }).click();

  await expect(page.getByText(/^0 comparisons ·/)).toBeVisible();
});

test('reordering applies silently when there is nothing to lose', async ({ page }) => {
  await enterData(page, DINNERS);
  await page.getByRole('button', { name: 'Start ranking' }).click();

  await page.getByRole('button', { name: /^Reorder Tacos/ }).focus();
  await page.keyboard.press('Alt+ArrowDown');

  await expect(page.getByText(/starts a new ranking session/)).toBeHidden();
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
