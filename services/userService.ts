import { doc, setDoc, getDoc, serverTimestamp, DocumentData } from 'firebase/firestore';
import { db } from './firestoreService';
import { User } from '@/types';
import { GEMINI_TASKS, GeminiTaskName } from './gemini/geminiTasks';
import { devLog, devWarn, devError } from '@/utils/devLogger';
import { withTracking } from './analyticsService';

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
    credit_limit: data.credit_limit,
  };
};

/**
 * Initialize usage object with all Gemini tasks set to { onVPoints: 0, onOwnKey: 0 }
 */
export const initializeUsage = (): {
  [key: string]: { onVPoints: number; onOwnKey: number };
} => {
  const usage: { [key: string]: { onVPoints: number; onOwnKey: number } } = {};

  Object.values(GEMINI_TASKS).forEach((task) => {
    usage[task.task_name] = { onVPoints: 0, onOwnKey: 0 };
  });

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
  return withTracking('firestore_create_or_update_user', async () => {
    const userRef = doc(db, 'users', userData.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      // User exists, check if credit_limit needs to be initialized
      const existingData = userDoc.data();
      const updates: Record<string, unknown> = {
        lastLoginAt: serverTimestamp(),
      };

      // If credit_limit doesn't exist, set it to DEFAULT_CREDIT_LIMIT
      if (existingData.credit_limit === undefined) {
        const { DEFAULT_CREDIT_LIMIT } = await import('@/constants/constants');
        updates.credit_limit = DEFAULT_CREDIT_LIMIT;
        devLog(
          `Initializing credit_limit for existing user ${userData.uid}: ${DEFAULT_CREDIT_LIMIT}`
        );
      }

      await setDoc(userRef, updates, { merge: true });
      devLog('User updated:', userData.uid);
    } else {
      // New user, create document with initial data including credit_limit
      const { DEFAULT_CREDIT_LIMIT } = await import('@/constants/constants');
      await setDoc(userRef, {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        usage: initializeUsage(),
        credit_limit: DEFAULT_CREDIT_LIMIT,
        lastLoginAt: serverTimestamp(),
      });
      devLog(`New user created: ${userData.uid} with credit_limit: ${DEFAULT_CREDIT_LIMIT}`);
    }
  });
};

/**
 * Get user document from Firestore
 * @param uid - User ID
 * @returns User data or null if not found
 */
export const getUser = async (uid: string): Promise<User | null> => {
  return withTracking('firestore_get_user', async () => {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      return convertFirestoreUser(userDoc.data());
    }
    return null;
  });
};

/**
 * Increment usage count for a specific Gemini task or feature
 * @param uid - User ID
 * @param usageKey - Gemini task name or feature key (e.g., 'thinking_mode')
 * @param byOwnKey - Whether this usage is from user's own API key (true) or V Points (false)
 * @param amount - Amount to increment by (default 1)
 */
export const incrementTaskUsage = async (
  uid: string,
  usageKey: GeminiTaskName,
  byOwnKey: boolean = false,
  amount: number = 1
): Promise<void> => {
  return withTracking(
    'firestore_increment_task_usage',
    async () => {
      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const currentUsage = userDoc.data().usage || initializeUsage();
        const trackingKey = byOwnKey ? 'onOwnKey' : 'onVPoints';

        const newUsage = {
          ...currentUsage,
          [usageKey]: {
            ...(currentUsage[usageKey] || { onVPoints: 0, onOwnKey: 0 }),
            [trackingKey]: (currentUsage[usageKey]?.[trackingKey] || 0) + amount,
          },
        };

        await setDoc(
          userRef,
          {
            usage: newUsage,
          },
          { merge: true }
        );
        devLog(`Usage incremented by ${amount}: ${usageKey} (${byOwnKey ? 'own key' : 'V Points'})`);
      } else {
        devWarn('User not found, cannot increment usage');
      }
    },
    { usageKey, byOwnKey, amount }
  );
};

/**
 * Toggle the active status of the user's custom API key
 * @param uid - User ID
 * @param isActive - New active status
 */
export const toggleUserAiKeyStatus = async (uid: string, isActive: boolean): Promise<void> => {
  return withTracking(
    'firestore_toggle_user_ai_key_status',
    async () => {
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
      devLog(`User API Key status updated for: ${uid}, Active: ${isActive}`);
    },
    { isActive }
  );
};

/**
 * Fix corrupted usage data in Firestore
 * Clears any entries that don't match the expected format
 */
export const fixCorruptedUsageData = async (uid: string): Promise<void> => {
  return withTracking('firestore_fix_corrupted_usage_data', async () => {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      devWarn('User not found, cannot fix usage data');
      return;
    }

    const currentUsage = userDoc.data().usage || {};
    const fixedUsage: Record<string, unknown> = {};

    // Only keep valid entries
    for (const [k, v] of Object.entries(currentUsage)) {
      if (
        v &&
        typeof v === 'object' &&
        'onVPoints' in v &&
        'onOwnKey' in v &&
        typeof (v as Record<string, unknown>).onVPoints === 'number' &&
        typeof (v as Record<string, unknown>).onOwnKey === 'number'
      ) {
        fixedUsage[k] = v;
      } else if (v) {
        devLog(`[fixCorruptedUsageData] Removing corrupted entry: ${k}`, v);
      }
    }

    // Ensure all expected keys exist
    Object.values(GEMINI_TASKS).forEach((task) => {
      if (!fixedUsage[task.task_name]) {
        fixedUsage[task.task_name] = { onVPoints: 0, onOwnKey: 0 };
      }
    });

    await setDoc(
      userRef,
      {
        usage: fixedUsage,
      },
      { merge: true }
    );
    devLog(`[fixCorruptedUsageData] Usage data fixed for: ${uid}`);
  });
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
    // 0. Trim whitespace first
    const trimmed = apiKey.trim();
    // 1. XOR
    const xored = xorCipher(trimmed);
    // 2. Base64 encode to ensure safe string storage
    return btoa(xored);
  } catch (e) {
    devError('Encryption failed:', e);
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
    const decrypted = xorCipher(xored);
    // 3. Strip ALL control characters (0x00-0x1F, 0x7F-0x9F) + trim
    //    Control chars inside the key cause Headers.append() to throw
    // eslint-disable-next-line no-control-regex
    const sanitized = decrypted.replace(/[\x00-\x1f\x7f-\x9f]/g, '').trim();
    if (sanitized.length !== decrypted.trim().length) {
      devWarn(
        '[UserService] Decrypted API key contained control characters.',
        `Original length: ${decrypted.length}, Sanitized: ${sanitized.length}`
      );
    }
    return sanitized;
  } catch (e) {
    devError('Decryption failed:', e);
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
  return withTracking(
    'firestore_update_user_ai_key',
    async () => {
      const userRef = doc(db, 'users', uid);

      // Trim the key and encrypt before saving
      // If apiKey is empty strings (removing), we store empty string
      const trimmedKey = apiKey.trim();
      const encryptedKey = trimmedKey ? encryptKey(trimmedKey) : '';

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
      devLog(`User API Key updated for: ${uid}, Active: ${isActive}`);
    },
    { isActive }
  );
};

/**
 * Decrypt user's API key for use in the application
 */
export const decryptUserApiKey = (encryptedKey: string): string => {
  return decryptKey(encryptedKey);
};
