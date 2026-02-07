import { ref, getBytes, FirebaseStorage } from 'firebase/storage';
import { ImageData } from '@/types';

/**
 * Convert Blob to Base64 string (without prefix)
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Extract base64 string without data URL prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetch image from URL and convert to base64
 */
export async function fetchImageAsBase64(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
  }
  const blob = await response.blob();
  return await blobToBase64(blob);
}

/**
 * Fetches image data from Firebase Storage or a direct URL and converts to base64.
 *
 * @param storage Firebase Storage instance
 * @param imageData Image data object
 * @returns Promise resolving to base64 string
 */
export const getBase64FromImageData = async (storage: FirebaseStorage, imageData: ImageData) => {
  const storageFilePath = imageData.storageFilePath;

  // If no storage path, try to fetch directly from imageDownloadUrl
  if (!storageFilePath) {
    if (imageData.imageDownloadUrl) {
      return await fetchImageAsBase64(imageData.imageDownloadUrl);
    }
    throw new Error(`Storage path missing for image: ${imageData.id}`);
  }

  try {
    const storageRef = ref(storage, storageFilePath);
    const bytes = await getBytes(storageRef);
    const blob = new Blob([bytes], { type: imageData.mimeType });

    return await blobToBase64(blob);
  } catch (error) {
    console.error(`Failed to fetch image from Storage path: ${storageFilePath}`, error);
    throw new Error(
      `Failed to fetch image from Storage: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Extract image dimensions from base64 data
 * Loads the image into memory and reads naturalWidth/naturalHeight
 *
 * @param base64 Base64 encoded image string (without data URL prefix)
 * @param mimeType MIME type of the image
 * @returns Promise resolving to { width, height, aspect_ratio }
 */
export function extractImageDimensions(
  base64: string,
  mimeType: string
): Promise<{ width: number; height: number; aspect_ratio: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const aspect_ratio = width / height;

      resolve({ width, height, aspect_ratio });
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image from base64 data (${mimeType})`));
    };

    img.src = `data:${mimeType};base64,${base64}`;
  });
}
