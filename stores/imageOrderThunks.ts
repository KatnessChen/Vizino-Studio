import { debounce } from 'lodash';
import { AppDispatch } from './store';
import { reorderImagesOptimistic, rollbackReorderImages } from './projectStore';
import { batchUpdateImagesOrder } from '@/services/firestoreService';
import { ImageData } from '@/types';
import { message } from 'antd';

/**
 * Calculate new order values for reordered images
 * Strategy: Reassign all images with sequential ordering (1, 2, 3...)
 */
function calculateNewOrders(
  allImages: ImageData[],
  reorderedImageIds: string[]
): Array<{ imageId: string; order: number }> {
  const updates: Array<{ imageId: string; order: number }> = [];

  // Find images that need reordering
  const reorderedImages = reorderedImageIds
    .map((id) => allImages.find((img) => img.id === id))
    .filter(Boolean) as ImageData[];

  // Calculate new orders (1, 2, 3...)
  reorderedImages.forEach((img, index) => {
    const newOrder = index + 1;
    if (img.order !== newOrder) {
      updates.push({ imageId: img.id, order: newOrder });
    }
  });

  return updates;
}

/**
 * Debounced function for batch updating image orders in Firestore
 * Uses trailing edge debouncing (waits 500ms after last call)
 */
const debouncedBatchUpdate = debounce(
  async (
    userId: string,
    projectId: string,
    spaceId: string,
    updates: Array<{ imageId: string; order: number }>,
    previousOrders: Array<{ imageId: string; order: number | null }>,
    dispatch: AppDispatch
  ) => {
    try {
      await batchUpdateImagesOrder(userId, projectId, spaceId, updates);
      console.log('Successfully synced image order to Firestore');
      message.success('Image order saved successfully');
    } catch (error) {
      console.error('Failed to update image order in Firestore:', error);

      // Rollback optimistic update
      dispatch(
        rollbackReorderImages({
          projectId,
          spaceId,
          previousOrders,
        })
      );

      message.error('Failed to save image order. Changes have been reverted.');
    }
  },
  500, // 500ms debounce delay
  { trailing: true, leading: false }
);

/**
 * Thunk action creator for reordering images with optimistic updates and debounced sync
 * @param userId - User ID
 * @param projectId - Project ID
 * @param spaceId - Space ID
 * @param reorderedImageIds - Array of image IDs in the new desired order
 * @param allImages - All images in the space (for calculating order values)
 */
export const reorderImagesWithDebounce =
  (
    userId: string,
    projectId: string,
    spaceId: string,
    reorderedImageIds: string[],
    allImages: ImageData[]
  ) =>
  (dispatch: AppDispatch) => {
    // Calculate what needs to be updated
    const updates = calculateNewOrders(allImages, reorderedImageIds);

    if (updates.length === 0) {
      console.log('No order changes needed');
      return;
    }

    // Store previous orders for potential rollback
    const previousOrders = updates.map(({ imageId }) => {
      const img = allImages.find((i) => i.id === imageId);
      return { imageId, order: img?.order ?? null };
    });

    // Optimistically update Redux state immediately
    dispatch(
      reorderImagesOptimistic({
        projectId,
        spaceId,
        reorderedImages: updates,
      })
    );

    // Debounced sync to Firestore
    debouncedBatchUpdate(userId, projectId, spaceId, updates, previousOrders, dispatch);
  };
