/**
 * Gemini API Configuration
 * Centralized model versions and system settings
 */

// TODO: explore more model solutions and make this selectable to users
// https://ai.google.dev/gemini-api/docs/models

import { GoogleGenAI } from '@google/genai';
import { devLog, devWarn } from '@/utils/devLogger';

export const FAST_TEXT_MODEL = 'gemini-2.5-flash-lite';

/**
 * Nano Banana image generation model (Balanced speed/quality)
 */
export const FAST_IMAGE_MODEL = 'gemini-2.5-flash-image';

/**
 * Nano Banana Pro - High-fidelity image generation model
 */
export const PRO_IMAGE_MODEL = 'gemini-3-pro-image-preview';

/**
 * Standard reasoning/analysis model
 */
export const DEFAULT_THINKING_MODEL = 'gemini-2.5-pro';

/**
 * Gemini API Shared Client (Singleton)
 * Used across the app to maintain consistent configuration
 */
export const getGeminiClient = (() => {
  let instance: GoogleGenAI | null = null;
  let currentKey: string | null = null;

  return (apiKey?: string) => {
    // If a specific key is requested and it's different from current,
    // OR if no instance exists yet
    if ((apiKey && apiKey !== currentKey) || !instance) {
      const keyToUse = apiKey || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY || '';

      if (!keyToUse) {
        devWarn('[GeminiConfig] API Key not found.');
      }

      instance = new GoogleGenAI({ apiKey: keyToUse });
      currentKey = apiKey || null; // Track if we are using a custom key
      devLog(`[GeminiConfig] Client initialized with ${apiKey ? 'custom' : 'default'} key.`);
    }
    return instance;
  };
})();

/**
 * Initialize or update the Gemini client with a specific API key.
 * If apiKey is provided, it switches to that key.
 * If apiKey is undefined, it attempts to revert to the default environment key (logic handled in getGeminiClient).
 */
export const initializeGeminiClient = (apiKey?: string) => {
  getGeminiClient(apiKey);
};
