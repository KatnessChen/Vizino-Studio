import { useState, useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { ImageData } from '@/types';
import {
  ImageResolution,
  RESOLUTION_2K,
  RESOLUTION_4K,
  RESOLUTION_8K,
} from '@/constants/constants';
import { updateImageUpscaleData } from '@/stores/projectStore';
import { devLog, devError } from '@/utils/devLogger';
import { backendService } from '@/services/backendService';

interface UseImageUpscalingProps {
  userId?: string;
  projectId?: string;
  hasEnabledOwnKey?: boolean;
}

export const useImageUpscaling = ({
  userId,
  projectId,
}: UseImageUpscalingProps) => {
  const dispatch = useDispatch();
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [upscaleProgress, setUpscaleProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelUpscaling = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsUpscaling(false);
      setUpscaleProgress(0);
      setErrorMessage(null);
    }
  }, []);

  const upscaleImage = useCallback(
    async (image: ImageData, targetResolution: ImageResolution) => {
      if (!userId || !projectId) {
        setErrorMessage('User authentication required for upscaling.');
        return false;
      }

      // Validate target resolution
      if (targetResolution !== RESOLUTION_4K && targetResolution !== RESOLUTION_8K) {
        setErrorMessage('Only 4K and 8K upscaling are supported.');
        return false;
      }

      // Check if image is already at target resolution or higher
      const currentResolution = image.currentResolution || RESOLUTION_2K;
      const currentPixels: Record<ImageResolution, number> = {
        '1K': 1024,
        '2K': 2048,
        '4K': 4096,
        '8K': 8192,
      };

      if (currentPixels[currentResolution] >= currentPixels[targetResolution]) {
        setErrorMessage(`Image is already at ${currentResolution} resolution or higher.`);
        return false;
      }

      setIsUpscaling(true);
      setUpscaleProgress(10);
      setErrorMessage(null);

      try {
        devLog('[Upscaling] Requesting upscale from backend:', {
          imageId: image.id,
          to: targetResolution,
        });

        // Step 1: Get image base64
        const response = await fetch(image.imageDownloadUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        const imageBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        setUpscaleProgress(30);

        // Step 2: Call backend upscale
        const scale = targetResolution === RESOLUTION_8K ? 4 : 2;
        const result = await backendService.upscaleImage({
          imageBase64,
          imageMimeType: image.mimeType,
          scale: scale as 2 | 4,
        });

        setUpscaleProgress(90);

        // Note: In a fully migrated system, the backend should also update the Firestore record
        // but since our backend upscale currently only returns the outputUrl, we still need
        // to update the local store.
        
        // TODO: Update backend to handle full upscale document update
        
        const updatedFields = {
          imageDownloadUrl: result.outputUrl,
          currentResolution: targetResolution,
          isUpscaled: true,
        };

        dispatch(
          updateImageUpscaleData({
            projectId,
            spaceId: image.spaceId!,
            imageId: image.id,
            updates: updatedFields,
          })
        );

        setUpscaleProgress(100);
        setTimeout(() => {
          setIsUpscaling(false);
          setUpscaleProgress(0);
        }, 500);

        return true;
      } catch (error: any) {
        devError('[Upscaling] Upscaling failed:', error);
        setErrorMessage(error.message || 'Upscaling failed');
        setIsUpscaling(false);
        setUpscaleProgress(0);
        return false;
      }
    },
    [dispatch, userId, projectId]
  );

  return {
    upscaleImage,
    isUpscaling,
    upscaleProgress,
    errorMessage,
    setErrorMessage,
    cancelUpscaling,
  };
};
