import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/stores/store';
import {
  setCustomTextures,
  setCustomItems,
  addCustomTexture as addCustomTextureAction,
  addCustomItem as addCustomItemAction,
  removeCustomTexture as removeCustomTextureAction,
  removeCustomItem as removeCustomItemAction,
  setLoadingTextures,
  setLoadingItems,
  setLoadTexturesError,
  setLoadItemsError,
} from '@/stores/customAssetsStore';
import {
  fetchTextures,
  fetchItems,
  addTexture as addTextureFirestore,
  addItem as addItemFirestore,
  deleteTexture as deleteTextureFirestore,
  deleteItem as deleteItemFirestore,
} from '@/services/firestoreService';
import { useAuth } from '@/contexts/AuthContext';

type AssetType = 'texture' | 'item';

export const useCustomAssets = <T extends AssetType>(assetType: T, projectId: string | null) => {
  const dispatch = useDispatch();
  const { user } = useAuth();

  // Get project-specific assets from store
  const projectAssets = useSelector((state: RootState) =>
    projectId ? state.customAssets.projects[projectId] : undefined
  );

  const isTexture = assetType === 'texture';

  const customAssets = isTexture
    ? (projectAssets?.customTextures ?? [])
    : (projectAssets?.customItems ?? []);
  const isLoadingAssets = isTexture
    ? (projectAssets?.isLoadingTextures ?? false)
    : (projectAssets?.isLoadingItems ?? false);
  const loadAssetsError = isTexture
    ? (projectAssets?.loadTexturesError ?? null)
    : (projectAssets?.loadItemsError ?? null);

  // Load custom assets with cache check
  useEffect(() => {
    if (!user?.uid || !projectId) {
      return;
    }

    // Check if assets are already loaded in store
    const hasAssets =
      projectAssets &&
      (isTexture ? projectAssets.customTextures.length > 0 : projectAssets.customItems.length > 0);
    if (hasAssets) {
      console.log(`Using cached custom ${assetType}s for project:`, projectId);
      return;
    }

    // Check if already loading
    const isLoading = isTexture ? projectAssets?.isLoadingTextures : projectAssets?.isLoadingItems;
    if (isLoading) {
      return;
    }

    const loadAssets = async () => {
      try {
        if (isTexture) {
          dispatch(setLoadingTextures({ projectId, isLoadingTextures: true }));
          const textures = await fetchTextures(user.uid, projectId);
          dispatch(setCustomTextures({ projectId, textures }));
          console.log(`Loaded custom ${assetType}s from Firestore:`, projectId);
        } else {
          dispatch(setLoadingItems({ projectId, isLoadingItems: true }));
          const items = await fetchItems(user.uid, projectId);
          dispatch(setCustomItems({ projectId, items }));
          console.log(`Loaded custom ${assetType}s from Firestore:`, projectId);
        }
      } catch (error) {
        console.error(`Failed to load ${assetType}s:`, error);
        if (isTexture) {
          dispatch(
            setLoadTexturesError({
              projectId,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          );
        } else {
          dispatch(
            setLoadItemsError({
              projectId,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          );
        }
      }
    };

    loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, projectId, dispatch, assetType]);

  const addAsset = async (assetData: { name: string; file: File; description?: string; width?: number; height?: number; aspect_ratio?: number }) => {
    if (!user?.uid || !projectId) {
      throw new Error('User or project not available');
    }

    try {
      if (isTexture) {
        const newTexture = await addTextureFirestore(user.uid, projectId, assetData);
        dispatch(addCustomTextureAction({ projectId, texture: newTexture }));
        return newTexture;
      } else {
        const newItem = await addItemFirestore(user.uid, projectId, assetData);
        dispatch(addCustomItemAction({ projectId, item: newItem }));
        return newItem;
      }
    } catch (error) {
      console.error(`Failed to add ${assetType}:`, error);
      throw error;
    }
  };

  const deleteAsset = async (assetId: string) => {
    if (!user?.uid || !projectId) {
      throw new Error('User or project not available');
    }

    try {
      if (isTexture) {
        await deleteTextureFirestore(user.uid, projectId, assetId);
        dispatch(removeCustomTextureAction({ projectId, textureId: assetId }));
      } else {
        await deleteItemFirestore(user.uid, projectId, assetId);
        dispatch(removeCustomItemAction({ projectId, itemId: assetId }));
      }
    } catch (error) {
      console.error(`Failed to delete ${assetType}:`, error);
      throw error;
    }
  };

  return {
    customAssets,
    isLoadingAssets,
    loadAssetsError,
    addAsset,
    deleteAsset,
  };
};
