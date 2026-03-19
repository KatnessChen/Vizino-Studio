import { initializeApp } from 'firebase/app';
import { devWarn } from '@/utils/devLogger';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Validate required Firebase config
if (!firebaseConfig.apiKey || !firebaseConfig.authDomain) {
  devWarn('Firebase configuration is incomplete. Some features may not work properly.');
}

// Initialize Firebase app (shared instance for all services)
export const app = initializeApp(firebaseConfig);
