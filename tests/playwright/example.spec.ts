import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/GSCODER/);
});

test('branding is visible', async ({ page }) => {
  await page.goto('/');
  const brandElement = page.locator('.brand-logo');
  await expect(brandElement).toBeVisible();
});

test('navigation works', async ({ page }) => {
  await page.goto('/');
  const navLink = page.locator('nav a').nth(1); // Click Features link (second link)
  await navLink.click();
  await expect(page).toHaveURL(/.*features/);
});
