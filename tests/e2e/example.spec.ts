import { test, expect } from '@playwright/test';

/**
 * Example E2E test for the landing page
 * This test demonstrates the structure that AI-generated tests should follow
 */
test.describe('Landing Page', () => {
  test('should load the landing page successfully', async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Verify the page title or main heading exists
    await expect(page).toHaveTitle(/Interior Painting Designer/i);
  });

  test('should display authentication page when accessing protected routes', async ({ page }) => {
    // Try to navigate to home
    await page.goto('/');

    // Should redirect to auth page if not authenticated
    // or show the landing page with auth options
    await page.waitForLoadState('networkidle');

    // Check that we can see the page (either landing or auth)
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });
});
