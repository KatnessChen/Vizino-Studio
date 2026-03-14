import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { auth } from './firebaseService';
import { createOrUpdateUser } from './userService';
import { devLog, devError } from '@/utils/devLogger';
import { withTracking } from './analyticsService';

const googleProvider = new GoogleAuthProvider();

/**
 * Detect if the browser is Safari
 * Safari has issues with popup-based authentication due to ITP (Intelligent Tracking Prevention)
 */
const isSafari = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('safari') && !ua.includes('chrome') && !ua.includes('crios');
};

// Configure Google provider for additional scopes if needed
googleProvider.addScope('profile');
googleProvider.addScope('email');

/**
 * Sign in user with Google using popup or redirect
 * Automatically uses redirect mode for Safari browsers to avoid popup blocking issues
 * Falls back to redirect if popup is blocked in other browsers
 */
export const signInWithGoogle = async () => {
  return withTracking('auth_sign_in_with_google', async () => {
    // Enable persistence so user stays logged in
    await setPersistence(auth, browserLocalPersistence);

    // Safari has issues with popup authentication due to ITP, use redirect instead
    if (isSafari()) {
      devLog('Safari detected, using redirect authentication');
      await signInWithRedirect(auth, googleProvider);
      // After redirect, the page will reload and handleRedirectResult will process the result
      return { success: true, isRedirecting: true };
    }

    // Try popup authentication for other browsers
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Create or update user in Firestore
      await createOrUpdateUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      });

      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          isEmailVerified: user.emailVerified,
        },
        token: await user.getIdToken(),
      };
    } catch (popupError: unknown) {
      // If popup is blocked, fall back to redirect
      if (popupError instanceof Error && 'code' in popupError) {
        const firebaseError = popupError as { code: string };
        if (
          firebaseError.code === 'auth/popup-blocked' ||
          firebaseError.code === 'auth/cancelled-popup-request'
        ) {
          devLog('Popup blocked, falling back to redirect authentication');
          await signInWithRedirect(auth, googleProvider);
          return { success: true, isRedirecting: true };
        }
      }
      throw popupError;
    }
  });
};

/**
 * Handle redirect result after user returns from Google sign-in page
 * This should be called when the app initializes to process redirect authentication
 */
export const handleRedirectResult = async () => {
  return withTracking('auth_handle_redirect_result', async () => {
    const result = await getRedirectResult(auth);

    if (result) {
      // User just returned from Google sign-in page
      const user = result.user;
      devLog('Processing redirect authentication result');

      // Create or update user in Firestore
      await createOrUpdateUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      });

      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          isEmailVerified: user.emailVerified,
        },
        token: await user.getIdToken(),
      };
    }

    // No redirect result (normal page load)
    return null;
  });
};

/**
 * Sign out current user
 */
export const signOutUser = async () => {
  return withTracking('auth_sign_out', async () => {
    await signOut(auth);
    return { success: true };
  });
};

/**
 * Get current user
 */
export const getCurrentUser = (): Promise<User | null> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

/**
 * Listen to authentication state changes
 */
export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Get current user's ID token
 */
export const getIdToken = async (forceRefresh = false): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken(forceRefresh);
  } catch (error) {
    devError('Failed to get ID token:', error);
    return null;
  }
};
