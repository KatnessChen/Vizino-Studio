/**
 * Guest Storage Adapter
 *
 * Implementation of StorageAdapter for guest users.
 * Stores data locally in IndexedDB (no backend storage).
 */

import {
  StorageAdapter,
  CreateImageParams,
  CreateAssetParams,
  CreateColorParams,
} from './storageAdapter';
import { ImageData, Color, Texture, Item, CustomPrompt } from '@/types';
import { guestIndexedDB } from '@/utils/guestIndexedDB';
import { Timestamp } from 'firebase/firestore';

const GUEST_PROJECT_ID = 'guest-project';
const GUEST_SPACE_ID = 'guest-space';

export class GuestStorageAdapter implements StorageAdapter {
  readonly isGuest = true;
  readonly contextId: string;
  readonly projectId = GUEST_PROJECT_ID;
  readonly spaceId = GUEST_SPACE_ID;

  constructor(guestSessionId: string) {
    this.contextId = guestSessionId;
  }

  // ============ Images ============
  async createImage(params: CreateImageParams): Promise<ImageData> {
    const { imageMetadata, processingInfo } = params;
    const { operation, parentImage, base64, base64MimeType } = processingInfo || {};

    try {
      console.log('[GuestAdapter] Creating image locally...');

      // Validate that we have base64 data (required for local storage)
      if (!base64 || !base64MimeType) {
        throw new Error('Base64 data is required for guest image storage');
      }

      // Get current images to calculate order
      const existingImages = await guestIndexedDB.getImages();
      const maxOrder = existingImages.reduce(
        (max, entry) => Math.max(max, entry.imageData.order || 0),
        0
      );
      const newImageOrder = maxOrder > 0 ? maxOrder + 1 : 1;

      const now = Timestamp.fromDate(new Date());

      // Build evolution chain
      const buildEvolutionChain = () => {
        if (!operation) return [];
        return [...(parentImage?.evolutionChain || []), operation];
      };

      // Create image data (no download URL for local storage)
      const newImageData: ImageData = {
        ...imageMetadata,
        spaceId: null, // Guest images don't belong to a space
        evolutionChain: buildEvolutionChain(),
        parentImageId: parentImage?.id || null,
        imageDownloadUrl: '', // No remote URL for local storage
        storageFilePath: '', // No remote storage path
        order: newImageOrder,
        isDeleted: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        description: imageMetadata.description || '',
        // Include dimensions if provided
        ...(imageMetadata.width !== undefined && { width: imageMetadata.width }),
        ...(imageMetadata.height !== undefined && { height: imageMetadata.height }),
        ...(imageMetadata.aspect_ratio !== undefined && {
          aspect_ratio: imageMetadata.aspect_ratio,
        }),
      };

      // Save to IndexedDB with base64 data
      await guestIndexedDB.saveImage(newImageData, base64);

      console.log('[GuestAdapter] Image saved locally:', newImageData.id);
      return newImageData;
    } catch (error) {
      console.error('[GuestAdapter] Failed to create image:', error);
      throw error instanceof Error
        ? new Error(`Failed to create guest image: ${error.message}`)
        : new Error('Failed to create guest image.');
    }
  }

  async fetchImages(): Promise<ImageData[]> {
    try {
      const entries = await guestIndexedDB.getImages();
      const images = entries
        .map((entry) => entry.imageData)
        .filter((image) => !image.isDeleted)
        .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());

      console.log('[GuestAdapter] Fetched', images.length, 'images from IndexedDB');
      return images;
    } catch (error) {
      console.error('[GuestAdapter] Failed to fetch images:', error);
      return [];
    }
  }

  // ============ Colors ============
  async addColor(_params: CreateColorParams): Promise<Color> {
    throw new Error('Guests cannot add custom colors. Please use preset colors.');
  }

  async fetchColors(): Promise<Color[]> {
    return []; // Guests use preset colors only
  }

  async updateColor(_colorId: string, _updates: { name?: string; description?: string }): Promise<void> {
    throw new Error('Guests cannot update colors');
  }

  async deleteColor(_colorId: string): Promise<void> {
    throw new Error('Guests cannot delete colors');
  }

  // ============ Textures ============
  async addTexture(_params: CreateAssetParams): Promise<Texture> {
    throw new Error('Guests cannot add custom textures. Please log in to add textures.');
  }

  async fetchTextures(): Promise<Texture[]> {
    return []; // Guests cannot add textures
  }

  async updateTexture(_textureId: string, _updates: { name?: string; description?: string }): Promise<void> {
    throw new Error('Guests cannot update textures');
  }

  async deleteTexture(_textureId: string): Promise<void> {
    throw new Error('Guests cannot delete textures');
  }

  // ============ Items ============
  async addItem(_params: CreateAssetParams): Promise<Item> {
    throw new Error('Guests cannot add custom items. Please log in to add items.');
  }

  async fetchItems(): Promise<Item[]> {
    return []; // Guests cannot add items
  }

  async updateItem(_itemId: string, _updates: { name?: string; description?: string }): Promise<void> {
    throw new Error('Guests cannot update items');
  }

  async deleteItem(_itemId: string): Promise<void> {
    throw new Error('Guests cannot delete items');
  }

  // ============ Custom Prompts ============
  async saveCustomPrompt(_taskName: string, _prompt: string): Promise<CustomPrompt> {
    throw new Error('Guests cannot save custom prompts');
  }

  async fetchCustomPrompts(_taskName: string): Promise<CustomPrompt[]> {
    return [];
  }
}

/**
 * Factory function to create a guest storage adapter
 */
export function createGuestStorageAdapter(guestSessionId: string): StorageAdapter {
  return new GuestStorageAdapter(guestSessionId);
}
