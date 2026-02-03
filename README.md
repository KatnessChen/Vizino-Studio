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

## Testing GitHub Actions Locally (using act) ✅

You can use `nektos/act` to simulate the GitHub Actions runner locally (Docker is required). Below is a quick setup and example tailored for this project:

1. Install Docker
2. Install act:
   - Homebrew: `brew install act`
   - Or install manually: `curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash`
3. Copy the environment file template:
   ```bash
   cp .env.act.example .env.act
   # Edit .env.act and fill in GITHUB_TOKEN and any other required secrets
   ```
4. (Optional) Edit `.actrc` to adjust the runner image (the project already includes: `-P ubuntu-latest=nektos/act-environments-ubuntu:18.04`)
5. Run the project's PR workflow (this simulates a `pull_request` event):
   ```bash
   # List runnable jobs
   pnpm run act:list

   # Run lint & type-check job (using the example event)
   pnpm run act:pr
   ```

Notes:
- act is not a 100% equivalent to GitHub-hosted runners; some official Actions or steps that rely on the GitHub API may behave differently. Use act for fast iteration and validate workflows on GitHub before finalizing.
- Do NOT commit real tokens to the repository; keep your local `.env.act` in `.gitignore` (the project includes a `.env.act.example`).

---

## Pre-push Hook (Husky)

This repository includes a Husky `pre-push` hook to run quick checks before pushing commits. By default, the hook runs the following fast checks:

- `pnpm run lint`
- `pnpm run type-check`

If you want the push to also run the full `act` simulation (slower, requires Docker), set the `ACT_PRE_PUSH` environment variable when pushing:

```bash
# Run fast checks only
git push

# Run fast checks + act simulation
ACT_PRE_PUSH=1 git push
```

To bypass the hook (not recommended), use:

```bash
git push --no-verify
```

If the hook fails, it will abort the push and print a short error message. Ensure contributors have Docker and `act` installed if they need to run the `ACT_PRE_PUSH=1` option.