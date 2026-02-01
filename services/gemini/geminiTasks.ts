/**
 * Gemini API Task Types
 * Use these constants to specify which task/prompt template to use
 */

export const GEMINI_TASKS = {
  RECOLOR_WALL: {
    task_name: 'recolor_wall',
    label_name: 'Recolor',
    customPromptRequired: false,
    model_code: 'gemini-2.5-flash-image',
  },
  ADD_TEXTURE: {
    task_name: 'add_texture',
    label_name: 'Add Texture',
    customPromptRequired: false,
    model_code: 'gemini-2.5-flash-image',
  },
  ADD_HOME_ITEM: {
    task_name: 'add_home_item',
    label_name: 'Add Object',
    customPromptRequired: false,
    model_code: 'gemini-2.5-flash-image',
  },
  CUSTOM_PROMPT: {
    task_name: 'custom_prompt',
    label_name: 'Prompt Only',
    customPromptRequired: true,
    model_code: 'gemini-2.5-flash-image',
  },
  COLOR_ADJUSTMENT: {
    task_name: 'color_adjustment',
    label_name: 'Color Adjustment',
    customPromptRequired: true,
    model_code: 'gemini-2.5-flash-lite',
  },
} as const;

export type GeminiTask = (typeof GEMINI_TASKS)[keyof typeof GEMINI_TASKS];
export type GeminiTaskName = GeminiTask['task_name'];

/**
 * Helper function to find a task entry by task_name
 * @param taskName - The task_name value to search for
 * @returns The task entry [key, task] or undefined if not found
 */
export const getTaskEntry = (taskName: GeminiTaskName) => {
  return Object.entries(GEMINI_TASKS).find(([, task]) => task.task_name === taskName);
};
