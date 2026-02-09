import { MAGIC_PROMPT } from './prompts';
import { FAST_TEXT_MODEL, FAST_IMAGE_MODEL, DEFAULT_THINKING_MODEL } from './geminiConfig';

export const GEMINI_TASKS = {
  RECOLOR_WALL: {
    task_name: 'recolor_wall',
    label_name: 'Recolor',
    customPromptRequired: false,
    model_code: FAST_IMAGE_MODEL,
    temperature: 1.0,
  },
  ADD_TEXTURE: {
    task_name: 'add_texture',
    label_name: 'Add Texture',
    customPromptRequired: false,
    model_code: FAST_IMAGE_MODEL,
    temperature: 1.0,
  },
  ADD_HOME_ITEM: {
    task_name: 'add_home_item',
    label_name: 'Add Object',
    customPromptRequired: false,
    model_code: FAST_IMAGE_MODEL,
    temperature: 1.0,
  },
  CUSTOM_PROMPT: {
    task_name: 'custom_prompt',
    label_name: 'Prompt Only',
    customPromptRequired: true,
    model_code: FAST_IMAGE_MODEL,
    temperature: 1.0,
  },
  COLOR_ADJUSTMENT: {
    task_name: 'color_adjustment',
    label_name: 'Color Adjustment',
    customPromptRequired: true,
    model_code: FAST_TEXT_MODEL,
    temperature: 1.0,
  },
  REMOVE_CLUTTER: {
    task_name: 'remove_clutter',
    label_name: 'Remove Clutter',
    customPromptRequired: false,
    model_code: FAST_IMAGE_MODEL,
    useThinkingMode: true,
    temperature: 0.4,
    defaultPrompt: MAGIC_PROMPT.REMOVE_CLUTTER,
  },
  BRIGHTEN_SPACE: {
    task_name: 'brighten_space',
    label_name: 'Brighten Space',
    customPromptRequired: false,
    model_code: FAST_IMAGE_MODEL,
    useThinkingMode: true,
    temperature: 0.4,
    defaultPrompt: MAGIC_PROMPT.BRIGHTEN_SPACE,
  },
  INDUSTRIAL_STYLE: {
    task_name: 'industrial_style',
    label_name: 'Industrial Style',
    customPromptRequired: false,
    model_code: FAST_IMAGE_MODEL,
    useThinkingMode: true,
    temperature: 0.4,
    defaultPrompt: MAGIC_PROMPT.INDUSTRIAL_STYLE,
  },
  LOFT_STYLE: {
    task_name: 'loft_style',
    label_name: 'Loft Style',
    customPromptRequired: false,
    model_code: FAST_IMAGE_MODEL,
    useThinkingMode: true,
    temperature: 0.4,
    defaultPrompt: MAGIC_PROMPT.LOFT_STYLE,
  },
  THINKING_MODE: {
    task_name: 'thinking_mode',
    label_name: 'Thinking Mode',
    customPromptRequired: false,
    // Thinking Mode is represented as a logical task used for tracking and
    // accounting. It uses the DEFAULT_THINKING_MODEL and is not a standalone
    // image generation operation in the UI.
    model_code: DEFAULT_THINKING_MODEL,
    temperature: 0.4,
  },
  OPTIMIZE_PROMPT: {
    task_name: 'optimize_prompt',
    label_name: 'Optimize Prompt',
    customPromptRequired: true,
    model_code: DEFAULT_THINKING_MODEL,
    temperature: 0.4,
  },
} as const;

export type GeminiTask = (typeof GEMINI_TASKS)[keyof typeof GEMINI_TASKS];
export type GeminiTaskName = GeminiTask['task_name'];

/**
 * Map for O(1) task lookup by task_name
 * This eliminates the need for Object.values().find() every time
 */
export const TASKS_BY_NAME = new Map<GeminiTaskName, GeminiTask>(
  Object.values(GEMINI_TASKS).map((task) => [task.task_name, task])
);

/**
 * Get a task by its task_name
 * @param taskName - The task_name to look up
 * @returns The task object or undefined if not found
 */
export const getTask = (taskName: string | null): GeminiTask | undefined => {
  if (!taskName) return undefined;
  return TASKS_BY_NAME.get(taskName as GeminiTaskName);
};

/**
 * Check if a task requires a custom prompt
 * @param taskName - The task_name to check
 * @returns true if custom prompt is required, false otherwise
 */
export const isCustomPromptRequired = (taskName: string | null): boolean => {
  return getTask(taskName)?.customPromptRequired ?? false;
};

/**
 * Check if a task is a Magic Prompt task
 * Magic Prompt tasks are identified by having useThinkingMode enabled
 * @param taskName - The task_name to check
 * @returns true if this is a Magic Prompt task, false otherwise
 */
export const isMagicPromptTask = (taskName: string | null): boolean => {
  const task = getTask(taskName);
  return task ? 'useThinkingMode' in task && task.useThinkingMode === true : false;
};
/**
 * Type guard to check if a task has a defaultPrompt property
 * @param task - The task to check
 * @returns true if the task has a defaultPrompt, false otherwise
 */
export const hasDefaultPrompt = (
  task: GeminiTask | undefined
): task is GeminiTask & { defaultPrompt: string } => {
  return task !== undefined && 'defaultPrompt' in task && typeof task.defaultPrompt === 'string';
};
/**
 * @deprecated Use getTask() instead for better performance
 * Helper function to find a task entry by task_name
 * @param taskName - The task_name value to search for
 * @returns The task entry [key, task] or undefined if not found
 */
export const getTaskEntry = (taskName: GeminiTaskName) => {
  return Object.entries(GEMINI_TASKS).find(([, task]) => task.task_name === taskName);
};

/**
 * Check if Thinking Mode is available for a given task.
 * Thinking Mode allows using PRO_IMAGE_MODEL instead of FAST_IMAGE_MODEL.
 * Available for tasks that:
 * - Use FAST_IMAGE_MODEL as their default model
 * - Are NOT COLOR_ADJUSTMENT (uses FAST_TEXT_MODEL)
 * - Are NOT OPTIMIZE_PROMPT (uses DEFAULT_THINKING_MODEL)
 * @param taskName - The task_name to check
 * @returns true if Thinking Mode can be enabled, false otherwise
 */
export const isThinkingModeAvailable = (taskName: string | null): boolean => {
  if (!taskName) return false;
  const task = getTask(taskName);
  if (!task) return false;

  // Thinking mode is only available for tasks using FAST_IMAGE_MODEL
  return task.model_code === FAST_IMAGE_MODEL;
};
