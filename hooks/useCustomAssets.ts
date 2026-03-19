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
import { useUploadGate } from '@/hooks/useUploadGate';
import { devError } from '@/utils/devLogger';
import { Texture, Item } from '@/types';
import { AssetKind, isTextureAsset, isItemAsset, isColorAsset } from '@/utils/assetUtils';
import { backendService } from '@/services/backendService';
import { useAuth } from '@/contexts/AuthContext';

const GUEST_PROJECT_ID = 'guest-project';

export const useCustomAssets = <T extends AssetKind>(assetType: T, projectId: string | null) => {
  const dispatch = useDispatch<AppDispatch>();
  const { user, isAuthenticated } = useAuth();
  const isGuestMode = !isAuthenticated;
  useUploadGate();

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
    // Skip if no project or guest (guests don't have custom assets in this version)
    if (!effectiveProjectId || isGuestMode) return;

    // Skip if already loaded (has assets)
    const hasAssets = isTexture
      ? (projectAssets?.customTextures?.length ?? 0) > 0
      : isItem
        ? (projectAssets?.customItems?.length ?? 0) > 0
        : (projectAssets?.customColors?.length ?? 0) > 0;
    if (hasAssets) return;

    // Skip if already loading
    const isLoading = isTexture
      ? projectAssets?.isLoadingTextures
      : isItem
        ? projectAssets?.isLoadingItems
        : projectAssets?.isLoadingColors;
    if (isLoading) return;

    // Skip if we already started loading for this key
    if (loadingStartedRef.current === loadingKey) return;

    // Mark that we're starting to load
    loadingStartedRef.current = loadingKey;

    const loadAssets = async () => {
      try {
        if (isTexture) {
          dispatch(setLoadingTextures({ projectId: effectiveProjectId, isLoadingTextures: true }));
          const rawTextures = await backendService.getTextures(effectiveProjectId);
          // Normalize: ensure imageDownloadUrl is set from textureImageDownloadUrl for AssetCard compatibility
          const textures = rawTextures.map((t) => ({
            ...t,
            imageDownloadUrl: (t.textureImageDownloadUrl as string) || (t.imageDownloadUrl as string) || '',
          }));
          dispatch(setCustomTextures({ projectId: effectiveProjectId, textures: textures as unknown as Texture[] }));
        } else if (isItem) {
          dispatch(setLoadingItems({ projectId: effectiveProjectId, isLoadingItems: true }));
          const rawItems = await backendService.getItems(effectiveProjectId);
          // Normalize: ensure imageDownloadUrl is set from itemImageDownloadUrl for AssetCard compatibility
          const items = rawItems.map((i) => ({
            ...i,
            imageDownloadUrl: (i.itemImageDownloadUrl as string) || (i.imageDownloadUrl as string) || '',
          }));
          dispatch(setCustomItems({ projectId: effectiveProjectId, items: items as unknown as Item[] }));
        } else {
          dispatch(setLoadingColors({ projectId: effectiveProjectId, isLoadingColors: true }));
          const colors = await backendService.getColors(effectiveProjectId);
          dispatch(setCustomColors({ projectId: effectiveProjectId, colors }));
        }
      } catch (error) {
        devError(`Failed to load ${assetType}s:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (isTexture) {
          dispatch(setLoadTexturesError({ projectId: effectiveProjectId, error: errorMessage }));
        } else if (isItem) {
          dispatch(setLoadItemsError({ projectId: effectiveProjectId, error: errorMessage }));
        } else {
          dispatch(setLoadColorsError({ projectId: effectiveProjectId, error: errorMessage }));
        }
      }
    };

    loadAssets();
  }, [effectiveProjectId, assetType, isGuestMode, isTexture, isItem, dispatch]);

  const addAsset = useCallback(
    async (assetData: Record<string, unknown>): Promise<unknown> => {
      if (!effectiveProjectId || isGuestMode) {
        throw new Error('Action not allowed for guests');
      }

      if (isTexture) {
        const newTexture = await backendService.uploadTexture(effectiveProjectId, assetData.name, assetData.file, assetData.description);
        dispatch(addCustomTextureAction({ projectId: effectiveProjectId, texture: newTexture as unknown as Texture }));
        return newTexture;
      } else if (isItem) {
        const newItem = await backendService.uploadItem(effectiveProjectId, assetData.name, assetData.file, assetData.description);
        dispatch(addCustomItemAction({ projectId: effectiveProjectId, item: newItem as unknown as Item }));
        return newItem;
      } else {
        const newColor = await backendService.createColor(effectiveProjectId, assetData.name, assetData.hex, assetData.description);
        dispatch(addCustomColorAction({ projectId: effectiveProjectId, color: newColor }));
        return newColor;
      }
    },
    [effectiveProjectId, isGuestMode, isTexture, isItem, assetType, dispatch]
  );

  const deleteAsset = useCallback(
    async (assetId: string): Promise<void> => {
      if (!effectiveProjectId || isGuestMode) return;

      if (isTexture) {
        await backendService.deleteTexture(effectiveProjectId, assetId);
        dispatch(removeCustomTextureAction({ projectId: effectiveProjectId, textureId: assetId }));
      } else if (isItem) {
        await backendService.deleteItem(effectiveProjectId, assetId);
        dispatch(removeCustomItemAction({ projectId: effectiveProjectId, itemId: assetId }));
      } else if (isColor) {
        await backendService.deleteColor(effectiveProjectId, assetId);
        dispatch(removeCustomColorAction({ projectId: effectiveProjectId, colorId: assetId }));
      }
    },
    [effectiveProjectId, isGuestMode, isTexture, isItem, isColor, dispatch]
  );

  const updateAsset = useCallback(
    async (assetId: string, updates: Record<string, unknown>): Promise<void> => {
      if (!effectiveProjectId || isGuestMode) return;

      if (isTexture) {
        // Assume backend updateTexture exists or use generic
        await backendService.updateTexture(effectiveProjectId, assetId, updates);
        dispatch(updateCustomTextureAction({ projectId: effectiveProjectId, textureId: assetId, updates }));
      } else if (isItem) {
        await backendService.updateItem(effectiveProjectId, assetId, updates);
        dispatch(updateCustomItemAction({ projectId: effectiveProjectId, itemId: assetId, updates }));
      } else if (isColor) {
        await backendService.updateColor(effectiveProjectId, assetId, updates.name, updates.hex);
        dispatch(updateCustomColor({ projectId: effectiveProjectId, colorId: assetId, updates }));
      }
    },
    [effectiveProjectId, isGuestMode, isTexture, isItem, isColor, dispatch]
  );

  const reorderAssets = useCallback(
    async (reorderedIds: string[]): Promise<void> => {
      if (!effectiveProjectId || isGuestMode) return;

      let collectionName: 'custom_textures' | 'custom_items' | null = null;
      if (isTexture) collectionName = 'custom_textures';
      if (isItem) collectionName = 'custom_items';

      if (!collectionName) return;

      const currentAssets = isTexture ? projectAssets?.customTextures : projectAssets?.customItems;
      if (!currentAssets || currentAssets.length === 0) return;

      dispatch(
        reorderAssetsWithDebounce(
          user?.uid || '',
          effectiveProjectId,
          null,
          collectionName,
          reorderedIds,
          isTexture ? (currentAssets as Texture[]) : (currentAssets as Item[])
        )
      );
    },
    [effectiveProjectId, isGuestMode, isTexture, isItem, projectAssets, user, dispatch]
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
