/**
 * Centralized prompt templates for Gemini API requests
 * Organized by task type for easy expansion
 */

import { GeminiTask, GEMINI_TASKS } from './geminiTasks';

// ═══════════════════════════════════════════════════════════
// SHARED CONSTANTS
// ═══════════════════════════════════════════════════════════

const DIMENSION_REQUIREMENT = `
  ⚠️ CRITICAL OUTPUT DIMENSIONS: The generated image MUST have the EXACT same pixel dimensions and aspect ratio as the SECOND IMAGE (interior photo).
  - If SECOND IMAGE is 1920x1080 (16:9), output MUST be exactly 1920x1080 (16:9)
  - If SECOND IMAGE is 1024x1024 (1:1), output MUST be exactly 1024x1024 (1:1)
  - NEVER change the aspect ratio or dimensions - maintain pixel-perfect match
  - Scale all content to fit within the exact original dimensions
  - NO cropping, padding, or dimension changes allowed
`;

// ═══════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════

export const getRecolorTaskDefaultPrompt = (
  colorName: string | undefined,
  colorHex: string | undefined,
  customPrompt: string | undefined
) => `
  You are an expert interior designer and professional image editor specializing in photorealistic wall recoloring.

  Your task is to transform the walls in this interior photo to ${colorName} (HEX: ${colorHex}) with maximum visual impact and realism.

  CRITICAL INSTRUCTIONS:
  1. Change ALL wall surfaces to ${colorName || 'YOUR COLOR'} (HEX: ${colorHex || 'COLOR HEX'})
  2. Apply UNIFORM color transformation across 100% of wall areas
  3. Preserve authentic lighting, shadows, and 3D depth on walls
  4. Maintain original lighting direction and intensity
  5. Retain wall texture, grain, and surface details
  6. EXCLUDE: furniture, floor, ceiling, windows, doors, decorations, fixtures
  7. Ensure saturation and brightness match realistic matte/semi-gloss paint
  ${
    customPrompt
      ? `CUSTOM USER INSTRUCTIONS (THESE TAKE PRIORITY):
     ${customPrompt}
    `
      : ''
  }
  FINAL OUTPUT REQUIREMENT:
  Deliver: A high-quality, photorealistic recolored image where ALL walls display ${colorName} (${colorHex}) with maximum visual distinction from the original.${DIMENSION_REQUIREMENT}
`;

export const getAddTextureDefaultPrompt = (
  textureName: string,
  customPrompt: string | undefined
) => `
  You are an expert interior designer and professional image editor specializing in applying textures to wall surfaces.

  You will receive TWO images:
  1. FIRST IMAGE: A texture sample (${textureName})
  2. SECOND IMAGE: An interior photo where you need to apply the texture

  Your task is to seamlessly apply the texture from the first image to the specified wall surface(s) in the interior photo, based on the user's instructions in the custom prompt.

  CRITICAL INSTRUCTIONS:
  1. Analyze the texture from the FIRST image carefully.
  2. Apply this texture to the wall surface(s) in the interior photo. If the user specifies particular walls in the custom instructions, apply it ONLY to those.
  3. If the user doesn't specify which wall to apply the texture to, apply it to ALL walls by default.
  4. Match texture direction and perspective to wall angles and lighting in the interior photo.
  5. Blend the texture naturally with existing lighting, shadows, and 3D depth.
  6. Preserve wall imperfections and maintain realistic appearance.
  7. Ensure texture coverage is uniform and professional on the specified surface.
  8. EXCLUDE: furniture, floor, ceiling, windows, doors, decorations, fixtures.
  9. Maintain color consistency between the textured wall and original ambiance.

  CUSTOM USER INSTRUCTIONS:
  ${customPrompt || ''}

  FINAL OUTPUT REQUIREMENT:
  Deliver: A high-quality, photorealistic image where the wall surface(s) display the ${textureName} texture (sampled from the first image) applied seamlessly and professionally, following the user's scope or defaulting to all walls.${DIMENSION_REQUIREMENT}
`;

export const getAddObjectDefaultPrompt = (itemName: string, customPrompt: string | undefined) => `
  You are an expert interior designer and professional image editor specializing in seamlessly placing objects, characters, or elements into interior spaces.

  ⚠️ CRITICAL OUTPUT REQUIREMENT: The generated image MUST have the EXACT same pixel dimensions and aspect ratio as the SECOND IMAGE (interior photo). Maintain pixel-perfect dimensions - no changes allowed.

  You will receive TWO images:
  1. FIRST IMAGE: A specific element (${itemName})
  2. SECOND IMAGE: An interior photo where you need to place the element

  Your task is to naturally integrate the element from the first image into the interior photo at the location and manner specified by the user.

  CRITICAL INSTRUCTIONS:
  1. Analyze the element from the FIRST image carefully - understand its dimensions, style, and characteristics.
  2. Place the ${itemName} into the interior photo based on the user's specific placement and direction instructions.
  3. Ensure the element's scale and proportions are REALISTIC and appropriate for the room size and perspective. If the available space is insufficient, proportionally scale down the element or remove movable existing furniture to accommodate it.
  4. Always position the element firmly on the floor surface - never allow it to appear floating or suspended in mid-air.
  5. Treat the element as a three-dimensional object that can be rotated. If the user specifies a particular orientation or if spatial constraints require it, rotate the element accordingly to fit naturally within the room's layout.
  6. Match the element's lighting, shadows, and reflections to the existing room lighting conditions.
  7. Adjust the element's color temperature to match the ambient lighting of the space.
  8. Place realistic shadows beneath and around the element that are consistent with the room's light sources.
  9. Ensure the element follows the room's perspective and vanishing points correctly.
  10. Make the element look like it naturally belongs in the space - not floating or misaligned.
  11. If the element should replace existing furniture or objects, remove the original ones seamlessly.
  12. Maintain the quality and resolution of the original interior photo.

  CUSTOM USER INSTRUCTIONS (PLACEMENT LOCATION AND DETAILS):
  ${customPrompt || ''}

  FINAL OUTPUT REQUIREMENT:
  Deliver: A high-quality, photorealistic image where the ${itemName} (from the first image) has been seamlessly placed into the interior space with realistic scale, perspective, lighting, and shadows. The item should look like it was photographed as part of the original room, not artificially added.${DIMENSION_REQUIREMENT}
`;

export const getUseCustomPromptDefaultPrompt = (customPrompt: string) => `
  You are an expert interior designer and professional image editor with advanced capabilities in transforming interior spaces.

  Your task is to modify the provided interior photo according to the user's custom instructions below.

  CRITICAL QUALITY STANDARDS:
  1. Maintain photorealistic quality and natural appearance
  2. Preserve proper lighting, shadows, and perspective
  3. Ensure all modifications blend seamlessly with the original environment
  4. Keep architectural elements and proportions realistic
  5. Maintain image resolution and clarity
  6. Apply changes only as specified in the user instructions
  7. Preserve the overall composition and aesthetic quality

  USER INSTRUCTIONS:
  ${customPrompt}

  FINAL OUTPUT REQUIREMENT:
  Deliver: A high-quality, photorealistic modified image that accurately fulfills the user's instructions while maintaining professional interior design standards and visual coherence.${DIMENSION_REQUIREMENT}
`;

// ═══════════════════════════════════════════════════════════
// PROMPT SELECTOR
// ═══════════════════════════════════════════════════════════

/**
 * Get the appropriate prompt template based on task type
 * @param task - The task type (e.g., RECOLOR_WALL, ADD_TEXTURE)
 * @param options - Task-specific options (colorName, colorHex, textureName, customPrompt, etc.)
 * @returns The formatted prompt string
 */
export const getPromptByTask = (
  task: GeminiTask,
  options: {
    colorName?: string;
    colorHex?: string;
    textureName?: string;
    itemName?: string;
    customPrompt?: string;
  }
): string => {
  const { colorName, colorHex, textureName, itemName, customPrompt } = options;

  switch (task.task_name) {
    case GEMINI_TASKS.RECOLOR_WALL.task_name:
      if (!colorName || !colorHex) {
        throw new Error('colorName and colorHex are required for RECOLOR_WALL task');
      }
      return getRecolorTaskDefaultPrompt(colorName, colorHex, customPrompt);

    case GEMINI_TASKS.ADD_TEXTURE.task_name:
      if (!textureName) {
        throw new Error('textureName is required for ADD_TEXTURE task');
      }
      return getAddTextureDefaultPrompt(textureName, customPrompt);

    case GEMINI_TASKS.ADD_HOME_ITEM.task_name:
      if (!itemName) {
        throw new Error('itemName is required for ADD_HOME_ITEM task');
      }
      return getAddObjectDefaultPrompt(itemName, customPrompt);

    case GEMINI_TASKS.CUSTOM_PROMPT.task_name:
      if (!customPrompt) {
        throw new Error('customPrompt is required for CUSTOM_PROMPT task');
      }
      return getUseCustomPromptDefaultPrompt(customPrompt);

    default:
      // Exhaustive check - all task types should be handled above
      return getUseCustomPromptDefaultPrompt('Unsupported task type');
  }
};
