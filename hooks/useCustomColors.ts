/**
 * useCustomColors Hook
 *
 * Manages custom colors for the current context (user or guest).
 * Uses the storage adapter pattern to abstract away the storage details.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/stores/store';
import {
  setCustomColors,
  addCustomColor as addCustomColorAction,
  updateCustomColor,
  removeCustomColor as removeCustomColorAction,
  setLoadingColors,
  setLoadColorsError,
} from '@/stores/customAssetsStore';
import { useStorageAdapter } from '@/hooks/useStorageAdapter';
import { useUploadGate } from '@/hooks/useUploadGate';
import { Color } from '@/types';

const GUEST_PROJECT_ID = 'guest-project';

export const useCustomColors = (projectId: string | null) => {
  const dispatch = useDispatch();
  const { adapter, isReady, isGuestMode } = useStorageAdapter();
  const { gateUpload } = useUploadGate();

  // Use virtual project ID for guests
  const effectiveProjectId = isGuestMode ? GUEST_PROJECT_ID : projectId;

  // Use ref to track if we've already started loading for this project
  const loadingStartedRef = useRef<string | null>(null);

  // Get project-specific assets from store
  const projectAssets = useSelector((state: RootState) =>
    effectiveProjectId ? state.customAssets.projects[effectiveProjectId] : undefined
  );

  const customColors = projectAssets?.customColors ?? [];
  const isLoadingColors = projectAssets?.isLoadingColors ?? false;
  const loadColorsError = projectAssets?.loadColorsError ?? null;

  // Load custom colors - only once per project
  useEffect(() => {
    // Skip if not ready or no project
    if (!isReady || !effectiveProjectId) return;

    // Skip if already loaded (has colors)
    if (projectAssets?.customColors && projectAssets.customColors.length > 0) {
      return;
    }

    // Skip if already loading
    if (projectAssets?.isLoadingColors) {
      return;
    }

    // Skip if we already started loading for this project
    if (loadingStartedRef.current === effectiveProjectId) {
      return;
    }

    // Mark that we're starting to load
    loadingStartedRef.current = effectiveProjectId;

    const loadColors = async () => {
      dispatch(setLoadingColors({ projectId: effectiveProjectId, isLoadingColors: true }));
      try {
        const colors = await adapter.fetchColors();
        dispatch(setCustomColors({ projectId: effectiveProjectId, colors }));
      } catch (error) {
        console.error('Failed to load colors:', error);
        dispatch(
          setLoadColorsError({
            projectId: effectiveProjectId,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        );
      }
    };

    loadColors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, effectiveProjectId]);

  const addColor = useCallback(async (colorData: { name: string; hex: string; description?: string }): Promise<Color> => {
    if (!isReady || !effectiveProjectId) {
      throw new Error('Storage not ready');
    }

    // For guests, check if upload should be gated
    if (isGuestMode) {
      const allowed = gateUpload('color', colorData);
      if (!allowed) {
        throw new Error('LOGIN_REQUIRED');
      }
    }

    const newColor = await adapter.addColor(colorData);
    dispatch(addCustomColorAction({ projectId: effectiveProjectId, color: newColor }));
    return newColor;
  }, [isReady, effectiveProjectId, isGuestMode, gateUpload, adapter, dispatch]);

  const updateColor = useCallback(
    async (colorId: string, updates: { name?: string; description?: string }): Promise<void> => {
      if (!isReady || !effectiveProjectId) {
        throw new Error('Storage not ready');
      }

      await adapter.updateColor(colorId, updates);
      dispatch(updateCustomColor({ projectId: effectiveProjectId, colorId, updates }));
    },
    [isReady, effectiveProjectId, adapter, dispatch]
  );

  const deleteColor = useCallback(
    async (colorId: string): Promise<void> => {
      if (!isReady || !effectiveProjectId) {
        throw new Error('Storage not ready');
      }

      await adapter.deleteColor(colorId);
      dispatch(removeCustomColorAction({ projectId: effectiveProjectId, colorId }));
    },
    [isReady, effectiveProjectId, adapter, dispatch]
  );

  return {
    customColors,
    isLoadingColors,
    loadColorsError,
    addColor,
    updateColor,
    deleteColor,
  };
};
