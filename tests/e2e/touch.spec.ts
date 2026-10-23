import { devices, expect, test } from '@playwright/test';

// A phone, driven with real touch input rather than a mouse.
test.use({ ...devices['iPhone 13'], browserName: 'chromium' });

test('a ranked row can be dragged with a finger', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.getByLabel('Your list').fill(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].join('\n'));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start ranking' }).click();

  const list = page.getByRole('region', { name: 'Current ranking' });
  await list.scrollIntoViewIfNeeded();
  const grip = page.getByRole('button', { name: /^Reorder Alpha/ });
  const gripBox = (await grip.boundingBox())!;
  // Big enough for a fingertip.
  expect(gripBox.width).toBeGreaterThanOrEqual(36);
  expect(gripBox.height).toBeGreaterThanOrEqual(44);

  const rows = page.getByRole('listitem');
  const target = (await rows.nth(3).boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = gripBox.x + gripBox.width / 2;
  const from = gripBox.y + gripBox.height / 2;
  const to = target.y + target.height * 0.75;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: from }] });
  for (let step = 1; step <= 12; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: from + ((to - from) * step) / 12 }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  // The drop is recorded (as a placement, not an answer), so there is something to undo.
  await expect(page.getByRole('button', { name: 'Undo last change' })).not.toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await expect(page.getByText('0 answers so far')).toBeVisible();
  await expect(rows.first()).not.toContainText('Alpha');
});
