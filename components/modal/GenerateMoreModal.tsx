import { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Modal,
  Button,
  Input,
  Spin,
  Alert,
  Tooltip,
  Drawer,
  Typography,
  message,
  Skeleton,
  Empty,
} from 'antd';
import { InfoCircleOutlined, BulbOutlined, CloseOutlined } from '@ant-design/icons';
import { List, ListItem, Box, Tooltip as MuiTooltip, IconButton } from '@mui/material';
import { ContentCopy as CopyIcon } from '@mui/icons-material';
import { Timestamp } from 'firebase/firestore';
import { ImageData, ImageOperation, CustomPrompt } from '@/types';
import { imageCache } from '@/utils/imageCache';
import {
  getWallRecolorPrompt,
  getAddTexturePrompt,
  getItemPrompt,
} from '@/services/gemini/prompts';
import { GEMINI_TASKS } from '@/services/gemini/geminiTasks';
import { createImage, fetchSpaceImages, saveCustomPrompt } from '@/services/firestoreService';
import { formatImageOperationData, formatTaskName } from '@/utils';
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

interface GenerateMoreModalProps {
  isOpen: boolean;
  sourceImage: ImageData | null;
  userId: string | undefined;
  onSuccess: () => void; // Called after successful save to refresh images
  onCancel: () => void;
}

const GenerateMoreModal: React.FC<GenerateMoreModalProps> = ({
  isOpen,
  sourceImage,
  userId,
  onSuccess,
  onCancel,
}) => {
  // Get dispatch from Redux
  const dispatch = useDispatch();
  // Get adminSettings from Auth context
  const { adminSettings } = useAuth();
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
  const [generatedImage, setGeneratedImage] = useState<{ base64: string; mimeType: string } | null>(
    null
  );
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [isDefaultPromptExpanded, setIsDefaultPromptExpanded] = useState(false);
  const [searchPrompts, setSearchPrompts] = useState<string>('');

  const { Text } = Typography;

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

  // Use image processing hook
  const { processImage, processingImage, errorMessage, setErrorMessage } = useImageProcessing({
    userId,
    selectedTaskName: activeTaskName || GEMINI_TASKS.RECOLOR_WALL.task_name,
    options: {
      selectedColor,
      selectedTexture,
      selectedItem,
    },
  });

  // Get generate button state
  const { isDisabled: isGenerateDisabled, disableReason } = useGenerateButtonState({
    activeTaskName,
    processingImage,
    savingImage,
    canAddOperation: operationLimitCheck.canAdd,
    selectedColor,
    selectedTexture,
    selectedItem,
  });

  // Calculate default prompt based on active task
  const defaultPrompt = useMemo(() => {
    if (!activeTaskName) return '';

    if (activeTaskName === GEMINI_TASKS.RECOLOR_WALL.task_name) {
      return getWallRecolorPrompt(selectedColor?.name, selectedColor?.hex, undefined);
    } else if (activeTaskName === GEMINI_TASKS.ADD_TEXTURE.task_name) {
      return getAddTexturePrompt(selectedTexture?.name || '', undefined);
    } else if (activeTaskName === GEMINI_TASKS.ADD_HOME_ITEM.task_name) {
      return getItemPrompt(selectedItem?.name || '', undefined);
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

  const handleGenerate = async () => {
    // Check operation limit first
    const operationLimitCheck = checkOperationLimit(sourceImage, adminSettings.mock_limit_reached);
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
    if (activeTaskName === GEMINI_TASKS.RECOLOR_WALL.task_name && !selectedColor) {
      setValidationError(disableReason);
      return;
    }

    if (activeTaskName === GEMINI_TASKS.ADD_TEXTURE.task_name && !selectedTexture) {
      setValidationError(disableReason);
      return;
    }

    if (activeTaskName === GEMINI_TASKS.ADD_HOME_ITEM.task_name && !selectedItem) {
      setValidationError(disableReason);
      return;
    }

    if (!sourceImage) {
      setValidationError('No source image available.');
      return;
    }

    if (!userId) {
      setErrorMessage('User ID is required to process images.');
      return;
    }

    setValidationError(null);

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

      setGeneratedImage(result);
      setShowConfirmationModal(true);
    }
  };

  const handleClose = () => {
    if (!savingImage) {
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
    if (!sourceImage || !userId || !activeProjectId || !activeSpaceId || !activeTaskName) {
      setErrorMessage('Missing required data to save image.');
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

    setSavingImage(true);
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
        setSavingImage(false);
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

      // Create optimistic image object (matches LandingPage implementation)
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
          projectId: activeProjectId!,
          spaceId: activeSpaceId!,
          image: optimisticImage,
        })
      );

      // Reset state and close modal immediately for better UX
      setCustomPrompt('');
      setGeneratedImage(null);
      setErrorMessage(null);
      setValidationError(null);
      setSavingImage(false);

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
      dispatch(setSpaceImages({ projectId: activeProjectId, spaceId: activeSpaceId, images }));

      // Save custom prompt to Firestore if provided
      if (customPrompt.trim()) {
        try {
          await saveCustomPrompt(userId, activeProjectId, activeTaskName, customPrompt.trim());
        } catch (error) {
          console.warn('Failed to save custom prompt to Firestore:', error);
          // Don't throw - prompt saving is non-critical
        }
      }
    } catch (error) {
      console.error('Failed to save processed image:', error);

      // Rollback optimistic update on error
      dispatch(
        removeImageOptimistic({
          projectId: activeProjectId!,
          spaceId: activeSpaceId!,
          imageId: tempImageId,
        })
      );

      setErrorMessage(error instanceof Error ? error.message : 'Failed to save processed image.');
      setSavingImage(false);
      setShowConfirmationModal(true); // Reopen confirmation modal on error
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmationModal(false);
    setGeneratedImage(null);
  };

  const lastOperation = sourceImage?.evolutionChain[sourceImage.evolutionChain.length - 1];

  // Dynamic modal title based on task
  const getModalTitle = () => {
    if (!activeTaskName) return 'Generate Image';

    if (activeTaskName === GEMINI_TASKS.RECOLOR_WALL.task_name) {
      return 'Generate Recolored Image';
    } else if (activeTaskName === GEMINI_TASKS.ADD_TEXTURE.task_name) {
      return 'Apply Texture to Specified Surfaces';
    } else if (activeTaskName === GEMINI_TASKS.ADD_HOME_ITEM.task_name) {
      return 'Add New Elements';
    }
    return 'Generate More Images';
  };

  // Dynamic prompt placeholder based on task
  const getPromptPlaceholder = () => {
    if (activeTaskName === GEMINI_TASKS.RECOLOR_WALL.task_name) {
      return "Enter specific color instructions... (e.g., 'Make it a matte finish', 'Apply to the accent wall only')";
    } else if (activeTaskName === GEMINI_TASKS.ADD_TEXTURE.task_name) {
      return "Describe how to apply the texture... (e.g., 'Apply to the upper half only', 'Make the pattern smaller')";
    } else if (activeTaskName === GEMINI_TASKS.ADD_HOME_ITEM.task_name) {
      return "Describe what you want to add... (e.g., 'A person reading on the sofa', 'A cat sleeping near the window', 'A modern floor lamp')";
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
    }
    return { tips: [] };
  };

  if (!sourceImage) return null;

  // Check if operation limit has been reached for warning display
  const hasReachedOperationLimit = !operationLimitCheck.canAdd;

  return (
    <>
      <Modal
        title={
          <div className="mb-4">
            <Typography.Title level={4} style={{ margin: 0 }}>
              {getModalTitle()}
            </Typography.Title>
          </div>
        }
        open={isOpen}
        onCancel={handleClose}
        width={1200}
        maskClosable={!savingImage}
        keyboard={!savingImage}
        footer={[
          <Button
            key="cancel"
            onClick={handleClose}
            disabled={processingImage || savingImage}
            size="large"
          >
            Cancel
          </Button>,
          <Tooltip title={isGenerateDisabled ? disableReason : ''} key="generate-tooltip">
            <Button
              key="generate"
              type="primary"
              onClick={handleGenerate}
              disabled={isGenerateDisabled}
              size="large"
            >
              Generate
            </Button>
          </Tooltip>,
        ]}
      >
        <Spin spinning={processingImage} tip="Generating new image..." size="large">
          {/* Error Messages */}
          {errorMessage && (
            <Alert title={errorMessage} type="error" showIcon style={{ marginBottom: 16 }} />
          )}
          {validationError && (
            <Alert title={validationError} type="warning" showIcon style={{ marginBottom: 16 }} />
          )}

          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            {/* Left Column: Source Image */}
            <div
              style={{ minWidth: 0, flex: '1 1 400px', display: 'flex', flexDirection: 'column' }}
            >
              <Typography.Title level={5}>Target Image</Typography.Title>

              {/* Image Info */}
              <div style={{ marginBottom: 16 }}>
                <Tooltip title={sourceImage.name}>
                  <div
                    style={{
                      marginBottom: 4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <strong>Filename:</strong> {sourceImage.name}
                  </div>
                </Tooltip>
                <div>
                  <strong>Created:</strong>{' '}
                  {sourceImage.createdAt instanceof Object && 'toDate' in sourceImage.createdAt
                    ? sourceImage.createdAt.toDate().toLocaleString()
                    : new Date(sourceImage.createdAt).toLocaleString()}
                </div>
              </div>

              {/* Last Operation Info */}
              {lastOperation && (
                <div style={{ marginBottom: 16 }}>
                  <Typography.Title level={5} style={{ marginBottom: 8 }}>
                    Last Generation
                  </Typography.Title>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 4 }}>
                        <strong>Task:</strong> {formatTaskName(lastOperation.taskName)}
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <strong>Color:</strong> {lastOperation.options.colorSnapshot?.name || 'N/A'}
                      </div>
                      <div>
                        <strong>Custom Prompt:</strong> {lastOperation.customPrompt || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Source Image Preview */}
              <div
                style={{
                  minHeight: 400,
                  backgroundColor: '#f3f4f6',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  border: '1px solid #e5e7eb',
                }}
              >
                <img
                  src={cachedImageSrc || sourceImage.imageDownloadUrl}
                  alt={sourceImage.name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                  }}
                />
              </div>
            </div>

            {/* Right Column: Color Selector & Custom Prompt */}
            <div
              style={{
                flex: '1 1 400px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                minWidth: 0,
              }}
            >
              <SelectedAssets />

              {/* Custom Prompt & Historical Prompts */}
              <div
                style={{
                  display: 'flex',
                  gap: 0,
                  flex: 1,
                  minHeight: 0,
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  overflow: 'hidden',
                }}
              >
                {/* Left: Historical Custom Prompts List */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <Typography.Title
                    level={5}
                    style={{ margin: 0, marginBottom: '4px', padding: '12px 12px 0 12px' }}
                  >
                    Saved Prompts
                  </Typography.Title>

                  {/* Search Input */}
                  <Input
                    placeholder="Filter prompts..."
                    value={searchPrompts}
                    onChange={(e) => setSearchPrompts(e.target.value)}
                    allowClear
                    style={{
                      borderRadius: 0,
                      borderLeft: 'none',
                      borderRight: 'none',
                      borderTop: 'none',
                      margin: '8px 12px 0 12px',
                      width: 'calc(100% - 24px)',
                    }}
                  />

                  {/* Prompts List */}
                  <div
                    style={{
                      flex: 1,
                      overflow: 'auto',
                      borderRight: '1px solid #e5e7eb',
                      borderBottom: 'none',
                      maxHeight: '300px',
                    }}
                  >
                    {isLoadingPrompts ? (
                      <div style={{ padding: 8 }}>
                        <Skeleton active paragraph={{ rows: 2 }} />
                        <Skeleton active paragraph={{ rows: 2 }} style={{ marginTop: 8 }} />
                        <Skeleton active paragraph={{ rows: 2 }} style={{ marginTop: 8 }} />
                      </div>
                    ) : filteredPrompts.length === 0 ? (
                      <div
                        style={{
                          padding: 16,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                        }}
                      >
                        <Empty description="No prompts found" style={{ margin: 0 }} />
                      </div>
                    ) : (
                      <List
                        sx={{
                          width: '100%',
                          bgcolor: 'background.paper',
                          overflow: 'auto',
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
                            onClick={() => setCustomPrompt(prompt.content)}
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCustomPrompt(prompt.content);
                                    message.success('Prompt applied!');
                                  }}
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
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                    borderLeft: '1px solid #e5e7eb',
                    paddingBottom: '16px',
                  }}
                >
                  <Typography.Title
                    level={5}
                    style={{ margin: 0, marginBottom: '4px', padding: '12px 12px 0 12px' }}
                  >
                    Custom Prompt (Optional)
                  </Typography.Title>

                  {/* Custom Prompt Input */}
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '8px 12px',
                      minHeight: 0,
                    }}
                  >
                    <Input.TextArea
                      rows={10}
                      placeholder={getPromptPlaceholder()}
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      disabled={processingImage}
                      maxLength={500}
                      showCount
                      allowClear
                      style={{ flex: 1, resize: 'none' }}
                    />
                  </div>
                </div>
              </div>

              {/* Prompt Writing Guide */}
              {activeTaskName && (
                <div
                  style={{
                    padding: 12,
                    backgroundColor: '#e6f7ff',
                    borderRadius: 6,
                    border: '1px solid #91d5ff',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {getPromptWritingGuide().tips.map((tip, index) => (
                      <div
                        key={index}
                        style={{
                          fontSize: '0.85rem',
                        }}
                      >
                        <h6>
                          <BulbOutlined className="mr-2" style={{ color: '#1890ff' }} />
                          {tip.text}.
                          <span>
                            {' '}
                            See{' '}
                            <Button
                              type="link"
                              onClick={() => setIsDefaultPromptExpanded(true)}
                              style={{
                                padding: '0',
                                margin: '0 4px',
                                height: 'auto',
                              }}
                            >
                              default prompt
                              <InfoCircleOutlined />
                            </Button>{' '}
                          </span>{' '}
                          to understand what’s behind.
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
                  style={{ margin: 0 }}
                />
              )}
            </div>
          </div>
        </Spin>
      </Modal>

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
        <div
          style={{
            backgroundColor: '#f3f4f6',
            borderRadius: 4,
            padding: 16,
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            lineHeight: 1.5,
            color: '#666',
            border: '1px solid #e5e7eb',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflow: 'auto',
          }}
        >
          {defaultPrompt}
        </div>
      </Drawer>
    </>
  );
};

export default GenerateMoreModal;
