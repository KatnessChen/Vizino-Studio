/**
 * useCustomAssets Hook
 *
 * Manages custom assets (colors, textures, and items) for the current context (user or guest).
 * Uses the storage adapter pattern to abstract away the storage details.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/stores/store';
import {
  setCustomTextures,
  setCustomItems,
  setCustomColors,
  addCustomTexture as addCustomTextureAction,
  addCustomItem as addCustomItemAction,
  addCustomColor as addCustomColorAction,
  removeCustomTexture as removeCustomTextureAction,
  removeCustomItem as removeCustomItemAction,
  removeCustomColor as removeCustomColorAction,
  updateCustomTexture as updateCustomTextureAction,
  updateCustomItem as updateCustomItemAction,
  updateCustomColor,
  setLoadingTextures,
  setLoadingItems,
  setLoadingColors,
  setLoadTexturesError,
  setLoadItemsError,
  setLoadColorsError,
} from '@/stores/customAssetsStore';
import { reorderAssetsWithDebounce } from '@/stores/imageOrderThunks';
import { useStorageAdapter } from '@/hooks/useStorageAdapter';
import { useUploadGate } from '@/hooks/useUploadGate';
import { ImageOperation, Texture, Item, Color } from '@/types';
import { ASSET_COLOR } from '@/constants/constants';
import { AssetKind, isTextureAsset, isItemAsset, isColorAsset } from '@/utils/assetUtils';
import { CreateAssetParams, CreateColorParams } from '@/services/storageAdapter';

const GUEST_PROJECT_ID = 'guest-project';

export const useCustomAssets = <T extends AssetKind>(assetType: T, projectId: string | null) => {
  const dispatch = useDispatch<AppDispatch>();
  const { adapter, isReady, isGuestMode } = useStorageAdapter();
  const { gateUpload } = useUploadGate();

  // Use shared utility functions for type checking
  const isTexture = isTextureAsset(assetType);
  const isItem = isItemAsset(assetType);
  const isColor = isColorAsset(assetType);

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
    : isItem
      ? (projectAssets?.customItems ?? [])
      : (projectAssets?.customColors ?? []);
  const isLoadingAssets = isTexture
    ? (projectAssets?.isLoadingTextures ?? false)
    : isItem
      ? (projectAssets?.isLoadingItems ?? false)
      : (projectAssets?.isLoadingColors ?? false);
  const loadAssetsError = isTexture
    ? (projectAssets?.loadTexturesError ?? null)
    : isItem
      ? (projectAssets?.loadItemsError ?? null)
      : (projectAssets?.loadColorsError ?? null);

  // Load custom assets - only once per project/asset type
  useEffect(() => {
    // Skip if not ready or no project
    if (!isReady || !effectiveProjectId) return;

    // Skip if already loaded (has assets)
    const hasAssets = isTexture
      ? (projectAssets?.customTextures?.length ?? 0) > 0
      : isItem
        ? (projectAssets?.customItems?.length ?? 0) > 0
        : (projectAssets?.customColors?.length ?? 0) > 0;
    if (hasAssets) {
      return;
    }

    // Skip if already loading
    const isLoading = isTexture
      ? projectAssets?.isLoadingTextures
      : isItem
        ? projectAssets?.isLoadingItems
        : projectAssets?.isLoadingColors;
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
          textures.sort((a, b) => (a.order || 0) - (b.order || 0));
          dispatch(setCustomTextures({ projectId: effectiveProjectId, textures }));
        } else if (isItem) {
          dispatch(setLoadingItems({ projectId: effectiveProjectId, isLoadingItems: true }));
          const items = await adapter.fetchItems();
          items.sort((a, b) => (a.order || 0) - (b.order || 0));
          dispatch(setCustomItems({ projectId: effectiveProjectId, items }));
        } else {
          dispatch(setLoadingColors({ projectId: effectiveProjectId, isLoadingColors: true }));
          const colors = await adapter.fetchColors();
          dispatch(setCustomColors({ projectId: effectiveProjectId, colors }));
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
        } else if (isItem) {
          dispatch(
            setLoadItemsError({
              projectId: effectiveProjectId,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          );
        } else {
          dispatch(
            setLoadColorsError({
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

  const addAsset = useCallback(
    async (
      assetData: T extends typeof ASSET_COLOR
        ? {
            name: string;
            hex: string;
            description?: string;
            evolutionChain?: ImageOperation[];
          }
        : {
            name: string;
            file: File;
            description?: string;
            width?: number;
            height?: number;
            aspect_ratio?: number;
            evolutionChain?: ImageOperation[];
          }
    ): Promise<Color | Texture | Item> => {
      if (!isReady || !effectiveProjectId) {
        throw new Error('Storage not ready');
      }

      // For guests, check if upload should be gated (only for textures and items)
      if (isGuestMode && (isTexture || isItem)) {
        const allowed = gateUpload(assetType, assetData);
        if (!allowed) {
          throw new Error('LOGIN_REQUIRED');
        }
      }

      if (isTexture) {
        const newTexture = await adapter.addTexture(assetData as CreateAssetParams);
        dispatch(addCustomTextureAction({ projectId: effectiveProjectId, texture: newTexture }));
        return newTexture;
      } else if (isItem) {
        const newItem = await adapter.addItem(assetData as CreateAssetParams);
        dispatch(addCustomItemAction({ projectId: effectiveProjectId, item: newItem }));
        return newItem;
      } else {
        const newColor = await adapter.addColor(assetData as CreateColorParams);
        dispatch(addCustomColorAction({ projectId: effectiveProjectId, color: newColor }));
        return newColor;
      }
    },
    [
      isReady,
      effectiveProjectId,
      isGuestMode,
      gateUpload,
      assetType,
      isTexture,
      isItem,
      adapter,
      dispatch,
    ]
  );

  const deleteAsset = useCallback(
    async (assetId: string): Promise<void> => {
      if (!isReady || !effectiveProjectId) {
        throw new Error('Storage not ready');
      }

      if (isTexture) {
        await adapter.deleteTexture(assetId);
        dispatch(removeCustomTextureAction({ projectId: effectiveProjectId, textureId: assetId }));
      } else if (isItem) {
        await adapter.deleteItem(assetId);
        dispatch(removeCustomItemAction({ projectId: effectiveProjectId, itemId: assetId }));
      } else if (isColor) {
        await adapter.deleteColor(assetId);
        dispatch(removeCustomColorAction({ projectId: effectiveProjectId, colorId: assetId }));
      }
    },
    [isReady, effectiveProjectId, isColor, isTexture, isItem, adapter, dispatch]
  );

  const updateAsset = useCallback(
    async (assetId: string, updates: { name?: string; description?: string }): Promise<void> => {
      if (!isReady || !effectiveProjectId) {
        throw new Error('Storage not ready');
      }

      if (isTexture) {
        await adapter.updateTexture(assetId, updates);
        dispatch(
          updateCustomTextureAction({ projectId: effectiveProjectId, textureId: assetId, updates })
        );
      } else if (isItem) {
        await adapter.updateItem(assetId, updates);
        dispatch(
          updateCustomItemAction({ projectId: effectiveProjectId, itemId: assetId, updates })
        );
      } else if (isColor) {
        await adapter.updateColor(assetId, updates);
        dispatch(updateCustomColor({ projectId: effectiveProjectId, colorId: assetId, updates }));
      }
    },
    [isReady, effectiveProjectId, isTexture, isItem, isColor, adapter, dispatch]
  );

  const reorderAssets = useCallback(
    async (reorderedIds: string[]): Promise<void> => {
      // Basic validation
      if (!isReady || !effectiveProjectId) return;
      
      // Determine collection name
      let collectionName: 'custom_textures' | 'custom_items' | null = null;
      if (isTexture) collectionName = 'custom_textures';
      if (isItem) collectionName = 'custom_items';
      
      if (!collectionName) return; 

      // Get current assets for this type
      const currentAssets = isTexture 
         ? projectAssets?.customTextures 
         : projectAssets?.customItems;

      if (!currentAssets || currentAssets.length === 0) return;

      // Dispatch the thunk
      // effectiveProjectId is used as projectId
      // spaceId is null for project-level assets
      // contextId in adapter is essentially the userId (or guest ID)
      dispatch(
        reorderAssetsWithDebounce(
            adapter.contextId, // userId
            effectiveProjectId,
            null, // spaceId for project-level
            collectionName,
            reorderedIds,
            currentAssets as any[] // Start with cast, better would be proper union type handling
        )
      );
    },
    [isReady, effectiveProjectId, isTexture, isItem, projectAssets, adapter.contextId, dispatch]
  );

  return {
    customAssets,
    isLoadingAssets,
    loadAssetsError,
    addAsset,
    deleteAsset,
    updateAsset,
    reorderAssets,
  };
};
