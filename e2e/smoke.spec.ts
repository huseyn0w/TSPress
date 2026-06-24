import { expect, test } from '@playwright/test';

test('landing page renders the Cmstack-TS hero', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('TypeScript');
  await expect(page.getByRole('link', { name: /system status/i })).toBeVisible();
});
