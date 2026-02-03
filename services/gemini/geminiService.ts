import { GoogleGenAI, Modality, GenerateContentResponse } from '@google/genai';
import { ImageData, Color, Texture, Item } from '@/types';
import { getPromptByTask, getNameSuggestionPrompt } from './prompts';
import { GeminiTask, GEMINI_TASKS } from './geminiTasks';
import { ASSET_TEXTURE, ASSET_ITEM, ASSET_COLOR } from '@/constants/constants';
import { GEMINI_ERRORS } from './geminiApiErrors';
import { ref } from 'firebase/storage';
import { getBytes } from 'firebase/storage';
import { storage } from '../firestoreService';

export { GEMINI_TASKS };
export type { GeminiTask };

// TODO: explore more model solutions and make this selectable to users
// https://ai.google.dev/gemini-api/docs/models
const defaultModel = 'gemini-2.5-flash-image';

const getBase64FromImageData = async (userId: string | undefined, imageData: ImageData) => {
  // Fetch the image from Firebase Storage using SDK
  const storageFilePath = imageData.storageFilePath;

  // If no storage path, try to fetch directly from imageDownloadUrl (for demo images or external URLs)
  if (!storageFilePath) {
    if (imageData.imageDownloadUrl) {
      console.log(
        '[Gemini] Fetching image from URL (no storage path):',
        imageData.imageDownloadUrl
      );
      return await fetchImageAsBase64(imageData.imageDownloadUrl);
    }
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
  customPrompt?: string,
  signal?: AbortSignal
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
    signal,
  });
};

export const generateRetexturedImage = async (
  userId: string,
  imageData: ImageData,
  textureImageDownloadUrl: string,
  textureMimeType: string,
  textureName: string,
  customPrompt?: string,
  signal?: AbortSignal
): Promise<{ base64: string; mimeType: string }> => {
  const image = {
    base64String: await getBase64FromImageData(userId, imageData),
    mimeType: imageData.mimeType,
  };

  // Fetch texture image from URL
  const textureBase64 = await fetchImageAsBase64(textureImageDownloadUrl, signal);

  const textureImage = {
    base64String: textureBase64,
    mimeType: textureMimeType,
  };

  return processImageWithTask(GEMINI_TASKS.ADD_TEXTURE, image, {
    textureName,
    customPrompt,
    userId,
    textureImage,
    signal,
  });
};

export const generateItemPlacedImage = async (
  userId: string,
  imageData: ImageData,
  itemImageDownloadUrl: string,
  itemMimeType: string,
  itemName: string,
  customPrompt?: string,
  signal?: AbortSignal
): Promise<{ base64: string; mimeType: string }> => {
  const image = {
    base64String: await getBase64FromImageData(userId, imageData),
    mimeType: imageData.mimeType,
  };

  // Fetch item image from URL
  const itemBase64 = await fetchImageAsBase64(itemImageDownloadUrl, signal);

  const itemImage = {
    base64String: itemBase64,
    mimeType: itemMimeType,
  };

  return processImageWithTask(GEMINI_TASKS.ADD_HOME_ITEM, image, {
    itemName,
    customPrompt,
    userId,
    itemImage,
    signal,
  });
};

export const generateCustomPromptImage = async (
  userId: string,
  targetImageOrAsset: ImageData | Color | Texture | Item,
  customPrompt: string,
  signal?: AbortSignal
): Promise<{ base64: string; mimeType: string; hex?: string; name?: string }> => {
  let image: { base64String: string; mimeType: string };

  // Handle Source Type
  if (targetImageOrAsset.assetType === ASSET_COLOR) {
    // It's a Color
    const color = targetImageOrAsset as Color;
    // Use efficient Text-to-Text generation for color adjustment
    return await processColorAdjustment(userId, color, customPrompt, signal);
  } else if (targetImageOrAsset.assetType === ASSET_TEXTURE) {
    // It's a Texture
    const texture = targetImageOrAsset as Texture;
    const base64 = await fetchImageAsBase64(texture.textureImageDownloadUrl, signal);
    image = {
      base64String: base64,
      mimeType: texture.mimeType || 'image/jpeg',
    };
  } else if (targetImageOrAsset.assetType === ASSET_ITEM) {
    // It's an Item
    const item = targetImageOrAsset as Item;
    const base64 = await fetchImageAsBase64(item.itemImageDownloadUrl, signal);
    image = {
      base64String: base64,
      mimeType: item.mimeType || 'image/jpeg',
    };
  } else {
    // It's ImageData
    const imgData = targetImageOrAsset as ImageData;
    image = {
      base64String: await getBase64FromImageData(userId, imgData),
      mimeType: imgData.mimeType,
    };
  }

  // Determine asset type for name suggestion
  let assetType = 'image';
  if (targetImageOrAsset.assetType === ASSET_TEXTURE) {
    assetType = ASSET_TEXTURE;
  } else if (targetImageOrAsset.assetType === ASSET_ITEM) {
    assetType = ASSET_ITEM;
  }

  // Execute image generation with integrated name suggestion
  // We append the name instruction to the prompt and ask for both Text and Image modalities
  const promptSuffix = `
    IMPORTANT: You must also suggest a creative, short name (max 5 words) for this ${assetType}.
    Return the name in a JSON object structure like this: {"name": "Suggested Name"}.
    The JSON should be in a text part of the response, separate from the image.
  `;

  const options = {
    customPrompt: (customPrompt || '') + promptSuffix,
    responseModalities: [Modality.TEXT, Modality.IMAGE],
    signal,
  };

  return processImageWithTask(GEMINI_TASKS.CUSTOM_PROMPT, image, options);
};

/**
 * Generate a suggested name using Text-only model
 */
export const generateNameSuggestion = async (
  customPrompt: string,
  assetType: string
): Promise<string | undefined> => {
  if (!process.env.API_KEY) return undefined;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-1.5-flash'; // Fast text model
    const prompt = getNameSuggestionPrompt(customPrompt, assetType);

    const result = await ai.models.generateContent({
      model,
      contents: {
        parts: [{ text: prompt }],
      },
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    return text?.trim();
  } catch (e) {
    console.warn('[Gemini] Failed to generate name suggestion:', e);
    return undefined;
  }
};

/**
 * Fetch image from URL and convert to base64
 */
async function fetchImageAsBase64(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(url, { signal });
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
    signal?: AbortSignal;
    responseModalities?: Modality[];
  } = {}
): Promise<{ base64: string; mimeType: string; hex?: string; name?: string }> => {
  if (!process.env.API_KEY) {
    throw new Error(GEMINI_ERRORS.API_KEY_NOT_SET);
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = getPromptByTask(task, options);
  // Priority: options.model > task.model_code > defaultModel
  const model = options.model ?? task.model_code ?? defaultModel;

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
    parts.push({ text: prompt + '\n' + prompt }); // Improve the ai response by repeating the prompt

    // If the caller provided an AbortSignal and it's already aborted, throw early
    if (options.signal && options.signal.aborted) {
      const abortErr = new Error('Request aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    // Pass AbortSignal to the underlying request if supported by the SDK. Also race with the signal
    // to ensure we respond quickly to aborts even if the SDK doesn't forward the signal.
    // Build request params; avoid passing unknown properties directly to typed SDK call
    const generateParams = {
      model,
      contents: {
        parts,
      },
      config: {
        responseModalities: options.responseModalities || [Modality.IMAGE],
      },
      signal: options.signal,
    } as const;

    const generatePromise = ai.models.generateContent(generateParams);

    let response: GenerateContentResponse;
    let abortHandler: (() => void) | null = null;

    if (options.signal) {
      // Race the generate promise with a promise that rejects when signal aborts
      const abortPromise = new Promise<never>((_, reject) => {
        abortHandler = () => {
          const abortErr = new Error('Request aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
        };
        options.signal!.addEventListener('abort', abortHandler!);
      });

      try {
        response = await Promise.race([generatePromise, abortPromise]);
      } finally {
        // Clean up event listener to avoid leaks
        if (abortHandler) {
          try {
            options.signal!.removeEventListener('abort', abortHandler);
          } catch {
            // ignore
          }
        }
      }
    } else {
      response = await generatePromise;
    }

    // If signal was aborted after response arrived, treat as aborted and ignore result
    if (options.signal && options.signal.aborted) {
      const abortErr = new Error('Request aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    // Check if request was blocked by safety filters or other reasons
    // Reference: https://ai.google.dev/docs/safety_ratings
    if (response.promptFeedback?.blockReason) {
      const blockReason = response.promptFeedback.blockReason;
      const errorMessage = GEMINI_ERRORS.BLOCKED_BY_SAFETY_POLICY(blockReason);
      throw new Error(errorMessage);
    }

    const candidates = response.candidates?.[0]?.content?.parts || [];

    // Find Image Part
    const generatedImagePart = candidates.find((p) => p.inlineData);

    // Find Text Part (for Name suggestion)
    const generatedTextPart = candidates.find((p) => p.text);
    let suggestedName: string | undefined;

    if (generatedTextPart && generatedTextPart.text) {
      try {
        const cleanJson = generatedTextPart.text.replace(/```json\n?|\n?```/g, '').trim();
        // Try to find JSON object pattern
        const match = cleanJson.match(/\{.*"name":\s*".*"\s*.*\}/s) || cleanJson.match(/\{.*\}/s);
        if (match) {
          const parsed = JSON.parse(match[0]);
          suggestedName = parsed.name;
        }
      } catch (e) {
        console.warn('[Gemini] Failed to parse JSON name from text part:', e);
      }
    }

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
      name: suggestedName,
    };
  } catch (error) {
    // Propagate aborts so callers can distinguish cancellation
    if (error && (error as Error).name === 'AbortError') {
      console.warn('Gemini request aborted by signal');
      const abortErr = new Error('Request aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    if (options.signal && options.signal.aborted) {
      console.warn('Gemini request aborted by provided signal');
      const abortErr = new Error('Request aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    console.error('Error processing image with Gemini API:', error);
    throw new Error(
      GEMINI_ERRORS.FAILED_TO_PROCESS_IMAGE(error instanceof Error ? error.message : String(error))
    );
  }
};

/**
 * Special processing for Color Adjustment (Text-to-Text -> Image)
 */
export const processColorAdjustment = async (
  userId: string,
  color: Color,
  customPrompt: string,
  signal?: AbortSignal
): Promise<{ base64: string; mimeType: string; hex?: string; name?: string }> => {
  if (!process.env.API_KEY) {
    throw new Error(GEMINI_ERRORS.API_KEY_NOT_SET);
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const task = GEMINI_TASKS.COLOR_ADJUSTMENT;
  const prompt = getPromptByTask(task, {
    colorHex: color.hex,
    customPrompt,
  });
  const model = task.model_code || 'gemini-2.5-flash';

  try {
    const generateParams = {
      model,
      contents: {
        parts: [{ text: prompt }],
      },
      // No responseModalities needed for Text output, default is TEXT
      signal,
    };

    const result = await ai.models.generateContent(generateParams);

    // Extract text from response
    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('[Gemini] Color Adjustment Response:', responseText);

    // Parse JSON from response
    let newHex = '';
    let suggestedName: string | undefined;
    try {
      // Clean up markdown code blocks if present
      const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
      const data = JSON.parse(cleanJson);
      newHex = data.hex;
      suggestedName = data.name;
    } catch (e) {
      console.warn('[Gemini] Failed to parse JSON, trying regex match', e);
      // Fallback regex for #RRGGBB
      const match = responseText.match(/#[0-9A-Fa-f]{6}/);
      if (match) newHex = match[0];
    }

    if (!newHex || !/^#[0-9A-Fa-f]{6}$/i.test(newHex)) {
      throw new Error(`Invalid color code returned: ${responseText}`);
    }

    // Generate solid color image from new Hex using SVG (Text-to-Text friendly)
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="100%" height="100%" fill="${newHex}" /></svg>`;
    // Simple btoa for browser environment
    const base64 = btoa(svgString);

    return {
      base64,
      mimeType: 'image/svg+xml',
      hex: newHex,
      name: suggestedName,
    };
  } catch (error) {
    console.error('Error processing color adjustment:', error);
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
