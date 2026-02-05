/**
 * Storage Adapter Interface
 *
 * Provides a unified interface for data operations that works for both
 * authenticated users (Firestore users/{userId}/) and guests (Firestore guests/{sessionId}/).
 *
 * This abstraction allows hooks and components to work without knowing
 * whether the user is authenticated or a guest.
 */

import { ImageData, ImageOperation, Color, Texture, Item, CustomPrompt } from '@/types';

/**
 * Image creation parameters
 */
export interface CreateImageParams {
  imageFile: Blob | File | null;
  imageMetadata: {
    id: string;
    name: string;
    mimeType: string;
    description?: string;
    width?: number;
    height?: number;
    aspect_ratio?: number;
  };
  processingInfo?: {
    parentImage?: ImageData | null;
    operation?: ImageOperation | null;
    base64?: string;
    base64MimeType?: string;
  };
}

/**
 * Asset creation parameters
 */
export interface CreateAssetParams {
  name: string;
  file: File;
  description?: string;
  width?: number;
  height?: number;
  aspect_ratio?: number;
  evolutionChain?: ImageOperation[];
}

/**
 * Color creation parameters
 */
export interface CreateColorParams {
  name: string;
  hex: string;
  description?: string;
  evolutionChain?: ImageOperation[];
}

/**
 * Storage adapter interface - unified API for guest and user storage
 */
export interface StorageAdapter {
  /** Whether this adapter is for a guest (vs authenticated user) */
  readonly isGuest: boolean;

  /** The storage context (userId for users, sessionId for guests) */
  readonly contextId: string;

  /** Virtual project ID for guests, real projectId for users */
  readonly projectId: string | null;

  /** Virtual space ID for guests, real spaceId for users */
  readonly spaceId: string | null;

  // ============ Images ============
  createImage(params: CreateImageParams): Promise<ImageData>;
  fetchImages(): Promise<ImageData[]>;

  // ============ Colors ============
  addColor(params: CreateColorParams): Promise<Color>;
  fetchColors(): Promise<Color[]>;
  updateColor(colorId: string, updates: { name?: string; description?: string }): Promise<void>;
  deleteColor(colorId: string): Promise<void>;

  // ============ Textures ============
  addTexture(params: CreateAssetParams): Promise<Texture>;
  fetchTextures(): Promise<Texture[]>;
  updateTexture(textureId: string, updates: { name?: string; description?: string }): Promise<void>;
  deleteTexture(textureId: string): Promise<void>;
  reorderTextures(updates: Array<{ textureId: string; order: number }>): Promise<void>;

  // ============ Items ============
  addItem(params: CreateAssetParams): Promise<Item>;
  fetchItems(): Promise<Item[]>;
  updateItem(itemId: string, updates: { name?: string; description?: string }): Promise<void>;
  deleteItem(itemId: string): Promise<void>;
  reorderItems(updates: Array<{ itemId: string; order: number }>): Promise<void>;

  // ============ Custom Prompts ============
  saveCustomPrompt(taskName: string, prompt: string): Promise<CustomPrompt>;
  fetchCustomPrompts(taskName: string): Promise<CustomPrompt[]>;
}

/**
 * No-op adapter for when neither user nor guest context is available
 * Returns empty arrays and throws on write operations
 */
export class NoOpStorageAdapter implements StorageAdapter {
  readonly isGuest = false;
  readonly contextId = '';
  readonly projectId = null;
  readonly spaceId = null;

  async createImage(): Promise<ImageData> {
    throw new Error('No storage context available');
  }
  async fetchImages(): Promise<ImageData[]> {
    return [];
  }
  async addColor(): Promise<Color> {
    throw new Error('No storage context available');
  }
  async fetchColors(): Promise<Color[]> {
    return [];
  }
  async updateColor(): Promise<void> {
    throw new Error('No storage context available');
  }
  async deleteColor(): Promise<void> {
    throw new Error('No storage context available');
  }
  async addTexture(): Promise<Texture> {
    throw new Error('No storage context available');
  }
  async fetchTextures(): Promise<Texture[]> {
    return [];
  }
  async updateTexture(): Promise<void> {
    throw new Error('No storage context available');
  }
  async deleteTexture(): Promise<void> {
    throw new Error('No storage context available');
  }
  async reorderTextures(): Promise<void> {
    throw new Error('No storage context available');
  }
  async addItem(): Promise<Item> {
    throw new Error('No storage context available');
  }
  async fetchItems(): Promise<Item[]> {
    return [];
  }
  async updateItem(): Promise<void> {
    throw new Error('No storage context available');
  }
  async deleteItem(): Promise<void> {
    throw new Error('No storage context available');
  }
  async reorderItems(): Promise<void> {
    throw new Error('No storage context available');
  }
  async saveCustomPrompt(): Promise<CustomPrompt> {
    throw new Error('No storage context available');
  }
  async fetchCustomPrompts(): Promise<CustomPrompt[]> {
    return [];
  }
}
