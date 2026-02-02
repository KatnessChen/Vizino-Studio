/**
 * Default Demo Images for Guest Mode
 *
 * These images are used as sample images for guests to try the application.
 * They are stored in Firebase Storage under a public path.
 */

import { ImageData } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { PRESET_COLOR, ASSET_IMAGE } from './constants';

// Demo image URLs - replace with actual Firebase Storage URLs
// These should be publicly accessible images
const DEMO_IMAGES: ImageData[] = [
  {
    id: 'demo-image-1',
    name: 'Modern Living Room',
    mimeType: 'image/jpeg',
    spaceId: null,
    evolutionChain: [],
    parentImageId: null,
    // Placeholder - use a real image URL
    imageDownloadUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80',
    storageFilePath: '',
    order: 1,
    isDeleted: false,
    deletedAt: null,
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
    description: 'A modern living room with white walls',
    width: 800,
    height: 600,
    aspect_ratio: 800 / 600,
    assetType: ASSET_IMAGE,
  },
];

/**
 * Returns demo images for guest mode
 */
export function getDemoImages(): ImageData[] {
  return DEMO_IMAGES;
}

/**
 * Returns the default color for guest mode pre-selection
 */
export function getDefaultGuestColor() {
  return PRESET_COLOR[0];
}

/**
 * Returns the default demo image ID for pre-selection
 */
export function getDefaultDemoImageId(): string {
  return 'demo-image-1';
}
