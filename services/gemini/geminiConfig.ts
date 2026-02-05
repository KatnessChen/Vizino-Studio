/**
 * Gemini API Configuration
 * Centralized model versions and system settings
 */

// TODO: explore more model solutions and make this selectable to users
// https://ai.google.dev/gemini-api/docs/models

import { GoogleGenAI } from '@google/genai';

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

  return () => {
    if (!instance) {
      const apiKey = process.env.API_KEY || process.env.VITE_GEMINI_API_KEY || '';
      if (!apiKey) {
        console.warn('[GeminiConfig] API Key not found in environment variables.');
      }
      instance = new GoogleGenAI({ apiKey });
    }
    return instance;
  };
})();
