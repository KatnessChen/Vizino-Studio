import {
  fetchProjects,
  fetchSpaceImages,
  batchUpdateImagesOrder,
} from '@/services/firestoreService';
import { ImageData } from '@/types';

/**
 * Migration script to add order property to existing images that don't have it
 * This function should be called once by admin to migrate legacy data
 *
 * @param userId - The user ID to migrate images for
 * @returns Promise with migration results
 */
export async function migrateImageOrders(userId: string): Promise<{
  success: boolean;
  message: string;
  stats: {
    totalProjects: number;
    totalSpaces: number;
    totalImages: number;
    migratedImages: number;
  };
}> {
  if (!userId) {
    return {
      success: false,
      message: 'User ID is required',
      stats: { totalProjects: 0, totalSpaces: 0, totalImages: 0, migratedImages: 0 },
    };
  }

  const stats = {
    totalProjects: 0,
    totalSpaces: 0,
    totalImages: 0,
    migratedImages: 0,
  };

  try {
    console.log('[Migration] Starting image order migration for user:', userId);

    // Fetch all projects for the user
    const projects = await fetchProjects(userId);
    stats.totalProjects = projects.length;

    for (const project of projects) {
      for (const space of project.spaces) {
        stats.totalSpaces++;

        // Fetch all images in this space
        const images = await fetchSpaceImages(userId, project.id, space.id);
        stats.totalImages += images.length;

        // Filter images that don't have order property
        const imagesToMigrate = images.filter(
          (img) => img.order === null || img.order === undefined
        );

        if (imagesToMigrate.length === 0) {
          console.log(`[Migration] No images to migrate in space: ${space.name}`);
          continue;
        }

        console.log(
          `[Migration] Found ${imagesToMigrate.length} images to migrate in space: ${space.name}`
        );

        // Separate original and generated images
        const originalImages = imagesToMigrate.filter((img) => !img.parentImageId);
        const generatedImages = imagesToMigrate.filter((img) => img.parentImageId);

        // Sort by createdAt to maintain original order
        const sortByCreatedAt = (a: ImageData, b: ImageData) => {
          return a.createdAt.toMillis() - b.createdAt.toMillis();
        };

        originalImages.sort(sortByCreatedAt);
        generatedImages.sort(sortByCreatedAt);

        // Assign order values with sequential numbering (1, 2, 3...)
        const updates: Array<{ imageId: string; order: number }> = [];

        originalImages.forEach((img, index) => {
          updates.push({
            imageId: img.id,
            order: index + 1,
          });
        });

        generatedImages.forEach((img, index) => {
          updates.push({
            imageId: img.id,
            order: index + 1,
          });
        });

        // Batch update the orders in Firestore
        if (updates.length > 0) {
          await batchUpdateImagesOrder(userId, project.id, space.id, updates);
          stats.migratedImages += updates.length;
          console.log(`[Migration] Updated ${updates.length} images in space: ${space.name}`);
        }
      }
    }

    const message = `Migration completed successfully! Migrated ${stats.migratedImages} images across ${stats.totalSpaces} spaces in ${stats.totalProjects} projects.`;
    console.log('[Migration]', message);

    return {
      success: true,
      message,
      stats,
    };
  } catch (error) {
    console.error('[Migration] Failed to migrate image orders:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      stats,
    };
  }
}

/**
 * Check if migration has been completed for a user
 * Stored in localStorage to prevent repeated migrations
 */
export function isMigrationCompleted(userId: string): boolean {
  const key = `migration_image_orders_${userId}`;
  return localStorage.getItem(key) === 'completed';
}

/**
 * Mark migration as completed for a user
 */
export function markMigrationCompleted(userId: string): void {
  const key = `migration_image_orders_${userId}`;
  localStorage.setItem(key, 'completed');
  localStorage.setItem(`${key}_timestamp`, new Date().toISOString());
}

/**
 * Reset migration status (for testing purposes)
 */
export function resetMigrationStatus(userId: string): void {
  const key = `migration_image_orders_${userId}`;
  localStorage.removeItem(key);
  localStorage.removeItem(`${key}_timestamp`);
}
