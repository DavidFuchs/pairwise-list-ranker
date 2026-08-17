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

  await expect(page.getByRole('button', { name: /^Choose / }).first()).toBeVisible();
  await page.getByRole('button', { name: /^Choose / }).first().click();

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
  await expect(page.getByLabel('List name')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('List name')).toBeVisible();

  await page.getByRole('button', { name: 'Start over' }).click();
  await page.getByRole('button', { name: 'Confirm start over' }).click();

  await expect(page.getByLabel('Your list')).toBeVisible();
});

test('edits the data mid-run and keeps the rankings', async ({ page }) => {
  await enterData(page, DINNERS);
  await page.getByRole('button', { name: 'Start ranking' }).click();
  await page.getByRole('button', { name: /^Choose / }).first().click();

  await page.getByRole('button', { name: 'Edit data' }).click();
  await enterData(page, `${DINNERS}\nUdon`);
  await page.getByRole('button', { name: 'Apply edits' }).click();

  await expect(page.getByText(/4 items unchanged/)).toBeVisible();
  await expect(page.getByText(/1 item added/)).toBeVisible();
});
