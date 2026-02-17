import { Color } from '@/types';

export const PRESET_COLOR: Color[] = [
  {
    id: '1572',
    name: 'Raindance',
    hex: '#a7b3aa',
    description: 'Easygoing grey undertones bring an effortless versatility to this steely green.',
    assetType: 'color',
  },
  {
    id: 'CSP-310',
    name: 'First Crush',
    hex: '#e8decf',
    description:
      'Infused with a hint of blush, this tender hue brings a subtle warmth to any space.',
    assetType: 'color',
  },
  {
    id: 'OC-45',
    name: 'Swiss Coffee',
    hex: '#eeece1',
    description: 'An essential white paint colour with just the right amount of warmth.',
    assetType: 'color',
  },
  {
    id: 'AF-610',
    name: 'Batik',
    hex: '#ccb9b5',
    description: 'Violet and rose come together to create this surprisingly versatile dusty hue.',
    assetType: 'color',
  },
  {
    id: 'HC-157',
    name: 'Narragansett Green',
    hex: '#435155',
    description:
      'A blackened teal that conveys a strong sense of history and architectural relevance.',
    assetType: 'color',
  },
  {
    id: '048',
    name: 'Southwest Pottery',
    hex: '#975f57',
    description: 'A nuanced hue that captures the brown and red tones of kiln-fired clay.',
    assetType: 'color',
  },
  {
    id: '1054',
    name: 'Sherwood Tan',
    hex: '#b8a183',
    description: 'A classic tan infused with notes of earthy brown.',
    assetType: 'color',
  },
  {
    id: 'AF-655',
    name: 'Silhouette',
    hex: '#57504c',
    description:
      'Reminiscent of tailored suiting, this elegant colour weaves rich espresso hues with refined notes of charcoal.',
    assetType: 'color',
  },
];

export const MAX_FILE_SIZE_MB = 10;

export const MAX_CUSTOM_ASSET_NAME_LENGTH = 50;
export const MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH = 100;
export const MAX_CUSTOM_PROMPT_LENGTH = 1000;

// ============================================================================
// User Limitation Constants
// ============================================================================
export const MAX_PROJECTS_PER_USER = 10;
export const MAX_SPACES_PER_PROJECT = 10;
export const MAX_IMAGES_PER_SPACE = 50;
export const MAX_OPERATIONS_PER_IMAGE = 20;

// Named constants for convenience
export const ASSET_IMAGE = 'image' as const;
export const ASSET_COLOR = 'color' as const;
export const ASSET_TEXTURE = 'texture' as const;
export const ASSET_ITEM = 'item' as const;

// Asset types used in Custom Prompt asset picker
export const ASSET_TYPES = [ASSET_IMAGE, ASSET_COLOR, ASSET_TEXTURE, ASSET_ITEM] as const;
export type CustomPromptAssetType = (typeof ASSET_TYPES)[number];
export type AssetType = (typeof ASSET_TYPES)[number];

// ============================================================================
// V Points (Credit System) Constants
// ============================================================================

/**
 * Default credit limit for free users (V points)
 */
export const DEFAULT_CREDIT_LIMIT = 50;

/**
 * Credit multipliers for each task type
 * optimize_prompt costs 4x, thinking_mode costs 3x, all others cost 1x
 */
export const CREDIT_MULTIPLIERS: Record<string, number> = {
  // High-cost task
  optimize_prompt: 4,
  thinking_mode: 3,
  // Standard tasks
  recolor_wall: 1,
  add_texture: 1,
  add_home_item: 1,
  custom_prompt: 1,
  color_adjustment: 1,
  remove_clutter: 1,
  brighten_space: 1,
} as const;
