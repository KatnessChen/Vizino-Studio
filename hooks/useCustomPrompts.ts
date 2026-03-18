import { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { backendService } from '@/services/backendService';
import {
  setCustomPrompts,
  setLoadingPrompts,
  setLoadPromptsError,
  removeCustomPrompt,
  selectCustomPromptsForProject,
  selectIsLoadingPromptsForProject,
  selectLoadPromptsErrorForProject,
  selectSearchedCustomPrompts,
} from '@/stores/customAssetsStore';

interface UseCustomPromptsOptions {
  userId?: string;
  projectId?: string;
}

/**
 * Hook for managing custom prompts
 * Provides access to cached prompts, loading states, and fetch/search/delete operations
 */
export const useCustomPrompts = (options: UseCustomPromptsOptions) => {
  const { projectId } = options;
  const dispatch = useDispatch();

  // Selectors
  const prompts = useSelector(selectCustomPromptsForProject(projectId || ''));
  const isLoading = useSelector(selectIsLoadingPromptsForProject(projectId || ''));
  const error = useSelector(selectLoadPromptsErrorForProject(projectId || ''));

  // Fetch all prompts from Backend
  const fetchPrompts = useCallback(async () => {
    if (!projectId) {
      dispatch(
        setLoadPromptsError({ projectId: projectId || '', error: 'Missing projectId' })
      );
      return;
    }

    dispatch(setLoadingPrompts({ projectId, isLoadingPrompts: true }));

    try {
      const fetchedPrompts = await backendService.getPrompts(projectId);
      dispatch(
        setCustomPrompts({
          projectId,
          prompts: fetchedPrompts,
        })
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch custom prompts';
      dispatch(
        setLoadPromptsError({
          projectId,
          error: errorMessage,
        })
      );
    }
  }, [projectId, dispatch]);

  // Delete a single prompt
  const deletePrompt = useCallback(
    async (promptId: string) => {
      if (!projectId) {
        throw new Error('Missing projectId');
      }

      try {
        // Delete from Backend
        await backendService.deletePrompt(projectId, promptId);
        
        // Remove from Redux store
        dispatch(removeCustomPrompt({ projectId, promptId }));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete custom prompt';
        throw new Error(errorMessage);
      }
    },
    [projectId, dispatch]
  );

  // Filter prompts by keyword
  const searchPrompts = useCallback(
    (keyword: string) => {
      if (!projectId) return [];
      return selectSearchedCustomPrompts(projectId, keyword)({ customAssets: { projects: {} } });
    },
    [projectId]
  );

  return {
    prompts,
    isLoading,
    error,
    fetchPrompts,
    deletePrompt,
    searchPrompts,
  };
};
