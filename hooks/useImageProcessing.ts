import { useState, useCallback, useRef } from 'react';
import { ImageData, Color, Asset } from '@/types';
import { ASSET_TEXTURE, ASSET_ITEM } from '@/constants/constants';
import {
  generateRecoloredImage,
  generateRetexturedImage,
  generateItemPlacedImage,
  generateCustomPromptImage,
} from '@/services/gemini/geminiService';
import {
  GEMINI_TASKS,
  GeminiTaskName,
  isMagicPromptTask,
  getTask,
  hasDefaultPrompt,
} from '@/services/gemini/geminiTasks';
import { incrementTaskUsage } from '@/services/userService';

interface Texture {
  id: string;
  name: string;
  textureImageDownloadUrl: string;
  mimeType?: string;
  description?: string;
  assetType: typeof ASSET_TEXTURE;
}

interface Item {
  id: string;
  name: string;
  itemImageDownloadUrl: string;
  mimeType?: string;
  description?: string;
  assetType: typeof ASSET_ITEM;
}

interface UseImageProcessingProps {
  userId: string | undefined;
  guestSessionId?: string | null;
  selectedTaskName: GeminiTaskName;
  thinkingMode?: boolean;
  options: {
    selectedColor?: Color | null;
    selectedTexture?: Texture | null;
    selectedItem?: Item | null;
  };
}

export const useImageProcessing = ({
  userId,
  guestSessionId,
  selectedTaskName,
  thinkingMode,
  options: { selectedColor, selectedTexture, selectedItem },
}: UseImageProcessingProps) => {
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<{ label: string; action: () => void } | null>(
    null
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  // Use userId if available, otherwise use guestSessionId for guest mode
  const effectiveUserId = userId || guestSessionId || undefined;

  const cancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsProcessingImage(false);
      setErrorMessage(null);
      setErrorAction(null);
    }
  }, []);

  const processImage = useCallback(
    async (
      source: ImageData | Color | Texture | Item, // Updated to accept unified source
      customPrompt: string | undefined
    ): Promise<{ base64: string; mimeType: string; hex?: string; name?: string } | null> => {
      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setIsProcessingImage(true);
      setErrorMessage(null);

      if (!effectiveUserId) {
        setErrorMessage('User ID is required to process images.');
        setIsProcessingImage(false);
        return null;
      }

      try {
        let result: { base64: string; mimeType: string; hex?: string; name?: string };

        // Helper to ensure we have ImageData for older tasks that strictly require it
        const ensureImageData = (src: Asset | ImageData): ImageData => {
          if ('imageDownloadUrl' in src) return src as ImageData;
          throw new Error('This task requires an Image source.');
        };

        if (selectedTaskName === GEMINI_TASKS.RECOLOR_WALL.task_name) {
          if (!selectedColor) {
            setErrorMessage('Please select a color first.');
            setIsProcessingImage(false);
            return null;
          }

          result = await generateRecoloredImage(
            effectiveUserId,
            ensureImageData(source),
            selectedColor.name,
            selectedColor.hex,
            customPrompt,
            signal,
            thinkingMode
          );
        } else if (selectedTaskName === GEMINI_TASKS.ADD_TEXTURE.task_name) {
          if (!selectedTexture) {
            setErrorMessage('Please select a texture first.');
            setIsProcessingImage(false);
            return null;
          }
          result = await generateRetexturedImage(
            effectiveUserId,
            ensureImageData(source),
            selectedTexture.textureImageDownloadUrl,
            selectedTexture.mimeType || 'image/jpeg',
            selectedTexture.name,
            customPrompt,
            signal,
            thinkingMode
          );
        } else if (selectedTaskName === GEMINI_TASKS.ADD_HOME_ITEM.task_name) {
          if (!selectedItem) {
            setErrorMessage('Please select a home item first.');
            setIsProcessingImage(false);
            return null;
          }
          result = await generateItemPlacedImage(
            effectiveUserId,
            ensureImageData(source),
            selectedItem.itemImageDownloadUrl,
            selectedItem.mimeType || 'image/jpeg',
            selectedItem.name,
            customPrompt,
            signal,
            thinkingMode
          );
        } else if (
          selectedTaskName === GEMINI_TASKS.CUSTOM_PROMPT.task_name ||
          isMagicPromptTask(selectedTaskName)
        ) {
          // For custom prompt and magic prompt tasks, no validation needed if task provides default prompt
          const task = getTask(selectedTaskName);
          const taskHasDefaultPrompt = hasDefaultPrompt(task);

          if (!taskHasDefaultPrompt && (!customPrompt || customPrompt.trim() === '')) {
            setErrorMessage('Please enter a custom prompt first.');
            setIsProcessingImage(false);
            return null;
          }

          // Use custom prompt if provided, otherwise use default prompt from task
          const effectivePrompt = customPrompt || (taskHasDefaultPrompt ? task.defaultPrompt : '');

          // source can be ImageData, Color, Texture, or Item. Service handles logic.
          result = await generateCustomPromptImage(
            effectiveUserId,
            source,
            effectivePrompt,
            signal,
            task,
            thinkingMode
          );
        } else {
          throw new Error('Unknown task type');
        }

        // Increment task usage in Firestore (only for authenticated users)
        if (userId) {
          try {
            await incrementTaskUsage(userId, selectedTaskName);
            // Also track thinking mode usage if enabled
            if (thinkingMode) {
              await incrementTaskUsage(userId, 'thinking_mode');
            }
          } catch (error) {
            console.error('Failed to increment task usage:', error);
            // Don't block the user flow if usage tracking fails
          }
        }

        setIsProcessingImage(false);
        abortControllerRef.current = null;
        return result;
      } catch (error: unknown) {
        // Check if error is due to abort
        if ((error instanceof Error && error.name === 'AbortError') || signal.aborted) {
          console.log('Request was cancelled by user');
          setIsProcessingImage(false);
          abortControllerRef.current = null;
          return null;
        }

        console.error('Processing failed:', error);
        const msg = error instanceof Error ? error.message : String(error);
        let displayMessage = `Processing failed: ${msg}.`;

        let apiError: unknown = null;
        try {
          const jsonStringMatch = msg.match(/\{"error":\{.*\}\}/);
          if (jsonStringMatch) {
            apiError = JSON.parse(jsonStringMatch[0]);
          }
        } catch (e) {
          console.warn('Failed to parse error message as JSON:', e);
        }

        if (apiError && typeof apiError === 'object' && 'error' in apiError) {
          const errorObj = apiError as {
            error?: { status?: string; code?: number; message?: string; details?: unknown[] };
          };
          if (errorObj.error?.status === 'INVALID_ARGUMENT' && errorObj.error?.code === 400) {
            // Check if it's an API key validation error
            if (errorObj.error?.message?.includes('API key')) {
              displayMessage = `Your Gemini API key is invalid or expired. Please check your API key in Settings and try again.`;
              setErrorAction({
                label: 'Go to Settings',
                action: () => {
                  window.location.href = '/user_profile';
                },
              });
            }
          } else if (
            errorObj.error?.status === 'RESOURCE_EXHAUSTED' ||
            errorObj.error?.code === 429
          ) {
            const rateLimitDocsLink =
              (Array.isArray(errorObj.error.details) &&
                errorObj.error.details[1] &&
                typeof errorObj.error.details[1] === 'object' &&
                'links' in errorObj.error.details[1] &&
                Array.isArray((errorObj.error.details[1] as { links?: unknown[] }).links) &&
                (errorObj.error.details[1] as { links?: unknown[] }).links?.[0] &&
                typeof (errorObj.error.details[1] as { links?: unknown[] }).links?.[0] ===
                  'object' &&
                (errorObj.error.details[1] as { links?: { url?: string }[] }).links?.[0]?.url) ||
              'https://ai.google.dev/gemini-api/docs/rate-limits';
            const usageLink = 'https://ai.dev/usage?tab=rate-limit';
            displayMessage = `Processing failed due to quota limits. You've exceeded your current usage limit for the Gemini API. Please check your plan and billing details. For more information, visit: ${rateLimitDocsLink} or monitor your usage at: ${usageLink}`;
          }
        } else if (msg.includes('Requested entity was not found.')) {
          displayMessage = `Processing failed. This might indicate an invalid API key or an issue with model availability. Please try again.`;
        } else {
          displayMessage = `Processing failed. If this error persists, try again or contact support.`;
        }

        setErrorMessage(displayMessage);
        setIsProcessingImage(false);
        abortControllerRef.current = null;
        return null;
      }
    },
    [
      effectiveUserId,
      selectedTaskName,
      selectedColor,
      selectedTexture,
      selectedItem,
      userId,
      thinkingMode,
    ]
  );

  return {
    processImage,
    isProcessingImage,
    errorMessage,
    setErrorMessage,
    errorAction,
    setErrorAction,
    cancelProcessing,
  };
};
