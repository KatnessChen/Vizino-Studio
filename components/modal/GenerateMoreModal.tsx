import { useState, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Modal, Button, Input, Alert, Tooltip, Drawer, Typography, message, Skeleton } from 'antd';
import { BulbOutlined, CloseOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { List, ListItem, Box, Tooltip as MuiTooltip, IconButton } from '@mui/material';
import { ContentCopy as CopyIcon } from '@mui/icons-material';
import InfoIconWithTooltip from '@/components/ui/InfoIconWithTooltip';
import MyEmpty from '@/components/ui/MyEmpty';
import { Timestamp } from 'firebase/firestore';
import { ImageData, ImageOperation, CustomPrompt } from '@/types';
import { imageCache } from '@/utils/imageCache';
import {
  getRecolorTaskDefaultPrompt,
  getAddTextureDefaultPrompt,
  getAddObjectDefaultPrompt,
  getUseCustomPromptDefaultPrompt,
} from '@/services/gemini/prompts';
import { GEMINI_TASKS } from '@/services/gemini/geminiTasks';
import { createImage, fetchSpaceImages, saveCustomPrompt } from '@/services/firestoreService';
import { formatImageOperationData } from '@/utils';
import { checkOperationLimit, getLimitExceededMessage } from '@/utils/limitationUtils';
import {
  selectActiveProjectId,
  selectActiveSpaceId,
  setSpaceImages,
  addImageOptimistic,
  removeImageOptimistic,
} from '@/stores/projectStore';
import { useImageProcessing } from '@/hooks/useImageProcessing';
import { useGenerateButtonState } from '@/hooks/useGenerateButtonState';
import {
  selectSelectedColor,
  selectSelectedTexture,
  selectSelectedItem,
  selectSelectedTaskNames,
  setCustomPrompt as setReduxCustomPrompt,
  setSourceImage,
} from '@/stores/taskStore';
import { useCustomPrompts } from '@/hooks/useCustomPrompts';
import ConfirmImageUpdateModal from './ConfirmImageUpdateModal';
import SelectedAssets from '@/components/SelectedAssets';
import { MAX_OPERATIONS_PER_IMAGE } from '@/constants/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useGuest } from '@/contexts/GuestContext';
import { guestIndexedDB } from '@/utils/guestIndexedDB';
import { addGuestImage, setShowLoginRequiredModal } from '@/stores/guestStore';

export interface GenerateMoreModalRef {
  triggerGenerate: () => Promise<void>;
}

interface GenerateMoreModalProps {
  isOpen: boolean;
  sourceImage: ImageData | null;
  userId: string | undefined;
  onSuccess: () => void; // Called after successful save to refresh images
  onCancel: () => void;
  onGenerateClick?: () => void; // Called when generate button is clicked
}

const GenerateMoreModal = forwardRef<GenerateMoreModalRef, GenerateMoreModalProps>(
  ({ isOpen, sourceImage, userId, onSuccess, onCancel, onGenerateClick }, ref) => {
    // Get dispatch from Redux
    const dispatch = useDispatch();
    // Get adminSettings from Auth context
    const { adminSettings, isAuthenticated } = useAuth();
    // Get guest context
    const { guestSessionId, isGuestMode, hasGeneratedImage, markImageGenerated } = useGuest();
    // Get active project and space from Redux store
    const activeProjectId = useSelector(selectActiveProjectId);
    const activeSpaceId = useSelector(selectActiveSpaceId);

    const selectedTaskNames = useSelector(selectSelectedTaskNames);
    const selectedColor = useSelector(selectSelectedColor);
    const selectedTexture = useSelector(selectSelectedTexture);
    const selectedItem = useSelector(selectSelectedItem);

    const [cachedImageSrc, setCachedImageSrc] = useState<string | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [customPrompt, setCustomPrompt] = useState<string>('');
    const [generatedImage, setGeneratedImage] = useState<{
      base64: string;
      mimeType: string;
    } | null>(null);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [isSavingImage, setIsSavingImage] = useState(false);
    const [isDefaultPromptExpanded, setIsDefaultPromptExpanded] = useState(false);
    const [searchPrompts, setSearchPrompts] = useState<string>('');

    const { Text } = Typography;

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

    // Filter prompts based on search keyword using %match% logic
    const filteredPrompts = useMemo(() => {
      if (!searchPrompts.trim()) {
        return prompts;
      }

      const keyword = searchPrompts.toLowerCase();
      return prompts.filter(
        (prompt) =>
          prompt.task_name.toLowerCase().includes(keyword) ||
          prompt.content.toLowerCase().includes(keyword)
      );
    }, [prompts, searchPrompts]);

    // Determine the active task from selectedTaskNames (assuming single task)
    const activeTaskName = useMemo(() => {
      if (selectedTaskNames.length === 0) return null;
      return selectedTaskNames[0];
    }, [selectedTaskNames]);

    // Check operation limit
    const operationLimitCheck = checkOperationLimit(sourceImage, adminSettings.mock_limit_reached);

    // Helper function to get customPromptRequired for a task
    const getCustomPromptRequired = (taskName: string | null): boolean => {
      if (!taskName) return false;
      const taskEntry = Object.entries(GEMINI_TASKS).find(
        ([, task]) => task.task_name === taskName
      );
      return taskEntry?.[1]?.customPromptRequired ?? false;
    };

    // Determine if custom prompt is required for current task
    const isCustomPromptRequired = getCustomPromptRequired(activeTaskName);

    // Use image processing hook
    const { processImage, isProcessingImage, errorMessage, setErrorMessage, cancelProcessing } =
      useImageProcessing({
        userId,
        guestSessionId,
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
      isCustomPromptRequired,
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

    // Load cached image
    useEffect(() => {
      const loadCachedImage = async () => {
        if (!sourceImage) return;

        try {
          const base64 = await imageCache.get(sourceImage.imageDownloadUrl);
          if (base64) {
            setCachedImageSrc(`data:${sourceImage.mimeType};base64,${base64}`);
          } else {
            setCachedImageSrc(null);
          }
        } catch (error) {
          console.warn('[GenerateMoreModal] Failed to load cached image:', error);
          setCachedImageSrc(null);
        }
      };

      loadCachedImage();
    }, [sourceImage]);

    // Clear validation error when color changes
    useEffect(() => {
      if (selectedColor) {
        setValidationError(null);
      }
    }, [selectedColor]);

    const handleGenerate = useCallback(async () => {
      // If guest has already generated, show login modal
      if (guestHasUsedGeneration) {
        dispatch(setShowLoginRequiredModal(true));
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
      if (customPrompt.length > 500) {
        setErrorMessage(
          'Custom prompt exceeds the 500 character limit. Please reduce the prompt length.'
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
      if (isCustomPromptRequired && !customPrompt.trim()) {
        setValidationError('Please enter a custom prompt.');
        return;
      }

      if (!sourceImage) {
        setValidationError('No source image available.');
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

      console.log('[GenerateMoreModal] Starting image processing with:', {
        userId,
        sourceImageId: sourceImage.id,
        taskName: activeTaskName,
        colorName: selectedColor?.name,
        colorHex: selectedColor?.hex,
        textureName: selectedTexture?.name,
        textureUrl: selectedTexture?.textureImageDownloadUrl,
        hasCustomPrompt: !!customPrompt.trim(),
      });

      const result = await processImage(sourceImage, customPrompt.trim() || undefined);

      if (result) {
        console.log('[GenerateMoreModal] Processing successful, result:', {
          hasMimeType: !!result.mimeType,
          hasBase64: !!result.base64,
          base64Length: result.base64?.length || 0,
        });

        // Save custom prompt immediately after a successful generation for authenticated users
        const promptToSave = customPrompt.trim() || undefined;
        if (isAuthenticated && userId && activeProjectId && activeTaskName && promptToSave) {
          (async () => {
            try {
              await saveCustomPrompt(userId, activeProjectId, activeTaskName, promptToSave);
              // Refresh prompts list so it appears in the Saved Prompts panel
              try {
                await fetchPrompts();
              } catch (fetchErr) {
                console.warn('Failed to refresh prompts after saving:', fetchErr);
              }
              message.success('Prompt saved');
            } catch (saveErr) {
              console.warn('Failed to save custom prompt on generate:', saveErr);
            }
          })();
        }

        setGeneratedImage(result);
        setShowConfirmationModal(true);
      }
    }, [
      guestHasUsedGeneration,
      dispatch,
      sourceImage,
      adminSettings.mock_limit_reached,
      customPrompt,
      activeTaskName,
      selectedColor,
      selectedTexture,
      selectedItem,
      disableReason,
      isCustomPromptRequired,
      userId,
      guestSessionId,
      onGenerateClick,
      processImage,
      isAuthenticated,
      activeProjectId,
      fetchPrompts,
      setErrorMessage,
    ]);

    // Expose handleGenerate to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        triggerGenerate: handleGenerate,
      }),
      [handleGenerate]
    );

    const handlePickHistoricalCustomPrompt = useCallback(
      (e: React.MouseEvent, customPrompt: string) => {
        e.stopPropagation();
        setCustomPrompt(customPrompt);
        message.success('Prompt applied!');
      },
      []
    );

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

    const handleConfirmImage = async (
      imageData: { base64: string; mimeType: string },
      customName: string
    ) => {
      if (!sourceImage || !activeTaskName) {
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

      let tempImageId = '';

      try {
        // Check operation limit on source image
        const operationLimitCheck = checkOperationLimit(
          sourceImage,
          adminSettings.mock_limit_reached
        );
        if (!operationLimitCheck.canAdd) {
          setErrorMessage(getLimitExceededMessage('operations', MAX_OPERATIONS_PER_IMAGE));
          setIsSavingImage(false);
          setShowConfirmationModal(true);
          return;
        }

        tempImageId = crypto.randomUUID();
        const imageName = customName;
        const now = Timestamp.fromDate(new Date());

        // Create ImageOperation for evolution chain
        const operation: ImageOperation = formatImageOperationData(
          sourceImage,
          activeTaskName,
          customPrompt.trim() || undefined,
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
            mimeType: imageData.mimeType,
            spaceId: activeSpaceId,
            evolutionChain: [operation],
            parentImageId: sourceImage.id,
            imageDownloadUrl: `data:${imageData.mimeType};base64,${imageData.base64}`,
            storageFilePath: '',
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
          const promptToSave = customPrompt.trim() || undefined;
          if (promptToSave) {
            dispatch(setReduxCustomPrompt(promptToSave));
          }

          // Show success message
          message.success('Image saved successfully!');

          // Close modal immediately
          onSuccess();

          // Save processed image to Firestore in background
          try {
            await createImage(
              userId,
              activeProjectId,
              activeSpaceId,
              null,
              {
                id: tempImageId,
                name: imageName,
                mimeType: imageData.mimeType,
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
              setSpaceImages({ projectId: activeProjectId, spaceId: activeSpaceId, images })
            );
          } catch (saveError) {
            console.error('Failed to save processed image:', saveError);
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

          // Create the image data
          const guestImageData: ImageData = {
            id: tempImageId,
            name: imageName,
            mimeType: imageData.mimeType,
            spaceId: null,
            evolutionChain: [operation],
            parentImageId: sourceImage.id,
            imageDownloadUrl: `data:${imageData.mimeType};base64,${imageData.base64}`,
            storageFilePath: '',
            order: null,
            isDeleted: false,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
            description: '',
          };

          // Save to IndexedDB (local storage)
          await guestIndexedDB.saveImage(guestImageData, imageData.base64);

          // Add to Redux store for immediate display in gallery
          dispatch(addGuestImage(guestImageData));

          // Mark that guest has saved a generated image (triggers login requirement for future generations)
          markImageGenerated();

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
        console.error('Failed to save processed image:', error);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to save processed image.');
        setIsSavingImage(false);
        setShowConfirmationModal(true);
      }
    };

    const handleCancelConfirmation = () => {
      setShowConfirmationModal(false);
      setGeneratedImage(null);
    };

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
        return 'Transform image with custom prompts';
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

    if (!sourceImage) return null;

    // Check if operation limit has been reached for warning display
    const hasReachedOperationLimit = !operationLimitCheck.canAdd;

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
          footer={[
            <Button key="cancel" onClick={handleClose} disabled={isSavingImage} size="large">
              Cancel
            </Button>,
            <Tooltip title={isGenerateDisabled ? disableReason : ''} key="generate-tooltip">
              <Button
                key="generate"
                type="primary"
                onClick={handleGenerate}
                disabled={isGenerateDisabled}
                size="large"
                data-tour="modal-generate-button"
              >
                Generate
              </Button>
            </Tooltip>,
          ]}
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
            {/* Left Column: Target Image + Design Material */}
            <div className="min-w-0 flex-1 basis-[200px] flex flex-col gap-4 relative">
              {/* Target Image */}
              <div className="relative">
                <Typography.Title level={5}>Target Image</Typography.Title>

                {/* Source Image Preview */}
                <div
                  className="h-[240px] rounded overflow-hidden border border-gray-200 bg-cover bg-center bg-no-repeat relative"
                  style={{
                    backgroundImage: `url(${cachedImageSrc || sourceImage.imageDownloadUrl})`,
                  }}
                />
              </div>

              {/* Design Material */}
              {selectedTaskNames[0] !== GEMINI_TASKS.CUSTOM_PROMPT.task_name && (
                <SelectedAssets customCardHeight={240} />
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
                    <Typography.Title
                      level={5}
                      className="m-0 mb-1 px-3 pt-3 flex items-center gap-1.5"
                    >
                      Saved Prompts
                      <InfoIconWithTooltip title="Used custom prompts from previous image operations in this project" />
                    </Typography.Title>

                    {/* Search Input */}
                    <div className="mt-2 mb-2 px-3">
                      <Input
                        placeholder="Filter prompts..."
                        value={searchPrompts}
                        onChange={(e) => setSearchPrompts(e.target.value)}
                        allowClear
                        className="w-full rounded-none border-l-0 border-r-0 border-t-0"
                      />
                    </div>

                    {/* Prompts List */}
                    <div className="overflow-auto flex-1">
                      {isLoadingPrompts ? (
                        <div className="p-2">
                          <Skeleton active paragraph={{ rows: 2 }} />
                          <Skeleton active paragraph={{ rows: 2 }} className="mt-2" />
                          <Skeleton active paragraph={{ rows: 2 }} className="mt-2" />
                        </div>
                      ) : filteredPrompts.length === 0 ? (
                        <div className="p-4 flex items-center justify-center h-full">
                          <MyEmpty description="No historical prompts found." />
                        </div>
                      ) : (
                        <List
                          sx={{
                            width: '100%',
                            bgcolor: 'background.paper',
                            paddingBottom: 0,
                            height: '334px', // hardcoded height to make both columns same height
                          }}
                        >
                          {filteredPrompts.map((prompt: CustomPrompt, index) => (
                            <ListItem
                              key={prompt.id || index}
                              sx={{
                                padding: '8px 12px',
                                borderBottom: '1px solid #f0f0f0',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                '&:hover': {
                                  backgroundColor: '#f5f5f5',
                                },
                              }}
                              onClick={(e) => handlePickHistoricalCustomPrompt(e, prompt.content)}
                            >
                              <Box
                                sx={{
                                  width: '100%',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                  gap: 1,
                                }}
                              >
                                <Text>{prompt.content}</Text>
                                <MuiTooltip title="Use this prompt">
                                  <IconButton
                                    size="small"
                                    onClick={(e) =>
                                      handlePickHistoricalCustomPrompt(e, prompt.content)
                                    }
                                    sx={{ flexShrink: 0 }}
                                  >
                                    <CopyIcon sx={{ fontSize: '1rem' }} />
                                  </IconButton>
                                </MuiTooltip>
                              </Box>
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </div>
                  </div>

                  {/* Right: Custom Prompt Textarea */}
                  <div className="flex-1 flex flex-col min-w-0 border-l border-gray-200">
                    <Typography.Title level={5} className="m-0 mb-1 px-3 pt-3">
                      Input
                      <span
                        className={`${isCustomPromptRequired ? 'text-red-500' : 'text-gray-500'} text-[0.85em] ml-1`}
                      >
                        ({isCustomPromptRequired ? 'Required' : 'Optional'})
                      </span>
                    </Typography.Title>

                    {/* Custom Prompt Input */}
                    <div className="flex-1 flex flex-col px-3 pb-6 pt-2 min-h-0">
                      <Input.TextArea
                        placeholder={getPromptPlaceholder()}
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        disabled={isProcessingImage}
                        maxLength={500}
                        showCount
                        allowClear
                        className="flex-1 resize-none"
                        data-tour="custom-prompt-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Prompt Writing Guide */}
              {activeTaskName && (
                <div className="p-3 bg-[#e6f7ff] rounded-md border border-[#91d5ff]">
                  <div className="flex flex-col gap-0.5">
                    {getPromptWritingGuide().tips.map((tip, index) => (
                      <div key={index} className="text-[0.85rem]">
                        <h6>
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
        {sourceImage && generatedImage && activeTaskName && (
          <ConfirmImageUpdateModal
            isOpen={showConfirmationModal}
            originalImage={sourceImage}
            generatedImage={generatedImage}
            onConfirm={handleConfirmImage}
            onCancel={handleCancelConfirmation}
            taskName={activeTaskName}
            colorName={selectedColor?.name}
            textureName={selectedTexture?.name}
            itemName={selectedItem?.name}
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
      </>
    );
  }
);

GenerateMoreModal.displayName = 'GenerateMoreModal';

export default GenerateMoreModal;
