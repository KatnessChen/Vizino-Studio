/**
 * IndexedDB service for managing image cache persistence.
 * Handles all database operations (init, get, set, delete, etc.)
 */

import { devLog, devWarn } from '@/utils/devLogger';

export interface CacheEntry {
  base64: string;
  timestamp: number;
  mimeType: string;
}

const DB_NAME = 'ImageCacheDB';
const DB_VERSION = 1;
const STORE_NAME = 'images';

class IndexedDBService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB database (lazy initialization)
   */
  async init(): Promise<void> {
    // Return existing promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.db) {
      return;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        devWarn('[IndexedDB] Initialization failed:', request.error);
        this.initPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        devLog('[IndexedDB] Initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          devLog('[IndexedDB] Object store created');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Get cache entry from IndexedDB
   */
  async get(imageDownloadUrl: string): Promise<CacheEntry | null> {
    try {
      await this.init();
      if (!this.db) {
        return null;
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(imageDownloadUrl);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          // Remove the 'url' property and return the cache entry
          const result = request.result;
          if (result) {
            resolve(result);
          } else {
            resolve(null);
          }
        };
      });
    } catch (error) {
      devWarn('[IndexedDB] Get failed:', error);
      return null;
    }
  }

  /**
   * Save cache entry to IndexedDB
   */
  async set(imageDownloadUrl: string, entry: CacheEntry): Promise<void> {
    try {
      await this.init();
      if (!this.db) {
        return;
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put({ url: imageDownloadUrl, ...entry });

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      devWarn('[IndexedDB] Set failed:', error);
    }
  }

  /**
   * Clear all entries from IndexedDB
   */
  async clear(): Promise<void> {
    try {
      await this.init();
      if (!this.db) {
        return;
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          devLog('[IndexedDB] Cleared');
          resolve();
        };
      });
    } catch (error) {
      devWarn('[IndexedDB] Clear failed:', error);
    }
  }
}

// Export singleton instance
export const indexedDBService = new IndexedDBService();
