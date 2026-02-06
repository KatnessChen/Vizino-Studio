import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GeminiTaskName } from '@/services/gemini/geminiTasks';
import { ImageData, Asset } from '@/types';

interface TaskState {
  // Task selection
  selectedTaskNames: GeminiTaskName[];

  // Task-specific options
  selectedAssets: Asset[];

  // Generate modal state
  isGenerateModalOpen: boolean;
  sourceImage: ImageData | null;
  customPrompt: string | undefined;
}

const initialState: TaskState = {
  selectedTaskNames: [],
  selectedAssets: [],
  isGenerateModalOpen: false,
  sourceImage: null,
  customPrompt: undefined,
};

const taskSlice = createSlice({
  name: 'task',
  initialState,
  reducers: {
    // Task selection actions
    setSelectedTaskNames: (state, action: PayloadAction<GeminiTaskName[]>) => {
      state.selectedTaskNames = action.payload;
    },

    // Task option actions
    setSelectedAssets: (state, action: PayloadAction<Asset[]>) => {
      state.selectedAssets = action.payload;
    },

    // Generate modal actions
    setIsGenerateModalOpen: (state, action: PayloadAction<boolean>) => {
      state.isGenerateModalOpen = action.payload;
    },

    setSourceImage: (state, action: PayloadAction<ImageData | null>) => {
      state.sourceImage = action.payload;
    },

    setCustomPrompt: (state, action: PayloadAction<string | undefined>) => {
      state.customPrompt = action.payload;
    },

    // Reset all task-related state
    resetTaskState: (state) => {
      state.selectedTaskNames = [];
      state.selectedAssets = [];
      state.isGenerateModalOpen = false;
      state.sourceImage = null;
      state.customPrompt = undefined;
    },
  },
});

export const {
  setSelectedTaskNames,
  setSelectedAssets,
  setIsGenerateModalOpen,
  setSourceImage,
  setCustomPrompt,
  resetTaskState,
} = taskSlice.actions;

// Selectors
export const selectSelectedTaskNames = (state: { task: TaskState }) => state.task.selectedTaskNames;
export const selectSelectedAssets = (state: { task: TaskState }) => state.task.selectedAssets;
export const selectIsGenerateModalOpen = (state: { task: TaskState }) =>
  state.task.isGenerateModalOpen;
export const selectSourceImage = (state: { task: TaskState }) => state.task.sourceImage;
export const selectCustomPrompt = (state: { task: TaskState }) => state.task.customPrompt;

export default taskSlice.reducer;
