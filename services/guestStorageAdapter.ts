/**
 * Guest Storage Adapter
 *
 * Implementation of StorageAdapter for guest users.
 * Stores data under guests/{sessionId}/ in Firestore.
 */

import {
  StorageAdapter,
  CreateImageParams,
  CreateAssetParams,
  CreateColorParams,
} from './storageAdapter';
import { ImageData, Color, Texture, Item, CustomPrompt } from '@/types';
import {
  createGuestImage,
  fetchGuestImages,
  addGuestColor,
  fetchGuestColors,
  addGuestTexture,
  fetchGuestTextures,
  addGuestItem,
  fetchGuestItems,
} from './guestFirestoreService';

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
    return createGuestImage(
      this.contextId,
      params.imageFile,
      params.imageMetadata,
      params.processingInfo
    );
  }

  async fetchImages(): Promise<ImageData[]> {
    return fetchGuestImages(this.contextId);
  }

  // ============ Colors ============
  async addColor(params: CreateColorParams): Promise<Color> {
    return addGuestColor(this.contextId, params);
  }

  async fetchColors(): Promise<Color[]> {
    return fetchGuestColors(this.contextId);
  }

  async deleteColor(_colorId: string): Promise<void> {
    // Guests cannot delete colors (they will be migrated on login)
    throw new Error('Guests cannot delete colors');
  }

  // ============ Textures ============
  async addTexture(params: CreateAssetParams): Promise<Texture> {
    return addGuestTexture(this.contextId, params);
  }

  async fetchTextures(): Promise<Texture[]> {
    return fetchGuestTextures(this.contextId);
  }

  async deleteTexture(_textureId: string): Promise<void> {
    throw new Error('Guests cannot delete textures');
  }

  // ============ Items ============
  async addItem(params: CreateAssetParams): Promise<Item> {
    return addGuestItem(this.contextId, params);
  }

  async fetchItems(): Promise<Item[]> {
    return fetchGuestItems(this.contextId);
  }

  async deleteItem(_itemId: string): Promise<void> {
    throw new Error('Guests cannot delete items');
  }

  // ============ Custom Prompts ============
  async saveCustomPrompt(_taskName: string, _prompt: string): Promise<CustomPrompt> {
    // Guests don't save custom prompts persisted (they can use them in session)
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
