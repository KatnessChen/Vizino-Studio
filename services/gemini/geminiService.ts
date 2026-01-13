import { GoogleGenAI, Modality, GenerateContentResponse } from '@google/genai';
import { ImageData } from '@/types';
import { getPromptByTask } from './prompts';
import { GeminiTask, GEMINI_TASKS } from './geminiTasks';
import { GEMINI_ERRORS } from './geminiApiErrors';
import { ref } from 'firebase/storage';
import { getBytes } from 'firebase/storage';
import { storage } from '../firestoreService';

export { GEMINI_TASKS };
export type { GeminiTask };

// TODO: explore more model solutions and make this selectable to users
const defaultModel = 'gemini-3-pro-image-preview';

const getBase64FromImageData = async (userId: string | undefined, imageData: ImageData) => {
  // Fetch the image from Firebase Storage using SDK
  const storageFilePath = imageData.storageFilePath;

  if (!storageFilePath) {
    throw new Error(GEMINI_ERRORS.IMAGE_STORAGE_PATH_MISSING(imageData.id));
  }

  try {
    const storageRef = ref(storage, storageFilePath);
    const bytes = await getBytes(storageRef);
    const blob = new Blob([bytes], { type: imageData.mimeType });

    return await blobToBase64(blob);
  } catch (error) {
    console.error(`Failed to fetch image from Storage path: ${storageFilePath}`, error);
    throw new Error(
      GEMINI_ERRORS.FAILED_TO_FETCH_IMAGE(error instanceof Error ? error.message : String(error))
    );
  }
};

export const generateRecoloredImage = async (
  userId: string,
  imageData: ImageData,
  colorName: string,
  colorHex: string,
  customPrompt?: string
): Promise<{ base64: string; mimeType: string }> => {
  const image = {
    base64String: await getBase64FromImageData(userId, imageData),
    mimeType: imageData.mimeType,
  };

  return processImageWithTask(GEMINI_TASKS.RECOLOR_WALL, image, {
    colorName,
    colorHex,
    customPrompt,
    userId,
  });
};

export const generateRetexturedImage = async (
  userId: string,
  imageData: ImageData,
  textureImageDownloadUrl: string,
  textureMimeType: string,
  textureName: string,
  customPrompt?: string
): Promise<{ base64: string; mimeType: string }> => {
  const image = {
    base64String: await getBase64FromImageData(userId, imageData),
    mimeType: imageData.mimeType,
  };

  // Fetch texture image from URL
  const textureBase64 = await fetchImageAsBase64(textureImageDownloadUrl);

  const textureImage = {
    base64String: textureBase64,
    mimeType: textureMimeType,
  };

  return processImageWithTask(GEMINI_TASKS.ADD_TEXTURE, image, {
    textureName,
    customPrompt,
    userId,
    textureImage,
  });
};

export const generateItemPlacedImage = async (
  userId: string,
  imageData: ImageData,
  itemImageDownloadUrl: string,
  itemMimeType: string,
  itemName: string,
  customPrompt?: string
): Promise<{ base64: string; mimeType: string }> => {
  const image = {
    base64String: await getBase64FromImageData(userId, imageData),
    mimeType: imageData.mimeType,
  };

  // Fetch item image from URL
  const itemBase64 = await fetchImageAsBase64(itemImageDownloadUrl);

  const itemImage = {
    base64String: itemBase64,
    mimeType: itemMimeType,
  };

  return processImageWithTask(GEMINI_TASKS.ADD_HOME_ITEM, image, {
    itemName,
    customPrompt,
    userId,
    itemImage,
  });
};

export const generateCustomPromptImage = async (
  userId: string,
  imageData: ImageData,
  customPrompt: string
): Promise<{ base64: string; mimeType: string }> => {
  const image = {
    base64String: await getBase64FromImageData(userId, imageData),
    mimeType: imageData.mimeType,
  };

  return processImageWithTask(GEMINI_TASKS.CUSTOM_PROMPT, image, {
    customPrompt,
    userId,
  });
};

/**
 * Fetch image from URL and convert to base64
 */
async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(GEMINI_ERRORS.FAILED_TO_FETCH_FROM_URL(response.statusText));
  }
  const blob = await response.blob();
  return await blobToBase64(blob);
}

/**
 * Generic image processing function with task-based prompt selection
 * @param task - The task type (RECOLOR_WALL, ADD_TEXTURE, etc.)
 * @param imageData - The image to process
 * @param options - Task-specific options
 * @returns Object with base64 and mimeType of processed image
 */
export const processImageWithTask = async (
  task: GeminiTask,
  image: {
    base64String: string;
    mimeType: string;
  },
  options: {
    customPrompt?: string;
    model?: string;
    colorName?: string;
    colorHex?: string;
    textureName?: string;
    itemName?: string;
    userId?: string;
    textureImage?: {
      base64String: string;
      mimeType: string;
    };
    itemImage?: {
      base64String: string;
      mimeType: string;
    };
  } = {}
): Promise<{ base64: string; mimeType: string }> => {
  if (!process.env.API_KEY) {
    throw new Error(GEMINI_ERRORS.API_KEY_NOT_SET);
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = getPromptByTask(task, options);
  const model = options.model ?? defaultModel;

  try {
    // Build parts array
    const parts: Array<{ inlineData?: { data: string; mimeType: string }; text?: string }> = [];

    // For ADD_TEXTURE task, texture image comes first
    if (task.task_name === GEMINI_TASKS.ADD_TEXTURE.task_name && options.textureImage) {
      parts.push({
        inlineData: {
          data: options.textureImage.base64String,
          mimeType: options.textureImage.mimeType,
        },
      });
    }

    // For ADD_HOME_ITEM task, item image comes first
    if (task.task_name === GEMINI_TASKS.ADD_HOME_ITEM.task_name && options.itemImage) {
      parts.push({
        inlineData: {
          data: options.itemImage.base64String,
          mimeType: options.itemImage.mimeType,
        },
      });
    }

    // Add the main image
    parts.push({
      inlineData: {
        data: image.base64String,
        mimeType: image.mimeType,
      },
    });

    // Add the prompt text
    parts.push({ text: prompt });

    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents: {
        parts,
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    // Check if request was blocked by safety filters or other reasons
    // Reference: https://ai.google.dev/docs/safety_ratings
    if (response.promptFeedback?.blockReason) {
      const blockReason = response.promptFeedback.blockReason;
      const errorMessage = GEMINI_ERRORS.BLOCKED_BY_SAFETY_POLICY(blockReason);
      throw new Error(errorMessage);
    }

    const generatedImagePart = response.candidates?.[0]?.content?.parts?.[0];

    if (!generatedImagePart || !generatedImagePart.inlineData) {
      throw new Error(GEMINI_ERRORS.NO_IMAGE_DATA_RECEIVED);
    }

    const newImageBase64: string = generatedImagePart.inlineData.data ?? '';
    const newImageMimeType: string = generatedImagePart.inlineData.mimeType ?? 'image/png';

    if (!newImageBase64) {
      throw new Error(GEMINI_ERRORS.NO_BASE64_DATA_RECEIVED);
    }

    return {
      base64: newImageBase64,
      mimeType: newImageMimeType,
    };
  } catch (error) {
    console.error('Error processing image with Gemini API:', error);
    throw new Error(
      GEMINI_ERRORS.FAILED_TO_PROCESS_IMAGE(error instanceof Error ? error.message : String(error))
    );
  }
};

/**
 * Convert Blob to Base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
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
