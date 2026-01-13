import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Timestamp } from 'firebase/firestore';
import { Project } from '@/types';

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  activeSpaceId: string | null;
  isAppInitiated: boolean;
  initError: string | null;
}

const initialState: ProjectState = {
  projects: [],
  activeProjectId: null,
  activeSpaceId: null,
  isAppInitiated: false,
  initError: null,
};

export const projectStore = createSlice({
  name: 'project',
  initialState,
  reducers: {
    // Projects actions
    setProjects: (state, action: PayloadAction<Project[]>) => {
      state.projects = action.payload;
    },
    addProject: (state, action: PayloadAction<Project>) => {
      state.projects.push(action.payload);
    },
    updateProject: (state, action: PayloadAction<{ projectId: string; name: string }>) => {
      const project = state.projects.find((p) => p.id === action.payload.projectId);
      if (project) {
        project.name = action.payload.name;
      }
    },
    removeProject: (state, action: PayloadAction<string>) => {
      state.projects = state.projects.filter((p) => p.id !== action.payload);
      if (state.activeProjectId === action.payload) {
        state.activeProjectId = null;
        state.activeSpaceId = null;
      }
    },

    // Spaces actions
    addSpace: (state, action: PayloadAction<{ projectId: string; space: any }>) => {
      const project = state.projects.find((p) => p.id === action.payload.projectId);
      if (project) {
        project.spaces.push(action.payload.space);
      }
    },
    setSpaceImages: (
      state,
      action: PayloadAction<{ projectId: string; spaceId: string; images: any[] }>
    ) => {
      const project = state.projects.find((p) => p.id === action.payload.projectId);
      if (project) {
        const space = project.spaces.find((s) => s.id === action.payload.spaceId);
        if (space) {
          space.images = action.payload.images;
        }
      }
    },
    updateSpace: (
      state,
      action: PayloadAction<{ projectId: string; spaceId: string; name: string }>
    ) => {
      const project = state.projects.find((p) => p.id === action.payload.projectId);
      if (project) {
        const space = project.spaces.find((s) => s.id === action.payload.spaceId);
        if (space) {
          space.name = action.payload.name;
        }
      }
    },
    removeSpace: (state, action: PayloadAction<{ projectId: string; spaceId: string }>) => {
      const project = state.projects.find((p) => p.id === action.payload.projectId);
      if (project) {
        project.spaces = project.spaces.filter((s) => s.id !== action.payload.spaceId);
      }
      if (state.activeSpaceId === action.payload.spaceId) {
        state.activeSpaceId = null;
      }
    },

    // Selection actions
    setActiveProjectId: (state, action: PayloadAction<string | null>) => {
      state.activeProjectId = action.payload;
    },
    setActiveSpaceId: (state, action: PayloadAction<string | null>) => {
      state.activeSpaceId = action.payload;
    },
    setIsAppInitiated: (state, action: PayloadAction<boolean>) => {
      state.isAppInitiated = action.payload;
    },
    setInitError: (state, action: PayloadAction<string | null>) => {
      state.initError = action.payload;
    },

    // Optimistic updates for images
    addImageOptimistic: (
      state,
      action: PayloadAction<{
        projectId: string;
        spaceId: string;
        image: any;
      }>
    ) => {
      const project = state.projects.find((p) => p.id === action.payload.projectId);
      if (project) {
        const space = project.spaces.find((s) => s.id === action.payload.spaceId);
        if (space) {
          if (space.images) {
            space.images = [...space.images, action.payload.image];
          } else {
            space.images = [action.payload.image];
          }
        }
      }
    },
    removeImageOptimistic: (
      state,
      action: PayloadAction<{
        projectId: string;
        spaceId: string;
        imageId: string;
      }>
    ) => {
      const project = state.projects.find((p) => p.id === action.payload.projectId);
      if (project) {
        const space = project.spaces.find((s) => s.id === action.payload.spaceId);
        if (space?.images) {
          space.images = space.images.filter((img) => img.id !== action.payload.imageId);
        }
      }
    },
    removeImagesOptimistic: (
      state,
      action: PayloadAction<{
        projectId: string;
        spaceId: string;
        imageIds: string[];
      }>
    ) => {
      const project = state.projects.find((p) => p.id === action.payload.projectId);
      if (project) {
        const space = project.spaces.find((s) => s.id === action.payload.spaceId);
        if (space?.images) {
          space.images = space.images.filter((img) => !action.payload.imageIds.includes(img.id));
        }
      }
    },
    updateImageOptimistic: (
      state,
      action: PayloadAction<{
        projectId: string;
        spaceId: string;
        imageId: string;
        newName: string;
      }>
    ) => {
      const project = state.projects.find((p) => p.id === action.payload.projectId);
      if (project) {
        const space = project.spaces.find((s) => s.id === action.payload.spaceId);
        if (space?.images) {
          const image = space.images.find((img) => img.id === action.payload.imageId);
          if (image) {
            image.name = action.payload.newName;
            image.updatedAt = Timestamp.fromDate(new Date());
          }
        }
      }
    },
    // Reorder images optimistically
    reorderImagesOptimistic: (
      state,
      action: PayloadAction<{
        projectId: string;
        spaceId: string;
        reorderedImages: Array<{ imageId: string; order: number }>;
      }>
    ) => {
      const project = state.projects.find((p) => p.id === action.payload.projectId);
      if (project) {
        const space = project.spaces.find((s) => s.id === action.payload.spaceId);
        if (space?.images) {
          const now = Timestamp.fromDate(new Date());
          action.payload.reorderedImages.forEach(({ imageId, order }) => {
            const image = space.images!.find((img) => img.id === imageId);
            if (image) {
              image.order = order;
              image.updatedAt = now;
            }
          });
        }
      }
    },
    // Rollback reorder on error
    rollbackReorderImages: (
      state,
      action: PayloadAction<{
        projectId: string;
        spaceId: string;
        previousOrders: Array<{ imageId: string; order: number | null }>;
      }>
    ) => {
      const project = state.projects.find((p) => p.id === action.payload.projectId);
      if (project) {
        const space = project.spaces.find((s) => s.id === action.payload.spaceId);
        if (space?.images) {
          action.payload.previousOrders.forEach(({ imageId, order }) => {
            const image = space.images!.find((img) => img.id === imageId);
            if (image) {
              image.order = order;
            }
          });
        }
      }
    },
  },
  selectors: {
    selectProjects: (state) => state.projects,
    selectActiveProjectId: (state) => state.activeProjectId,
    selectActiveSpaceId: (state) => state.activeSpaceId,
    selectIsAppInitiated: (state) => state.isAppInitiated,
    selectInitError: (state) => state.initError,
    selectActiveProject: (state) =>
      state.activeProjectId
        ? state.projects.find((p) => p.id === state.activeProjectId)
        : undefined,
    selectActiveSpace: (state) => {
      const activeProject = state.activeProjectId
        ? state.projects.find((p) => p.id === state.activeProjectId)
        : undefined;
      return activeProject && state.activeSpaceId
        ? activeProject.spaces.find((s) => s.id === state.activeSpaceId)
        : undefined;
    },
  },
});

export const {
  setProjects,
  addProject,
  updateProject,
  removeProject,
  addSpace,
  setSpaceImages,
  updateSpace,
  removeSpace,
  setActiveProjectId,
  setActiveSpaceId,
  setIsAppInitiated,
  setInitError,
  addImageOptimistic,
  removeImageOptimistic,
  removeImagesOptimistic,
  updateImageOptimistic,
  reorderImagesOptimistic,
  rollbackReorderImages,
} = projectStore.actions;

export const {
  selectProjects,
  selectActiveProjectId,
  selectActiveSpaceId,
  selectIsAppInitiated,
  selectInitError,
  selectActiveProject,
  selectActiveSpace,
} = projectStore.selectors;

export default projectStore.reducer;
