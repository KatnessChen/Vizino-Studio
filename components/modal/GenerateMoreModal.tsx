import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
  lazy,
} from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Modal, Button, Input, Alert, Tooltip, Drawer, Typography, Tabs, Switch, List, Flex } from 'antd';
import { message } from '@/utils/antd';

import {
  BulbOutlined,
  CloseOutlined,
  InfoCircleOutlined,
  EditOutlined,
  LoadingOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import InfoIconWithTooltip from '@/components/ui/InfoIconWithTooltip';
import VPointsIcon from '@/components/icons/VPointsIcon';
import SavedPromptList from '@/components/SavedPromptList';
import { Timestamp } from 'firebase/firestore';
import { ASSET_COLOR, ASSET_TEXTURE, ASSET_ITEM, ASSET_IMAGE } from '@/constants/constants';
import { ImageData, ImageOperation } from '@/types';
import { Color, Texture, Item } from '@/types';
import {
  getRecolorTaskDefaultPrompt,
  getAddTextureDefaultPrompt,
  getAddObjectDefaultPrompt,
  getUseCustomPromptDefaultPrompt,
} from '@/services/gemini/prompts';
import {
  GEMINI_TASKS,
  isCustomPromptRequired,
  getTask,
  isMagicPromptTask,
  hasDefaultPrompt,
  isThinkingModeAvailable,
} from '@/services/gemini/geminiTasks';
import { generateOptimizedPrompt } from '@/services/gemini/geminiService';
import { incrementTaskUsage } from '@/services/userService';
import { formatImageOperationData } from '@/utils/imageOperationUtils';
import { base64ToFile } from '@/utils/fileUtils';
import { extractImageDimensions } from '@/utils/imageUtils';
import { checkOperationLimit, getLimitExceededMessage } from '@/utils/limitationUtils';
import {
  selectActiveProjectId,
  selectActiveSpaceId,
  setSpaceImages,
  addImageOptimistic,
  removeImageOptimistic,
} from '@/stores/projectStore';
import { saveFeedback } from '@/services/feedbackService';
import { backendService } from '@/services/backendService';

import { useImageProcessing } from '@/hooks/useImageProcessing';
import { useGenerateButtonState } from '@/hooks/useGenerateButtonState';
import {
  selectSelectedAssets,
  selectSelectedTaskNames,
  setSelectedTaskNames,
  setCustomPrompt as setReduxCustomPrompt,
  setSourceImage,
} from '@/stores/taskStore';
import { useCustomPrompts } from '@/hooks/useCustomPrompts';
import { useCustomAssets } from '@/hooks/useCustomAssets';
import { devWarn, devError, devLog, devLogContext } from '@/utils/devLogger';
const ConfirmImageUpdateModal = lazy(() => import('./ConfirmImageUpdateModal'));
import SelectedAssets from '@/components/SelectedAssets';
import { MAX_OPERATIONS_PER_IMAGE, MAX_CUSTOM_PROMPT_LENGTH } from '@/constants/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useGuest } from '@/contexts/GuestContext';
import { guestIndexedDB } from '@/utils/guestIndexedDB';
import { addGuestImage, setShowLoginRequiredModal } from '@/stores/guestStore';
import { useCreditCheck } from '@/hooks/useCreditCheck';
import { getCreditCost } from '@/utils/creditUtils';
import CreditExhaustedModal from './CreditExhaustedModal';

export interface GenerateMoreModalRef {
  triggerGenerate: () => Promise<void>;
}

interface GenerateMoreModalProps {
  isOpen: boolean;
  sourceImage: ImageData | null;
  sourceAsset?: ImageData | Color | Texture | Item | null; // Unified source
  userId: string | undefined;
  onSuccess: () => void; // Called after successful save to refresh images
  onCancel: () => void;
  onError?: (message: string) => void;
  onErrorAction?: (action: { label: string; action: () => void } | null) => void;
  onGenerateClick?: () => void; // Called when generate button is clicked
  assetType?: string;
}

const GenerateMoreModal = forwardRef<GenerateMoreModalRef, GenerateMoreModalProps>(
  (
    {
      isOpen,
      sourceImage,
      sourceAsset,
      userId,
      onSuccess,
      onCancel,
      onError,
      onErrorAction,
      onGenerateClick,
      assetType,
    },
    ref
  ) => {
    // Get dispatch from Redux
    const dispatch = useDispatch();
    // Get adminSettings from Auth context
    const { adminSettings, isAuthenticated } = useAuth();
    // Get guest context
    const { guestSessionId, isGuestMode, hasGeneratedImage, markImageGenerated } = useGuest();
    // Get credit check for authenticated users
    const {
      hasExceeded: hasCreditExceeded,
      totalCredits,
      showCreditExhaustedModal,
      setShowCreditExhaustedModal,
      hasEnabledOwnKey,
    } = useCreditCheck({ userId });
    // Get active project and space from Redux store
    const activeProjectId = useSelector(selectActiveProjectId);
    const activeSpaceId = useSelector(selectActiveSpaceId);

    const selectedTaskNames = useSelector(selectSelectedTaskNames);
    const selectedAssets = useSelector(selectSelectedAssets);

    const selectedAssetRaw = selectedAssets[0] || null;
    const selectedColor =
      selectedAssetRaw && selectedAssetRaw.assetType === ASSET_COLOR
        ? (selectedAssetRaw as Color)
        : null;
    const selectedTexture =
      selectedAssetRaw && selectedAssetRaw.assetType === ASSET_TEXTURE
        ? (selectedAssetRaw as Texture)
        : null;
    const selectedItem =
      selectedAssetRaw && selectedAssetRaw.assetType === ASSET_ITEM
        ? (selectedAssetRaw as Item)
        : null;

    const { addAsset: addColor } = useCustomAssets(ASSET_COLOR, activeProjectId || '');
    const { addAsset: addTextureToStore } = useCustomAssets(ASSET_TEXTURE, activeProjectId || '');
    const { addAsset: addItemToStore } = useCustomAssets(ASSET_ITEM, activeProjectId || '');

    const [validationError, setValidationError] = useState<string | null>(null);
    const [customPrompt, setCustomPrompt] = useState<string>('');
    const [generatedImage, setGeneratedImage] = useState<{
      base64: string;
      mimeType: string;
      hex?: string;
      name?: string;
    } | null>(null);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [isSavingImage, setIsSavingImage] = useState(false);
    const [isDefaultPromptExpanded, setIsDefaultPromptExpanded] = useState(false);
    const [searchPrompts, setSearchPrompts] = useState<string>('');

    const [activePromptTab, setActivePromptTab] = useState<'magic' | 'saved'>('saved');
    const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);
    const [thinkingMode, setThinkingMode] = useState(false);

    // Generate shimmer layer configurations dynamically
    const shimmerLayers = useMemo(() => {
      const layers = [];
      const totalLayers = 24;

      for (let i = 0; i < totalLayers; i++) {
        // Vary speed between 6-9 seconds (30-50% slower than before)
        const speed = 6 + (i % 4) * 0.8;
        // Stagger delays - start with negative delays so they begin from left side
        const delay = -speed + i * 0.3;
        // Vary opacity between 0.12 and 0.22
        const opacity = 0.12 + (i % 10) * 0.01;
        // Alternate between indigo, violet, and purple shades
        const color1 =
          i % 3 === 0
            ? 'rgba(99, 102, 241,'
            : i % 3 === 1
              ? 'rgba(124, 58, 237,'
              : 'rgba(147, 51, 234,';
        const color2 =
          i % 3 === 0
            ? 'rgba(124, 58, 237,'
            : i % 3 === 1
              ? 'rgba(147, 51, 234,'
              : 'rgba(99, 102, 241,';
        // Vary gradient positions
        const start = 20 + (i % 12);
        const mid1 = 38 + (i % 8);
        const mid2 = 52 + (i % 8);
        const end = 78 - (i % 12);

        layers.push({
          id: i + 1,
          speed,
          delay,
          gradient: `linear-gradient(75deg, transparent 0%, transparent ${start}%, ${color1} ${opacity}) ${mid1}%, ${color2} ${opacity}) ${mid2}%, transparent ${end}%, transparent 100%)`,
        });
      }

      return layers;
    }, []);

    // Generate keyframes for all shimmer animations
    const shimmerKeyframes = useMemo(() => {
      let keyframes = '';
      for (let i = 1; i <= 24; i++) {
        keyframes += `
                    @keyframes shimmer${i} {
                      0% { transform: translateX(-100%); }
                      100% { transform: translateX(100%); }
                    }`;
      }
      return keyframes;
    }, []);

    // Use custom prompts hook
    const {
      prompts,
      isLoading: isLoadingPrompts,
      fetchPrompts,
      deletePrompt,
    } = useCustomPrompts({
      userId,
      projectId: activeProjectId || '',
    });

    // Fetch prompts when modal opens
    useEffect(() => {
      if (isOpen && userId && activeProjectId) {
        void fetchPrompts();
      }
    }, [isOpen, userId, activeProjectId, fetchPrompts]);

    // Magic Prompts list
    const magicPromptsList = useMemo(
      () => [
        {
          taskName: GEMINI_TASKS.REMOVE_CLUTTER.task_name,
          label: GEMINI_TASKS.REMOVE_CLUTTER.label_name,
        },
        {
          taskName: GEMINI_TASKS.BRIGHTEN_SPACE.task_name,
          label: GEMINI_TASKS.BRIGHTEN_SPACE.label_name,
        },
        {
          taskName: GEMINI_TASKS.INDUSTRIAL_STYLE.task_name,
          label: GEMINI_TASKS.INDUSTRIAL_STYLE.label_name,
        },
        { taskName: GEMINI_TASKS.LOFT_STYLE.task_name, label: GEMINI_TASKS.LOFT_STYLE.label_name },
      ],
      []
    );

    // Filter prompts based on search keyword using %match% logic

    // Determine the active task from selectedTaskNames (assuming single task)
    const activeTaskName = useMemo(() => {
      if (selectedTaskNames.length === 0) return null;
      return selectedTaskNames[0];
    }, [selectedTaskNames]);

    const activeTask = useMemo(() => getTask(activeTaskName), [activeTaskName]);
    const isMagicTask = useMemo(() => isMagicPromptTask(activeTaskName), [activeTaskName]);

    // Check operation limit
    const operationLimitCheck = checkOperationLimit(sourceImage, adminSettings.mock_limit_reached);

    // Compute effective original image once for modal usage AND saving logic
    const effectiveOriginalImage = useMemo(() => {
      if (sourceImage) return sourceImage;
      if (sourceAsset) {
        let downloadUrl = '';
        if (sourceAsset.assetType === ASSET_TEXTURE) {
          downloadUrl = (sourceAsset as Texture).textureImageDownloadUrl;
        } else if (sourceAsset.assetType === ASSET_ITEM) {
          downloadUrl = (sourceAsset as Item).itemImageDownloadUrl;
        } else if (sourceAsset.assetType === ASSET_IMAGE) {
          downloadUrl = (sourceAsset as ImageData).imageDownloadUrl || '';
        }

        const baseAsset = {
          id: 'id' in sourceAsset ? sourceAsset.id : 'unknown',
          name: 'name' in sourceAsset ? sourceAsset.name : 'Asset',
          mimeType:
            'mimeType' in sourceAsset && sourceAsset.mimeType ? sourceAsset.mimeType : 'image/png',
          spaceId: activeSpaceId || '',
          imageDownloadUrl: downloadUrl,
          storageFilePath: '',
          isDeleted: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          evolutionChain: 'evolutionChain' in sourceAsset ? sourceAsset.evolutionChain || [] : [],
          parentImageId: null,
          description: '',
          order: 0,
          deletedAt: null,
          assetType: ASSET_IMAGE,
        } as ImageData;
        return baseAsset;
      }
      return null;
    }, [sourceImage, sourceAsset, activeSpaceId]);

    // Determine if custom prompt is required for current task
    const isCustomPromptRequiredForTask = isCustomPromptRequired(activeTaskName);

    // Use image processing hook
    const {
      processImage,
      isProcessingImage,
      errorMessage,
      setErrorMessage,
      errorAction,
      cancelProcessing,
    } = useImageProcessing({
      userId,
      projectId: activeProjectId || undefined,
      spaceId: activeSpaceId || undefined,
      selectedTaskName: activeTaskName || GEMINI_TASKS.RECOLOR_WALL.task_name,
      options: {
        selectedColor,
        selectedTexture,
        selectedItem,
      },
    });

    // Get generate button state
    const {
      isDisabled: isGenerateDisabled,
      disableReason,
      guestHasUsedGeneration,
    } = useGenerateButtonState({
      activeTaskName,
      isProcessingImage,
      isSavingImage,
      canAddOperation: operationLimitCheck.canAdd,
      selectedColor,
      selectedTexture,
      selectedItem,
      customPrompt,
      isCustomPromptRequired: isCustomPromptRequiredForTask,
      isGuestMode,
      hasGeneratedImage,
      hasSelectedImage: !!sourceImage,
    });

    // Calculate default prompt based on active task
    const defaultPrompt = useMemo(() => {
      if (!activeTaskName) return '';

      if (activeTaskName === GEMINI_TASKS.RECOLOR_WALL.task_name) {
        return getRecolorTaskDefaultPrompt(selectedColor?.name, selectedColor?.hex, undefined);
      } else if (activeTaskName === GEMINI_TASKS.ADD_TEXTURE.task_name) {
        return getAddTextureDefaultPrompt(selectedTexture?.name || '', undefined);
      } else if (activeTaskName === GEMINI_TASKS.ADD_HOME_ITEM.task_name) {
        return getAddObjectDefaultPrompt(selectedItem?.name || '', undefined);
      } else if (activeTaskName === GEMINI_TASKS.CUSTOM_PROMPT.task_name) {
        return getUseCustomPromptDefaultPrompt('USER CUSTOM PROMPTS');
      }
      return '';
    }, [activeTaskName, selectedColor, selectedTexture, selectedItem]);

    // Clear validation error when color changes
    useEffect(() => {
      if (selectedColor) {
        setValidationError(null);
      }
    }, [selectedColor]);

    // Propagate error message and action to parent
    useEffect(() => {
      if (onError && errorMessage) {
        onError(errorMessage);
      }
      if (onErrorAction) {
        onErrorAction(errorAction);
      }
    }, [errorMessage, errorAction, onError, onErrorAction]);

    const handleGenerate = useCallback(async () => {
      // If guest has already generated, show login modal
      if (guestHasUsedGeneration) {
        dispatch(setShowLoginRequiredModal(true));
        return;
      }

      // Check credit limit for authenticated users
      if (isAuthenticated && hasCreditExceeded) {
        setShowCreditExhaustedModal(true);
        return;
      }

      // Check operation limit first
      const operationLimitCheck = checkOperationLimit(
        sourceImage,
        adminSettings.mock_limit_reached
      );
      if (!operationLimitCheck.canAdd) {
        setErrorMessage(getLimitExceededMessage('operations', MAX_OPERATIONS_PER_IMAGE));
        return;
      }

      // Check custom prompt character limit
      if (customPrompt.length > MAX_CUSTOM_PROMPT_LENGTH) {
        setErrorMessage(
          `Custom prompt exceeds the ${MAX_CUSTOM_PROMPT_LENGTH} character limit. Please reduce the prompt length.`
        );
        return;
      }

      // Check if a task is selected
      if (!activeTaskName) {
        setValidationError('Please select a design goal.');
        return;
      }

      // Validate based on task type
      if (
        (activeTaskName === GEMINI_TASKS.RECOLOR_WALL.task_name && !selectedColor) ||
        (activeTaskName === GEMINI_TASKS.ADD_TEXTURE.task_name && !selectedTexture) ||
        (activeTaskName === GEMINI_TASKS.ADD_HOME_ITEM.task_name && !selectedItem)
      ) {
        setValidationError(disableReason);
        return;
      }

      // Check if custom prompt is required for current task
      if (isCustomPromptRequiredForTask && !customPrompt.trim()) {
        setValidationError('Please enter a custom prompt.');
        return;
      }

      if (!sourceImage && !sourceAsset) {
        setValidationError('No source material available.');
        return;
      }

      // Check if we have a valid identifier (userId or guestSessionId)
      if (!userId && !guestSessionId) {
        setErrorMessage('User ID is required to process images.');
        return;
      }

      setValidationError(null);

      // Notify external components (like Tour) that generation is starting
      onGenerateClick?.();

      const effectiveSource = sourceImage || sourceAsset;
      if (!effectiveSource) {
        setErrorMessage('No source image or asset selected.');
        return;
      }

      devLogContext('[GenerateMoreModal] Starting image processing with:', {
        userId,
        // Use optional chaining safely
        sourceId: 'id' in effectiveSource ? effectiveSource.id : 'unknown',
        taskName: activeTaskName,
        colorName: selectedColor?.name,
        colorHex: selectedColor?.hex,
        textureName: selectedTexture?.name,
        textureUrl: selectedTexture?.textureImageDownloadUrl,
        hasCustomPrompt: !!customPrompt.trim(),
      });

      const result = await processImage(sourceImage!, customPrompt.trim() || undefined, {
        selectedColor,
        selectedTexture,
        selectedItem,
      });

      if (result) {
        devLogContext('[GenerateMoreModal] Image generation succeeded:', {
          hasData: !!result,
          id: result.id,
        });

        // Reset state and close modal immediately
        setCustomPrompt('');
        setGeneratedImage(null);
        setErrorMessage(null);
        setValidationError(null);
        setIsSavingImage(false);

        // Reset sourceImage in Redux
        dispatch(setSourceImage(null));

        // Save customPrompt to Redux for later use
        const promptToSave = customPrompt.trim() || undefined;
        if (promptToSave) {
          dispatch(setReduxCustomPrompt(promptToSave));
        }

        // Show success message
        message.success('Image generated and saved successfully!');

        // Close modal and trigger refresh in parent
        onSuccess();
      }
    }, [
      guestHasUsedGeneration,
      dispatch,
      sourceAsset,
      sourceImage,
      adminSettings.mock_limit_reached,
      customPrompt,
      activeTaskName,
      selectedColor,
      selectedTexture,
      selectedItem,
      disableReason,
      isCustomPromptRequiredForTask,
      userId,
      guestSessionId,
      onGenerateClick,
      processImage,
      isAuthenticated,
      hasCreditExceeded,
      setShowCreditExhaustedModal,
      activeProjectId,
      fetchPrompts,
      setErrorMessage,
      onSuccess,
    ]);

    // Expose handleGenerate to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        triggerGenerate: handleGenerate,
      }),
      [handleGenerate]
    );

    const handlePickMagicPrompt = useCallback(
      (e: React.MouseEvent, taskName: string, taskLabel: string) => {
        e.stopPropagation();
        const task = getTask(taskName);

        // Reset task-related state before switching
        setGeneratedImage(null);
        setErrorMessage(null);
        setValidationError(null);

        dispatch(
          setSelectedTaskNames([
            taskName as (typeof GEMINI_TASKS)[keyof typeof GEMINI_TASKS]['task_name'],
          ])
        );

        // Apply default prompt to the custom prompt input
        if (hasDefaultPrompt(task)) {
          setCustomPrompt(task.defaultPrompt);
        } else {
          setCustomPrompt('');
        }

        message.success(`${taskLabel} selected!`);
      },
      [dispatch, setErrorMessage]
    );

    /**
     * Handle 'Help me write' button click
     * Calls generateOptimizedPrompt to get an AI-optimized version of the user's prompt
     */
    const handleHelpMeWrite = useCallback(async () => {
      // Check credit limit for authenticated users
      if (isAuthenticated && hasCreditExceeded) {
        setShowCreditExhaustedModal(true);
        return;
      }

      // Validate: require user to start writing first
      if (!customPrompt.trim()) {
        message.warning('Start writing your prompt first!');
        return;
      }

      // For most tasks, we need a source image. For asset-based views, use sourceAsset.
      const effectiveSource = sourceImage || sourceAsset;
      if (!effectiveSource || effectiveSource.assetType === ASSET_COLOR) {
        message.warning('Please select an image first.');
        return;
      }

      // Get the current task or default to CUSTOM_PROMPT
      const task = activeTask || getTask(GEMINI_TASKS.CUSTOM_PROMPT.task_name);
      if (!task) {
        message.error('Invalid task configuration.');
        return;
      }

      setIsOptimizingPrompt(true);

      try {
        // Helper function to fetch image as base64
        const fetchAsBase64 = async (url: string): Promise<string> => {
          if (url.startsWith('data:')) {
            return url.split(',')[1] || '';
          }
          const response = await fetch(url);
          const blob = await response.blob();
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1] || '');
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        };

        // Get the main room image (effectiveSource)
        let mainImageBase64: string;
        let mainImageMimeType: string;

        if (effectiveSource.assetType === ASSET_TEXTURE) {
          const texture = effectiveSource as Texture;
          mainImageBase64 = await fetchAsBase64(texture.textureImageDownloadUrl);
          mainImageMimeType = texture.mimeType || 'image/jpeg';
        } else if (effectiveSource.assetType === ASSET_ITEM) {
          const item = effectiveSource as Item;
          mainImageBase64 = await fetchAsBase64(item.itemImageDownloadUrl);
          mainImageMimeType = item.mimeType || 'image/jpeg';
        } else {
          // It's ImageData
          const imgData = effectiveSource as ImageData;
          mainImageBase64 = await fetchAsBase64(imgData.imageDownloadUrl || '');
          mainImageMimeType = imgData.mimeType;
        }

        // Build additional context based on task type
        type AdditionalContextType = {
          textureImage?: { base64: string; mimeType: string };
          textureName?: string;
          itemImage?: { base64: string; mimeType: string };
          itemName?: string;
          colorName?: string;
          colorHex?: string;
        };
        let additionalContext: AdditionalContextType | undefined;

        // For ADD_HOME_ITEM task: include the selected item image
        if (activeTaskName === GEMINI_TASKS.ADD_HOME_ITEM.task_name && selectedItem) {
          const itemBase64 = await fetchAsBase64(selectedItem.itemImageDownloadUrl);
          additionalContext = {
            itemImage: {
              base64: itemBase64,
              mimeType: selectedItem.mimeType || 'image/jpeg',
            },
            itemName: selectedItem.name,
          };
        }

        // For ADD_TEXTURE task: include the selected texture image
        if (activeTaskName === GEMINI_TASKS.ADD_TEXTURE.task_name && selectedTexture) {
          const textureBase64 = await fetchAsBase64(selectedTexture.textureImageDownloadUrl);
          additionalContext = {
            textureImage: {
              base64: textureBase64,
              mimeType: selectedTexture.mimeType || 'image/jpeg',
            },
            textureName: selectedTexture.name,
          };
        }

        // For RECOLOR_WALL task: include the selected color info
        if (activeTaskName === GEMINI_TASKS.RECOLOR_WALL.task_name && selectedColor) {
          additionalContext = {
            colorName: selectedColor.name,
            colorHex: selectedColor.hex,
          };
        }

        // Call the backend to generate optimized prompt
        const optimizedPrompt = await generateOptimizedPrompt(
          task,
          customPrompt.trim(),
          mainImageBase64,
          mainImageMimeType,
          undefined, // signal
          additionalContext
        );

        // Record usage for prompt optimization (only for authenticated users)
        if (userId) {
          void incrementTaskUsage(userId, GEMINI_TASKS.OPTIMIZE_PROMPT.task_name);
        }

        // Set the optimized prompt in the textarea
        setCustomPrompt(optimizedPrompt);
        message.success('Prompt optimized!');
      } catch (error) {
        devError('[GenerateMoreModal] Help me write failed:', error);
        message.error('Failed to optimize prompt. Please try again.');
      } finally {
        setIsOptimizingPrompt(false);
      }
    }, [
      isAuthenticated,
      hasCreditExceeded,
      setShowCreditExhaustedModal,
      customPrompt,
      sourceImage,
      sourceAsset,
      activeTask,
      activeTaskName,
      selectedItem,
      selectedTexture,
      selectedColor,
      userId,
    ]);

    const handleClose = () => {
      // If processing, cancel the request and keep modal open while preserving form state
      if (isProcessingImage) {
        cancelProcessing();
        // Inform the user that processing was cancelled and return to the modal
        message.info('Image generation cancelled');
        return;
      }

      // Only allow closing when not saving (prevent accidental closure during save)
      if (!isSavingImage) {
        setValidationError(null);
        setErrorMessage(null);
        setCustomPrompt('');
        setGeneratedImage(null);
        setShowConfirmationModal(false);
        onCancel();
      }
    };

    const handleConfirmImage = useCallback(
      async (
        imageData: { base64: string; mimeType: string; hex?: string },
        customName: string,
        description?: string,
        feedbackData?: { rating: 0 | 1; comment: string }
      ) => {
        // Use edited description from modal, or fall back to current customPrompt
        const finalDescription = description !== undefined ? description : customPrompt;

        if ((!sourceImage && !sourceAsset) || !activeTaskName) {
          setErrorMessage('Missing required data to save image.');
          return;
        }

        // For authenticated users, require project/space context
        if (isAuthenticated && (!userId || !activeProjectId || !activeSpaceId)) {
          setErrorMessage('Missing project/space context. Please select a space.');
          return;
        }

        // For guests, require session ID
        if (!isAuthenticated && !guestSessionId) {
          setErrorMessage('Guest session not initialized.');
          return;
        }

        // Validate based on task type
        if (activeTaskName === GEMINI_TASKS.RECOLOR_WALL.task_name && !selectedColor) {
          setErrorMessage('Color information is required.');
          return;
        }

        if (activeTaskName === GEMINI_TASKS.ADD_TEXTURE.task_name && !selectedTexture) {
          setErrorMessage('Texture information is required.');
          return;
        }

        if (activeTaskName === GEMINI_TASKS.ADD_HOME_ITEM.task_name && !selectedItem) {
          setErrorMessage('Home item information is required.');
          return;
        }

        setIsSavingImage(true);
        setShowConfirmationModal(false);

        // --- COLOR ADJUSTMENT SAVING FLOW ---
        // --- CUSTOM ASSET SAVING FLOW ---
        // Determine if we should save as an asset (Color/Texture/Item) or a Space Image

        // If we have a sourceImage, we are definitely updating an image, not creating a new template asset
        const isImageUpdate = !!sourceImage;
        const isSavingAsAsset = !isImageUpdate;

        const isColor = isSavingAsAsset && !!imageData.hex;

        const isTexture =
          isSavingAsAsset &&
          ((activeTaskName === GEMINI_TASKS.CUSTOM_PROMPT.task_name &&
            (selectedTexture || assetType === ASSET_TEXTURE)) ||
            activeTaskName === GEMINI_TASKS.ADD_TEXTURE.task_name);
        const isItem =
          isSavingAsAsset &&
          ((activeTaskName === GEMINI_TASKS.CUSTOM_PROMPT.task_name &&
            (selectedItem || assetType === ASSET_ITEM || assetType === ASSET_ITEM)) ||
            activeTaskName === GEMINI_TASKS.ADD_HOME_ITEM.task_name);

        if (isColor || isTexture || isItem) {
          try {
            // Create Evolution Chain Entry
            const operation: ImageOperation = formatImageOperationData(
              effectiveOriginalImage!,
              activeTaskName,
              finalDescription.trim() || undefined,
              selectedColor,
              selectedTexture,
              selectedItem
            );

            // Compute full evolution chain from parent
            const parentChain = effectiveOriginalImage!.evolutionChain || [];
            const fullEvolutionChain = [...parentChain, operation];

            if (isColor) {
              await addColor({
                name: customName,
                hex: imageData.hex!,
                description: finalDescription.trim() || '',
                evolutionChain: fullEvolutionChain,
              });

              // Refresh space images as requested
              if (isAuthenticated && userId && activeProjectId && activeSpaceId) {
                const images = await fetchSpaceImages(userId, activeProjectId, activeSpaceId);
                dispatch(
                  setSpaceImages({ projectId: activeProjectId, spaceId: activeSpaceId, images })
                );
              }

              message.success('Color saved successfully!');
            } else if (isTexture) {
              const extension = imageData.mimeType.split('/')[1] || 'png';
              const filenameWithExt = customName.endsWith(`.${extension}`)
                ? customName
                : `${customName}.${extension}`;

              const file = base64ToFile(imageData.base64, imageData.mimeType, filenameWithExt);

              await addTextureToStore({
                name: customName,
                file,
                description: finalDescription.trim() || '',
                evolutionChain: fullEvolutionChain,
              });

              // Refresh space images as requested
              if (isAuthenticated && userId && activeProjectId && activeSpaceId) {
                const images = await fetchSpaceImages(userId, activeProjectId, activeSpaceId);
                dispatch(
                  setSpaceImages({ projectId: activeProjectId, spaceId: activeSpaceId, images })
                );
              }

              message.success('Texture saved successfully!');
            } else if (isItem) {
              const extension = imageData.mimeType.split('/')[1] || 'png';
              const filenameWithExt = customName.endsWith(`.${extension}`)
                ? customName
                : `${customName}.${extension}`;

              const file = base64ToFile(imageData.base64, imageData.mimeType, filenameWithExt);

              await addItemToStore({
                name: customName,
                file,
                description: finalDescription.trim() || '',
                evolutionChain: fullEvolutionChain,
              });

              // Refresh space images as requested
              if (isAuthenticated && userId && activeProjectId && activeSpaceId) {
                const images = await fetchSpaceImages(userId, activeProjectId, activeSpaceId);
                dispatch(
                  setSpaceImages({ projectId: activeProjectId, spaceId: activeSpaceId, images })
                );
              }

              message.success('Object saved successfully!');
            }

            // Handle Success
            setCustomPrompt('');
            setGeneratedImage(null);
            setErrorMessage(null);
            setValidationError(null);
            setIsSavingImage(false);
            dispatch(setSourceImage(null));

            onSuccess();
            return;
          } catch (error) {
            devError('Failed to save asset:', error);
            setErrorMessage('Failed to save asset.');
            setIsSavingImage(false);
            setShowConfirmationModal(true);
            return;
          }
        }

        // --- IMAGE SAVING FLOW (Existing) ---

        // We use effectiveOriginalImage which is already computed and mocks ImageData for assets if needed
        if (!effectiveOriginalImage) {
          setErrorMessage('Failed to process source image data.');
          return;
        }

        try {
          // Check operation limit (using effective wrapper)
          const operationLimitCheck = checkOperationLimit(
            effectiveOriginalImage as ImageData,
            adminSettings.mock_limit_reached
          );

          if (!operationLimitCheck.canAdd) {
            setErrorMessage(getLimitExceededMessage('operations', MAX_OPERATIONS_PER_IMAGE));
            setIsSavingImage(false);
            setShowConfirmationModal(true);
            return;
          }

          const tempImageId = crypto.randomUUID();
          const imageName = customName;
          const now = Timestamp.fromDate(new Date());

          // Create ImageOperation for evolution chain
          const operation: ImageOperation = formatImageOperationData(
            effectiveOriginalImage!,
            activeTaskName,
            finalDescription.trim() || undefined,
            selectedColor,
            selectedTexture,
            selectedItem
          );

          // For authenticated users, use optimistic updates and save to users/
          if (isAuthenticated && userId && activeProjectId && activeSpaceId) {
            // Create optimistic image object
            const optimisticImage = {
              id: tempImageId,
              name: imageName,
              assetType: ASSET_IMAGE,
              mimeType: imageData.mimeType,
              spaceId: activeSpaceId,
              evolutionChain: [operation],
              parentImageId: effectiveOriginalImage.id,
              imageDownloadUrl: `data:${imageData.mimeType};base64,${imageData.base64}`,
              storageFilePath: '',
              order: 0,
              isDeleted: false,
              deletedAt: null,
              createdAt: now,
              updatedAt: now,
            };

            // Add optimistic image to Redux store immediately for better UX
            dispatch(
              addImageOptimistic({
                projectId: activeProjectId,
                spaceId: activeSpaceId,
                image: optimisticImage,
              })
            );

            // Reset state and close modal immediately for better UX
            setCustomPrompt('');
            setGeneratedImage(null);
            setErrorMessage(null);
            setValidationError(null);
            setIsSavingImage(false);

            // Reset sourceImage in Redux
            dispatch(setSourceImage(null));

            // Save customPrompt to Redux for later use
            const promptToSave = finalDescription.trim() || undefined;
            if (promptToSave) {
              dispatch(setReduxCustomPrompt(promptToSave));
            }

            // Show success message
            message.success('Image saved successfully!');

            // Close modal immediately
            onSuccess();

            // Save processed image to Firestore in background
            try {
              // Extract dimensions from generated image base64
              const dimensions = await extractImageDimensions(imageData.base64, imageData.mimeType);

              await createImage(
                userId,
                activeProjectId,
                activeSpaceId,
                null,
                {
                  id: tempImageId,
                  name: imageName,
                  mimeType: imageData.mimeType,
                  description: finalDescription,
                  width: dimensions.width,
                  height: dimensions.height,
                  aspect_ratio: dimensions.aspect_ratio,
                },
                {
                  base64: imageData.base64,
                  base64MimeType: imageData.mimeType,
                  parentImage: sourceImage,
                  operation,
                }
              );

              // Fetch updated space images to get real Firebase Storage URL
              const images = await fetchSpaceImages(userId, activeProjectId, activeSpaceId);
              dispatch(
                setSpaceImages({
                  projectId: activeProjectId,
                  spaceId: activeSpaceId,
                  images,
                })
              );

              // Submit feedback if provided (for authenticated users)
              if (feedbackData) {
                setTimeout(() => {
                  const submitFeedback = async () => {
                    try {
                      // Find the saved image URL from the fetched images
                      const savedImage = images.find((img) => img.id === tempImageId);
                      if (!savedImage?.imageDownloadUrl) {
                        devWarn('[GenerateMoreModal] Could not find saved image URL for feedback');
                        return;
                      }

                      devLogContext('[GenerateMoreModal] Submitting feedback for saved image...');
                      await saveFeedback({
                        sourceImageDownloadUrl: effectiveOriginalImage?.imageDownloadUrl || '',
                        generatedImageDownloadUrl: savedImage.imageDownloadUrl,
                        taskName: activeTaskName || 'unknown',
                        isSaved: true,
                        rate: feedbackData.rating,
                        comments: feedbackData.comment,
                        userId: userId || 'unknown',
                        options: {
                          prompt: finalDescription,
                          selectedColor: selectedColor
                            ? {
                                id: selectedColor.id,
                                name: selectedColor.name,
                                hex: selectedColor.hex,
                              }
                            : undefined,
                          selectedTexture: selectedTexture
                            ? {
                                id: selectedTexture.id,
                                name: selectedTexture.name,
                                textureImageDownloadUrl: selectedTexture.textureImageDownloadUrl,
                              }
                            : undefined,
                          selectedItem: selectedItem
                            ? {
                                id: selectedItem.id,
                                name: selectedItem.name,
                                itemImageDownloadUrl: selectedItem.itemImageDownloadUrl,
                              }
                            : undefined,
                        },
                      });
                      devLog(
                        '[GenerateMoreModal] Feedback submitted successfully (authenticated)!'
                      );
                    } catch (e) {
                      devError('[GenerateMoreModal] Failed to submit feedback:', e);
                    }
                  };
                  void submitFeedback();
                }, 100);
              }
            } catch (saveError) {
              devError('Failed to save processed image:', saveError);
              // Rollback optimistic update on error
              dispatch(
                removeImageOptimistic({
                  projectId: activeProjectId,
                  spaceId: activeSpaceId,
                  imageId: tempImageId,
                })
              );
              message.error('Failed to save image. Please try again.');
            }
          } else if (guestSessionId) {
            // Guests save their generated image to local IndexedDB storage
            const now = Timestamp.fromDate(new Date());

            // Extract dimensions from generated image base64
            const dimensions = await extractImageDimensions(imageData.base64, imageData.mimeType);

            // Create the image data
            const guestImageData: ImageData = {
              id: tempImageId,
              name: imageName,
              mimeType: imageData.mimeType,
              spaceId: null,
              evolutionChain: [operation],
              parentImageId: effectiveOriginalImage.id,
              imageDownloadUrl: `data:${imageData.mimeType};base64,${imageData.base64}`,
              storageFilePath: '',
              order: null,
              isDeleted: false,
              deletedAt: null,
              createdAt: now,
              updatedAt: now,
              description: '',
              assetType: ASSET_IMAGE,
              width: dimensions.width,
              height: dimensions.height,
              aspect_ratio: dimensions.aspect_ratio,
            };

            // Save to IndexedDB (local storage)
            await guestIndexedDB.saveImage(guestImageData, imageData.base64);

            // Add to Redux store for immediate display in gallery
            dispatch(addGuestImage(guestImageData));

            // Mark that guest has saved a generated image (triggers login requirement for future generations)
            markImageGenerated();

            // Submit feedback if provided (for guest users)
            if (feedbackData) {
              setTimeout(() => {
                const submitFeedback = async () => {
                  try {
                    // For guest users, use the data URL as the saved image URL
                    const savedImageUrl = guestImageData.imageDownloadUrl;

                    devLog('[GenerateMoreModal] Submitting feedback for saved image (guest)...');
                    await saveFeedback({
                      sourceImageDownloadUrl: effectiveOriginalImage?.imageDownloadUrl || '',
                      generatedImageDownloadUrl: savedImageUrl,
                      taskName: activeTaskName || 'unknown',
                      isSaved: true,
                      rate: feedbackData.rating,
                      comments: feedbackData.comment,
                      userId: guestSessionId || 'guest',
                      options: {
                        prompt: finalDescription,
                        selectedColor: selectedColor
                          ? {
                              id: selectedColor.id,
                              name: selectedColor.name,
                              hex: selectedColor.hex,
                            }
                          : undefined,
                        selectedTexture: selectedTexture
                          ? {
                              id: selectedTexture.id,
                              name: selectedTexture.name,
                              textureImageDownloadUrl: selectedTexture.textureImageDownloadUrl,
                            }
                          : undefined,
                        selectedItem: selectedItem
                          ? {
                              id: selectedItem.id,
                              name: selectedItem.name,
                              itemImageDownloadUrl: selectedItem.itemImageDownloadUrl,
                            }
                          : undefined,
                      },
                    });
                    devLogContext('[GenerateMoreModal] Feedback submitted successfully (guest)!');
                  } catch (e) {
                    devError('[GenerateMoreModal] Failed to submit feedback (guest):', e);
                  }
                };
                void submitFeedback();
              }, 100);
            }

            // Reset state
            setCustomPrompt('');
            setGeneratedImage(null);
            setErrorMessage(null);
            setValidationError(null);
            setIsSavingImage(false);
            dispatch(setSourceImage(null));

            message.success('Image saved successfully!');

            onSuccess();
          }
        } catch (error) {
          devError('Failed to save processed image:', error);
          setErrorMessage(
            error instanceof Error ? error.message : 'Failed to save processed image.'
          );
          setIsSavingImage(false);
          setShowConfirmationModal(true);
        }
      },
      [
        userId,
        isAuthenticated,
        guestSessionId,
        sourceImage,
        sourceAsset,
        activeProjectId,
        activeSpaceId,
        activeTaskName,
        selectedColor,
        selectedTexture,
        selectedItem,
        setErrorMessage,
        customPrompt,
        dispatch,
        onSuccess,
        addColor,
        addItemToStore,
        addTextureToStore,
        assetType,
        effectiveOriginalImage,
        markImageGenerated,
        adminSettings.mock_limit_reached,
      ]
    );

    const handleCancelConfirmation = useCallback(() => {
      setShowConfirmationModal(false);
      setGeneratedImage(null);
    }, []);

    // const lastOperation = sourceImage?.evolutionChain[sourceImage.evolutionChain.length - 1];

    // Dynamic modal title based on task
    const getModalTitle = () => {
      if (!activeTaskName) return 'Generate Image';

      if (activeTaskName === GEMINI_TASKS.RECOLOR_WALL.task_name) {
        return 'Generate recolored image';
      } else if (activeTaskName === GEMINI_TASKS.ADD_TEXTURE.task_name) {
        return 'Apply texture to specified surfaces';
      } else if (activeTaskName === GEMINI_TASKS.ADD_HOME_ITEM.task_name) {
        return 'Add new elements';
      } else if (activeTaskName === GEMINI_TASKS.CUSTOM_PROMPT.task_name) {
        return 'Transform any assets with custom prompts';
      }
      return 'Generate more images';
    };

    // Dynamic prompt placeholder based on task
    const getPromptPlaceholder = () => {
      if (activeTaskName === GEMINI_TASKS.RECOLOR_WALL.task_name) {
        return "Enter specific color instructions... (e.g., 'Make it a matte finish', 'Apply to the accent wall only')";
      } else if (activeTaskName === GEMINI_TASKS.ADD_TEXTURE.task_name) {
        return "Describe how to apply the texture... (e.g., 'Apply to the upper half only', 'Make the pattern smaller')";
      } else if (activeTaskName === GEMINI_TASKS.ADD_HOME_ITEM.task_name) {
        return "Describe what you want to add... (e.g., 'A person reading on the sofa', 'A cat sleeping near the window', 'A modern floor lamp')";
      } else if (activeTaskName === GEMINI_TASKS.CUSTOM_PROMPT.task_name) {
        return 'Enter your detailed instructions for the AI image transformation... (required)';
      }
      return "Enter any specific instructions for the AI... (e.g., 'Make the walls lighter', 'Add more warmth to the color')";
    };

    const sharedTip = 'Try to clearly specify: ';

    const getPromptWritingGuide = () => {
      if (activeTaskName === GEMINI_TASKS.RECOLOR_WALL.task_name) {
        return {
          tips: [
            {
              text:
                sharedTip +
                "which wall to recolor? (e.g., 'only the accent wall', 'all walls except the ceiling').",
              hasButton: false,
            },
          ],
        };
      } else if (activeTaskName === GEMINI_TASKS.ADD_TEXTURE.task_name) {
        return {
          tips: [
            {
              text:
                sharedTip +
                "which wall to apply it to? (e.g., 'the lower half only', 'behind the sofa')",
              hasButton: false,
            },
          ],
        };
      } else if (activeTaskName === GEMINI_TASKS.ADD_HOME_ITEM.task_name) {
        return {
          tips: [
            {
              text:
                sharedTip +
                "where to place the object and what angle? (e.g., 'corner by the window', 'center of the room facing left')",
              hasButton: false,
            },
          ],
        };
      } else if (activeTaskName === GEMINI_TASKS.CUSTOM_PROMPT.task_name) {
        return {
          tips: [
            {
              text: 'Be specific and detailed about what changes you want. Include: what elements to modify, how to modify them, and any specific style or aesthetic preferences',
              hasButton: false,
            },
          ],
        };
      }
      return { tips: [] };
    };

    // Check if operation limit has been reached for warning display
    const hasReachedOperationLimit = !operationLimitCheck.canAdd;

    // (Moved effectiveOriginalImage to top of component, see line 192)

    // If no valid source provided, don't render the modal. Keep this check after hooks so
    // React hooks are called in the same order on every render.
    if (!sourceImage && !sourceAsset) return null;

    return (
      <>
        <style>{shimmerKeyframes}</style>
        <Modal
          title={
            <div className="mb-4">
              <Typography.Title level={4} className="m-0">
                {getModalTitle()}
              </Typography.Title>
            </div>
          }
          open={isOpen}
          onCancel={handleClose}
          width="1152px"
          maskClosable={!isSavingImage && !isProcessingImage}
          keyboard={!isSavingImage && !isProcessingImage}
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                key="cancel"
                onClick={handleClose}
                disabled={isSavingImage || isOptimizingPrompt}
              >
                Cancel
              </Button>
              <div className="flex items-center">
                {isThinkingModeAvailable(activeTaskName) && (
                  <Tooltip
                    key="thinking-tooltip"
                    title="Use a more capable model for higher quality results"
                  >
                    <span className="inline-flex items-center gap-2 mr-3">
                      <span className="text-sm text-gray-600">Thinking</span>
                      <Switch
                        size="small"
                        checked={thinkingMode}
                        onChange={setThinkingMode}
                        disabled={isSavingImage || isProcessingImage || isOptimizingPrompt}
                      />
                    </span>
                  </Tooltip>
                )}
                <Tooltip title={isGenerateDisabled ? disableReason : ''} key="generate-tooltip">
                  <Button
                    key="generate"
                    type="primary"
                    onClick={handleGenerate}
                    disabled={isGenerateDisabled || isOptimizingPrompt}
                    data-tour="modal-generate-button"
                    className="flex items-center gap-1.5"
                  >
                    Generate
                    {!hasEnabledOwnKey && (
                      <div className="flex items-center bg-white/20 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {getCreditCost(activeTaskName, thinkingMode)}
                        <VPointsIcon size={20} className="ml-1 opacity-90" />
                      </div>
                    )}
                  </Button>
                </Tooltip>
              </div>
            </div>
          }
        >
          {/* Error Messages */}
          {errorMessage && (
            <div className="mb-4">
              <Alert title={errorMessage} type="error" showIcon />
            </div>
          )}
          {validationError && (
            <div className="mb-4">
              <Alert title={validationError} type="warning" showIcon />
            </div>
          )}

          <div className="flex gap-8 flex-wrap relative">
            {/* Left Column: Target Image & Design Material */}
            <div className="min-w-0 flex-1 basis-[200px] flex flex-col gap-4 relative">
              {/* Target Image */}
              <div className="relative">
                {/* Unified Asset Preview */}
                <SelectedAssets
                  title={
                    selectedTaskNames[0] === GEMINI_TASKS.CUSTOM_PROMPT.task_name
                      ? 'Target Asset'
                      : 'Target Image'
                  }
                  customCardHeight={240}
                  assets={
                    selectedTaskNames[0] === GEMINI_TASKS.CUSTOM_PROMPT.task_name
                      ? sourceImage
                        ? [sourceImage, ...selectedAssets]
                        : sourceAsset
                          ? [sourceAsset]
                          : selectedAssets
                      : sourceImage
                        ? [sourceImage]
                        : []
                  }
                />
              </div>

              {/* Design Material */}
              {activeTaskName !== GEMINI_TASKS.CUSTOM_PROMPT.task_name && !isMagicTask && (
                <SelectedAssets
                  title="Design Material"
                  customCardHeight={240}
                  assets={selectedAssets}
                />
              )}
            </div>

            {/* Right Column: Custom Prompt */}
            <div className="flex flex-col flex-1 basis-[400px] gap-4 min-w-0 relative">
              <div>
                {/* Custom Prompt & Historical Prompts */}
                <Typography.Title level={5} className="mb-2">
                  Custom Prompt
                </Typography.Title>

                <div className="flex gap-0 flex-1 min-h-0 border border-gray-200 rounded-md overflow-hidden h-[420px] relative">
                  {/* Left: Historical Custom Prompts List */}
                  <div className="flex-1 flex flex-col min-w-0">
                    {(activeTaskName === GEMINI_TASKS.CUSTOM_PROMPT.task_name ||
                      activeTaskName === GEMINI_TASKS.REMOVE_CLUTTER.task_name) &&
                    (sourceImage || sourceAsset?.assetType === ASSET_IMAGE) ? (
                      <Tabs
                        activeKey={activePromptTab}
                        onChange={(key) => setActivePromptTab(key as 'magic' | 'saved')}
                        style={{ padding: '0 12px' }}
                        items={[
                          {
                            key: 'magic',
                            label: (
                              <Tooltip title="Use system optimized prompts for common tasks">
                                <span className="text-[0.80rem] font-semibold flex items-center">
                                  Magic Prompts
                                  <span className="ml-1.5 inline-flex">
                                    <InfoCircleOutlined />
                                  </span>
                                </span>
                              </Tooltip>
                            ),
                          },
                          {
                            key: 'saved',
                            label: (
                              <Tooltip title="Used custom prompts from previous image operations in this project">
                                <span className="text-[0.80rem] font-semibold flex items-center">
                                  Saved Prompts
                                  <span className="ml-1.5 inline-flex">
                                    <InfoCircleOutlined />
                                  </span>
                                </span>
                              </Tooltip>
                            ),
                          },
                        ]}
                      />
                    ) : (
                      <div className="m-0 mb-1 px-3 pt-3 flex items-center gap-1.5 text-[0.85rem] font-semibold text-gray-800">
                        Saved Prompts
                        <InfoIconWithTooltip title="Used custom prompts from previous image operations in this project" />
                      </div>
                    )}

                    {/* Saved Prompts Search + List (or Magic Prompts List) */}
                    {activePromptTab === 'saved' ? (
                      <SavedPromptList
                        prompts={prompts}
                        isLoading={isLoadingPrompts}
                        searchKeyword={searchPrompts}
                        onSearchChange={setSearchPrompts}
                        onSelectPrompt={(content) => {
                          setCustomPrompt(content);
                          message.success('Prompt applied!');
                        }}
                        onDeletePrompt={async (promptId) => {
                          try {
                            await deletePrompt(promptId);
                            await fetchPrompts();
                          } catch (error) {
                            // Error is already handled in SavedPromptList component
                            devError('Failed to delete and refresh prompts:', error);
                          }
                        }}
                      />
                    ) : (
                      <>
                        {/* Magic Prompts List */}
                        <div className="overflow-auto flex-1">
                          <List
                            className="w-full bg-white h-[334px]"
                            dataSource={magicPromptsList}
                            renderItem={(item) => (
                              <List.Item
                                className="px-3 py-2 border-b border-[#f0f0f0] cursor-pointer transition-colors hover:bg-[#f5f5f5]"
                                onClick={(e) => handlePickMagicPrompt(e, item.taskName, item.label)}
                              >
                                <Flex justify="space-between" align="flex-start" gap={4} className="w-full">
                                  <span>{item.label}</span>
                                  <Tooltip title="Use this magic prompt">
                                    <Button
                                      type="text"
                                      size="small"
                                      icon={<CopyOutlined style={{ fontSize: '1rem' }} />}
                                      onClick={(e) =>
                                        handlePickMagicPrompt(e, item.taskName, item.label)
                                      }
                                      className="flex-none"
                                    />
                                  </Tooltip>
                                </Flex>
                              </List.Item>
                            )}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Right: Custom Prompt Textarea */}
                  <div className="flex-1 flex flex-col min-w-0 border-l border-gray-200">
                    <Typography.Title level={5} className="m-0 px-3 pt-3">
                      Input
                      <span
                        className={`${isCustomPromptRequiredForTask ? 'text-red-500' : 'text-gray-500'} text-[0.85em] ml-1`}
                      >
                        ({isCustomPromptRequiredForTask ? 'Required' : 'Optional'})
                      </span>
                    </Typography.Title>

                    {/* Custom Prompt Input */}
                    <div className="flex-1 flex flex-col px-3 pb-6 min-h-0 relative">
                      <Input.TextArea
                        placeholder={getPromptPlaceholder()}
                        value={customPrompt}
                        onChange={(e) => {
                          setCustomPrompt(e.target.value);
                          if (activeTaskName === GEMINI_TASKS.CUSTOM_PROMPT.task_name) {
                            dispatch(setSelectedTaskNames([GEMINI_TASKS.CUSTOM_PROMPT.task_name]));
                          }
                        }}
                        disabled={isProcessingImage || isOptimizingPrompt}
                        maxLength={MAX_CUSTOM_PROMPT_LENGTH}
                        showCount
                        allowClear
                        className="flex-1 resize-none"
                        data-tour="custom-prompt-input"
                        style={{ paddingBottom: '48px' }}
                      />
                      {/* Help me write button */}
                      {(sourceImage || (sourceAsset && sourceAsset.assetType !== ASSET_COLOR)) && (
                        <div className="absolute bottom-10 right-6 z-10 flex items-center gap-2">
                          <Tooltip title="Let AI optimize your prompt">
                            <Button
                              type={customPrompt.trim() ? 'primary' : 'default'}
                              icon={
                                isOptimizingPrompt ? <LoadingOutlined spin /> : <EditOutlined />
                              }
                              onClick={handleHelpMeWrite}
                              disabled={
                                isProcessingImage || isOptimizingPrompt || !customPrompt.trim()
                              }
                              className={
                                customPrompt.trim()
                                  ? 'shadow-md'
                                  : 'opacity-50 bg-gray-100 border-gray-200 text-gray-400'
                              }
                            >
                              {isOptimizingPrompt ? 'Optimizing...' : 'Help me write'}
                              {!hasEnabledOwnKey && (
                                <div className="ml-1.5 flex items-center bg-gray-100/50 px-1.5 py-0.5 rounded text-[10px] font-bold text-gray-600">
                                  {getCreditCost('optimize_prompt', false)}
                                  <VPointsIcon size={20} className="ml-1 opacity-70" />
                                </div>
                              )}
                            </Button>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Prompt Writing Guide */}
              {/* TODO: handle tips display logic for magic prompts or custom prompts */}
              {activeTaskName &&
                activeTaskName !== GEMINI_TASKS.CUSTOM_PROMPT.task_name &&
                !isMagicTask && (
                  <div className="p-3 bg-[#e6f7ff] rounded-md border border-[#91d5ff]">
                    <div className="flex flex-col gap-0.5">
                      {getPromptWritingGuide().tips.map((tip, index) => (
                        <div key={index} className="text-[0.85rem] leading-none">
                          <h6 className="m-0 leading-none">
                            <BulbOutlined className="mr-2 text-[#1890ff]" />
                            {tip.text}.
                            <span>
                              {' '}
                              See
                              <Button
                                type="link"
                                onClick={() => setIsDefaultPromptExpanded(true)}
                                className="p-0 h-auto"
                                style={{ padding: '0 6px' }}
                              >
                                default prompt
                                <InfoCircleOutlined />
                              </Button>
                            </span>{' '}
                            to understand what's behind.
                          </h6>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              {hasReachedOperationLimit && (
                <Alert
                  title={getLimitExceededMessage('operations', MAX_OPERATIONS_PER_IMAGE)}
                  type="warning"
                  showIcon
                  className="m-0"
                />
              )}
            </div>
          </div>

          {/* Full Modal Loading Overlay */}
          {isProcessingImage && (
            <div className="absolute inset-0 z-[9999] flex flex-col items-center justify-center backdrop-blur-xl bg-white/85 pointer-events-auto rounded-md overflow-hidden">
              {/* Dynamically generated shimmer layers - 24 total */}
              {shimmerLayers.map((layer) => (
                <div
                  key={layer.id}
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: layer.gradient,
                    animation: `shimmer${layer.id} ${layer.speed}s infinite ${layer.delay}s`,
                  }}
                />
              ))}

              {/* Spinner and text */}
              <div className="flex flex-col items-center gap-6 z-10">
                {/* Large Spinner */}
                <div
                  className="w-16 h-16 border-4 border-gray-200 border-t-indigo-500 rounded-full"
                  style={{
                    animation: 'spin 1s linear infinite',
                  }}
                />

                {/* Processing text */}
                <Typography.Title level={3} className="text-xl font-medium text-gray-800">
                  Image processing...
                </Typography.Title>

                {/* Cancel button */}
                <Button type="text" onClick={handleClose} size="small" className="mt-4">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Saving Image Overlay */}
          {isSavingImage && !isProcessingImage && (
            <div className="absolute inset-0 z-[9999] flex flex-col items-center justify-center backdrop-blur-xl bg-white/85 pointer-events-auto rounded-md overflow-hidden">
              {/* Dynamically generated shimmer layers - 24 total */}
              {shimmerLayers.map((layer) => (
                <div
                  key={layer.id}
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: layer.gradient,
                    animation: `shimmer${layer.id} ${layer.speed}s infinite ${layer.delay}s`,
                  }}
                />
              ))}

              {/* Spinner and text */}
              <div className="flex flex-col items-center gap-6 z-10">
                {/* Large Spinner */}
                <div
                  className="w-16 h-16 border-4 border-gray-200 border-t-indigo-500 rounded-full"
                  style={{
                    animation: 'spin 1s linear infinite',
                  }}
                />

                {/* Saving text */}
                <Typography.Title level={3} className="text-xl font-medium text-gray-800">
                  Saving image...
                </Typography.Title>

                <Typography.Text className="text-gray-600">
                  Please wait while we save your generated image
                </Typography.Text>
              </div>
            </div>
          )}
        </Modal>

        {/* Spinner animation */}
        <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

        {/* Confirmation Modal for Generated Image */}
        {effectiveOriginalImage && generatedImage && activeTaskName && (
          <ConfirmImageUpdateModal
            isOpen={showConfirmationModal}
            originalImage={effectiveOriginalImage}
            generatedImage={generatedImage}
            onConfirm={handleConfirmImage}
            onCancel={handleCancelConfirmation}
            taskName={activeTaskName}
            colorName={selectedColor?.name}
            textureName={selectedTexture?.name}
            itemName={selectedItem?.name}
            originalHex={
              (activeTaskName === GEMINI_TASKS.COLOR_ADJUSTMENT.task_name ||
                activeTaskName === GEMINI_TASKS.CUSTOM_PROMPT.task_name) &&
              sourceAsset &&
              sourceAsset.assetType === ASSET_COLOR
                ? (sourceAsset as Color).hex
                : undefined
            }
            defaultDescription={customPrompt}
            ratingRequired={import.meta.env.VITE_GENERATION_RESULT_RATING_REQUIRED === 'true'}
            userId={userId}
            guestSessionId={guestSessionId}
            customPrompt={customPrompt}
            selectedColor={selectedColor}
            selectedTexture={selectedTexture}
            selectedItem={selectedItem}
          />
        )}

        {/* Default Prompt Drawer */}
        <Drawer
          title="Default Prompt"
          placement="right"
          open={isDefaultPromptExpanded}
          onClose={() => setIsDefaultPromptExpanded(false)}
          size="default"
          closeIcon={<CloseOutlined />}
        >
          <div className="bg-[#f3f4f6] rounded p-4 font-mono text-[0.8rem] leading-[1.5] text-[#666666] border border-gray-200 whitespace-pre-wrap break-words overflow-auto">
            {defaultPrompt}
          </div>
        </Drawer>

        {/* Credit Exhausted Modal */}
        <CreditExhaustedModal
          isOpen={showCreditExhaustedModal}
          onClose={() => setShowCreditExhaustedModal(false)}
          totalCredits={totalCredits}
        />
      </>
    );
  }
);

GenerateMoreModal.displayName = 'GenerateMoreModal';

export default GenerateMoreModal;
