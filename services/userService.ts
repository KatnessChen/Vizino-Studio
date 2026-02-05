import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firestoreService';
import { User } from '@/types';
import { GEMINI_TASKS, GeminiTaskName } from './gemini/geminiTasks';

import { DocumentData } from 'firebase/firestore';

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
  };
};

/**
 * Initialize usage object with all Gemini tasks set to 0
 */
const initializeUsage = (): { [key in GeminiTaskName]: number } => {
  const usage: Partial<{ [key in GeminiTaskName]: number }> = {};

  Object.values(GEMINI_TASKS).forEach((task) => {
    usage[task.task_name] = 0;
  });

  return usage as { [key in GeminiTaskName]: number };
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
