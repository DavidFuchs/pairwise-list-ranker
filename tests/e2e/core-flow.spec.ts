import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const DINNERS = ['- Tacos', '- Ramen', '- Curry', '- Pho'].join('\n');

const FILMS = JSON.stringify(
  [
    { alpha: 'Arrival', beta: 'Villeneuve', year: 2016 },
    { alpha: 'Alien', beta: 'Scott', year: 1979 },
    { alpha: 'Solaris', beta: 'Tarkovsky', year: 1972 },
  ],
  null,
  2,
);

/** Replaces the editor contents the way a paste would. */
async function pasteInto(page: Page, format: 'yaml' | 'json' | 'markdown', text: string) {
  await page.getByRole('tab', { name: format, exact: false }).click();
  const editor = page.getByLabel(`${format} source`);
  await editor.fill(text);
}

async function importList(page: Page, format: 'yaml' | 'json' | 'markdown', text: string) {
  await pasteInto(page, format, text);
  await page.getByRole('button', { name: `Import the edited ${format}` }).click();
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

test('first run explains where to start', async ({ page }) => {
  await expect(page.getByText('Start with a list')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'GUI' })).toHaveAttribute('aria-selected', 'true');
});

test('imports a list, ranks it, and shows the result', async ({ page }) => {
  await importList(page, 'yaml', DINNERS);

  await expect(page.getByRole('button', { name: /^Choose / }).first()).toBeVisible();

  const winner = await page.getByRole('button', { name: /^Choose / }).first().textContent();
  await page.getByRole('button', { name: /^Choose / }).first().click();

  await page.getByRole('tab', { name: 'GUI' }).click();
  const ranking = page.getByLabel('Current ranking');
  await expect(ranking.getByText('1', { exact: true })).toBeVisible();
  expect(winner).toContain('Choose');
});

test('ranks with the keyboard', async ({ page }) => {
  await importList(page, 'yaml', DINNERS);
  await page.getByRole('tab', { name: 'GUI' }).click();
  // Shortcuts are ignored while a text field has focus, which is the point of
  // the guard: leave the editor before driving the deck from the keyboard.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('s');

  await expect(page.getByText(/2 comparisons/)).toBeVisible();
});

test('keeps the list when pasted text does not parse', async ({ page }) => {
  await importList(page, 'yaml', DINNERS);

  await pasteInto(page, 'json', '{ not json');
  await page.getByRole('button', { name: 'Import the edited json' }).click();

  await expect(page.getByText(/Invalid JSON/i)).toBeVisible();
  await expect(page.getByLabel('json source')).toHaveValue('{ not json');
  await expect(page.getByText('4 items', { exact: true })).toBeVisible();
});

test('switches between every preview format', async ({ page }) => {
  await importList(page, 'yaml', DINNERS);

  await page.getByRole('tab', { name: 'JSON' }).click();
  await expect(page.getByLabel('json source')).toHaveValue(/"kind": "primitive"/);

  await page.getByRole('tab', { name: 'Markdown' }).click();
  await expect(page.getByLabel('markdown source')).toHaveValue(/^# /);

  await page.getByRole('tab', { name: 'GUI' }).click();
  await expect(page.getByRole('button', { name: /^Copy/ })).toHaveCount(0);
});

test('copies an export to the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await importList(page, 'yaml', DINNERS);

  await page.getByRole('button', { name: /Copy yaml/i }).click();

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain('title: Untitled list');
});

test('downloads an export as a file', async ({ page }) => {
  await importList(page, 'yaml', DINNERS);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Download untitled-list/ }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^untitled-list-\d{4}-\d{2}-\d{2}\.yaml$/);
});

test('asks for a label field before ranking objects', async ({ page }) => {
  await importList(page, 'json', FILMS);

  await expect(page.getByText(/Pick a label field first/i)).toBeVisible();

  await page.getByRole('button', { name: 'Label items by alpha' }).click();

  await expect(page.getByRole('button', { name: 'Choose Arrival' })).toBeVisible();
});

test('deletes an item from the comparison without ranking it', async ({ page }) => {
  await importList(page, 'yaml', DINNERS);
  const deleteButton = page.getByRole('button', { name: /^Delete / }).first();
  const doomed = (await deleteButton.getAttribute('aria-label'))!.replace('Delete ', '');

  await deleteButton.click();
  await page.getByRole('button', { name: `Confirm deleting ${doomed}` }).click();

  await expect(page.getByText('3 items', { exact: true })).toBeVisible();
  await expect(page.getByText(/0 comparisons/)).toBeVisible();
});

test('restores the workspace after a reload', async ({ page }) => {
  await importList(page, 'yaml', DINNERS);
  await page.getByRole('button', { name: /^Choose / }).first().click();

  await page.reload();

  await expect(page.getByText('4 items', { exact: true })).toBeVisible();
  await expect(page.getByText(/1 comparisons/)).toBeVisible();
});

test('clears the workspace and starts fresh', async ({ page }) => {
  await importList(page, 'yaml', DINNERS);

  await page.getByRole('button', { name: 'Clear this workspace' }).click();
  await page.getByRole('button', { name: 'Confirm clearing the workspace' }).click();

  await expect(page.getByText('Start with a list')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Start with a list')).toBeVisible();
});

test('switches to the dark theme and remembers it', async ({ page }) => {
  await page.getByRole('button', { name: 'Use the dark theme' }).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const canvas = await page
    .locator('body')
    .evaluate((body) => getComputedStyle(body).backgroundColor);

  await page.reload();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', canvas);
});

test('hands the theme back to the operating system', async ({ page }) => {
  await page.getByRole('button', { name: 'Use the dark theme' }).click();

  await page.getByRole('button', { name: 'Match system theme' }).click();

  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
});

test('renders the dark palette when the system prefers it', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();

  const background = await page
    .locator('body')
    .evaluate((body) => getComputedStyle(body).backgroundColor);

  // The dark canvas, resolved by the stylesheet rather than by React.
  expect(background).toBe('rgb(13, 16, 22)');
});

test('runs the whole flow without a console error', async ({ page }) => {
  await importList(page, 'yaml', DINNERS);
  await page.getByRole('button', { name: /^Choose / }).first().click();
  await page.getByRole('tab', { name: 'Markdown' }).click();
  await page.getByRole('tab', { name: 'GUI' }).click();
  await page.reload();

  const errors = (page as Page & { consoleErrors: string[] }).consoleErrors;
  expect(errors).toEqual([]);
});
