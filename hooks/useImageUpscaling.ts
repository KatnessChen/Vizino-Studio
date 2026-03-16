import { useState, useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { ImageData } from '@/types';
import { GeminiTaskName } from '@/services/gemini/geminiTasks';
import {
  ImageResolution,
  RESOLUTION_2K,
  RESOLUTION_4K,
  RESOLUTION_8K,
} from '@/constants/constants';
import { upscaleToResolution } from '@/services/upscaling/upscalingService';
import { updateImageUpscaleFields } from '@/services/firestoreService';
import { updateImageUpscaleData } from '@/stores/projectStore';
import { devLog, devError, devWarn } from '@/utils/devLogger';
import { incrementTaskUsage } from '@/services/userService';
import { base64ToFile } from '@/utils';
import { extractImageDimensions } from '@/utils/imageUtils';
import { getUpscaleFactor } from '@/constants/constants';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from '@/config/firebaseConfig';
import { Timestamp } from 'firebase/firestore';

interface UseImageUpscalingProps {
  userId?: string;
  projectId?: string;
  hasEnabledOwnKey?: boolean;
}

export const useImageUpscaling = ({
  userId,
  projectId,
  hasEnabledOwnKey = false,
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

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setIsUpscaling(true);
      setUpscaleProgress(0);
      setErrorMessage(null);

      try {
        devLog('[Upscaling] Starting upscaling process:', {
          imageId: image.id,
          from: currentResolution,
          to: targetResolution,
        });

        // Step 1: Download and prepare image (10%)
        setUpscaleProgress(10);

        // Fetch the current image as base64
        const response = await fetch(image.imageDownloadUrl);
        if (!response.ok) {
          throw new Error('Failed to download image for upscaling');
        }

        const blob = await response.blob();
        const reader = new FileReader();
        const imageBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // Remove data:image/xxx;base64, prefix
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        if (signal.aborted) {
          devWarn('[Upscaling] Request was cancelled');
          return false;
        }

        // Step 2: Call upscaling service (10% -> 80%)
        setUpscaleProgress(20);

        const currentDimension = Math.max(image.width || 2048, image.height || 2048);
        const targetPixels = currentPixels[targetResolution];

        const upscaleResult = await upscaleToResolution(
          imageBase64,
          image.mimeType,
          currentDimension,
          targetPixels,
          image.spaceId || undefined, // Convert null to undefined for type compatibility
          userId, // Pass userId for Firebase Storage upload path
          signal
        );

        if (signal.aborted) {
          devWarn('[Upscaling] Request was cancelled during upscaling');
          return false;
        }

        setUpscaleProgress(80);

        let downloadURL: string;
        let filePath: string;
        let width: number;
        let height: number;

        // Generate consistent file name for upscaled image
        const extension = image.mimeType.split('/')[1] || 'png';
        const upscaleId = `${image.id}_${targetResolution.toLowerCase()}`;
        const newFileName = `${upscaleId}.${extension}`;

        if (upscaleResult.downloadUrl) {
          // Step 3A: Large image - Cloud Function already uploaded to Firebase Storage
          downloadURL = upscaleResult.downloadUrl;

          // Extract file path from the Firebase download URL
          const url = new URL(downloadURL);
          const pathMatch = url.pathname.match(/\/o\/(.+?)(?:\?|$)/);
          filePath = pathMatch
            ? decodeURIComponent(pathMatch[1])
            : `users/${userId}/images/${newFileName}`;

          // Get dimensions from the uploaded image
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = downloadURL;
          });
          width = img.naturalWidth;
          height = img.naturalHeight;

          devLog('[Upscaling] Using Cloud Function uploaded image', {
            downloadURL,
            filePath,
            width,
            height,
          });
        } else if (upscaleResult.base64) {
          // Step 3B: Small image - Upload base64 to Firebase Storage
          const upscaledFile = base64ToFile(
            upscaleResult.base64,
            upscaleResult.mimeType,
            newFileName
          );
          const dimensions = await extractImageDimensions(
            upscaleResult.base64,
            upscaleResult.mimeType
          );
          width = dimensions.width;
          height = dimensions.height;

          // Use same path format as normal images: users/{userId}/images/{fileName}
          const storage = getStorage(app);
          filePath = `users/${userId}/images/${newFileName}`;
          const fileStorageRef = storageRef(storage, filePath);
          await uploadBytes(fileStorageRef, upscaledFile);
          downloadURL = await getDownloadURL(fileStorageRef);

          devLog('[Upscaling] Uploaded base64 image to Firebase Storage', {
            downloadURL,
            newFileName,
            width,
            height,
          });
        } else {
          throw new Error('Upscaling result contains neither base64 nor downloadUrl');
        }

        if (signal.aborted) {
          devWarn('[Upscaling] Request was cancelled during upload');
          return false;
        }

        setUpscaleProgress(90);

        // Step 4: Update image in Firestore and Redux (90% -> 100%)
        const newEvolutionChain = [
          ...image.evolutionChain,
          {
            imageId: image.id,
            imageDownloadUrl: image.imageDownloadUrl,
            taskName: 'upscale_image',
            customPrompt: null,
            options: {
              colorId: null,
              colorSnapshot: null,
              textureId: null,
              textureSnapshot: null,
              itemId: null,
              itemSnapshot: null,
              targetResolution,
              appliedResolution: targetResolution,
              isUpscalingOperation: true,
            },
            timestamp: Timestamp.fromDate(new Date()),
          },
        ];

        const updatedFields = {
          imageDownloadUrl: downloadURL,
          storageFilePath: filePath,
          name: newFileName,
          width,
          height,
          aspect_ratio: width / height,
          currentResolution: targetResolution,
          isUpscaled: true,
          evolutionChain: newEvolutionChain,
        };

        // Save all upscale fields to Firestore
        try {
          await updateImageUpscaleFields(
            userId,
            projectId,
            image.spaceId!,
            image.id,
            updatedFields
          );
          devLog('[Upscaling] Image upscale fields saved to Firestore');
        } catch (error) {
          devError('[Upscaling] Failed to save upscale fields to Firestore:', error);
          throw new Error('Failed to save upscaled image. Please try again.');
        }

        // Update Redux store with full image data so UI refreshes
        dispatch(
          updateImageUpscaleData({
            projectId,
            spaceId: image.spaceId!,
            imageId: image.id,
            updates: updatedFields,
          })
        );

        // Step 5: Charge credits (only for authenticated users without own key)
        if (!hasEnabledOwnKey) {
          try {
            const upscaleFactor = getUpscaleFactor(targetResolution);
            const creditCost = upscaleFactor === 2 ? 4 : 8; // 4K = 4 credits, 8K = 8 credits
            await incrementTaskUsage(userId, 'upscale_image' as GeminiTaskName, false, creditCost);
            devLog(`[Upscaling] Charged ${creditCost} credits for ${targetResolution} upscaling`);
          } catch (error) {
            devError('[Upscaling] Failed to charge credits:', error);
            // Don't fail the upscaling if credit charging fails
          }
        }

        setUpscaleProgress(100);

        devLog('[Upscaling] Upscaling completed successfully:', {
          from: currentResolution,
          to: targetResolution,
          newImageId: image.id,
          newFileName: newFileName,
          dimensions: `${width}x${height}`,
        });

        // Small delay to show 100% progress before reset
        setTimeout(() => {
          setIsUpscaling(false);
          setUpscaleProgress(0);
        }, 500);

        return true;
      } catch (error: unknown) {
        // Check if error is due to abort
        if ((error instanceof Error && error.name === 'AbortError') || signal.aborted) {
          devLog('[Upscaling] Request was cancelled by user');
          setIsUpscaling(false);
          setUpscaleProgress(0);
          return false;
        }

        devError('[Upscaling] Upscaling failed:', error);
        const errorMsg = error instanceof Error ? error.message : String(error);

        // Handle specific upscaling errors
        let displayMessage = 'Upscaling failed. Please try again.';

        if (errorMsg.includes('service unavailable') || errorMsg.includes('503')) {
          displayMessage = 'Upscaling service is temporarily unavailable. Please try again later.';
        } else if (errorMsg.includes('timeout') || errorMsg.includes('Request timeout')) {
          displayMessage =
            'Upscaling request timed out. Please try again with a smaller image or try again later.';
        } else if (errorMsg.includes('credit') || errorMsg.includes('quota')) {
          displayMessage = 'Insufficient credits for upscaling. Please check your account balance.';
        } else if (errorMsg.includes('Invalid image') || errorMsg.includes('image format')) {
          displayMessage = 'Invalid image format for upscaling. Please try with a different image.';
        }

        setErrorMessage(displayMessage);
        setIsUpscaling(false);
        setUpscaleProgress(0);
        return false;
      } finally {
        abortControllerRef.current = null;
      }
    },
    [dispatch, userId, projectId, hasEnabledOwnKey]
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
