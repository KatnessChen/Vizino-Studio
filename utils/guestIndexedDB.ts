/**
 * Guest IndexedDB Storage
 *
 * Local-only storage for guest user data using IndexedDB.
 * Stores generated images with base64 data for offline persistence.
 */

import { ImageData } from '@/types';
import { devLog, devError } from '@/utils/devLogger';

const DB_NAME = 'vizino-guest-data';
const DB_VERSION = 1;
const IMAGES_STORE = 'images';

export interface GuestImageEntry {
  id: string;
  imageData: ImageData;
  base64: string;
  timestamp: number;
}

class GuestIndexedDB {
  private db: IDBDatabase | null = null;

  /**
   * Initialize the IndexedDB database
   */
  private async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        devError('[GuestDB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        devLog('[GuestDB] Database opened successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create images object store if it doesn't exist
        if (!db.objectStoreNames.contains(IMAGES_STORE)) {
          const objectStore = db.createObjectStore(IMAGES_STORE, { keyPath: 'id' });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          devLog('[GuestDB] Created images object store');
        }
      };
    });
  }

  /**
   * Save an image to IndexedDB
   */
  async saveImage(imageData: ImageData, base64: string): Promise<void> {
    try {
      const db = await this.init();
      const transaction = db.transaction([IMAGES_STORE], 'readwrite');
      const store = transaction.objectStore(IMAGES_STORE);

      const entry: GuestImageEntry = {
        id: imageData.id,
        imageData,
        base64,
        timestamp: Date.now(),
      };

      await new Promise<void>((resolve, reject) => {
        const request = store.put(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      devLog('[GuestDB] Image saved:', imageData.id);
    } catch (error) {
      devError('[GuestDB] Failed to save image:', error);
      throw error;
    }
  }

  /**
   * Get all images from IndexedDB
   */
  async getImages(): Promise<GuestImageEntry[]> {
    try {
      const db = await this.init();
      const transaction = db.transaction([IMAGES_STORE], 'readonly');
      const store = transaction.objectStore(IMAGES_STORE);

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const entries = request.result as GuestImageEntry[];
          devLog('[GuestDB] Retrieved', entries.length, 'images');
          resolve(entries);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      devError('[GuestDB] Failed to get images:', error);
      return [];
    }
  }

  /**
   * Get a single image by ID
   */
  async getImage(imageId: string): Promise<GuestImageEntry | null> {
    try {
      const db = await this.init();
      const transaction = db.transaction([IMAGES_STORE], 'readonly');
      const store = transaction.objectStore(IMAGES_STORE);

      return new Promise((resolve, reject) => {
        const request = store.get(imageId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      devError('[GuestDB] Failed to get image:', error);
      return null;
    }
  }

  /**
   * Delete an image from IndexedDB
   */
  async deleteImage(imageId: string): Promise<void> {
    try {
      const db = await this.init();
      const transaction = db.transaction([IMAGES_STORE], 'readwrite');
      const store = transaction.objectStore(IMAGES_STORE);

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(imageId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      devLog('[GuestDB] Image deleted:', imageId);
    } catch (error) {
      devError('[GuestDB] Failed to delete image:', error);
      throw error;
    }
  }

  /**
   * Clear all guest data
   */
  async clearAll(): Promise<void> {
    try {
      const db = await this.init();
      const transaction = db.transaction([IMAGES_STORE], 'readwrite');
      const store = transaction.objectStore(IMAGES_STORE);

      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      devLog('[GuestDB] All data cleared');
    } catch (error) {
      devError('[GuestDB] Failed to clear data:', error);
      throw error;
    }
  }

  /**
   * Get the count of stored images
   */
  async getImageCount(): Promise<number> {
    try {
      const db = await this.init();
      const transaction = db.transaction([IMAGES_STORE], 'readonly');
      const store = transaction.objectStore(IMAGES_STORE);

      return new Promise((resolve, reject) => {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      devError('[GuestDB] Failed to get image count:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const guestIndexedDB = new GuestIndexedDB();
