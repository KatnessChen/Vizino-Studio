import { CREDIT_MULTIPLIERS, DEFAULT_CREDIT_LIMIT } from '@/constants/constants';
import { GeminiTaskName } from '@/services/gemini/geminiTasks';

/**
 * Usage data from Firestore user document
 */
export interface UsageData {
  [key: string]: number;
}

/**
 * Normalize usage object to ensure expected keys exist with default 0 values
 * - Includes all Gemini task names and special keys like 'thinking_mode'
 */
import { GEMINI_TASKS } from '@/services/gemini/geminiTasks';

export const normalizeUsage = (usage?: UsageData): UsageData => {
  const normalized: UsageData = {};

  // Ensure all defined Gemini tasks are present
  Object.values(GEMINI_TASKS).forEach((task) => {
    normalized[task.task_name] = 0;
  });

  // Include special usage keys
  normalized['thinking_mode'] = 0;

  if (!usage) return normalized;

  for (const [k, v] of Object.entries(usage)) {
    if (typeof v === 'number') normalized[k] = v;
  }

  return normalized;
};

/**
 * Calculate total V points consumed based on usage data
 * Formula: thinking_mode × 4, optimize_prompt × 4, all others × 1
 *
 * @param usage - Usage data object from Firestore
 * @returns Total V points consumed
 */
export const calculateTotalCredits = (usage: UsageData | undefined): number => {
  if (!usage) return 0;

  let total = 0;

  for (const [taskName, count] of Object.entries(usage)) {
    const multiplier = CREDIT_MULTIPLIERS[taskName] ?? 1;
    total += count * multiplier;
  }

  return total;
};

/**
 * Get the credit cost for a specific task
 *
 * @param taskName - The task name or 'thinking_mode'
 * @param thinkingMode - Whether thinking mode is enabled (adds thinking_mode cost)
 * @returns Credit cost for this operation
 */
export const getCreditCost = (
  taskName: GeminiTaskName | string | null,
  thinkingMode: boolean = false
): number => {
  if (!taskName) return 1;

  // Base cost from task
  const baseCost = CREDIT_MULTIPLIERS[taskName] ?? 1;

  // If thinking mode is enabled and this isn't already thinking_mode or optimize_prompt,
  // we count the thinking_mode increment separately
  if (thinkingMode && taskName !== 'thinking_mode' && taskName !== 'optimize_prompt') {
    return baseCost + CREDIT_MULTIPLIERS.thinking_mode;
  }

  return baseCost;
};

/**
 * Calculate usage percentage
 *
 * @param usage - Usage data object from Firestore
 * @param limit - Credit limit (defaults to DEFAULT_CREDIT_LIMIT)
 * @returns Usage percentage (0-100+, can exceed 100 if over limit)
 */
export const getUsagePercentage = (
  usage: UsageData | undefined,
  limit: number = DEFAULT_CREDIT_LIMIT
): number => {
  const total = calculateTotalCredits(usage);
  return Math.round((total / limit) * 100);
};

/**
 * Check if user has exceeded their credit limit
 *
 * @param usage - Usage data object from Firestore
 * @param limit - Credit limit (defaults to DEFAULT_CREDIT_LIMIT)
 * @returns True if user has exceeded or reached their limit
 */
export const hasExceededLimit = (
  usage: UsageData | undefined,
  limit: number = DEFAULT_CREDIT_LIMIT
): boolean => {
  const total = calculateTotalCredits(usage);
  return total >= limit;
};

/**
 * Get remaining credits
 *
 * @param usage - Usage data object from Firestore
 * @param limit - Credit limit (defaults to DEFAULT_CREDIT_LIMIT)
 * @returns Number of remaining credits (can be negative if exceeded)
 */
export const getRemainingCredits = (
  usage: UsageData | undefined,
  limit: number = DEFAULT_CREDIT_LIMIT
): number => {
  const total = calculateTotalCredits(usage);
  return limit - total;
};
