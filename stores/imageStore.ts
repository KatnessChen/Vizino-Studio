import { createSlice, createSelector, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
import { ImageData, Space } from '@/types';

interface ImageState {
  // Selection state
  selectedOriginalImageIds: Set<string>;
  selectedUpdatedImageIds: Set<string>;
}

const initialState: ImageState = {
  selectedOriginalImageIds: new Set(),
  selectedUpdatedImageIds: new Set(),
};

export const imageStore = createSlice({
  name: 'image',
  initialState,
  reducers: {
    setSelectedOriginalImageIds: (state, action: PayloadAction<Set<string>>) => {
      state.selectedOriginalImageIds = action.payload;
    },
    setSelectedUpdatedImageIds: (state, action: PayloadAction<Set<string>>) => {
      state.selectedUpdatedImageIds = action.payload;
    },
    resetSelectedImageIds: (state) => {
      state.selectedOriginalImageIds = new Set();
      state.selectedUpdatedImageIds = new Set();
    },
  },
});

/**
 * Selector to get all images (both original and updated) for the active space
 */
export const selectAllImages = createSelector(
  (state: RootState) => state.project.projects,
  (state: RootState) => state.project.activeProjectId,
  (state: RootState) => state.project.activeSpaceId,
  (projects, activeProjectId, activeSpaceId): ImageData[] => {
    if (!activeProjectId || !activeSpaceId) return [];
    const activeProject = projects.find((p) => p.id === activeProjectId);
    if (!activeProject) return [];
    const activeSpace = activeProject.spaces.find((s: Space) => s.id === activeSpaceId);
    return activeSpace?.images || [];
  }
);

/**
 * Selector to get only original images (without parentImageId) for the active space
 * Sorted by order (ascending), with null orders falling back to createdAt
 */
export const selectOriginalImages = createSelector(selectAllImages, (allImages): ImageData[] => {
  const originalImages = allImages.filter((img) => !img.parentImageId);

  return originalImages.sort((a, b) => {
    // If both have order values, sort by order
    if (a.order !== null && b.order !== null) {
      return a.order - b.order;
    }
    // If only one has order, prioritize it
    if (a.order !== null) return -1;
    if (b.order !== null) return 1;
    // If both are null, fallback to createdAt
    return a.createdAt.toMillis() - b.createdAt.toMillis();
  });
});

/**
 * Selector to get only updated images (with parentImageId) for the active space
 * Sorted by order (ascending), with null orders falling back to createdAt
 */
export const selectUpdatedImages = createSelector(selectAllImages, (allImages): ImageData[] => {
  const updatedImages = allImages.filter((img) => img.parentImageId);

  return updatedImages.sort((a, b) => {
    // If both have order values, sort by order
    if (a.order !== null && b.order !== null) {
      return a.order - b.order;
    }
    // If only one has order, prioritize it
    if (a.order !== null) return -1;
    if (b.order !== null) return 1;
    // If both are null, fallback to createdAt
    return a.createdAt.toMillis() - b.createdAt.toMillis();
  });
});

/**
 * Selector to get selected original image IDs
 */
export const selectSelectedOriginalImageIds = (state: RootState): Set<string> =>
  state.image.selectedOriginalImageIds;

/**
 * Selector to get selected updated image IDs
 */
export const selectSelectedUpdatedImageIds = (state: RootState): Set<string> =>
  state.image.selectedUpdatedImageIds;

export const { setSelectedOriginalImageIds, setSelectedUpdatedImageIds, resetSelectedImageIds } =
  imageStore.actions;

export default imageStore.reducer;
