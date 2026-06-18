import { expect, test } from '@playwright/test';

// The search page's form renders without the API (results need the API, but the
// page shell does not), so this runs against the web server alone.
test('the search page renders its form inside the active theme', async ({ page }) => {
  await page.goto('/search');
  await expect(page.locator('[data-public-theme]')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search query' })).toBeVisible();
});
