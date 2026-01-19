import { useState, useCallback, useRef } from 'react';
import { ImageData, Color } from '@/types';
import {
  generateRecoloredImage,
  generateRetexturedImage,
  generateItemPlacedImage,
  generateCustomPromptImage,
} from '@/services/gemini/geminiService';
import { GEMINI_TASKS, GeminiTaskName } from '@/services/gemini/geminiTasks';
import { incrementTaskUsage } from '@/services/userService';

interface Texture {
  id: string;
  name: string;
  textureImageDownloadUrl: string;
  mimeType?: string;
  description?: string;
}

interface Item {
  id: string;
  name: string;
  itemImageDownloadUrl: string;
  mimeType?: string;
  description?: string;
}

interface UseImageProcessingProps {
  userId: string | undefined;
  selectedTaskName: GeminiTaskName;
  options: {
    selectedColor?: Color | null;
    selectedTexture?: Texture | null;
    selectedItem?: Item | null;
  };
}

export const useImageProcessing = ({
  userId,
  selectedTaskName,
  options: { selectedColor, selectedTexture, selectedItem },
}: UseImageProcessingProps) => {
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsProcessingImage(false);
      setErrorMessage(null);
    }
  }, []);

  const processImage = useCallback(
    async (
      imageData: ImageData,
      customPrompt: string | undefined
    ): Promise<{ base64: string; mimeType: string } | null> => {
      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setIsProcessingImage(true);
      setErrorMessage(null);

      if (!userId) {
        setErrorMessage('User ID is required to process images.');
        setIsProcessingImage(false);
        return null;
      }

      try {
        let result: { base64: string; mimeType: string };

        if (selectedTaskName === GEMINI_TASKS.RECOLOR_WALL.task_name) {
          if (!selectedColor) {
            setErrorMessage('Please select a color first.');
            setIsProcessingImage(false);
            return null;
          }

          result = await generateRecoloredImage(
            userId,
            imageData,
            selectedColor.name,
            selectedColor.hex,
            customPrompt,
            signal
          );
        } else if (selectedTaskName === GEMINI_TASKS.ADD_TEXTURE.task_name) {
          if (!selectedTexture) {
            setErrorMessage('Please select a texture first.');
            setIsProcessingImage(false);
            return null;
          }
          result = await generateRetexturedImage(
            userId,
            imageData,
            selectedTexture.textureImageDownloadUrl,
            selectedTexture.mimeType || 'image/jpeg',
            selectedTexture.name,
            customPrompt,
            signal
          );
        } else if (selectedTaskName === GEMINI_TASKS.ADD_HOME_ITEM.task_name) {
          if (!selectedItem) {
            setErrorMessage('Please select a home item first.');
            setIsProcessingImage(false);
            return null;
          }
          result = await generateItemPlacedImage(
            userId,
            imageData,
            selectedItem.itemImageDownloadUrl,
            selectedItem.mimeType || 'image/jpeg',
            selectedItem.name,
            customPrompt,
            signal
          );
        } else if (selectedTaskName === GEMINI_TASKS.CUSTOM_PROMPT.task_name) {
          if (!customPrompt || customPrompt.trim() === '') {
            setErrorMessage('Please enter a custom prompt first.');
            setIsProcessingImage(false);
            return null;
          }
          result = await generateCustomPromptImage(userId, imageData, customPrompt, signal);
        } else {
          throw new Error('Unknown task type');
        }

        // Increment task usage in Firestore
        if (userId) {
          try {
            await incrementTaskUsage(userId, selectedTaskName);
          } catch (error) {
            console.error('Failed to increment task usage:', error);
            // Don't block the user flow if usage tracking fails
          }
        }

        setIsProcessingImage(false);
        abortControllerRef.current = null;
        return result;
      } catch (error: any) {
        // Check if error is due to abort
        if (error.name === 'AbortError' || signal.aborted) {
          console.log('Request was cancelled by user');
          setIsProcessingImage(false);
          abortControllerRef.current = null;
          return null;
        }

        console.error('Processing failed:', error);
        const msg = error instanceof Error ? error.message : String(error);
        let displayMessage = `Processing failed: ${msg}.`;

        let apiError: any = null;
        try {
          const jsonStringMatch = msg.match(/\{"error":\{.*\}\}/);
          if (jsonStringMatch) {
            apiError = JSON.parse(jsonStringMatch[0]);
          }
        } catch (e) {
          console.warn('Failed to parse error message as JSON:', e);
        }

        if (apiError?.error?.status === 'RESOURCE_EXHAUSTED' || apiError?.error?.code === 429) {
          const rateLimitDocsLink =
            apiError?.error?.details?.[1]?.links?.[0]?.url ||
            'https://ai.google.dev/gemini-api/docs/rate-limits';
          const usageLink = 'https://ai.dev/usage?tab=rate-limit';
          displayMessage = `Processing failed due to quota limits. You've exceeded your current usage limit for the Gemini API. Please check your plan and billing details. For more information, visit: ${rateLimitDocsLink} or monitor your usage at: ${usageLink}`;
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
    [userId, selectedTaskName, selectedColor, selectedTexture, selectedItem]
  );

  return {
    processImage,
    isProcessingImage,
    errorMessage,
    setErrorMessage,
    cancelProcessing,
  };
};
