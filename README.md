## Configure Firebase Storage CORS

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

---

## Pre-push Hook (Husky)

This repository uses Husky to enforce code quality checks before pushing commits. The `pre-push` hook automatically runs:

```bash
pnpm run lint
pnpm run type-check
```

If either check fails, the push will be aborted. To bypass the hook (not recommended):

```bash
git push --no-verify
```

```bash
git push --no-verify
```

This repository uses Husky to enforce code quality checks before pushing commits. The `pre-push` hook automatically runs:

```bash
pnpm run lint
pnpm run type-check
```

If either check fails, the push will be aborted. To bypass the hook (not recommended):

```bash
git push --no-verify
```
