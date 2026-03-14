import { GeminiTask, GEMINI_TASKS } from './geminiTasks';

/**
 * Centralized prompt templates for Gemini API requests
 * Organized by task type for easy expansion
 */

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
  Deliver: A high-quality, photorealistic recolored image where ALL walls display ${colorName} (${colorHex}) with maximum visual distinction from the original.
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
  Deliver: A high-quality, photorealistic image where the wall surface(s) display the ${textureName} texture (sampled from the first image) applied seamlessly and professionally, following the user's scope or defaulting to all walls.
`;

export const getAddObjectDefaultPrompt = (itemName: string, customPrompt: string | undefined) => `
  You are an expert interior designer and professional image editor specializing in seamlessly placing objects, characters, or elements into interior spaces.

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
  Deliver: A high-quality, photorealistic image where the ${itemName} (from the first image) has been seamlessly placed into the interior space with realistic scale, perspective, lighting, and shadows. The item should look like it was photographed as part of the original room, not artificially added.
`;

export const getUseCustomPromptDefaultPrompt = (customPrompt: string, assetContext?: string) => `
  You are an expert interior designer and professional image editor with advanced capabilities in transforming interior spaces.

  Your task is to process the provided input image according to the user's custom instructions below.

  ${assetContext ? `INPUT CONTEXT:\n  ${assetContext}` : 'The provided image is an interior photo to be modified.'}

  CRITICAL QUALITY STANDARDS:
  1. Maintain photorealistic quality and natural appearance
  2. Preserve proper lighting, shadows, and perspective
  3. Ensure all modifications blend seamlessly
  4. Keep architectural elements and proportions realistic
  5. Maintain image resolution and clarity
  6. Apply changes only as specified in the user instructions
  7. Preserve the overall composition and aesthetic quality

  USER INSTRUCTIONS:
  ${customPrompt}

  FINAL OUTPUT REQUIREMENT:
  Deliver: A high-quality, photorealistic image that accurately fulfills the user's instructions while maintaining professional interior design standards and visual coherence.
`;

export const getColorAdjustmentDefaultPrompt = (colorHex: string, customPrompt: string) => `
  You are a color theory expert and a digital design assistant.

  Your task is to take a base color (HEX: ${colorHex}) and modify it according to the user's instructions.

  INPUT COLOR: ${colorHex}
  USER INSTRUCTION: "${customPrompt}"

  CRITICAL OUTPUT REQUIREMENT:
  1. Return ONLY a valid 6-digit HEX color code for the new color.
  2. The output must be valid JSON in the following format:
     { "hex": "#RRGGBB", "name": "Suggested Color Name" }
  3. Include a creative name for the new color in the "name" field.
  3. Do not include any explanation, markdown formatting, or text outside the JSON object.
  4. Ensure the resulting color logically follows the user's request (e.g. "lighter", "darker", "more vibrant", "pastel version").
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

    case GEMINI_TASKS.CUSTOM_PROMPT.task_name: {
      if (!customPrompt) {
        throw new Error('customPrompt is required for CUSTOM_PROMPT task');
      }

      let assetContext = undefined;
      if (colorName && colorHex) {
        assetContext = `The provided image is a solid color reference: ${colorName} (${colorHex}). Use this color as the primary reference for the generation as requested.`;
      } else if (textureName) {
        assetContext = `The provided image is a texture reference: ${textureName}. Use this texture as the primary material reference.`;
      } else if (itemName) {
        assetContext = `The provided image is an object/item reference: ${itemName}. Use this object as the primary element reference.`;
      }

      return getUseCustomPromptDefaultPrompt(customPrompt, assetContext);
    }

    case GEMINI_TASKS.COLOR_ADJUSTMENT.task_name:
      if (!colorHex) {
        throw new Error('colorHex is required for COLOR_ADJUSTMENT task');
      }
      if (!customPrompt) {
        throw new Error('customPrompt is required for COLOR_ADJUSTMENT task');
      }
      return getColorAdjustmentDefaultPrompt(colorHex, customPrompt);

    case GEMINI_TASKS.REMOVE_CLUTTER.task_name:
      return customPrompt || MAGIC_PROMPT.REMOVE_CLUTTER;

    case GEMINI_TASKS.BRIGHTEN_SPACE.task_name:
      return customPrompt || MAGIC_PROMPT.BRIGHTEN_SPACE;

    case GEMINI_TASKS.INDUSTRIAL_STYLE.task_name:
      return customPrompt || MAGIC_PROMPT.INDUSTRIAL_STYLE;

    case GEMINI_TASKS.LOFT_STYLE.task_name:
      return customPrompt || MAGIC_PROMPT.LOFT_STYLE;

    default:
      // Exhaustive check - all task types should be handled above
      return getUseCustomPromptDefaultPrompt('Unsupported task type');
  }
};

// Prompt for suggesting a name based on description
export const getNameSuggestionPrompt = (customPrompt: string, assetType: string = 'image') => {
  return `
    Based on this user description for generating a new ${assetType}:
    "${customPrompt}"

    Suggest a creative, short, and descriptive name (max 5 words) for the resulting ${assetType}.
    Return ONLY the name as a plain string. No quotes, no markdown, no JSON.
  `;
};

// ═══════════════════════════════════════════════════════════
// MAGIC PROMPT TEXTS
// ═══════════════════════════════════════════════════════════

export const MAGIC_PROMPT = {
  REMOVE_CLUTTER:
    'Act as a professional interior cleaner and organizer. Identify and remove all clutter, small personal items, trash, loose papers, toys, and unnecessary objects from surfaces like tables, floors, and counters. Keep the main furniture and architectural elements intact. The goal is to create a pristine, show-home ready appearance where the space looks spacious, tidy, and organized. Fill in the background where items are removed with appropriate textures and lighting to match the surroundings seamlessly.',
  BRIGHTEN_SPACE:
    'Act as a professional lighting designer and photographer. Enhancing the ambient lighting of the room. Significantly increase the brightness and exposure to eliminate dark shadows and gloomy areas. Use natural daylight simulation to creating a bright, airy, and well-lit atmosphere. Adjust the white balance to be neutral and fresh, avoiding yellow or blue casts. The room should feel inviting, spacious, and filled with soft, diffused light.',
  INDUSTRIAL_STYLE:
    'Act as an interior designer specializing in Industrial Chic. Transform this room to reflect an industrial design aesthetic. Incorporate raw materials such as exposed brick walls, concrete flooring, and distressed wood. Use metal accents in black or rust finishes for furniture and fixtures. Expose architectural elements like beams or ductwork if possible. Use a moody but warm lighting scheme with Edison bulbs or metal pendant lights. The atmosphere should be raw, edgy, and sophisticated.',
  LOFT_STYLE:
    'Act as an interior designer specializing in loft-style conversions. Transform this space into a stylish loft with high ceilings, large industrial-style windows, and an open floor plan. Emphasize exposed structural elements like brick, steel beams, and concrete surfaces. Combine warm reclaimed wood furniture with metal accents and layered textiles for a cozy yet airy feel. Use a neutral but warm palette, incorporate mixed materials, and add ambient and task lighting to create depth and comfort. Maintain a balance of raw industrial details and soft, livable touches to achieve an urban loft aesthetic.',
  MODERN_STYLE:
    'Act as a lead interior designer specializing in modern aesthetics. Transform this room into a sleek, Modern style space. Use a neutral color palette with whites, greys, and blacks. Replace existing furniture with minimalist, straight-line designs. Incorporate materials like glass, steel, and matte finishes. Simplify the decor to emphasize open space and clean lines. Ensure the lighting is contemporary and architectural.',
};
