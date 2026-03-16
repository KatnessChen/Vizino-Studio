/**
 * Upscaling Service
 * Uses Cloud Function to call Replicate API for AI-powered image upscaling (Real-ESRGAN)
 * This avoids CORS issues by proxying through a Cloud Function
 *
 * This service enables 4K/8K output by:
 * 1. Generating images at 2K via Gemini
 * 2. Upscaling to 4K (2x) or 8K (4x) via Real-ESRGAN through Cloud Function
 */

import { devLog, devError, devWarn } from '@/utils/devLogger';
import { withTracking } from '../analyticsService';

// Cloud Function URL for upscaling
const UPSCALE_FUNCTION_URL =
  'https://us-central1-vizion-studio-dev-ab6a5.cloudfunctions.net/upscaleImage';

// Alternative models for different use cases (for reference)
export const UPSCALE_MODELS = {
  REAL_ESRGAN: 'real-esrgan',
  // Can add more models here in the future
} as const;

export type UpscaleScale = 2 | 4;

export interface UpscaleOptions {
  scale?: UpscaleScale;
  faceEnhance?: boolean;
  spaceId?: string; // Optional space ID for Firebase Storage upload path
  userId?: string; // Optional user ID for Firebase Storage upload path
  signal?: AbortSignal;
}

export interface UpscaleResult {
  base64?: string; // For smaller images (4K and below)
  downloadUrl?: string; // For larger images (8K) - Firebase Storage URL
  mimeType: string;
  originalWidth?: number;
  originalHeight?: number;
  upscaledWidth?: number;
  upscaledHeight?: number;
}

interface CloudFunctionResponse {
  success: boolean;
  base64?: string; // For smaller images
  downloadUrl?: string; // For larger images - Firebase Storage URL
  mimeType?: string;
  outputUrl?: string;
  error?: string;
}

/**
 * Check if upscaling is available
 * Always returns true since we use Cloud Function (no local API key needed)
 */
export const isUpscalingAvailable = (): boolean => {
  return true;
};

/**
 * Upscale an image using Real-ESRGAN via Cloud Function
 * The Cloud Function handles the Replicate API call to avoid CORS issues
 *
 * @param imageBase64 - Base64 encoded image data
 * @param imageMimeType - MIME type of the image
 * @param options - Upscaling options
 * @returns Promise<UpscaleResult> - Upscaled image data
 */
// Custom error class for upscaling failures
export class UpscalingError extends Error {
  constructor(
    message: string,
    public isServiceUnavailable: boolean = false
  ) {
    super(message);
    this.name = 'UpscalingError';
  }
}

export const upscaleImage = async (
  imageBase64: string,
  imageMimeType: string,
  options: UpscaleOptions = {}
): Promise<UpscaleResult> => {
  const { scale = 2, spaceId, userId, signal } = options;

  return withTracking(
    'upscale_image',
    async () => {
      devLog('[Upscaling] Starting upscale via Cloud Function', { scale });

      // Call Cloud Function
      const response = await fetch(UPSCALE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64,
          imageMimeType,
          scale,
          spaceId, // Include spaceId for Firebase Storage upload path
          userId, // Include userId for Firebase Storage upload path
        }),
        signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        devError('[Upscaling] Cloud Function error:', errorBody);

        // Parse the error to determine if it's a service availability issue
        const isServiceIssue =
          response.status === 500 ||
          response.status === 503 ||
          errorBody.includes('Replicate API') ||
          errorBody.includes('service unavailable') ||
          errorBody.includes('timeout');

        throw new UpscalingError(`Upscaling service error: ${response.statusText}`, isServiceIssue);
      }

      const result: CloudFunctionResponse = await response.json();

      if (!result.success) {
        const isServiceIssue =
          result.error?.includes('Replicate API') ||
          result.error?.includes('failed') ||
          result.error?.includes('timeout') ||
          result.error?.includes('canceled');
        throw new UpscalingError(result.error || 'Upscaling failed', isServiceIssue);
      }

      // Check for either base64 or downloadUrl response
      if ((!result.base64 && !result.downloadUrl) || !result.mimeType) {
        throw new UpscalingError('Invalid response from upscaling service', true);
      }

      devLog('[Upscaling] Upscale complete via Cloud Function', {
        responseType: result.downloadUrl ? 'downloadUrl' : 'base64',
      });

      return {
        base64: result.base64,
        downloadUrl: result.downloadUrl,
        mimeType: result.mimeType,
      };
    },
    { scale, model: 'real-esrgan' }
  );
};

/**
 * Upscale image to target resolution
 * Automatically determines the scale factor needed
 *
 * @param imageBase64 - Base64 encoded image data
 * @param imageMimeType - MIME type
 * @param currentMaxDimension - Current largest dimension in pixels
 * @param targetMaxDimension - Target largest dimension in pixels
 * @param spaceId - Optional space ID for Firebase Storage upload path
 * @param userId - Optional user ID for Firebase Storage upload path
 * @param signal - Optional abort signal
 */
export const upscaleToResolution = async (
  imageBase64: string,
  imageMimeType: string,
  currentMaxDimension: number,
  targetMaxDimension: number,
  spaceId?: string,
  userId?: string,
  signal?: AbortSignal
): Promise<UpscaleResult> => {
  // Calculate required scale
  const requiredScale = targetMaxDimension / currentMaxDimension;

  devLog('[Upscaling] Required scale:', requiredScale, {
    current: currentMaxDimension,
    target: targetMaxDimension,
  });

  // Real-ESRGAN supports 2x and 4x
  // For scales > 4x, we may need multiple passes
  if (requiredScale <= 1) {
    devWarn('[Upscaling] No upscaling needed, returning original');
    return {
      base64: imageBase64,
      mimeType: imageMimeType,
    };
  }

  if (requiredScale <= 2) {
    return upscaleImage(imageBase64, imageMimeType, { scale: 2, spaceId, userId, signal });
  }

  if (requiredScale <= 4) {
    return upscaleImage(imageBase64, imageMimeType, { scale: 4, spaceId, userId, signal });
  }

  devWarn('[Upscaling] Scale > 4x not supported in single pass. Consider using 4x scale instead.');
  return upscaleImage(imageBase64, imageMimeType, { scale: 4, spaceId, userId, signal });
};

/**
 * Get estimated processing time for upscaling
 */
export const getUpscaleEstimatedTime = (scale: UpscaleScale): string => {
  switch (scale) {
    case 2:
      return '10-30 seconds';
    case 4:
      return '20-60 seconds';
    default:
      return '30-90 seconds';
  }
};

/**
 * Get credit cost multiplier for upscaling
 */
export const getUpscaleCreditMultiplier = (scale: UpscaleScale): number => {
  switch (scale) {
    case 2:
      return 1;
    case 4:
      return 2;
    default:
      return 1;
  }
};
