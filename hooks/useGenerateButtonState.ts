import { Color, Texture, Item } from '@/types';
import { GEMINI_TASKS } from '@/services/gemini/geminiTasks';

interface UseGenerateButtonStateProps {
  activeTaskName: string | null;
  isProcessingImage: boolean;
  isSavingImage: boolean;
  canAddOperation: boolean;
  selectedColor: Color | null;
  selectedTexture: Texture | null;
  selectedItem: Item | null;
  customPrompt?: string;
  isCustomPromptRequired?: boolean;
  // Guest mode related
  isGuestMode?: boolean;
  hasGeneratedImage?: boolean;
  hasSelectedImage?: boolean;
}

export const useGenerateButtonState = ({
  activeTaskName,
  isProcessingImage,
  isSavingImage,
  canAddOperation,
  selectedColor,
  selectedTexture,
  selectedItem,
  customPrompt = '',
  isCustomPromptRequired = false,
  isGuestMode = false,
  hasGeneratedImage = false,
  hasSelectedImage = false,
}: UseGenerateButtonStateProps) => {
  let disableReason = '';

  // Check if guest has already generated an image
  const guestHasUsedGeneration = isGuestMode && hasGeneratedImage;

  // If guest has used generation, they should login
  if (guestHasUsedGeneration) {
    disableReason = 'Login to generate more images';
  } else if (!hasSelectedImage) {
    disableReason = 'Please select an image.';
  } else if (isProcessingImage) {
    disableReason = 'Processing image...';
  } else if (isSavingImage) {
    disableReason = 'Saving image...';
  } else if (!canAddOperation) {
    disableReason = 'Generation limit reached for this image.';
  } else if (!activeTaskName) {
    disableReason = 'Please select a goal.';
  } else if (activeTaskName === GEMINI_TASKS.RECOLOR_WALL.task_name && !selectedColor) {
    disableReason = 'Please select a color to generate image.';
  } else if (activeTaskName === GEMINI_TASKS.ADD_TEXTURE.task_name && !selectedTexture) {
    disableReason = 'Please select a texture to generate image.';
  } else if (activeTaskName === GEMINI_TASKS.ADD_HOME_ITEM.task_name && !selectedItem) {
    disableReason = 'Please select an object to generate image.';
  } else if (isCustomPromptRequired && !customPrompt.trim()) {
    disableReason = 'Please enter a custom prompt.';
  }

  const isDisabled = disableReason !== '';

  // For guests who have used generation, allow clicking (disable=false) but show visual feedback
  const shouldBeDisabled = guestHasUsedGeneration ? false : isDisabled;

  return {
    isDisabled: shouldBeDisabled,
    disableReason,
    guestHasUsedGeneration,
    // For styling purposes
    shouldShowLockedStyle: guestHasUsedGeneration,
    buttonOpacity: guestHasUsedGeneration ? 0.6 : undefined,
  };
};
