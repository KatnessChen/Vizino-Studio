/**
 * Migrate Guest Data Utility
 *
 * Migrates guest generated images from guests/{sessionId}/ to users/{userId}/
 * after a guest user logs in.
 * 
 * Note: Guests can only generate images using preset colors.
 * They cannot add custom colors, textures, or items.
 * 
 * Migration includes:
 * - One hardcoded original image (the demo image guests used)
 * - All generated images (those with parentImageId)
 */

import {
  createProject,
  createSpace,
  createImage,
} from '@/services/firestoreService';
import {
  fetchAllGuestData,
  deleteGuestData,
} from '@/services/guestFirestoreService';

const DEFAULT_PROJECT_NAME = 'My First Project';
const DEFAULT_SPACE_NAME = 'My First Space';

// Hardcoded original image that guests use (from demo images)
const ORIGINAL_IMAGE = {
  name: 'Modern Living Room',
  mimeType: 'image/jpeg',
  imageDownloadUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80',
  description: 'A modern living room with white walls',
  width: 800,
  height: 600,
  aspect_ratio: 800 / 600,
};

interface MigrationResult {
  projectId: string;
  spaceId: string;
  migratedOriginalImages: number;
  migratedGeneratedImages: number;
}

/**
 * Helper to fetch image as blob from URL
 */
async function urlToBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  return response.blob();
}

/**
 * Migrates guest images to a user account.
 *
 * Creates "My First Project" and "My First Space" under the user,
 * then:
 * 1. Creates one hardcoded original image (the demo image)
 * 2. Migrates all generated images from guest storage
 *
 * @param guestSessionId The guest session ID to migrate from
 * @param userId The user ID to migrate to
 * @returns Migration result with created project/space IDs and image counts
 */
export async function migrateGuestDataToUser(
  guestSessionId: string,
  userId: string
): Promise<MigrationResult> {
  console.log('[Migration] Starting guest data migration...', { guestSessionId, userId });

  const result: MigrationResult = {
    projectId: '',
    spaceId: '',
    migratedOriginalImages: 0,
    migratedGeneratedImages: 0,
  };

  try {
    // 1. Fetch all guest data
    const guestData = await fetchAllGuestData(guestSessionId);
    
    // Filter to only get generated images (those with parentImageId)
    const generatedImages = guestData.images.filter(img => img.parentImageId);
    
    console.log('[Migration] Guest data fetched:', {
      totalImages: guestData.images.length,
      generatedImages: generatedImages.length,
    });

    // If no generated images to migrate, skip project creation
    if (generatedImages.length === 0) {
      console.log('[Migration] No generated images to migrate');
      // Still delete guest session data
      await deleteGuestData(guestSessionId);
      return result;
    }

    // 2. Create project and space
    const project = await createProject(userId, DEFAULT_PROJECT_NAME);
    result.projectId = project.id;
    console.log('[Migration] Created project:', project.id);

    const space = await createSpace(userId, project.id, DEFAULT_SPACE_NAME);
    result.spaceId = space.id;
    console.log('[Migration] Created space:', space.id);

    // 3. Create the hardcoded original image first
    try {
      const originalImageBlob = await urlToBlob(ORIGINAL_IMAGE.imageDownloadUrl);
      const originalImageId = crypto.randomUUID();
      
      await createImage(
        userId,
        project.id,
        space.id,
        originalImageBlob,
        {
          id: originalImageId,
          name: ORIGINAL_IMAGE.name,
          mimeType: ORIGINAL_IMAGE.mimeType,
          description: ORIGINAL_IMAGE.description,
          width: ORIGINAL_IMAGE.width,
          height: ORIGINAL_IMAGE.height,
          aspect_ratio: ORIGINAL_IMAGE.aspect_ratio,
        }
      );
      
      result.migratedOriginalImages++;
      console.log('[Migration] Original image created:', originalImageId);
    } catch (error) {
      console.error('[Migration] Failed to create original image:', error);
      // Continue anyway - generated images are more important
    }

    // 4. Migrate all generated images - only 1 image is expected
    for (const guestImage of generatedImages) {
      try {
        // Fetch image blob from guest storage
        const imageBlob = await urlToBlob(guestImage.imageDownloadUrl);

        // Create new image in user's space
        await createImage(
          userId,
          project.id,
          space.id,
          imageBlob,
          {
            id: crypto.randomUUID(), // New ID for user's copy
            name: guestImage.name,
            mimeType: guestImage.mimeType,
            description: guestImage.description || '',
            width: guestImage.width,
            height: guestImage.height,
            aspect_ratio: guestImage.aspect_ratio,
          },
          {
            // Preserve evolution chain
            operation: guestImage.evolutionChain.length > 0
              ? guestImage.evolutionChain[guestImage.evolutionChain.length - 1]
              : undefined,
          }
        );

        result.migratedGeneratedImages++;
      } catch (error) {
        console.error('[Migration] Failed to migrate generated image:', guestImage.id, error);
        // Continue with other images
      }
    }
    console.log('[Migration] Generated images migrated:', result.migratedGeneratedImages);

    // 5. Delete guest data after successful migration
    await deleteGuestData(guestSessionId);
    console.log('[Migration] Guest data deleted');

    console.log('[Migration] Migration complete:', result);
    return result;
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    throw error instanceof Error
      ? new Error(`Migration failed: ${error.message}`)
      : new Error('Migration failed');
  }
}


