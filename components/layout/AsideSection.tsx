import React, { useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Button } from 'antd';
import { LockOutlined, ThunderboltOutlined } from '@ant-design/icons';
import TaskSelect from '@/components/select/TaskSelect';
import SelectedAssets from '@/components/SelectedAssets';
import {
  selectSelectedOriginalImageIds,
  selectSelectedUpdatedImageIds,
  selectOriginalImages,
  selectUpdatedImages,
} from '@/stores/imageStore';
import {
  selectSelectedTaskNames,
  selectSelectedAssets,
  setIsGenerateModalOpen,
  setSourceImage,
} from '@/stores/taskStore';
import { Color, Texture, Item, ImageData as AppImageData } from '@/types';
import {
  selectHasGeneratedImage,
  selectGuestImages,
  setShowLoginRequiredModal,
} from '@/stores/guestStore';
import { useGenerateButtonState } from '@/hooks/useGenerateButtonState';
import { checkOperationLimit } from '@/utils/limitationUtils';
import { useImageProcessing } from '@/hooks/useImageProcessing';
import { useAuth } from '@/contexts/AuthContext';
import { useGuest } from '@/contexts/GuestContext';
import { ASSET_COLOR, ASSET_TEXTURE, ASSET_ITEM } from '@/constants/constants';
import { getDemoImages } from '@/constants/demoImages';
import { GEMINI_TASKS } from '@/services/gemini/geminiTasks';

export const cardHeight = '120px';

const AsideSection: React.FC = () => {
  const dispatch = useDispatch();
  const { user, adminSettings } = useAuth();
  const { isGuestMode } = useGuest();
  const selectedOriginalImageIds = useSelector(selectSelectedOriginalImageIds);
  const selectedUpdatedImageIds = useSelector(selectSelectedUpdatedImageIds);
  const storeOriginalImages = useSelector(selectOriginalImages);
  const storeUpdatedImages = useSelector(selectUpdatedImages);
  const guestImages = useSelector(selectGuestImages);

  const originalImages = useMemo(() => {
    if (isGuestMode && storeOriginalImages.length === 0) {
      return getDemoImages();
    }
    return storeOriginalImages;
  }, [isGuestMode, storeOriginalImages]);

  // For guests, use guest generated images; for users, use space updated images
  const updatedImages = useMemo(() => {
    if (isGuestMode) {
      return guestImages.filter((img) => img.parentImageId);
    }
    return storeUpdatedImages;
  }, [isGuestMode, guestImages, storeUpdatedImages]);

  const selectedTaskNames = useSelector(selectSelectedTaskNames);
  const selectedAssets = useSelector(selectSelectedAssets);
  const hasGeneratedImage = useSelector(selectHasGeneratedImage);

  // Derive legacy state for hooks/compatibility
  // Note: selectedAssets currently only holds 1 item max for now
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

  // Use image processing hook to get sourceImage state
  const { isProcessingImage } = useImageProcessing({
    userId: user?.uid,
    selectedTaskName: selectedTaskNames[0] || null,
    options: {
      selectedColor,
      selectedTexture,
      selectedItem,
    },
  });

  // Get the single selected image (if exactly 1 is selected)
  const selectedImage = useMemo(() => {
    const allSelectedIds = new Set([
      ...Array.from(selectedOriginalImageIds),
      ...Array.from(selectedUpdatedImageIds),
    ]);

    if (allSelectedIds.size !== 1) return null;

    const selectedId = Array.from(allSelectedIds)[0];
    const allImages = [...originalImages, ...updatedImages];
    return allImages.find((img) => img.id === selectedId) || null;
  }, [selectedOriginalImageIds, selectedUpdatedImageIds, originalImages, updatedImages]);

  // Get all selected images as an array
  const selectedImages: AppImageData[] = useMemo(() => {
    const allSelectedIds = new Set([
      ...Array.from(selectedOriginalImageIds),
      ...Array.from(selectedUpdatedImageIds),
    ]);

    if (allSelectedIds.size === 0) return [];

    const allImages = [...originalImages, ...updatedImages];
    const result: AppImageData[] = [];
    for (const id of allSelectedIds) {
      const img = allImages.find((img) => img.id === id);
      if (img) result.push(img);
    }
    return result;
  }, [selectedOriginalImageIds, selectedUpdatedImageIds, originalImages, updatedImages]);

  // Calculate button state
  // Calculate button state
  const activeTask = selectedTaskNames[0];
  const isCustomPrompt = activeTask === GEMINI_TASKS.CUSTOM_PROMPT.task_name;
  const selectedAsset = isCustomPrompt ? selectedColor || selectedTexture || selectedItem : null;

  const effectiveSource = selectedImage || selectedAsset;

  const operationLimitCheck = effectiveSource
    ? checkOperationLimit(effectiveSource, adminSettings.mock_limit_reached)
    : null;

  const { isDisabled, guestHasUsedGeneration, shouldShowLockedStyle, buttonOpacity } =
    useGenerateButtonState({
      activeTaskName: selectedTaskNames[0] || null,
      isProcessingImage,
      isSavingImage: false, // AsideSection doesn't track saving state, only processing
      canAddOperation: operationLimitCheck?.canAdd ?? false,
      selectedColor,
      selectedTexture,
      selectedItem,
      isGuestMode,
      hasGeneratedImage,
      hasSelectedImage: !!selectedImage,
    });

  const handleGenerate = () => {
    // If guest has already generated, show login modal
    if (guestHasUsedGeneration) {
      dispatch(setShowLoginRequiredModal(true));
      return;
    }

    // activeTask is already defined above
    // const activeTask = selectedTaskNames[0];
    // const isCustomPrompt = activeTask === 'custom_prompt';

    // Allow generation if Image is selected OR (Custom Prompt AND Asset is selected)
    const hasValidSource = selectedImage || (isCustomPrompt && selectedAssets.length > 0);

    if (hasValidSource) {
      // If we have an image, set it as source (compatible with existing logic)
      if (selectedImage) {
        dispatch(setSourceImage(selectedImage));
      } else {
        // If no image but we have asset, we ensure sourceImage is null so Modal handles asset extraction
        dispatch(setSourceImage(null));
      }
      dispatch(setIsGenerateModalOpen(true));
    }
  };

  return (
    <aside
      className="h-full w-[250px] bg-white flex flex-col shadow-lg border-r border-gray-200 overflow-y-auto gap-6"
      style={{ height: 'calc(100vh - var(--header-height))' }}
    >
      <div data-tour="design-goal">
        <TaskSelect />
      </div>

      <div className="px-6">
        {(() => {
          if (!activeTask) {
            return <SelectedAssets title="Target Image" assets={selectedImages} />;
          }

          if (
            activeTask === GEMINI_TASKS.RECOLOR_WALL.task_name ||
            activeTask === GEMINI_TASKS.ADD_TEXTURE.task_name ||
            activeTask === GEMINI_TASKS.ADD_HOME_ITEM.task_name
          ) {
            return (
              <div className="flex flex-col gap-6">
                <SelectedAssets title="Target Image" assets={selectedImages} />
                <SelectedAssets title="Design Material" assets={selectedAssets} />
              </div>
            );
          }

          if (activeTask === GEMINI_TASKS.CUSTOM_PROMPT.task_name) {
            return (
              <SelectedAssets
                title="Target Asset"
                assets={[...selectedImages, ...selectedAssets]}
              />
            );
          }

          // Default fallback for other tasks
          return <SelectedAssets title="Target Image" assets={selectedImages} />;
        })()}
      </div>

      {/* Generate Button - stick to bottom */}
      <div className="px-6 mt-auto pb-6" data-tour="generate-button">
        <div className="relative">
          <Button
            block
            size="large"
            htmlType="button"
            disabled={isDisabled}
            onClick={handleGenerate}
            className={`btn-generate h-11 text-base font-semibold rounded-md shadow-sm ${isDisabled ? 'btn-disabled' : ''}`}
            style={buttonOpacity ? { opacity: buttonOpacity } : undefined}
          >
            <ThunderboltOutlined className="text-lg mr-2 align-middle" />
            Generate
          </Button>
          {shouldShowLockedStyle && (
            <LockOutlined className="text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
          )}
        </div>
      </div>
    </aside>
  );
};

export default AsideSection;
