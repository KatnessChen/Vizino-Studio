# E2E Tests

This directory contains End-to-End (E2E) tests for the vizion-studio application.

## Structure

- `example.spec.ts` - Example test demonstrating the structure
- `generated/` - AI-generated tests from the automation workflow

## Running Tests

See the main [E2E Testing Documentation](../../docs/E2E_TESTING.md) for detailed information.

Quick commands:
```bash
# Run all tests
pnpm run test:e2e

# Run tests in UI mode
pnpm run test:e2e:ui

# Debug tests
pnpm run test:e2e:debug
```

## Writing Tests

Tests should follow the Playwright best practices:

1. Use descriptive test names
2. Wait for network idle on page loads
3. Use stable selectors (prefer data-testid)
4. Avoid hard-coded timeouts
5. Test complete user flows

Example:
```typescript
import { test, expect } from '@playwright/test';

test.describe('My Component', () => {
  test('should perform action', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="my-element"]')).toBeVisible();
  });
});
```

## AI-Generated Tests

Tests in the `generated/` directory are created by the AI workflow. Review these tests before merging:

1. Verify test assertions are correct
2. Add component-specific checks
3. Ensure tests are stable and not flaky
4. Add comments for complex test logic
