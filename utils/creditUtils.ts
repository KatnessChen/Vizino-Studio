import {
  CREDIT_MULTIPLIERS,
  DEFAULT_CREDIT_LIMIT,
  ImageResolution,
  RESOLUTION_CREDIT_MULTIPLIERS,
  RESOLUTION_2K,
} from '@/constants/constants';
import { GeminiTaskName } from '@/services/gemini/geminiTasks';
import { devWarn } from '@/utils/devLogger';

/**
 * Usage data from Firestore user document
 * New structure: { taskName: { onVPoints: number; onOwnKey: number } }
 */
export interface UsageData {
  [key: string]: { onVPoints: number; onOwnKey: number };
}

/**
 * Normalize usage object to ensure expected keys exist with default 0 values
 * - Includes all Gemini task names
 */
import { GEMINI_TASKS } from '@/services/gemini/geminiTasks';

export const normalizeUsage = (usage?: UsageData): UsageData => {
  const normalized: UsageData = {};

  // Ensure all defined Gemini tasks are present
  Object.values(GEMINI_TASKS).forEach((task) => {
    normalized[task.task_name] = { onVPoints: 0, onOwnKey: 0 };
  });

  if (!usage) return normalized;

  // Merge valid entries from usage, skipping corrupted ones
  for (const [k, v] of Object.entries(usage)) {
    // Only accept valid entries with proper structure
    if (
      v &&
      typeof v === 'object' &&
      'onVPoints' in v &&
      'onOwnKey' in v &&
      typeof (v as Record<string, unknown>).onVPoints === 'number' &&
      typeof (v as Record<string, unknown>).onOwnKey === 'number'
    ) {
      normalized[k] = v as { onVPoints: number; onOwnKey: number };
    } else if (v) {
      devWarn(`[creditUtils] Skipping corrupted usage entry for "${k}":`, v);
    }
  }

  return normalized;
};

/**
 * Calculate total V points consumed based on usage data (only onVPoints)
 * Formula: thinking_mode × 3, optimize_prompt × 4, all others × 1
 *
 * @param usage - Usage data object from Firestore
 * @returns Total V points consumed
 */
export const calculateTotalCredits = (usage: UsageData | undefined): number => {
  if (!usage) return 0;

  let total = 0;

  for (const [taskName, counts] of Object.entries(usage)) {
    if (counts && typeof counts === 'object' && 'onVPoints' in counts) {
      const multiplier = CREDIT_MULTIPLIERS[taskName] ?? 1;
      total += (counts.onVPoints || 0) * multiplier;
    }
  }

  return total;
};

/**
 * Get total usage count (onVPoints + onOwnKey) for a specific task
 *
 * @param usage - Usage data object from Firestore
 * @param taskName - Task name to get total count for
 * @returns Total usage count (both V Points and own key)
 */
export const getTotalTaskUsage = (usage: UsageData | undefined, taskName: string): number => {
  if (!usage || !usage[taskName]) return 0;
  const counts = usage[taskName];
  return (counts.onVPoints || 0) + (counts.onOwnKey || 0);
};

/**
 * Get the credit multiplier for a specific resolution
 *
 * @param resolution - The image resolution (1K, 2K, 4K)
 * @returns Multiplier for this resolution
 */
export const getResolutionMultiplier = (resolution: ImageResolution = RESOLUTION_2K): number => {
  return RESOLUTION_CREDIT_MULTIPLIERS[resolution] || 1;
};

/**
 * Get the credit cost for a specific task and resolution
 *
 * @param taskName - The task name
 * @param thinkingMode - Whether thinking mode is enabled (adds thinking_mode cost)
 * @param resolution - The image resolution (1K, 2K, 4K)
 * @returns Credit cost for this operation
 */
export const getCreditCost = (
  taskName: GeminiTaskName | string | null,
  thinkingMode: boolean = false,
  resolution: ImageResolution = RESOLUTION_2K
): number => {
  if (!taskName) return 1;

  // Base cost from task
  let cost = CREDIT_MULTIPLIERS[taskName] ?? 1;

  // Apply resolution multiplier if it's an image generation task
  const isImageTask = [
    'recolor_wall',
    'add_texture',
    'add_home_item',
    'custom_prompt',
    'remove_clutter',
    'brighten_space',
    'industrial_style',
    'loft_style',
  ].includes(taskName);

  if (isImageTask) {
    const resolutionMultiplier = getResolutionMultiplier(resolution);
    cost *= resolutionMultiplier;
  }

  // If thinking mode is enabled and this isn't already thinking_mode or optimize_prompt,
  // we count the thinking_mode increment separately
  if (thinkingMode && taskName !== 'thinking_mode' && taskName !== 'optimize_prompt') {
    cost += CREDIT_MULTIPLIERS.thinking_mode;
  }

  return cost;
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
