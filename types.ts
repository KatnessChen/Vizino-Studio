import { Timestamp } from 'firebase/firestore';
import { GeminiTaskName } from './services/gemini/geminiTasks';

export interface ImageData {
  id: string;
  name: string;

  // The space this image belongs to
  spaceId: string | null;

  // Evolution chain
  evolutionChain: ImageOperation[];
  parentImageId: string | null;

  // Firebase Storage
  imageDownloadUrl: string; // Firebase Storage download URL
  storageFilePath: string; // Storage Path

  // Other metadata
  mimeType: string;

  // User-defined ordering (100, 200, 300...)
  // null for legacy images created before ordering feature
  order: number | null;

  description?: string;

  // Dimensions
  width?: number | null;
  height?: number | null;
  aspect_ratio?: number | null; // width / height

  // Soft delete
  isDeleted: boolean;
  deletedAt: Timestamp | null;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Record of an image operations
 */
export interface ImageOperation {
  /**
   * The ID of the image *before* this operation was applied.
   * This is the source image for the operation.
   */
  imageId: string;

  /**
   * The download URL for accessing the source image at the time of this operation.
   */
  imageDownloadUrl: string;

  taskName: string; // e.g., "recolor_wall" or "add_texture".

  customPrompt: string | null;

  /**
   * A container for any options specific to the task, such as the color or texture used.
   */
  options: {
    /**
      * The ID of the color used, if applicable (e.g., "HC-170").
      */
    colorId: string | null;

    /**
      * A snapshot of the color's details at the time of the operation.
      * This is to preserve the color information even if the original color definition changes later.
      */
    colorSnapshot: {
      name: string;
      hex: string;
    } | null;

    /**
      * The ID of the texture used, if applicable.
      */
    textureId: string | null;

    /**
      * A snapshot of the texture's details at the time of the operation.
      */
    textureSnapshot: {
      name: string;
      url: string; // The URL of the texture image at that time
    } | null;

    /**
      * The ID of the item used, if applicable.
      */
    itemId: string | null;

    /**
      * A snapshot of the item's details at the time of the operation.
      */
    itemSnapshot: {
      name: string;
      url: string; // The URL of the item image at that time
    } | null;
  };

  timestamp: Timestamp;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  usage: {
    [key in GeminiTaskName]: number;
  };
  lastLoginAt: Date;
}

// ============================================================================
// Application Types (used in frontend with populated data)
// ============================================================================

export interface Space {
  id: string;
  projectId: string;
  name: string;
  images: null | ImageData[];
  createdAt: string; // ISO 8601 date string for Redux serialization
}

export interface Project {
  id: string;
  name: string;
  spaces: Space[];
  createdAt: string; // ISO 8601 date string for Redux serialization
}

// ============================================================================
// Firestore Document Types (actual structure stored in Firestore)
// ============================================================================

/**
 * Project document structure in Firestore.
 * Path: users/{userId}/projects/{projectId}
 * Note: Spaces are stored in a subcollection, not in this document.
 */
export interface ProjectDocument {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * Space document structure in Firestore subcollection.
 * Path: users/{userId}/projects/{projectId}/spaces/{spaceId}
 * Note: Images are stored in a separate subcollection, not in this document.
 */
export interface SpaceDocument {
  id: string;
  userId: string; // Required for collectionGroup queries
  projectId: string;
  name: string;
  createdAt: string;
}

/**
 * Image document structure in Firestore subcollection.
 * Path: users/{userId}/projects/{projectId}/spaces/{spaceId}/images/{imageId}
 */
export interface ImageDocument {
  id: string;
  name: string;
  spaceId: string | null;
  evolutionChain: ImageOperation[];
  parentImageId: string | null;
  imageDownloadUrl: string;
  storageFilePath: string;
  mimeType: string;
  isDeleted: boolean;
  deletedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// Custom Assets Types
// ============================================================================

/**
 * Custom Color document structure in Firestore.
 * Path: users/{userId}/projects/{projectId}/custom_assets/colors/{colorId}
 */
export interface Color {
  id: string;
  name: string;
  hex: string;
  description?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Texture {
  id: string;
  name: string;
  textureImageDownloadUrl: string;
  description?: string;
  base64?: string;
  mimeType?: string;
  width?: number | null;
  height?: number | null;
  aspect_ratio?: number | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Item {
  id: string;
  name: string;
  itemImageDownloadUrl: string;
  description?: string;
  base64?: string;
  mimeType?: string;
  width?: number | null;
  height?: number | null;
  aspect_ratio?: number | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Custom Prompt document structure in Firestore.
 * Path: users/{userId}/projects/{projectId}/custom_prompts/{promptId}
 */
export interface CustomPrompt {
  id?: string;
  task_name: string;
  timestamp: Timestamp;
  content: string;
}
