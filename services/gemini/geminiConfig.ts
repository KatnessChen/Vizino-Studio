export const FAST_TEXT_MODEL = 'gemini-2.5-flash';
export const FAST_IMAGE_MODEL = 'gemini-2.5-flash';
export const DEFAULT_THINKING_MODEL = 'gemini-2.0-pro-exp-02-05';
export const FAST_THINKING_MODEL = 'gemini-2.0-flash-thinking-exp-01-21';

let geminiClient: any = null;

/**
 * Initialize Gemini client with optional user API key
 * Falls back to VITE_GEMINI_API_KEY env var if no key provided
 */
export const initializeGeminiClient = (userApiKey?: string): void => {
  const apiKey = userApiKey || process.env.VITE_GEMINI_API_KEY || '';

  if (!apiKey) {
    console.warn('No Gemini API key available');
    geminiClient = null;
    return;
  }

  try {
    // Import here to allow dynamic initialization with different keys
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    geminiClient = new GoogleGenerativeAI(apiKey);
  } catch (error) {
    console.error('Failed to initialize Gemini client:', error);
    geminiClient = null;
  }
};

export const getGeminiClient = (): any => geminiClient;
