/**
 * Gemini API Error Messages
 * Centralized error message management for Gemini API responses
 *
 * Reference: https://ai.google.dev/api/rest/v1beta/models/generateContent#generatecontentresponse
 * For complete documentation on all possible error responses and blockReason types,
 * visit: https://ai.google.dev/docs/safety_ratings
 */

export const GEMINI_ERRORS = {
  // API Configuration Errors
  API_KEY_NOT_SET: 'API_KEY is not set in environment variables.',

  // Storage Errors
  IMAGE_STORAGE_PATH_MISSING: (imageId: string) =>
    `Image storageFilePath is missing for image ${imageId}`,
  FAILED_TO_FETCH_IMAGE: (error: string) => `Failed to fetch image: ${error}`,

  // Network Errors
  FAILED_TO_FETCH_FROM_URL: (statusText: string) => `Failed to fetch image from URL: ${statusText}`,

  // Safety & Content Policy Errors
  BLOCKED_BY_SAFETY_POLICY: (blockReason: string) => {
    switch (blockReason) {
      case 'SAFETY':
        return 'Request was blocked due to safety policies. Please try with different instructions.';
      case 'OTHER':
        return 'Request was blocked for unknown reasons. Please try again or modify your input.';
      default:
        return 'Request was blocked by Gemini API';
    }
  },

  // Response Processing Errors
  NO_IMAGE_DATA_RECEIVED: 'No image data received from Gemini API. Please try again.',
  NO_BASE64_DATA_RECEIVED: 'No base64 image data received from Gemini API.',

  // Generic Error Handler
  FAILED_TO_PROCESS_IMAGE: (error: string) => `Failed to process image: ${error}`,
};
