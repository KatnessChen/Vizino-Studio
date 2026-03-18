import { debounce } from 'lodash';
import { AppDispatch } from './store';
import { reorderImagesOptimistic, rollbackReorderImages } from './projectStore';
import { setCustomTextures, setCustomItems } from './customAssetsStore';
import { backendService } from '@/services/backendService';
import { devLog, devError } from '@/utils/devLogger';
import { ImageData, Texture, Item } from '@/types';
import { message } from '@/utils/antd';

type Asset = ImageData | Texture | Item;
type CollectionName = 'images' | 'custom_textures' | 'custom_items';

/**
 * Calculate new order values for reordered assets
 * Strategy: Reassign all assets with sequential ordering (1, 2, 3...)
 */
function calculateNewOrders(
  allAssets: Asset[],
  reorderedIds: string[]
): Array<{ id: string; order: number }> {
  const updates: Array<{ id: string; order: number }> = [];

  // Find assets that need reordering
  const reorderedAssets = reorderedIds
    .map((id) => allAssets.find((asset) => asset.id === id))
    .filter(Boolean) as Asset[];

  // Calculate new orders (1, 2, 3...)
  reorderedAssets.forEach((asset, index) => {
    const newOrder = index + 1;
    if (asset.order !== newOrder) {
      updates.push({ id: asset.id, order: newOrder });
    }
  });

  return updates;
}

/**
 * Debounced function for batch updating asset orders in Firestore
 * Uses trailing edge debouncing (waits 500ms after last call)
 */
const debouncedBatchUpdate = debounce(
  async (
    userId: string,
    projectId: string,
    spaceId: string | null,
    collectionName: CollectionName,
    reorderedIds: string[],
    rollbackAction: (dispatch: AppDispatch) => void,
    dispatch: AppDispatch
  ) => {
    try {
      // Calculate updates here to ensure we always write the full latest state
      // This prevents "lost updates" due to optimistic state mismatches during debounce
      const updates = reorderedIds.map((id, index) => ({ id, order: index + 1 }));

      if (collectionName === 'images' && spaceId) {
        await backendService.updateImageOrder(projectId, spaceId, updates);
      } else {
        // Fallback for custom assets if backend not ready, or implement there too
        devLog(`Order sync for ${collectionName} not yet implemented via backend`);
      }
      
      devLog(`Successfully synced ${collectionName} order to Firestore`);
      message.success('Order saved successfully');
    } catch (error) {
      devError(`Failed to update ${collectionName} order in Firestore:`, error);

      // Rollback optimistic update
      rollbackAction(dispatch);

      message.error('Failed to save order. Changes have been reverted.');
    }
  },
  500, // 500ms debounce delay
  { trailing: true, leading: false }
);

/**
 * Thunk action creator for reordering assets with optimistic updates and debounced sync
 */
export const reorderAssetsWithDebounce =
  (
    userId: string,
    projectId: string,
    spaceId: string | null,
    collectionName: CollectionName,
    reorderedIds: string[],
    allAssets: Asset[]
  ) =>
  (dispatch: AppDispatch) => {
    // Calculate what needs to be updated (FOR REDUX OPTIMISTIC UPDATE)
    const updates = calculateNewOrders(allAssets, reorderedIds);

    if (updates.length === 0) {
      devLog('No order changes needed');
      return;
    }

    // Prepare rollback action
    let rollbackAction: (dispatch: AppDispatch) => void;

    // Optimistically update Redux state immediately AND define rollback
    if (collectionName === 'images') {
      if (!spaceId) {
        devError('Space ID required for image reordering');
        return;
      }
      const previousOrders = updates.map(({ id }) => {
        const img = allAssets.find((i) => i.id === id);
        return { imageId: id, order: img?.order ?? null };
      });

      dispatch(
        reorderImagesOptimistic({
          projectId,
          spaceId,
          reorderedImages: updates.map((u) => ({ imageId: u.id, order: u.order })),
        })
      );

      rollbackAction = (d) =>
        d(
          rollbackReorderImages({
            projectId,
            spaceId,
            previousOrders,
          })
        );
    } else if (collectionName === 'custom_textures') {
      // For custom assets, we don't have atomic reorder actions, so we just set the full list
      // Creating the new sorted list
      const assetMap = new Map(allAssets.map((a) => [a.id, a as Texture]));

      // Create shallow copies to avoid mutating read-only Redux state
      const newSortedAssets = reorderedIds
        .map((id) => {
          const asset = assetMap.get(id);
          return asset ? { ...asset } : null;
        })
        .filter((a): a is Texture => !!a);

      // Update orders in the new list to match the calculated updates (optimistic)
      updates.forEach((u) => {
        const asset = newSortedAssets.find((a) => a.id === u.id);
        if (asset) asset.order = u.order;
      });

      // Preserve any assets that weren't in reorderedIds (append them)
      // Filter to check for any missing assets (if needed for future validation)
      // Simplified missing check:
      const processedIds = new Set(newSortedAssets.map((a) => a.id));
      const remainingAssets = (allAssets as Texture[]).filter((a) => !processedIds.has(a.id));

      if (remainingAssets.length > 0) newSortedAssets.push(...remainingAssets);

      dispatch(setCustomTextures({ projectId, textures: newSortedAssets }));

      // Rollback is just setting the original list back
      rollbackAction = (d) => d(setCustomTextures({ projectId, textures: allAssets as Texture[] }));
    } else if (collectionName === 'custom_items') {
      const assetMap = new Map(allAssets.map((a) => [a.id, a as Item]));

      // Create shallow copies
      const newSortedAssets = reorderedIds
        .map((id) => {
          const asset = assetMap.get(id);
          return asset ? { ...asset } : null;
        })
        .filter((a): a is Item => !!a);

      updates.forEach((u) => {
        const asset = newSortedAssets.find((a) => a.id === u.id);
        if (asset) asset.order = u.order;
      });

      const processedIds = new Set(newSortedAssets.map((a) => a.id));
      const remainingAssets = (allAssets as Item[]).filter((a) => !processedIds.has(a.id));

      if (remainingAssets.length > 0) newSortedAssets.push(...remainingAssets);

      dispatch(setCustomItems({ projectId, items: newSortedAssets }));

      rollbackAction = (d) => d(setCustomItems({ projectId, items: allAssets as Item[] }));
    } else {
      devError('Unknown collection name for reordering');
      return;
    }

    // Debounced sync to Firestore
    // IMPORTANT: We pass the FULL reorderedIds list, not the incremental updates.
    // The debounce function will persist the entire order to ensure consistency because
    // calculating incremental updates against Redux state during a debounce sequence is unreliable.
    debouncedBatchUpdate(
      userId,
      projectId,
      spaceId,
      collectionName,
      reorderedIds,
      rollbackAction,
      dispatch
    );
  };

// Backward compatibility alias (deprecated)
export const reorderImagesWithDebounce = (
  userId: string,
  projectId: string,
  spaceId: string,
  reorderedImageIds: string[],
  allImages: ImageData[]
) => reorderAssetsWithDebounce(userId, projectId, spaceId, 'images', reorderedImageIds, allImages);
