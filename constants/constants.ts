import { Color } from '@/types';

export const PRESET_COLOR: Color[] = [
  {
    id: '1572',
    name: 'Raindance',
    hex: '#a7b3aa',
    description: 'Easygoing grey undertones bring an effortless versatility to this steely green.',
  },
  {
    id: 'CSP-310',
    name: 'First Crush',
    hex: '#e8decf',
    description:
      'Infused with a hint of blush, this tender hue brings a subtle warmth to any space.',
  },
  {
    id: 'OC-45',
    name: 'Swiss Coffee',
    hex: '#eeece1',
    description: 'An essential white paint colour with just the right amount of warmth.',
  },
  {
    id: 'AF-610',
    name: 'Batik',
    hex: '#ccb9b5',
    description: 'Violet and rose come together to create this surprisingly versatile dusty hue.',
  },
  {
    id: 'HC-157',
    name: 'Narragansett Green',
    hex: '#435155',
    description:
      'A blackened teal that conveys a strong sense of history and architectural relevance.',
  },
  {
    id: '048',
    name: 'Southwest Pottery',
    hex: '#975f57',
    description: 'A nuanced hue that captures the brown and red tones of kiln-fired clay.',
  },
  {
    id: '1054',
    name: 'Sherwood Tan',
    hex: '#b8a183',
    description: 'A classic tan infused with notes of earthy brown.',
  },
  {
    id: 'AF-655',
    name: 'Silhouette',
    hex: '#57504c',
    description:
      'Reminiscent of tailored suiting, this elegant colour weaves rich espresso hues with refined notes of charcoal.',
  },
];

export const MAX_FILE_SIZE_MB = 10;

export const MAX_CUSTOM_ASSET_NAME_LENGTH = 50;
export const MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH = 100;

// ============================================================================
// User Limitation Constants
// ============================================================================
export const MAX_PROJECTS_PER_USER = 10;
export const MAX_SPACES_PER_PROJECT = 10;
export const MAX_IMAGES_PER_SPACE = 50;
export const MAX_OPERATIONS_PER_IMAGE = 20;
