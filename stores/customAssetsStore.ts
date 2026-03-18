import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Color, Texture, Item, CustomPrompt } from '@/types';

interface ProjectCustomAssets {
  // Custom Assets
  customColors: Color[];
  isLoadingColors: boolean;
  loadColorsError: string | null;

  customTextures: Texture[];
  isLoadingTextures: boolean;
  loadTexturesError: string | null;

  customItems: Item[];
  isLoadingItems: boolean;
  loadItemsError: string | null;

  // Custom Prompts
  customPrompts: CustomPrompt[];
  isLoadingPrompts: boolean;
  loadPromptsError: string | null;
}

interface CustomAssetsState {
  // Key: projectId, Value: project's custom assets
  projects: {
    [projectId: string]: ProjectCustomAssets;
  };
}

const initialState: CustomAssetsState = {
  projects: {},
};

// Helper function to get or create project assets state
const getOrCreateProjectAssets = (
  state: CustomAssetsState,
  projectId: string
): ProjectCustomAssets => {
  if (!state.projects[projectId]) {
    state.projects[projectId] = {
      customColors: [],
      isLoadingColors: false,
      loadColorsError: null,
      customTextures: [],
      isLoadingTextures: false,
      loadTexturesError: null,
      customItems: [],
      isLoadingItems: false,
      loadItemsError: null,
      customPrompts: [],
      isLoadingPrompts: false,
      loadPromptsError: null,
    };
  }
  return state.projects[projectId];
};

export const customAssetsStore = createSlice({
  name: 'customAssets',
  initialState,
  reducers: {
    // Custom Colors
    setCustomColors: (state, action: PayloadAction<{ projectId: string; colors: Color[] }>) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.customColors = action.payload.colors;
      projectAssets.isLoadingColors = false;
      projectAssets.loadColorsError = null;
    },

    addCustomColor: (state, action: PayloadAction<{ projectId: string; color: Color }>) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.customColors.unshift(action.payload.color);
    },

    updateCustomColor: (
      state,
      action: PayloadAction<{
        projectId: string;
        colorId: string;
        updates: Partial<Color>;
      }>
    ) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      const index = projectAssets.customColors.findIndex((c) => c.id === action.payload.colorId);
      if (index !== -1) {
        projectAssets.customColors[index] = {
          ...projectAssets.customColors[index],
          ...action.payload.updates,
        };
      }
    },

    removeCustomColor: (state, action: PayloadAction<{ projectId: string; colorId: string }>) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.customColors = projectAssets.customColors.filter(
        (c) => c.id !== action.payload.colorId
      );
    },

    // Custom Textures
    setCustomTextures: (
      state,
      action: PayloadAction<{ projectId: string; textures: Texture[] }>
    ) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.customTextures = action.payload.textures;
      projectAssets.isLoadingTextures = false;
      projectAssets.loadTexturesError = null;
    },

    addCustomTexture: (state, action: PayloadAction<{ projectId: string; texture: Texture }>) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.customTextures.unshift(action.payload.texture);
    },

    updateCustomTexture: (
      state,
      action: PayloadAction<{
        projectId: string;
        textureId: string;
        updates: Partial<Texture>;
      }>
    ) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      const index = projectAssets.customTextures.findIndex(
        (t) => t.id === action.payload.textureId
      );
      if (index !== -1) {
        projectAssets.customTextures[index] = {
          ...projectAssets.customTextures[index],
          ...action.payload.updates,
        };
      }
    },

    removeCustomTexture: (
      state,
      action: PayloadAction<{ projectId: string; textureId: string }>
    ) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.customTextures = projectAssets.customTextures.filter(
        (t) => t.id !== action.payload.textureId
      );
    },

    // Loading states - Colors
    setLoadingColors: (
      state,
      action: PayloadAction<{ projectId: string; isLoadingColors: boolean }>
    ) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.isLoadingColors = action.payload.isLoadingColors;
    },

    setLoadColorsError: (
      state,
      action: PayloadAction<{ projectId: string; error: string | null }>
    ) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.loadColorsError = action.payload.error;
      projectAssets.isLoadingColors = false;
    },

    // Loading states - Textures
    setLoadingTextures: (
      state,
      action: PayloadAction<{ projectId: string; isLoadingTextures: boolean }>
    ) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.isLoadingTextures = action.payload.isLoadingTextures;
    },

    setLoadTexturesError: (
      state,
      action: PayloadAction<{ projectId: string; error: string | null }>
    ) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.loadTexturesError = action.payload.error;
      projectAssets.isLoadingTextures = false;
    },

    // Custom Items
    setCustomItems: (state, action: PayloadAction<{ projectId: string; items: Item[] }>) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.customItems = action.payload.items;
      projectAssets.isLoadingItems = false;
      projectAssets.loadItemsError = null;
    },

    addCustomItem: (state, action: PayloadAction<{ projectId: string; item: Item }>) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.customItems.unshift(action.payload.item);
    },

    updateCustomItem: (
      state,
      action: PayloadAction<{
        projectId: string;
        itemId: string;
        updates: Partial<Item>;
      }>
    ) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      const index = projectAssets.customItems.findIndex((i) => i.id === action.payload.itemId);
      if (index !== -1) {
        projectAssets.customItems[index] = {
          ...projectAssets.customItems[index],
          ...action.payload.updates,
        };
      }
    },

    removeCustomItem: (state, action: PayloadAction<{ projectId: string; itemId: string }>) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.customItems = projectAssets.customItems.filter(
        (i) => i.id !== action.payload.itemId
      );
    },

    // Loading states - Items
    setLoadingItems: (
      state,
      action: PayloadAction<{ projectId: string; isLoadingItems: boolean }>
    ) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.isLoadingItems = action.payload.isLoadingItems;
    },

    setLoadItemsError: (
      state,
      action: PayloadAction<{ projectId: string; error: string | null }>
    ) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.loadItemsError = action.payload.error;
      projectAssets.isLoadingItems = false;
    },

    // Custom Prompts
    setCustomPrompts: (
      state,
      action: PayloadAction<{ projectId: string; prompts: CustomPrompt[] }>
    ) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.customPrompts = action.payload.prompts;
      projectAssets.isLoadingPrompts = false;
      projectAssets.loadPromptsError = null;
    },

    addCustomPrompt: (
      state,
      action: PayloadAction<{ projectId: string; prompt: CustomPrompt }>
    ) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.customPrompts.unshift(action.payload.prompt);
    },

    removeCustomPrompt: (
      state,
      action: PayloadAction<{ projectId: string; promptId: string }>
    ) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.customPrompts = projectAssets.customPrompts.filter(
        (p) => p.id !== action.payload.promptId
      );
    },

    setLoadingPrompts: (
      state,
      action: PayloadAction<{ projectId: string; isLoadingPrompts: boolean }>
    ) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.isLoadingPrompts = action.payload.isLoadingPrompts;
    },

    setLoadPromptsError: (
      state,
      action: PayloadAction<{ projectId: string; error: string | null }>
    ) => {
      const projectAssets = getOrCreateProjectAssets(state, action.payload.projectId);
      projectAssets.loadPromptsError = action.payload.error;
      projectAssets.isLoadingPrompts = false;
    },

    // Clear state for a specific project
    clearProjectAssets: (state, action: PayloadAction<string>) => {
      delete state.projects[action.payload];
    },

    // Clear state for all projects
    clearAllAssets: (state) => {
      state.projects = {};
    },
  },
});

export const {
  setCustomColors,
  addCustomColor,
  updateCustomColor,
  removeCustomColor,
  setLoadingColors,
  setLoadColorsError,
  setCustomTextures,
  addCustomTexture,
  updateCustomTexture,
  removeCustomTexture,
  setLoadingTextures,
  setLoadTexturesError,
  setCustomItems,
  addCustomItem,
  updateCustomItem,
  removeCustomItem,
  setLoadingItems,
  setLoadItemsError,
  setCustomPrompts,
  addCustomPrompt,
  removeCustomPrompt,
  setLoadingPrompts,
  setLoadPromptsError,
  clearProjectAssets,
  clearAllAssets,
} = customAssetsStore.actions;

export default customAssetsStore.reducer;

// ============================================================================
// Selectors
// ============================================================================

export const selectCustomPromptsForProject =
  (projectId: string) => (state: { customAssets: CustomAssetsState }) => {
    return state.customAssets.projects[projectId]?.customPrompts || [];
  };

export const selectIsLoadingPromptsForProject =
  (projectId: string) => (state: { customAssets: CustomAssetsState }) => {
    return state.customAssets.projects[projectId]?.isLoadingPrompts || false;
  };

export const selectLoadPromptsErrorForProject =
  (projectId: string) => (state: { customAssets: CustomAssetsState }) => {
    return state.customAssets.projects[projectId]?.loadPromptsError || null;
  };

/**
 * Search custom prompts by task name or content
 */
export const selectSearchedCustomPrompts =
  (projectId: string, keyword: string) =>
  (state: { customAssets: CustomAssetsState }): CustomPrompt[] => {
    const prompts = state.customAssets.projects[projectId]?.customPrompts || [];
    if (!keyword.trim()) {
      return prompts;
    }

    const lowerKeyword = keyword.toLowerCase();
    return prompts.filter(
      (p) =>
        p.task_name.toLowerCase().includes(lowerKeyword) ||
        p.content.toLowerCase().includes(lowerKeyword)
    );
  };
