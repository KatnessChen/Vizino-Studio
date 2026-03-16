/**
 * Credit refund service for handling point refunds when services fail
 */
import { doc, updateDoc, getDoc, increment, getFirestore } from 'firebase/firestore';
import { app } from '@/config/firebaseConfig';
import { devLog, devError } from '@/utils/devLogger';
import { GeminiTaskName } from '@/services/gemini/geminiTasks';
import { withTracking } from './analyticsService';

const db = getFirestore(app);

/**
 * Refund credits when upscaling fails
 * @param uid - User ID
 * @param taskName - Task name
 * @param refundAmount - Amount to refund
 * @param byOwnKey - Whether the original charge was on own key
 */
export const refundCredits = async (
  uid: string,
  taskName: GeminiTaskName,
  refundAmount: number,
  byOwnKey: boolean = false
): Promise<void> => {
  return withTracking(
    'firestore_refund_credits',
    async () => {
      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const trackingKey = byOwnKey ? 'onOwnKey' : 'onVPoints';

        // Decrement the usage (which effectively refunds)
        await updateDoc(userRef, {
          [`usage.${taskName}.${trackingKey}`]: increment(-refundAmount),
        });

        devLog(
          `Refunded ${refundAmount} credits for ${taskName} (${byOwnKey ? 'own key' : 'V Points'})`
        );
      } else {
        devError('User not found, cannot refund credits');
      }
    },
    { taskName, refundAmount, byOwnKey }
  );
};

/**
 * Calculate the credit difference between target and actual resolution
 * @param targetResolution - Original requested resolution
 * @param actualResolution - Resolution actually delivered
 * @returns Refund amount
 */
export const calculateUpscalingRefund = (
  targetResolution: string,
  actualResolution: string
): number => {
  const resolutionMultipliers = {
    '1K': 1,
    '2K': 2,
    '4K': 6,
    '8K': 10,
  };

  const targetCost =
    resolutionMultipliers[targetResolution as keyof typeof resolutionMultipliers] || 2;
  const actualCost =
    resolutionMultipliers[actualResolution as keyof typeof resolutionMultipliers] || 2;

  return Math.max(0, targetCost - actualCost);
};
