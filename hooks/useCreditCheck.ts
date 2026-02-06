import { useState, useEffect, useCallback } from 'react';
import { getUser } from '@/services/userService';
import { User } from '@/types';
import {
  calculateTotalCredits,
  hasExceededLimit,
  UsageData,
  normalizeUsage,
} from '@/utils/creditUtils';
import { DEFAULT_CREDIT_LIMIT } from '@/constants/constants';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Runtime type guard for usage data shape
 */
const isValidUsageData = (usage: unknown): usage is UsageData => {
  if (!usage) return false;
  if (typeof usage !== 'object') return false;
  return Object.values(usage as Record<string, unknown>).every((v) => typeof v === 'number');
};

interface UseCreditCheckOptions {
  userId: string | undefined;
  /** Credit limit (defaults to DEFAULT_CREDIT_LIMIT) */
  limit?: number;
}

interface UseCreditCheckResult {
  /** Whether user data is being loaded */
  isLoading: boolean;
  /** Total credits consumed */
  totalCredits: number;
  /** Remaining credits (can be negative if exceeded) */
  remainingCredits: number;
  /** Usage percentage (0-100+) */
  usagePercentage: number;
  /** Whether limit has been exceeded or reached */
  hasExceeded: boolean;
  /** Whether the credit exhausted modal should be shown */
  showCreditExhaustedModal: boolean;
  /** Set the modal visibility */
  setShowCreditExhaustedModal: (show: boolean) => void;
  /** Check if user can proceed with a specific operation */
  canProceed: boolean;
  /** Normalized usage data (includes all expected keys with defaults) */
  usage: UsageData;
  /** Credit limit (defaults to DEFAULT_CREDIT_LIMIT) */
  limit: number;
  /** Whether user has enabled their own Gemini API key */
  hasEnabledOwnKey: boolean;
  /** Refresh user data */
  refresh: () => Promise<void>;
}

/**
 * Hook to check user's V points credit status
 * Fetches user data and provides credit-related information
 */
export const useCreditCheck = ({
  userId,
  limit = DEFAULT_CREDIT_LIMIT,
}: UseCreditCheckOptions): UseCreditCheckResult => {
  const { adminSettings } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchUserData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const user = await getUser(userId);
      setUserData(user);
    } catch (error) {
      console.error('[useCreditCheck] Failed to fetch user data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchUserData();
  }, [fetchUserData]);

  // Validate and normalize usage, ensure all expected keys exist with default 0
  const rawUsage = isValidUsageData(userData?.usage) ? userData.usage : undefined;
  const usage = normalizeUsage(rawUsage);

  // Apply Mock Logic
  const isMockLimitReached = adminSettings.mock_credit_limit_reached;
  const isBypassEnabled = adminSettings.bypass_credit_limit;

  const realTotalCredits = calculateTotalCredits(usage);
  // If mock is enabled, assume usage is at least limit (unless it's already higher)
  const totalCredits = isMockLimitReached ? Math.max(realTotalCredits, limit) : realTotalCredits;

  const remainingCredits = limit - totalCredits;
  const usagePercentage = Math.round((totalCredits / limit) * 100);

  // Exceeded check:
  // 1. Naturally exceeded OR Mocked exceeded
  // 2. AND Bypass is NOT enabled
  const realExceeded = hasExceededLimit(usage, limit);

  // Logic:
  // If Bypass is ON: hasExceeded is FALSE (never blocked)
  // If Mock is ON: hasExceeded is TRUE (unless bypassed)
  // Otherwise: Real check
  // AND if user has their own key enabled, they are also not blocked (treated same as bypass effectively, but we track stats)
  const hasEnabledOwnKey = userData?.apiKey?.geminiKey && userData?.apiKey?.isActive;

  const hasExceeded =
    isBypassEnabled || hasEnabledOwnKey ? false : realExceeded || isMockLimitReached;

  const canProceed = !hasExceeded;

  return {
    limit,
    totalCredits,
    remainingCredits,
    usagePercentage,
    hasExceeded,
    canProceed,
    isLoading,
    usage: usage || {},
    hasEnabledOwnKey: !!hasEnabledOwnKey, // Explicitly return this status
    showCreditExhaustedModal: showModal,
    setShowCreditExhaustedModal: setShowModal,
    refresh: fetchUserData,
  };
};
