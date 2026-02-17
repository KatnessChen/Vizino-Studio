import { Modality, GenerateContentResponse } from '@google/genai';
import { ImageData, Color, Texture, Item } from '@/types';
import { getPromptByTask, getNameSuggestionPrompt } from './prompts';
import { GeminiTask, GEMINI_TASKS } from './geminiTasks';
import {
  FAST_TEXT_MODEL,
  FAST_IMAGE_MODEL,
  PRO_IMAGE_MODEL,
  getGeminiClient,
} from './geminiConfig';
import {
  ASSET_TEXTURE,
  ASSET_ITEM,
  ASSET_COLOR,
  MAX_CUSTOM_PROMPT_LENGTH,
} from '@/constants/constants';
import { GEMINI_ERRORS } from './geminiApiErrors';
import { storage } from '../firestoreService';
import { fetchImageAsBase64, getBase64FromImageData } from '@/utils';
import { withTracking } from '../analyticsService';
import {
  mockProcessImageWithTask,
  mockGenerateOptimizedPrompt,
} from './mockGeminiService';

// Helper function to check if we should use mock Gemini
// Mock is ONLY used in development mode when explicitly enabled
const shouldUseMockGemini = (): boolean => {
  const mode = import.meta.env.MODE; // 'development', 'production', or 'preview'
  const useMock = import.meta.env.VITE_USE_MOCK_GEMINI === 'true';
  
  // Never use mock in production or preview
  if (mode === 'production' || mode === 'preview') {
    return false;
  }
  
  // In development, respect the env variable
  return useMock;
};

/**
 * Helper to convert numeric aspect ratio to Gemini-friendly string
 */
const getGeminiAspectRatio = (aspectRatio: number | null | undefined): string | undefined => {
  if (!aspectRatio) return undefined;

  const ratios = [
    { label: '1:1', value: 1.0 },
    { label: '4:3', value: 4 / 3 },
    { label: '3:4', value: 3 / 4 },
    { label: '16:9', value: 16 / 9 },
    { label: '9:16', value: 9 / 16 },
  ];

  // Find closest supported ratio
  const closest = ratios.reduce((prev, curr) => {
    return Math.abs(curr.value - aspectRatio) < Math.abs(prev.value - aspectRatio) ? curr : prev;
  });

  return closest.label;
};

export { GEMINI_TASKS };
export type { GeminiTask };

/**
 * Additional context for prompt optimization
 */
interface OptimizePromptContext {
  // For ADD_TEXTURE task
  textureImage?: { base64: string; mimeType: string };
  textureName?: string;
  // For ADD_HOME_ITEM task
  itemImage?: { base64: string; mimeType: string };
  itemName?: string;
  // For RECOLOR_WALL task
  colorName?: string;
  colorHex?: string;
}

/**
 * Task-aware thinking prompt templates
 * Each task type has a customized analysis and generation strategy
 */
const getThinkingPromptForTask = (
  task: GeminiTask,
  userPrompt: string,
  context?: OptimizePromptContext
): string => {
  const baseStructure = `<role>
    You are an expert interior designer and prompt engineer specializing in photorealistic interior design transformation for image generation.
    </role>

    <context>
      CURRENT TASK: ${task.label_name}
      USER REQUEST: "${userPrompt}"
      TARGET OUTPUT: Generate an optimized, detailed prompt that instructs an image generation AI to accurately execute the user's request.
    </context>
  `;

  // Task-specific analysis and generation instructions
  switch (task.task_name) {
    case GEMINI_TASKS.RECOLOR_WALL.task_name:
      return `${baseStructure}

        <asset_context>
        SELECTED COLOR: ${context?.colorName || 'Not specified'} (${context?.colorHex || 'N/A'})
        </asset_context>

        <analysis_requirements>
        Analyze the provided interior photo:

        1. IDENTIFY WALLS TO RECOLOR:
          - Which walls are visible and paintable
          - Current wall colors and finishes
          - Areas that should receive the new color

        2. ELEMENTS TO PRESERVE:
          - Furniture, fixtures, and decorations
          - Flooring, ceiling, and trim
          - Lighting and shadows
          - All non-wall surfaces

        3. COLOR APPLICATION:
          - How the selected color (${context?.colorName || 'new color'}) will look
          - How it will interact with existing lighting
          - Maintaining realistic paint finish appearance
        </analysis_requirements>

        <prompt_generation>
        Create ONE coherent prompt that:
        - Specifies painting walls with ${context?.colorName || 'the new color'} (${context?.colorHex || ''})
        - Describes which walls to paint
        - Maintains all furniture and fixtures unchanged
        - Preserves realistic lighting and shadows
        - Keeps paint finish natural (matte, satin, etc.)
        </prompt_generation>

        <output_constraint>
        Output ONLY the optimized prompt text.
        - No preamble or explanation
        - No markdown formatting
        - CRITICAL: Maximum ${MAX_CUSTOM_PROMPT_LENGTH} characters
        </output_constraint>
      `;

    case GEMINI_TASKS.ADD_TEXTURE.task_name:
      return `${baseStructure}

        <asset_context>
        TEXTURE TO APPLY: ${context?.textureName || 'See second image'}
        NOTE: The SECOND image provided shows the texture/material to apply.
        </asset_context>

        <analysis_requirements>
        You are provided with TWO images:
        1. FIRST IMAGE: The interior room to transform
        2. SECOND IMAGE: The texture/material to apply (${context?.textureName || 'texture sample'})

        Analyze both images:

        1. FROM THE ROOM IMAGE:
          - Identify surfaces suitable for the texture (walls, floors, etc.)
          - Note current materials and finishes
          - Identify elements to preserve unchanged

        2. FROM THE TEXTURE IMAGE:
          - Observe the pattern, color, and material properties
          - Note the texture's scale and repeat pattern
          - Understand the material type (wood, stone, fabric, etc.)

        3. INTEGRATION PLANNING:
          - How the texture will wrap onto surfaces
          - Proper scaling for realistic appearance
          - Lighting interaction with the new material
        </analysis_requirements>

        <prompt_generation>
        Create ONE coherent prompt that:
        - Describes applying the ${context?.textureName || 'provided texture'} to appropriate surfaces
        - Specifies which surfaces receive the texture
        - Maintains proper texture scaling and perspective
        - Preserves furniture and other elements
        - Ensures realistic lighting on the new material
        </prompt_generation>

        <output_constraint>
        Output ONLY the optimized prompt text.
        - No preamble or explanation
        - No markdown formatting
        - CRITICAL: Maximum ${MAX_CUSTOM_PROMPT_LENGTH} characters
        </output_constraint>
      `;

    case GEMINI_TASKS.ADD_HOME_ITEM.task_name:
      return `${baseStructure}

        <asset_context>
        ITEM TO ADD: ${context?.itemName || 'See second image'}
        NOTE: The SECOND image provided shows the item/object to add to the room.
        </asset_context>

        <analysis_requirements>
        You are provided with TWO images:
        1. FIRST IMAGE: The interior room where the item will be placed
        2. SECOND IMAGE: The item/object to add (${context?.itemName || 'furniture/decor item'})

        Analyze both images:

        1. FROM THE ROOM IMAGE:
          - Available floor space or surfaces for placement
          - Room style and aesthetic
          - Existing furniture and layout
          - Lighting conditions

        2. FROM THE ITEM IMAGE:
          - Item type, style, and approximate dimensions
          - Material and color properties
          - How it should appear in the room context

        3. PLACEMENT PLANNING:
          - Best location for the item
          - Proper scale relative to the room
          - Integration with existing furniture arrangement
        </analysis_requirements>

        <prompt_generation>
        Create ONE coherent prompt that:
        - Describes adding the ${context?.itemName || 'provided item'} to the room
        - Specifies the ideal placement location
        - Maintains proper scale and perspective
        - Ensures the item matches the room's lighting
        - Preserves all existing furniture and elements
        </prompt_generation>

        <output_constraint>
        Output ONLY the optimized prompt text.
        - No preamble or explanation
        - No markdown formatting
        - CRITICAL: Maximum ${MAX_CUSTOM_PROMPT_LENGTH} characters
        </output_constraint>
      `;

    case GEMINI_TASKS.REMOVE_CLUTTER.task_name:
      return `${baseStructure}

        <analysis_requirements>
        Analyze the provided interior photo and user instructions:

        1. FIXED ELEMENTS (must preserve 100%):
          - Architectural structure (walls, floors, ceilings, doors, windows, trim, molding)
          - Main furniture pieces (sofas, beds, tables, chairs)
          - Built-in fixtures (shelves, cabinets, fixtures permanently attached)
          - Lighting fixtures and light sources

        2. CLUTTER TARGETS (identify but frame positively):
          - Small personal items on surfaces (books, decorations, toys, papers)
          - Loose items on floors, tables, counters
          - Visible disorder or disorganization
          - Unnecessary items that reduce visual cleanliness

        3. VISUAL PROPERTIES TO MAINTAIN:
          - Camera angle, perspective, framing (exactly the same viewpoint)
          - Lighting direction, intensity, color temperature
          - Material textures (fabric, wood, stone, paint finishes)
          - Room proportions and spatial relationships
          - Shadow patterns and depth

        4. DESIRED OUTCOME STATE:
          - Spacious, organized appearance
          - Pristine, professional show-home quality
          - All surfaces clean and organized
          - Minimal visual distractions
        </analysis_requirements>

        <prompt_generation>
        Create ONE coherent, detailed prompt with these characteristics:

        STRUCTURE YOUR PROMPT AROUND PRESERVATION (what to keep):
        - Start with: "Generate this room BUT organized/clean"
        - Explicitly list architectural and furniture elements to preserve
        - Describe the desired clean aesthetic

        BE SPECIFIC ABOUT REPLACEMENTS (not removals):
        - Instead of "remove clutter", say "make surfaces clear and organized"
        - Instead of "delete items", say "create an organized, minimalist arrangement"
        - Describe what empty/organized surfaces should look like
        - Fill empty spaces with organized arrangements if needed

        OPERATIONAL SPECIFICS:
        - Specify which surfaces should be cleared (counters, tables, floors)
        - Indicate that storage should look organized but closed
        - Request that any visible items be arranged neatly and purposefully
        - Ensure spacing between objects for visual clarity

        QUALITY ANCHORS:
        - Maintain photorealistic quality with consistent lighting
        - Ensure shadows and depth stay natural and logical
        - Keep color palette and ambient tone consistent
        - Verify proportions and scaling remain accurate
        </prompt_generation>

        <output_constraint>
        Output ONLY the optimized prompt text.
        - No preamble or explanation
        - No markdown formatting (no \`, #, **, etc.)
        - Single, coherent paragraph or well-structured instruction block
        - CRITICAL: Maximum ${MAX_CUSTOM_PROMPT_LENGTH} characters (strict limit)
        - Approximately 150-250 words for clarity and specificity
        </output_constraint>
      `;

    case GEMINI_TASKS.CUSTOM_PROMPT.task_name:
    default:
      return `${baseStructure}

        <analysis_requirements>
        Analyze the provided interior photo carefully:

        1. ROOM CHARACTERISTICS:
          - Room type and purpose (living room, bedroom, kitchen, etc.)
          - Architectural structure (walls, floors, ceilings, doors, windows)
          - Main furniture and fixtures
          - Lighting conditions and color temperature

        2. USER REQUEST INTERPRETATION:
          - What specific changes does the user want?
          - What elements should be preserved?
          - What is the desired outcome or aesthetic?

        3. VISUAL PROPERTIES TO MAINTAIN:
          - Camera angle, perspective, framing
          - Lighting direction and intensity
          - Material textures and room proportions
          - Shadow patterns and depth
        </analysis_requirements>

        <prompt_generation>
        Create ONE coherent, detailed prompt that:

        1. CLEARLY STATES THE TRANSFORMATION:
          - What specific changes to make
          - Which elements to preserve unchanged
          - The desired final aesthetic

        2. PROVIDES OPERATIONAL SPECIFICS:
          - Where exactly to apply changes
          - How changes should blend with existing elements
          - Quality and style expectations

        3. INCLUDES QUALITY ANCHORS:
          - Maintain photorealistic quality
          - Ensure consistent lighting and shadows
          - Keep proportions accurate
          - Preserve the image's resolution and clarity
        </prompt_generation>

        <output_constraint>
        Output ONLY the optimized prompt text.
        - No preamble or explanation
        - No markdown formatting (no \`, #, **, etc.)
        - Single, coherent paragraph or well-structured instruction block
        - CRITICAL: Maximum ${MAX_CUSTOM_PROMPT_LENGTH} characters (strict limit)
        - Approximately 100-200 words
        </output_constraint>
      `;
  }
};

/**
 * Generate an optimized prompt using the Thinking model.
 * This is exposed for the frontend to call separately before image generation.
 *
 * @param task - The Gemini task configuration
 * @param userPrompt - The user's original prompt/request
 * @param imageBase64 - Base64 encoded main image data
 * @param imageMimeType - MIME type of the main image
 * @param signal - Optional AbortSignal for cancellation
 * @param additionalContext - Optional context for task-specific assets (texture, item, color)
 * @returns Promise<string> - The optimized prompt text
 */
export const generateOptimizedPrompt = async (
  task: GeminiTask,
  userPrompt: string,
  imageBase64: string,
  imageMimeType: string,
  signal?: AbortSignal,
  additionalContext?: OptimizePromptContext
): Promise<string> => {
  // Use mock service if enabled
  if (shouldUseMockGemini()) {
    console.log('[MOCK MODE] Using mock prompt optimization');
    return mockGenerateOptimizedPrompt(task, userPrompt, imageBase64, imageMimeType, signal);
  }
  
  return withTracking('gemini_optimize_prompt', async () => {
    const ai = getGeminiClient();

  // Get task-aware thinking prompt with context
  const thinkingPrompt = getThinkingPromptForTask(task, userPrompt, additionalContext);

  // Check for early abort
  if (signal?.aborted) {
    const abortErr = new Error('Request aborted');
    abortErr.name = 'AbortError';
    throw abortErr;
  }

  try {
    // Build parts array - main image first
    const parts: Array<{ inlineData?: { data: string; mimeType: string }; text?: string }> = [
      {
        inlineData: {
          data: imageBase64,
          mimeType: imageMimeType,
        },
      },
    ];

    // Add texture image if provided (for ADD_TEXTURE task)
    if (additionalContext?.textureImage) {
      parts.push({
        inlineData: {
          data: additionalContext.textureImage.base64,
          mimeType: additionalContext.textureImage.mimeType,
        },
      });
    }

    // Add item image if provided (for ADD_HOME_ITEM task)
    if (additionalContext?.itemImage) {
      parts.push({
        inlineData: {
          data: additionalContext.itemImage.base64,
          mimeType: additionalContext.itemImage.mimeType,
        },
      });
    }

    // Add the thinking prompt as the last part
    parts.push({ text: thinkingPrompt });

    const generateParams = {
      model: GEMINI_TASKS.OPTIMIZE_PROMPT.model_code,
      contents: {
        parts,
      },
      config: {
        responseModalities: [Modality.TEXT],
        temperature: (task as { temperature?: number }).temperature ?? 0.4,
      },
      signal,
    };

    const result = await ai.models.generateContent(
      generateParams as unknown as Parameters<typeof ai.models.generateContent>[0]
    );

    let optimizedPrompt = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (optimizedPrompt) {
      // Clean up any markdown formatting
      optimizedPrompt = optimizedPrompt.replace(/```(?:json|text|markdown)?\n?|\n?```/g, '');

      // Remove common prefixes
      optimizedPrompt = optimizedPrompt.replace(
        /^(Here is|Here's|Here are|The optimized|Optimized|Prompt:)\s*/i,
        ''
      );

      // Remove surrounding quotes if present
      optimizedPrompt = optimizedPrompt.replace(/^["']|["']$/g, '');

      optimizedPrompt = optimizedPrompt.trim();

      // Enforce character limit
      if (optimizedPrompt.length > MAX_CUSTOM_PROMPT_LENGTH) {
        console.warn(
          `[Gemini] Optimized prompt exceeded ${MAX_CUSTOM_PROMPT_LENGTH} chars (${optimizedPrompt.length}), truncating...`
        );
        optimizedPrompt = optimizedPrompt.substring(0, MAX_CUSTOM_PROMPT_LENGTH).trim();
      }

      console.log('[Gemini] Generated Optimized Prompt:', optimizedPrompt);
      return optimizedPrompt;
    }

    // Return original prompt if optimization failed
    return userPrompt;
  } catch (error) {
    // Propagate abort errors
    if (error && (error as Error).name === 'AbortError') {
      throw error;
    }
    console.warn('[Gemini] Prompt optimization failed:', error);
    // Fall back to original prompt on error
    return userPrompt;
    }
  }, { task: task.task_name });
};

export const generateRecoloredImage = async (
  userId: string,
  imageData: ImageData,
  colorName: string,
  colorHex: string,
  customPrompt?: string,
  signal?: AbortSignal,
  thinkingMode?: boolean
): Promise<{ base64: string; mimeType: string }> => {
  const image = {
    base64String: await getBase64FromImageData(storage, imageData),
    mimeType: imageData.mimeType,
  };

  return processImageWithTask(GEMINI_TASKS.RECOLOR_WALL, image, {
    colorName,
    colorHex,
    customPrompt,
    userId,
    signal,
    aspectRatio: getGeminiAspectRatio(imageData.aspect_ratio),
    modelOverride: thinkingMode ? PRO_IMAGE_MODEL : undefined,
  });
};

export const generateRetexturedImage = async (
  userId: string,
  imageData: ImageData,
  textureImageDownloadUrl: string,
  textureMimeType: string,
  textureName: string,
  customPrompt?: string,
  signal?: AbortSignal,
  thinkingMode?: boolean
): Promise<{ base64: string; mimeType: string }> => {
  const image = {
    base64String: await getBase64FromImageData(storage, imageData),
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
    aspectRatio: getGeminiAspectRatio(imageData.aspect_ratio),
    modelOverride: thinkingMode ? PRO_IMAGE_MODEL : undefined,
  });
};

export const generateItemPlacedImage = async (
  userId: string,
  imageData: ImageData,
  itemImageDownloadUrl: string,
  itemMimeType: string,
  itemName: string,
  customPrompt?: string,
  signal?: AbortSignal,
  thinkingMode?: boolean
): Promise<{ base64: string; mimeType: string }> => {
  const image = {
    base64String: await getBase64FromImageData(storage, imageData),
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
    aspectRatio: getGeminiAspectRatio(imageData.aspect_ratio),
    modelOverride: thinkingMode ? PRO_IMAGE_MODEL : undefined,
  });
};

// Note: Prompt optimization is now handled separately via generateOptimizedPrompt.
// Magic tasks use the default MAGIC_PROMPT or user-provided prompt directly.

export const generateCustomPromptImage = async (
  userId: string,
  targetImageOrAsset: ImageData | Color | Texture | Item,
  customPrompt: string,
  signal?: AbortSignal,
  taskOverride?: GeminiTask,
  thinkingMode?: boolean
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
      base64String: await getBase64FromImageData(storage, imgData),
      mimeType: imgData.mimeType,
    };
  }

  // Determine Aspect Ratio
  const ratio = (targetImageOrAsset as Texture | Item | ImageData).aspect_ratio;
  const aspectRatio = getGeminiAspectRatio(ratio);

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
    modelOverride: thinkingMode ? PRO_IMAGE_MODEL : undefined,
  };

  const task = taskOverride || GEMINI_TASKS.CUSTOM_PROMPT;
  return processImageWithTask(task, image, { ...options, aspectRatio });
};

/**
 * Generate a suggested name using Text-only model
 */
export const generateNameSuggestion = async (
  customPrompt: string,
  assetType: string
): Promise<string | undefined> => {
  try {
    const ai = getGeminiClient();
    const model = FAST_TEXT_MODEL; // Fast text model
    const prompt = getNameSuggestionPrompt(customPrompt, assetType);

    const result = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    } as unknown as Parameters<typeof ai.models.generateContent>[0]);

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    return text?.trim();
  } catch (e) {
    console.warn('[Gemini] Failed to generate name suggestion:', e);
    return undefined;
  }
};

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
    aspectRatio?: string;
    modelOverride?: string;
  } = {}
): Promise<{ base64: string; mimeType: string; hex?: string; name?: string }> => {
  // Use mock service if enabled (only in development)
  if (shouldUseMockGemini()) {
    console.log('[MOCK MODE] Using mock Gemini service');
    return mockProcessImageWithTask(task, image, options);
  }
  
  return withTracking(`gemini_generate_${task.task_name}`, async () => {
    const ai = getGeminiClient();

    const prompt = getPromptByTask(task, options);

  // Note: optimizePromptWithThinking is no longer called here.
  // Prompt optimization is now handled separately via generateOptimizedPrompt.
  // Magic tasks use the default MAGIC_PROMPT or user-provided prompt directly.

  // Priority: options.modelOverride > task.model_code > FAST_IMAGE_MODEL
  // modelOverride is used when Thinking Mode is enabled to switch to PRO_IMAGE_MODEL
  const model = options.modelOverride || task.model_code || FAST_IMAGE_MODEL;

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
        // Temperature is configured in geminiTask definition
        temperature: (task as { temperature?: number }).temperature ?? 1.0,
        aspectRatio: options.aspectRatio, // Pass converted aspect ratio (e.g., '16:9')
        imageSize: '2K', // Enforce 2K resolution as requested
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
      // If we have text but no image, the model might have refused or failed.
      const textContent = candidates
        .map((p) => p.text)
        .filter(Boolean)
        .join('\n');
      if (textContent) {
        console.warn('[Gemini] Received text only (no image):', textContent);
        throw new Error(`Gemini refused to generate image: ${textContent.slice(0, 200)}...`);
      }
      throw new Error(GEMINI_ERRORS.NO_IMAGE_DATA_RECEIVED);
    }

    const newImageBase64: string = generatedImagePart.inlineData.data ?? '';
    const newImageMimeType: string = generatedImagePart.inlineData.mimeType ?? 'image/png';

    if (!newImageBase64) {
      const textContent = candidates
        .map((p) => p.text)
        .filter(Boolean)
        .join('\n');
      if (textContent) {
        throw new Error(`Received empty image data. Model text: ${textContent.slice(0, 200)}...`);
      }
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
  }, { task: task.task_name, model_code: task.model_code });
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
  const ai = getGeminiClient();
  const task = GEMINI_TASKS.COLOR_ADJUSTMENT;
  const prompt = getPromptByTask(task, {
    colorHex: color.hex,
    customPrompt,
  });
  const model = task.model_code || FAST_TEXT_MODEL;

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
 * Extended thinking mode optimization is currently unused.
 * TODO: Integrate with image generation workflow for better prompt quality if needed.
 */
