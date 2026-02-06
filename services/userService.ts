import { doc, setDoc, getDoc, serverTimestamp, DocumentData } from 'firebase/firestore';
import { db } from './firestoreService';
import { User } from '@/types';
import { GEMINI_TASKS, GeminiTaskName } from './gemini/geminiTasks';

/**
 * Convert Firestore User document to User interface
 */
const convertFirestoreUser = (data: DocumentData): User => {
  return {
    uid: data.uid,
    email: data.email,
    displayName: data.displayName,
    photoURL: data.photoURL,
    usage: data.usage,
    lastLoginAt: data.lastLoginAt?.toDate() || new Date(),
    apiKey: data.apiKey
      ? {
          geminiKey: data.apiKey.geminiKey,
          isActive: data.apiKey.isActive ?? true,
        }
      : undefined,
  };
};

/**
 * Initialize usage object with all Gemini tasks set to 0
 */
export const initializeUsage = (): { [key: string]: number } => {
  const usage: { [key: string]: number } = {};

  Object.values(GEMINI_TASKS).forEach((task) => {
    usage[task.task_name] = 0;
  });

  // Include special usage keys
  usage['thinking_mode'] = 0;

  return usage;
};

/**
 * Create or update user document in Firestore when user logs in
 * @param userData - User data from Firebase Authentication
 */
export const createOrUpdateUser = async (userData: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userData.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      // User exists, update lastLoginAt only
      await setDoc(
        userRef,
        {
          lastLoginAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.log('User lastLoginAt updated:', userData.uid);
    } else {
      // New user, create document with initial data
      await setDoc(userRef, {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        usage: initializeUsage(),
        lastLoginAt: serverTimestamp(),
      });
      console.log('New user created:', userData.uid);
    }
  } catch (error) {
    console.error('Failed to create or update user:', error);
    throw error;
  }
};

/**
 * Get user document from Firestore
 * @param uid - User ID
 * @returns User data or null if not found
 */
export const getUser = async (uid: string): Promise<User | null> => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      return convertFirestoreUser(userDoc.data());
    }
    return null;
  } catch (error) {
    console.error('Failed to get user:', error);
    throw error;
  }
};

/**
 * Increment usage count for a specific Gemini task or feature
 * @param uid - User ID
 * @param usageKey - Gemini task name or feature key (e.g., 'thinking_mode')
 */
export const incrementTaskUsage = async (
  uid: string,
  usageKey: GeminiTaskName | 'thinking_mode'
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const currentUsage = userDoc.data().usage || initializeUsage();
      const newUsage = {
        ...currentUsage,
        [usageKey]: (currentUsage[usageKey] || 0) + 1,
      };

      await setDoc(
        userRef,
        {
          usage: newUsage,
        },
        { merge: true }
      );
      console.log(`Usage incremented: ${usageKey}`);
    } else {
      console.warn('User not found, cannot increment usage');
    }
  } catch (error) {
    console.error('Failed to increment usage:', error);
    throw error;
  }
};

/**
 * Toggle the active status of the user's custom API key
 * @param uid - User ID
 * @param isActive - New active status
 */
export const toggleUserAiKeyStatus = async (uid: string, isActive: boolean): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);

    await setDoc(
      userRef,
      {
        apiKey: {
          isActive,
        },
      },
      { merge: true }
    );
    console.log(`User API Key status updated for: ${uid}, Active: ${isActive}`);
  } catch (error) {
    console.error('Failed to update user API Key status:', error);
    throw error;
  }
};

// ============================================================================
// Encryption / Decryption Helpers (Client-side)
// ============================================================================

const SECRET_KEY = import.meta.env.VITE_USER_API_KEY_SECRET || 'default-dev-secret';

/**
 * Simple XOR encryption for client-side storage
 * Note: This is not high-security but prevents plain text storage in Firestore
 */
const xorCipher = (text: string): string => {
  const textChars = text.split('');
  const keyChars = SECRET_KEY.split('');

  return textChars
    .map((char, index) => {
      const charCode = char.charCodeAt(0);
      const keyCode = keyChars[index % keyChars.length].charCodeAt(0);
      return String.fromCharCode(charCode ^ keyCode);
    })
    .join('');
};

/**
 * Encrypts the API key before sending to Firestore
 */
const encryptKey = (apiKey: string): string => {
  if (!apiKey) return '';
  try {
    // 1. XOR
    const xored = xorCipher(apiKey);
    // 2. Base64 encode to ensure safe string storage
    return btoa(xored);
  } catch (e) {
    console.error('Encryption failed:', e);
    return '';
  }
};

/**
 * Decrypts the API key from Firestore
 */
const decryptKey = (encryptedKey: string): string => {
  if (!encryptedKey) return '';
  try {
    // 1. Base64 decode
    const xored = atob(encryptedKey);
    // 2. XOR (symmetric)
    return xorCipher(xored);
  } catch (e) {
    console.error('Decryption failed:', e);
    return '';
  }
};

/**
 * Update user's custom Gemini API Key
 */
export const updateUserAiKey = async (
  uid: string,
  apiKey: string,
  isActive: boolean
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);

    // Encrypt the key before saving
    // If apiKey is empty strings (removing), we store empty string
    const encryptedKey = apiKey ? encryptKey(apiKey) : '';

    await setDoc(
      userRef,
      {
        apiKey: {
          geminiKey: encryptedKey,
          isActive,
        },
      },
      { merge: true }
    );
    console.log(`User API Key updated for: ${uid}, Active: ${isActive}`);
  } catch (error) {
    console.error('Failed to update user API Key:', error);
    throw error;
  }
};

/**
 * Decrypt user's API key for use in the application
 */
export const decryptUserApiKey = (encryptedKey: string): string => {
  return decryptKey(encryptedKey);
};
