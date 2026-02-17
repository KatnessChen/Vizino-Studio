/**
 * Mock Gemini Image Generation for Local Development
 *
 * This file provides mock implementations of Gemini image generation functions
 * to enable faster local development without consuming API tokens.
 *
 * Usage: Set VITE_USE_MOCK_GEMINI=true in .env.local to enable mock mode.
 */

import { devLog } from '@/utils/devLogger';

/**
 * Generates a simple colored canvas as base64
 * @param width - Canvas width
 * @param height - Canvas height
 * @param color - Canvas color (hex)
 * @param text - Optional text to overlay
 * @returns Base64 encoded PNG image
 */
const generateMockCanvas = (
  width: number = 800,
  height: number = 600,
  color: string = '#4A90E2',
  text?: string
): string => {
  // Create canvas element
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Fill background
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);

  // Add text overlay if provided
  if (text) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);

    // Add timestamp
    ctx.font = '16px sans-serif';
    ctx.fillText(new Date().toLocaleTimeString(), width / 2, height / 2 + 40);
  }

  // Convert to base64 (remove data:image/png;base64, prefix)
  return canvas.toDataURL('image/png').split(',')[1];
};

/**
 * Mock delay to simulate API call
 */
const mockDelay = (ms: number = 1500): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Mock implementation of processImageWithTask
 */
export const mockProcessImageWithTask = async (
  task: { task_name: string; label_name: string },
  image: { base64String: string; mimeType: string },
  options: {
    customPrompt?: string;
    colorName?: string;
    colorHex?: string;
    textureName?: string;
    itemName?: string;
    signal?: AbortSignal;
  } = {}
): Promise<{ base64: string; mimeType: string; hex?: string; name?: string }> => {
  devLog(`[MOCK] Generating image for task: ${task.label_name}`);

  // Check for abort signal
  if (options.signal?.aborted) {
    const abortErr = new Error('Request aborted');
    abortErr.name = 'AbortError';
    throw abortErr;
  }

  // Simulate API delay
  await mockDelay(1500);

  // Check again after delay
  if (options.signal?.aborted) {
    const abortErr = new Error('Request aborted');
    abortErr.name = 'AbortError';
    throw abortErr;
  }

  let mockColor = '#4A90E2'; // Default blue
  let mockText = task.label_name;
  const result: { base64: string; mimeType: string; hex?: string; name?: string } = {
    base64: '',
    mimeType: 'image/png',
  };

  // Customize based on task type
  switch (task.task_name) {
    case 'recolor_wall':
      mockColor = options.colorHex || '#E74C3C';
      mockText = `MOCK: Recolored Wall\n${options.colorName || 'Red'}`;
      result.base64 = generateMockCanvas(800, 600, mockColor, mockText);
      break;

    case 'add_texture':
      mockColor = '#8B4513';
      mockText = `MOCK: Added Texture\n${options.textureName || 'Texture'}`;
      result.base64 = generateMockCanvas(800, 600, mockColor, mockText);
      break;

    case 'add_home_item':
      mockColor = '#27AE60';
      mockText = `MOCK: Added Item\n${options.itemName || 'Item'}`;
      result.base64 = generateMockCanvas(800, 600, mockColor, mockText);
      break;

    case 'color_adjustment': {
      // Return a random color for color adjustment
      const randomHex =
        '#'+
        Math.floor(Math.random() * 16777215)
          .toString(16)
          .padStart(6, '0');
      mockColor = randomHex;
      mockText = `MOCK: Color Adjusted\n${randomHex}`;
      result.base64 = generateMockCanvas(200, 200, mockColor, '');
      result.hex = randomHex;
      result.name = `Mock Color ${randomHex.substring(1, 4).toUpperCase()}`;
      break;
    }

    case 'custom_prompt':
    case 'remove_clutter':
    default:
      mockText = `MOCK: ${task.label_name}\n${options.customPrompt?.substring(0, 30) || 'Custom'}`;
      result.base64 = generateMockCanvas(800, 600, mockColor, mockText);
      result.name = `Mock ${task.label_name}`;
      break;
  }

  devLog(`[MOCK] Generated ${task.label_name} successfully`);
  return result;
};

/**
 * Mock implementation of generateOptimizedPrompt
 */
export const mockGenerateOptimizedPrompt = async (
  task: { task_name: string; label_name: string },
  userPrompt: string,
  imageBase64: string,
  imageMimeType: string,
  signal?: AbortSignal
): Promise<string> => {
  devLog(`[MOCK] Optimizing prompt for task: ${task.label_name}`);

  // Check for abort signal
  if (signal?.aborted) {
    const abortErr = new Error('Request aborted');
    abortErr.name = 'AbortError';
    throw abortErr;
  }

  // Check again after delay
  if (signal?.aborted) {
    const abortErr = new Error('Request aborted');
    abortErr.name = 'AbortError';
    throw abortErr;
  }

  // Return enhanced mock prompt
  const mockOptimizedPrompt = `[MOCK OPTIMIZED] ${userPrompt} - Enhanced with AI analysis for realistic ${task.label_name} transformation. Maintaining photorealistic quality, proper lighting, and perspective.`;

  devLog(`[MOCK] Optimized prompt:`, mockOptimizedPrompt);
  return mockOptimizedPrompt;
};
