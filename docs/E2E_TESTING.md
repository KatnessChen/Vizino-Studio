# AI-Powered E2E Test Automation Workflow

This repository includes an automated AI workflow for creating, running, and fixing E2E tests using Playwright and GitHub Actions.

## 🎯 Overview

The workflow automates the complete E2E testing lifecycle:

1. **AI Test Generation**: Automatically generates E2E tests based on your components and pages
2. **Virtual Browser Testing**: Runs tests in virtual browsers (Chromium, Firefox, WebKit)
3. **Auto-Fix**: Automatically fixes failing tests using AI analysis
4. **Reporting**: Provides comprehensive test results and artifacts

## 🚀 Quick Start

### Prerequisites

1. Install dependencies:
```bash
pnpm install
```

2. Install Playwright browsers:
```bash
pnpm exec playwright install
```

### Running Tests Locally

```bash
# Run all E2E tests
pnpm run test:e2e

# Run tests in UI mode (interactive)
pnpm run test:e2e:ui

# Run tests in headed mode (see browser)
pnpm run test:e2e:headed

# Debug tests
pnpm run test:e2e:debug

# View test report
pnpm run test:e2e:report
```

## 🤖 AI Workflows

### 1. Automated E2E Test Workflow

**File**: `.github/workflows/ai-e2e-tests.yml`

This workflow runs automatically on:
- Pull requests to `main` or `develop` branches
- Weekly schedule (Mondays at 2 AM UTC)
- Manual trigger via GitHub Actions UI

**Features**:
- ✅ Generates E2E tests based on codebase analysis
- ✅ Runs tests in multiple browsers (Chromium, Firefox, WebKit)
- ✅ Captures screenshots and videos on failure
- ✅ Automatically fixes failing tests using AI
- ✅ Creates issues for tests that can't be auto-fixed
- ✅ Comments on PRs with fix summaries

**Jobs**:

1. **generate-tests**: Analyzes codebase and generates E2E tests
2. **run-tests**: Executes tests in virtual browsers
3. **auto-fix-tests**: Analyzes failures and applies automatic fixes
4. **report-results**: Creates comprehensive test summary

### 2. Manual E2E Test Generator

**File**: `.github/workflows/manual-e2e-generator.yml`

This workflow is triggered manually when you need to generate a test for a specific component.

**Usage**:

1. Go to GitHub Actions → "Manual E2E Test Generator"
2. Click "Run workflow"
3. Fill in the parameters:
   - **Component Path**: Path to the component (e.g., `pages/LandingPage.tsx`)
   - **Test Scenarios**: What to test (e.g., "navigation, form submission")
   - **Browser**: Which browser to test with
4. The workflow will:
   - Generate a test file
   - Run the test
   - Create a PR with the generated test

## 📁 Project Structure

```
vizion-studio/
├── .github/
│   └── workflows/
│       ├── ai-e2e-tests.yml          # Main automated workflow
│       └── manual-e2e-generator.yml  # Manual test generator
├── tests/
│   └── e2e/
│       ├── example.spec.ts           # Example test
│       └── generated/                # AI-generated tests
├── playwright.config.ts              # Playwright configuration
└── package.json                      # Dependencies and scripts
```

## 🔧 Configuration

### Playwright Configuration

Edit `playwright.config.ts` to customize:

- **Base URL**: Default is `http://localhost:5173`
- **Browsers**: Chromium, Firefox, WebKit (all enabled by default)
- **Retries**: 2 retries on CI, 0 locally
- **Screenshots**: Captured on failure
- **Videos**: Retained on failure
- **Traces**: Captured on first retry

### Environment Variables

The workflows support the following environment variables:

- `BASE_URL`: Base URL for tests (default: `http://localhost:5173`)
- `CI`: Set to `true` in CI environment

## 📝 Writing E2E Tests

### Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Component Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should perform action', async ({ page }) => {
    // Test implementation
    await expect(page.locator('selector')).toBeVisible();
  });
});
```

### Best Practices

1. **Use descriptive test names**: Clearly describe what the test does
2. **Wait for network idle**: Use `waitForLoadState('networkidle')` for SPAs
3. **Use data-testid**: Add `data-testid` attributes to components for stable selectors
4. **Avoid hard-coded waits**: Use `waitForSelector` instead of `waitForTimeout`
5. **Test user flows**: Test complete user journeys, not just individual actions

## 🔍 Understanding the AI Loop

### The Automated Feedback Loop

The workflow creates a continuous improvement loop:

1. **Code Changes** → Trigger test generation
2. **Generate Tests** → AI analyzes components and creates tests
3. **Run Tests** → Execute in virtual browsers
4. **Tests Pass?**
   - ✅ Yes → Success, tests are committed
   - ❌ No → Analyze failures
5. **Analyze Failures** → AI examines errors, screenshots, videos
6. **Apply AI Fixes** → Update selectors, waits, assertions
7. **Re-run Tests** → Verify fixes
8. **Max Retries?**
   - If still failing → Create issue for manual review
   - If passing → Success, fixes are committed

### How AI Fixes Work

1. **Failure Analysis**: The AI agent analyzes test failures by examining:
   - Error messages and stack traces
   - Screenshots and videos of failures
   - Test code and selectors
   - Component source code

2. **Fix Application**: Common fixes include:
   - Updating selectors to match current DOM
   - Adding proper wait conditions
   - Improving retry logic
   - Adjusting timeouts
   - Fixing assertions

3. **Verification**: After applying fixes:
   - Tests are re-run automatically
   - If successful, fixes are committed
   - If still failing, an issue is created for manual review

## 🎮 Triggering Workflows

### Automatic Triggers

- **On Pull Request**: Tests run automatically on PRs to main/develop
- **Scheduled**: Weekly test generation on Mondays at 2 AM UTC
- **On Push**: (Optional) Can be configured to run on every push

### Manual Triggers

1. **Full Workflow**:
   - Go to Actions → "AI-Powered E2E Test Automation"
   - Click "Run workflow"
   - Optionally specify test target and description

2. **Component-Specific Test**:
   - Go to Actions → "Manual E2E Test Generator"
   - Click "Run workflow"
   - Specify component path and scenarios

## 📊 Viewing Results

### Workflow Artifacts

Each workflow run creates artifacts:

- **generated-tests**: AI-generated test files
- **test-results-{browser}**: Test results for each browser
- **test-failures-{browser}**: Screenshots and videos of failures

### Test Reports

1. Download the Playwright HTML report from artifacts
2. Extract and open `index.html` in a browser
3. View detailed test results, traces, and screenshots

## 🛠️ Troubleshooting

### Tests Failing Locally but Passing in CI

- Ensure you have the latest browsers: `pnpm exec playwright install`
- Check if your local dev server is running on the correct port
- Clear browser cache and try again

### AI Fixes Not Applied

- Check the `AUTO_FIXES.md` file in `tests/e2e/generated/`
- Review the workflow logs for error messages
- Manually review and apply suggested fixes

### Workflow Not Triggering

- Ensure workflows are enabled in repository settings
- Check branch protection rules
- Verify the workflow file syntax

## 🔐 Security Considerations

- Tests run in isolated virtual environments
- Sensitive data should be stored in GitHub Secrets
- Never commit credentials or API keys
- Use environment variables for configuration

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [E2E Testing Best Practices](https://playwright.dev/docs/best-practices)

## 🤝 Contributing

When adding new tests:

1. Follow the existing test structure
2. Add descriptive test names
3. Include comments for complex test logic
4. Ensure tests are deterministic (no random failures)
5. Run tests locally before committing

## 📄 License

This workflow configuration is part of the vizion-studio project.

---

**Questions or Issues?**

- Create an issue in the repository
- Check the workflow logs for detailed error messages
- Review the AI-generated fix suggestions in `tests/e2e/generated/AUTO_FIXES.md`
