import React, { useMemo, useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Typography, Button, Tooltip } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import TaskSelect from '@/components/select/TaskSelect';
import SelectedAssets from '@/components/SelectedAssets';
import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import {
  selectSelectedOriginalImageIds,
  selectSelectedUpdatedImageIds,
  selectOriginalImages,
  selectUpdatedImages,
} from '@/stores/imageStore';
import {
  selectSelectedTaskNames,
  selectSelectedColor,
  selectSelectedTexture,
  selectSelectedItem,
  setIsGenerateModalOpen,
  setSourceImage,
} from '@/stores/taskStore';
import {
  selectHasGeneratedImage,
  selectGuestImages,
  setShowLoginRequiredModal,
} from '@/stores/guestStore';
import { useGenerateButtonState } from '@/hooks/useGenerateButtonState';
import { checkOperationLimit } from '@/utils/limitationUtils';
import { imageCache } from '@/utils/imageCache';
import { useImageProcessing } from '@/hooks/useImageProcessing';
import { useAuth } from '@/contexts/AuthContext';
import { useGuest } from '@/contexts/GuestContext';
import { getDemoImages } from '@/constants/demoImages';

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
  const selectedColor = useSelector(selectSelectedColor);
  const selectedTexture = useSelector(selectSelectedTexture);
  const selectedItem = useSelector(selectSelectedItem);
  const hasGeneratedImage = useSelector(selectHasGeneratedImage);

  const [cachedImageSrc, setCachedImageSrc] = useState<string | null>(null);

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

  // Load cached image
  useEffect(() => {
    const loadCachedImage = async () => {
      if (!selectedImage) {
        setCachedImageSrc(null);
        return;
      }

      try {
        const base64 = await imageCache.get(selectedImage.imageDownloadUrl);
        if (base64) {
          setCachedImageSrc(`data:${selectedImage.mimeType};base64,${base64}`);
        }
      } catch (error) {
        console.warn('Failed to load cached image:', error);
      }
    };

    loadCachedImage();
  }, [selectedImage]);

  // Calculate button state
  const operationLimitCheck = selectedImage
    ? checkOperationLimit(selectedImage, adminSettings.mock_limit_reached)
    : null;
  const { isDisabled, disableReason } = useGenerateButtonState({
    activeTaskName: selectedTaskNames[0] || null,
    isProcessingImage,
    isSavingImage: false, // AsideSection doesn't track saving state, only processing
    canAddOperation: operationLimitCheck?.canAdd ?? false,
    selectedColor,
    selectedTexture,
    selectedItem,
  });

  // Check if guest has already generated an image
  const guestHasUsedGeneration = isGuestMode && hasGeneratedImage;
  const finalIsDisabled = isDisabled || guestHasUsedGeneration;
  const finalDisableReason = guestHasUsedGeneration
    ? 'Login to generate more images'
    : disableReason;

  // Determine selection state message
  const selectionMessage = useMemo(() => {
    const totalSelected = selectedOriginalImageIds.size + selectedUpdatedImageIds.size;

    if (totalSelected === 0) return 'No image selected';
    if (totalSelected > 1) return `${totalSelected} images selected. Please select only 1 image.`;
    return null;
  }, [selectedOriginalImageIds.size, selectedUpdatedImageIds.size]);

  const handleGenerate = () => {
    // If guest has already generated, show login modal
    if (guestHasUsedGeneration) {
      dispatch(setShowLoginRequiredModal(true));
      return;
    }

    if (selectedImage) {
      dispatch(setSourceImage(selectedImage));
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

      {/* Selected Image Display */}
      <div className="px-6">
        <Typography.Title level={5} className="m-0 mb-2">
          Target Image
        </Typography.Title>
        {selectionMessage ? (
          <div
            className={`flex justify-center items-center p-3 bg-gray-100 rounded border border-dashed border-gray-200 text-gray-500 text-sm`}
            style={{ height: cardHeight }}
          >
            {selectionMessage}
          </div>
        ) : selectedImage ? (
          <div>
            <img
              src={cachedImageSrc || selectedImage.imageDownloadUrl}
              alt={selectedImage.name}
              className={`w-full rounded border border-gray-200 object-cover`}
              style={{ height: cardHeight }}
            />
          </div>
        ) : null}
      </div>

      {/* Only show SelectedAssets if not using Custom Prompt task */}
      {selectedTaskNames[0] !== 'custom_prompt' && (
        <div className="px-6">
          <SelectedAssets />
        </div>
      )}

      {/* Generate Button - stick to bottom */}
      <div className="px-6 mt-auto pb-6" data-tour="generate-button">
        <Tooltip
          title={finalIsDisabled && finalDisableReason ? finalDisableReason : ''}
          placement="right"
        >
          <div className="relative">
            <Button
              block
              size="large"
              htmlType="button"
              disabled={finalIsDisabled || !selectedImage}
              onClick={handleGenerate}
              className={`btn-generate h-11 text-base font-semibold rounded-md shadow-sm ${finalIsDisabled || !selectedImage ? 'btn-disabled' : ''}`}
            >
              <AutoAwesomeIcon className="text-lg mr-2 align-middle" />
              Generate
            </Button>
            {guestHasUsedGeneration && (
              <LockOutlined className="text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </div>
        </Tooltip>
      </div>
    </aside>
  );
};

export default AsideSection;
