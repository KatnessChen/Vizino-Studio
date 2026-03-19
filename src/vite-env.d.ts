/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_ADMIN_EMAILS: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_USER_API_KEY_SECRET: string;
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  /** Optional: Replicate API token for AI upscaling (4K/8K output) */

}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
