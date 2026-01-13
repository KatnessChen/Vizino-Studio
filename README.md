# Vizion Studio - Interior Painting Designer

Recolor your interior photos with paint codes using AI.

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
pnpm install

# Run development server
pnpm run dev

# Build for production
pnpm run build
```

## 🧪 E2E Testing

This project includes an **AI-powered automated E2E testing workflow** that:

- 🤖 Automatically generates E2E tests based on your code
- 🌐 Runs tests in virtual browsers (Chromium, Firefox, WebKit)
- 🔧 Auto-fixes failing tests using AI analysis
- 📊 Provides comprehensive test reports

### Running Tests

```bash
# Run E2E tests
pnpm run test:e2e

# Run tests in UI mode
pnpm run test:e2e:ui

# Debug tests
pnpm run test:e2e:debug
```

For detailed information about the AI testing workflow, see [E2E Testing Documentation](./docs/E2E_TESTING.md).

## ⚙️ Configure Firebase Storage CORS

To enable your environment to access images from Firebase Storage, you need to configure CORS (Cross-Origin Resource Sharing) settings.

### Prerequisites

- Google Cloud SDK installed ([Install gsutil](https://cloud.google.com/storage/docs/gsutil_install))
- Access to your Firebase project

### Steps

1. **View your Firebase Storage bucket name**

   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Navigate to Storage
   - Copy your bucket name (format: `your-project-id.firebasestorage.app`)

2. **Use the provided cors.json file**

   - The project includes a [`cors.json`](./cors.json) file with pre-configured CORS settings
   - Current settings allow GET requests from:
     - `http://localhost:3000` (local development)
     - Add other domains

3. **Apply CORS settings using gsutil**

   ```bash
   # Set your bucket name
   gsutil cors set cors.json gs://VIZION_BUCKET_NAME
   ```
