export const FAST_TEXT_MODEL = 'gemini-2.5-flash';
export const FAST_IMAGE_MODEL = 'gemini-2.5-flash';
export const DEFAULT_THINKING_MODEL = 'gemini-2.0-pro-exp-02-05';
export const FAST_THINKING_MODEL = 'gemini-2.0-flash-thinking-exp-01-21';

// Gemini is now handled by the backend.
// initializeGeminiClient is kept for compatibility with GeminiClientManager.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const initializeGeminiClient = (_userApiKey?: string): void => {};

export const getGeminiClient = (): null => null;
