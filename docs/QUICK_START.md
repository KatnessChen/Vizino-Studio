# Quick Start Guide: AI E2E Test Automation

This guide will help you get started with the AI-powered E2E test automation workflow.

## 📋 Prerequisites

Before you begin, make sure you have:

- Node.js 20 or later installed
- pnpm 8.0.0 or later (will be installed automatically if missing)
- Access to GitHub Actions in your repository

## 🚀 Initial Setup

### Option 1: Using the Helper Script (Recommended)

```bash
# Make the script executable (if not already)
chmod +x scripts/e2e-helper.sh

# Run the setup
./scripts/e2e-helper.sh setup
```

This will:
1. Check and install pnpm if needed
2. Install all project dependencies
3. Install Playwright browsers

### Option 2: Manual Setup

```bash
# Install pnpm (if not installed)
npm install -g pnpm@8.0.0

# Install dependencies
pnpm install --no-frozen-lockfile

# Install Playwright browsers
pnpm exec playwright install --with-deps
```

## 🧪 Running Tests Locally

### Basic Commands

```bash
# Run all E2E tests
pnpm run test:e2e

# Run tests in UI mode (interactive, recommended for development)
pnpm run test:e2e:ui

# Run tests with visible browser (headed mode)
pnpm run test:e2e:headed

# Debug a specific test
pnpm run test:e2e:debug

# View the test report
pnpm run test:e2e:report
```

### Using the Helper Script

```bash
# Run tests
./scripts/e2e-helper.sh test

# Run tests in UI mode
./scripts/e2e-helper.sh test-ui
```

## 🤖 Using the AI Workflows

### Automatic Test Generation (CI/CD)

The workflow automatically runs on:
- **Pull Requests**: When you create a PR to `main` or `develop`
- **Schedule**: Every Monday at 2 AM UTC
- **Manual Trigger**: Click "Run workflow" in GitHub Actions

### Manual Test Generation for Specific Components

1. Go to your GitHub repository
2. Click on the "Actions" tab
3. Select "Manual E2E Test Generator" from the workflows list
4. Click "Run workflow"
5. Fill in the form:
   - **Component Path**: e.g., `pages/LandingPage.tsx`
   - **Test Scenarios**: e.g., `navigation, form submission, error handling`
   - **Browser**: Choose `chromium`, `firefox`, `webkit`, or `all`
6. Click "Run workflow"

The workflow will:
- Generate a test file based on your component
- Run the test in the selected browser(s)
- Create a Pull Request with the generated test
- Provide test results and artifacts

## 📊 Understanding Workflow Results

### Viewing Test Results

1. Go to the workflow run in GitHub Actions
2. Check the job summary for an overview
3. Download artifacts for detailed results:
   - `generated-tests` - The AI-generated test files
   - `test-results-{browser}` - Test results for each browser
   - `test-failures-{browser}` - Screenshots and videos of failures

### Reading the AI Fix Summary

If tests fail and AI applies fixes:
1. Check the workflow comments on your PR
2. Review the `tests/e2e/generated/AUTO_FIXES.md` file
3. The workflow will re-run tests to verify fixes

## 🔍 Common Workflows

### Scenario 1: Adding a New Page Component

1. Create your new page component (e.g., `pages/NewFeature.tsx`)
2. Commit and push your changes
3. Trigger the Manual E2E Test Generator:
   - Component Path: `pages/NewFeature.tsx`
   - Test Scenarios: `page load, navigation, user interactions`
4. Review the generated test in the created PR
5. Adjust the test if needed and merge

### Scenario 2: Fixing a Failing Test

1. Check the workflow run for failure details
2. Download test artifacts (screenshots, videos)
3. Review the AI-suggested fixes in `AUTO_FIXES.md`
4. If AI couldn't fix it automatically:
   - An issue will be created with details
   - Manually review and fix the test
   - Commit your changes

### Scenario 3: Running Tests Before Merging

1. Create a Pull Request
2. Tests will automatically run
3. Check the PR comments for results
4. If tests fail, AI will attempt to fix them
5. Review and merge when tests pass

## 🛠️ Customizing the Workflow

### Changing Test Configuration

Edit `playwright.config.ts` to customize:
- Base URL
- Browsers to test
- Timeout settings
- Screenshot/video settings

### Modifying AI Workflow Triggers

Edit `.github/workflows/ai-e2e-tests.yml` to change:
- When the workflow runs (branches, schedule)
- Which browsers to test
- Retry logic

### Adding Custom Test Scenarios

Edit `.github/workflows/manual-e2e-generator.yml` to:
- Add more test scenario templates
- Customize the generated test structure
- Add custom validations

## 📝 Writing Your Own Tests

### Test File Structure

Create a new test file in `tests/e2e/`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/my-feature');
    await page.waitForLoadState('networkidle');
  });

  test('should display the main content', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should handle user interaction', async ({ page }) => {
    await page.click('[data-testid="button"]');
    await expect(page.locator('[data-testid="result"]')).toContainText('Success');
  });
});
```

### Best Practices

1. **Use data-testid attributes**: Add to your components for stable selectors
2. **Wait for network idle**: Especially important for SPAs
3. **Write descriptive test names**: Clearly state what is being tested
4. **Test user flows**: Not just individual actions
5. **Keep tests independent**: Each test should work standalone

## 🐛 Troubleshooting

### Issue: Tests fail locally but pass in CI

**Solution**: Ensure you have the latest browsers installed
```bash
pnpm exec playwright install --with-deps
```

### Issue: pnpm command not found

**Solution**: Install pnpm globally
```bash
npm install -g pnpm@8.0.0
```

### Issue: Workflow not triggering

**Solution**: 
- Check that workflows are enabled in repository settings
- Verify the workflow file syntax
- Check branch protection rules

### Issue: AI fixes not being applied

**Solution**:
- Review the workflow logs for errors
- Check the `AUTO_FIXES.md` file for suggested fixes
- Manually apply fixes if needed

## 📚 Next Steps

1. **Explore the documentation**: Read [E2E_TESTING.md](./E2E_TESTING.md) for detailed information
2. **Run your first test**: Use the helper script or pnpm commands
3. **Generate a test**: Try the manual test generator workflow
4. **Customize**: Adjust the configuration to fit your needs

## 🆘 Getting Help

- Check the [E2E Testing Documentation](./E2E_TESTING.md)
- Review workflow logs in GitHub Actions
- Check the issues created by the AI workflow
- Look at example tests in `tests/e2e/example.spec.ts`

---

Happy Testing! 🚀
