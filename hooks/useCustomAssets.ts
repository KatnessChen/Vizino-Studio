/**
 * useCustomAssets Hook
 *
 * Manages custom textures and items for the current context (user or guest).
 * Uses the storage adapter pattern to abstract away the storage details.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/stores/store';
import {
  setCustomTextures,
  setCustomItems,
  addCustomTexture as addCustomTextureAction,
  addCustomItem as addCustomItemAction,
  removeCustomTexture as removeCustomTextureAction,
  removeCustomItem as removeCustomItemAction,
  updateCustomTexture as updateCustomTextureAction,
  updateCustomItem as updateCustomItemAction,
  setLoadingTextures,
  setLoadingItems,
  setLoadTexturesError,
  setLoadItemsError,
} from '@/stores/customAssetsStore';
import { useStorageAdapter } from '@/hooks/useStorageAdapter';
import { useUploadGate } from '@/hooks/useUploadGate';
import { Texture, Item } from '@/types';

type AssetType = 'texture' | 'item';

const GUEST_PROJECT_ID = 'guest-project';

export const useCustomAssets = <T extends AssetType>(assetType: T, projectId: string | null) => {
  const dispatch = useDispatch();
  const { adapter, isReady, isGuestMode } = useStorageAdapter();
  const { gateUpload } = useUploadGate();

  const isTexture = assetType === 'texture';

  // Use virtual project ID for guests
  const effectiveProjectId = isGuestMode ? GUEST_PROJECT_ID : projectId;

  // Use ref to track if we've already started loading for this project/asset type
  const loadingStartedRef = useRef<string | null>(null);
  const loadingKey = `${effectiveProjectId}-${assetType}`;

  // Get project-specific assets from store
  const projectAssets = useSelector((state: RootState) =>
    effectiveProjectId ? state.customAssets.projects[effectiveProjectId] : undefined
  );

  const customAssets = isTexture
    ? (projectAssets?.customTextures ?? [])
    : (projectAssets?.customItems ?? []);
  const isLoadingAssets = isTexture
    ? (projectAssets?.isLoadingTextures ?? false)
    : (projectAssets?.isLoadingItems ?? false);
  const loadAssetsError = isTexture
    ? (projectAssets?.loadTexturesError ?? null)
    : (projectAssets?.loadItemsError ?? null);

  // Load custom assets - only once per project/asset type
  useEffect(() => {
    // Skip if not ready or no project
    if (!isReady || !effectiveProjectId) return;

    // Skip if already loaded (has assets)
    const hasAssets = isTexture
      ? (projectAssets?.customTextures?.length ?? 0) > 0
      : (projectAssets?.customItems?.length ?? 0) > 0;
    if (hasAssets) {
      return;
    }

    // Skip if already loading
    const isLoading = isTexture
      ? projectAssets?.isLoadingTextures
      : projectAssets?.isLoadingItems;
    if (isLoading) {
      return;
    }

    // Skip if we already started loading for this key
    if (loadingStartedRef.current === loadingKey) {
      return;
    }

    // Mark that we're starting to load
    loadingStartedRef.current = loadingKey;

    const loadAssets = async () => {
      try {
        if (isTexture) {
          dispatch(setLoadingTextures({ projectId: effectiveProjectId, isLoadingTextures: true }));
          const textures = await adapter.fetchTextures();
          dispatch(setCustomTextures({ projectId: effectiveProjectId, textures }));
        } else {
          dispatch(setLoadingItems({ projectId: effectiveProjectId, isLoadingItems: true }));
          const items = await adapter.fetchItems();
          dispatch(setCustomItems({ projectId: effectiveProjectId, items }));
        }
      } catch (error) {
        console.error(`Failed to load ${assetType}s:`, error);
        if (isTexture) {
          dispatch(
            setLoadTexturesError({
              projectId: effectiveProjectId,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          );
        } else {
          dispatch(
            setLoadItemsError({
              projectId: effectiveProjectId,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          );
        }
      }
    };

    loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, effectiveProjectId, assetType]);

  const addAsset = useCallback(async (assetData: {
    name: string;
    file: File;
    description?: string;
    width?: number;
    height?: number;
    aspect_ratio?: number;
  }): Promise<Texture | Item> => {
    if (!isReady || !effectiveProjectId) {
      throw new Error('Storage not ready');
    }

    // For guests, check if upload should be gated
    if (isGuestMode) {
      const allowed = gateUpload(assetType, assetData);
      if (!allowed) {
        throw new Error('LOGIN_REQUIRED');
      }
    }

    if (isTexture) {
      const newTexture = await adapter.addTexture(assetData);
      dispatch(addCustomTextureAction({ projectId: effectiveProjectId, texture: newTexture }));
      return newTexture;
    } else {
      const newItem = await adapter.addItem(assetData);
      dispatch(addCustomItemAction({ projectId: effectiveProjectId, item: newItem }));
      return newItem;
    }
  }, [isReady, effectiveProjectId, isGuestMode, gateUpload, assetType, isTexture, adapter, dispatch]);

  const deleteAsset = useCallback(async (assetId: string): Promise<void> => {
    if (!isReady || !effectiveProjectId) {
      throw new Error('Storage not ready');
    }

    if (isTexture) {
      await adapter.deleteTexture(assetId);
      dispatch(removeCustomTextureAction({ projectId: effectiveProjectId, textureId: assetId }));
    } else {
      await adapter.deleteItem(assetId);
      dispatch(removeCustomItemAction({ projectId: effectiveProjectId, itemId: assetId }));
    }
  }, [isReady, effectiveProjectId, isTexture, adapter, dispatch]);
 
   const updateAsset = useCallback(async (assetId: string, updates: { name?: string; description?: string }): Promise<void> => {
     if (!isReady || !effectiveProjectId) {
       throw new Error('Storage not ready');
     }
 
     if (isTexture) {
       await adapter.updateTexture(assetId, updates);
       dispatch(updateCustomTextureAction({ projectId: effectiveProjectId, textureId: assetId, updates }));
     } else {
       await adapter.updateItem(assetId, updates);
       dispatch(updateCustomItemAction({ projectId: effectiveProjectId, itemId: assetId, updates }));
     }
   }, [isReady, effectiveProjectId, isTexture, adapter, dispatch]);
 
   return {
     customAssets,
     isLoadingAssets,
     loadAssetsError,
     addAsset,
     deleteAsset,
     updateAsset,
   };
 
 };
