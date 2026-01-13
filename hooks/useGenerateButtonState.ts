import { Color, Texture, Item } from '@/types';
import { GEMINI_TASKS } from '@/services/gemini/geminiTasks';

interface UseGenerateButtonStateProps {
  activeTaskName: string | null;
  processingImage: boolean;
  savingImage: boolean;
  canAddOperation: boolean;
  selectedColor: Color | null;
  selectedTexture: Texture | null;
  selectedItem: Item | null;
  customPrompt?: string;
  isCustomPromptRequired?: boolean;
}

export const useGenerateButtonState = ({
  activeTaskName,
  processingImage,
  savingImage,
  canAddOperation,
  selectedColor,
  selectedTexture,
  selectedItem,
  customPrompt = '',
  isCustomPromptRequired = false,
}: UseGenerateButtonStateProps) => {
  let disableReason = '';

  if (processingImage) {
    disableReason = 'Processing image...';
  } else if (savingImage) {
    disableReason = 'Saving image...';
  } else if (!canAddOperation) {
    disableReason = 'Generation limit reached for this image.';
  } else if (!activeTaskName) {
    disableReason = 'Please select a goal.';
  } else if (activeTaskName === GEMINI_TASKS.RECOLOR_WALL.task_name && !selectedColor) {
    disableReason = 'Please select a color to remix.';
  } else if (activeTaskName === GEMINI_TASKS.ADD_TEXTURE.task_name && !selectedTexture) {
    disableReason = 'Please select a texture to remix.';
  } else if (activeTaskName === GEMINI_TASKS.ADD_HOME_ITEM.task_name && !selectedItem) {
    disableReason = 'Please select an object to remix.';
  } else if (isCustomPromptRequired && !customPrompt.trim()) {
    disableReason = 'Please enter a custom prompt.';
  }

  const isDisabled = disableReason !== '';

  return {
    isDisabled,
    disableReason,
  };
};
