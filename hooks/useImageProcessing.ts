import { useState, useCallback, useRef } from 'react';
import { ImageData, Color } from '@/types';
import { ASSET_TEXTURE, ASSET_ITEM } from '@/constants/constants';
import { devError } from '@/utils/devLogger';
import {
  GeminiTaskName,
} from '@/services/gemini/geminiTasks';
import { backendService } from '@/services/backendService';

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
  projectId: string | undefined;
  spaceId: string | undefined;
  selectedTaskName: GeminiTaskName;
  // Options kept for backward compatibility but using projectId/spaceId now
  options?: {
    selectedColor?: Color | null;
    selectedTexture?: Texture | null;
    selectedItem?: Item | null;
  };
}

export const useImageProcessing = ({
  userId,
  projectId,
  spaceId,
  selectedTaskName,
}: UseImageProcessingProps) => {
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<{ label: string; action: () => void } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
      sourceImage: ImageData,
      customPrompt: string | undefined,
      options: {
        selectedColor?: Color | null;
        selectedTexture?: Texture | null;
        selectedItem?: Item | null;
      }
    ): Promise<ImageData | null> => {
      if (!userId || !projectId || !spaceId) {
        setErrorMessage('Context (User/Project/Space) is required.');
        return null;
      }

      abortControllerRef.current = new AbortController();
      setIsProcessingImage(true);
      setErrorMessage(null);

      try {
        const result = await backendService.generateImage({
          imageId: sourceImage.id,
          projectId,
          spaceId,
          taskName: selectedTaskName,
          customPrompt,
          options: {
            colorId: options.selectedColor?.id,
            colorSnapshot: options.selectedColor ? { name: options.selectedColor.name, hex: options.selectedColor.hex } : undefined,
            textureId: options.selectedTexture?.id,
            textureSnapshot: options.selectedTexture ? { name: options.selectedTexture.name, url: options.selectedTexture.textureImageDownloadUrl } : undefined,
            itemId: options.selectedItem?.id,
            itemSnapshot: options.selectedItem ? { name: options.selectedItem.name, url: options.selectedItem.itemImageDownloadUrl } : undefined,
          }
        });

        setIsProcessingImage(false);
        return result;
      } catch (error: any) {
        devError('AI Generation failed:', error);
        setErrorMessage(error.response?.data?.message || error.message || 'Generation failed');
        setIsProcessingImage(false);
        return null;
      }
    },
    [userId, projectId, spaceId, selectedTaskName]
  );

  return {
    isProcessingImage,
    processImage,
    cancelProcessing,
    errorMessage,
    setErrorMessage,
    errorAction,
  };
};
