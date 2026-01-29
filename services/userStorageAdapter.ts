/**
 * User Storage Adapter
 *
 * Implementation of StorageAdapter for authenticated users.
 * Stores data under users/{userId}/ in Firestore.
 */

import {
  StorageAdapter,
  CreateImageParams,
  CreateAssetParams,
  CreateColorParams,
} from './storageAdapter';
import { ImageData, Color, Texture, Item, CustomPrompt } from '@/types';
import {
  createImage,
  fetchSpaceImages,
  addColor,
  fetchColors,
  updateColor,
  deleteColor,
  addTexture,
  fetchTextures,
  deleteTexture,
  updateTexture,
  addItem,
  fetchItems,
  deleteItem,
  updateItem,
  saveCustomPrompt,
  fetchAllCustomPrompts,
} from './firestoreService';

export class UserStorageAdapter implements StorageAdapter {
  readonly isGuest = false;
  readonly contextId: string;
  readonly projectId: string | null;
  readonly spaceId: string | null;

  constructor(userId: string, projectId: string | null, spaceId: string | null) {
    this.contextId = userId;
    this.projectId = projectId;
    this.spaceId = spaceId;
  }

  private requireProject(): string {
    if (!this.projectId) {
      throw new Error('Project ID is required for this operation');
    }
    return this.projectId;
  }

  private requireSpace(): string {
    if (!this.spaceId) {
      throw new Error('Space ID is required for this operation');
    }
    return this.spaceId;
  }

  // ============ Images ============
  async createImage(params: CreateImageParams): Promise<ImageData> {
    const projectId = this.requireProject();
    const spaceId = this.requireSpace();

    return createImage(
      this.contextId,
      projectId,
      spaceId,
      params.imageFile,
      params.imageMetadata,
      params.processingInfo
    );
  }

  async fetchImages(): Promise<ImageData[]> {
    const projectId = this.requireProject();
    const spaceId = this.requireSpace();

    return fetchSpaceImages(this.contextId, projectId, spaceId);
  }

  // ============ Colors ============
  async addColor(params: CreateColorParams): Promise<Color> {
    const projectId = this.requireProject();
    return addColor(this.contextId, projectId, params);
  }

  async fetchColors(): Promise<Color[]> {
    const projectId = this.requireProject();
    return fetchColors(this.contextId, projectId);
  }

  async deleteColor(colorId: string): Promise<void> {
    const projectId = this.requireProject();
    return deleteColor(this.contextId, projectId, colorId);
  }

  async updateColor(
    colorId: string,
    updates: { name?: string; description?: string }
  ): Promise<void> {
    const projectId = this.requireProject();
    return updateColor(this.contextId, projectId, colorId, updates);
  }

  // ============ Textures ============
  async addTexture(params: CreateAssetParams): Promise<Texture> {
    const projectId = this.requireProject();
    return addTexture(this.contextId, projectId, params);
  }

  async fetchTextures(): Promise<Texture[]> {
    const projectId = this.requireProject();
    return fetchTextures(this.contextId, projectId);
  }

  async deleteTexture(textureId: string): Promise<void> {
    const projectId = this.requireProject();
    return deleteTexture(this.contextId, projectId, textureId);
  }

  async updateTexture(
    textureId: string,
    updates: { name?: string; description?: string }
  ): Promise<void> {
    const projectId = this.requireProject();
    return updateTexture(this.contextId, projectId, textureId, updates);
  }

  // ============ Items ============
  async addItem(params: CreateAssetParams): Promise<Item> {
    const projectId = this.requireProject();
    return addItem(this.contextId, projectId, params);
  }

  async fetchItems(): Promise<Item[]> {
    const projectId = this.requireProject();
    return fetchItems(this.contextId, projectId);
  }

  async deleteItem(itemId: string): Promise<void> {
    const projectId = this.requireProject();
    return deleteItem(this.contextId, projectId, itemId);
  }

  async updateItem(itemId: string, updates: { name?: string; description?: string }): Promise<void> {
    const projectId = this.requireProject();
    return updateItem(this.contextId, projectId, itemId, updates);
  }

  // ============ Custom Prompts ============
  async saveCustomPrompt(taskName: string, prompt: string): Promise<CustomPrompt> {
    const projectId = this.requireProject();
    await saveCustomPrompt(this.contextId, projectId, taskName, prompt);
    // Return a CustomPrompt matching the interface
    const now = new Date();
    const { Timestamp } = await import('firebase/firestore');
    return {
      id: crypto.randomUUID(),
      task_name: taskName,
      content: prompt,
      timestamp: Timestamp.fromDate(now),
    };
  }

  async fetchCustomPrompts(_taskName: string): Promise<CustomPrompt[]> {
    const projectId = this.requireProject();
    // fetchAllCustomPrompts returns all prompts, filter by taskName if needed
    const allPrompts = await fetchAllCustomPrompts(this.contextId, projectId);
    return _taskName ? allPrompts.filter(p => p.task_name === _taskName) : allPrompts;
  }
}

/**
 * Factory function to create a user storage adapter
 */
export function createUserStorageAdapter(
  userId: string,
  projectId: string | null,
  spaceId: string | null
): StorageAdapter {
  return new UserStorageAdapter(userId, projectId, spaceId);
}
