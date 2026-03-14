import { doc, getDoc, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from './firestoreService';
import { PromotionCode } from '@/types';
import { devLog } from '@/utils/devLogger';
import { withTracking } from './analyticsService';

/**
 * Create a new promotion code (Admin function)
 * @param code - The promotion code string (e.g., "2026MARCH-MEL")
 * @param credits - Number of credits this code provides
 */
export const createPromotionCode = async (code: string, credits: number): Promise<void> => {
  return withTracking(
    'firestore_create_promotion_code',
    async () => {
      const codeRef = doc(db, 'promotion_codes', code.toUpperCase());

      // Check if code already exists
      const existingDoc = await getDoc(codeRef);
      if (existingDoc.exists()) {
        throw new Error('Promotion code already exists');
      }

      await setDoc(codeRef, {
        code: code.toUpperCase(),
        credits,
        usedBy: null,
        usedAt: null,
        createdAt: serverTimestamp(),
      });

      devLog(`Promotion code created: ${code} (${credits} credits)`);
    },
    { code, credits }
  );
};

/**
 * Get a promotion code by its code string
 * @param code - The promotion code string
 * @returns The PromotionCode object or null if not found
 */
export const getPromotionCode = async (code: string): Promise<PromotionCode | null> => {
  return withTracking(
    'firestore_get_promotion_code',
    async () => {
      const codeRef = doc(db, 'promotion_codes', code.toUpperCase());
      const codeDoc = await getDoc(codeRef);

      if (!codeDoc.exists()) {
        return null;
      }

      const data = codeDoc.data();
      return {
        code: data.code,
        credits: data.credits,
        usedBy: data.usedBy,
        usedAt: data.usedAt,
        createdAt: data.createdAt,
      };
    },
    { code }
  );
};

/**
 * Redeem a promotion code for a user
 * Uses Firestore transaction to ensure atomicity
 *
 * @param userId - The user ID who is redeeming the code
 * @param code - The promotion code string
 * @returns The number of credits added
 * @throws Error if code is invalid, already used, or transaction fails
 */
export const redeemPromotionCode = async (userId: string, code: string): Promise<number> => {
  return withTracking(
    'firestore_redeem_promotion_code',
    async () => {
      const codeRef = doc(db, 'promotion_codes', code.toUpperCase());
      const userRef = doc(db, 'users', userId);

      return await runTransaction(db, async (transaction) => {
        // Read promotion code
        const codeDoc = await transaction.get(codeRef);
        if (!codeDoc.exists()) {
          throw new Error('Invalid promotion code');
        }

        const promoData = codeDoc.data();

        // Check if already used
        if (promoData.usedBy !== null) {
          throw new Error('This promotion code has already been used');
        }

        // Read user data
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error('User not found');
        }

        const userData = userDoc.data();
        const currentLimit = userData.credit_limit || 0;
        const newLimit = currentLimit + promoData.credits;

        // Update user's credit_limit
        transaction.update(userRef, {
          credit_limit: newLimit,
        });

        // Mark promotion code as used
        transaction.update(codeRef, {
          usedBy: userId,
          usedAt: serverTimestamp(),
        });

        devLog(
          `Promotion code redeemed: ${code} by user ${userId}. Credits: ${currentLimit} -> ${newLimit}`
        );

        return promoData.credits;
      });
    },
    { userId, code }
  );
};
