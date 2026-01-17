import React, { useMemo, useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Alert, Typography, Button } from 'antd';
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
import { useGenerateButtonState } from '@/hooks/useGenerateButtonState';
import { checkOperationLimit } from '@/utils/limitationUtils';
import { imageCache } from '@/utils/imageCache';
import { useImageProcessing } from '@/hooks/useImageProcessing';
import { useAuth } from '@/contexts/AuthContext';

export const cardHeight = '120px';

const AsideSection: React.FC = () => {
  const dispatch = useDispatch();
  const { user, adminSettings } = useAuth();
  const selectedOriginalImageIds = useSelector(selectSelectedOriginalImageIds);
  const selectedUpdatedImageIds = useSelector(selectSelectedUpdatedImageIds);
  const originalImages = useSelector(selectOriginalImages);
  const updatedImages = useSelector(selectUpdatedImages);
  const selectedTaskNames = useSelector(selectSelectedTaskNames);
  const selectedColor = useSelector(selectSelectedColor);
  const selectedTexture = useSelector(selectSelectedTexture);
  const selectedItem = useSelector(selectSelectedItem);

  const [cachedImageSrc, setCachedImageSrc] = useState<string | null>(null);

  // Use image processing hook to get sourceImage state
  const { processingImage } = useImageProcessing({
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
    processingImage,
    savingImage: false, // AsideSection doesn't track saving state, only processing
    canAddOperation: operationLimitCheck?.canAdd ?? false,
    selectedColor,
    selectedTexture,
    selectedItem,
  });

  // Determine selection state message
  const selectionMessage = useMemo(() => {
    const totalSelected = selectedOriginalImageIds.size + selectedUpdatedImageIds.size;

    if (totalSelected === 0) return 'No image selected';
    if (totalSelected > 1) return `${totalSelected} images selected. Please select only 1 image.`;
    return null;
  }, [selectedOriginalImageIds.size, selectedUpdatedImageIds.size]);

  const handleGenerate = () => {
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
      <TaskSelect />

      {/* Selected Image Display */}
      <div className="px-6">
        <Typography.Title level={5} className="m-0 mb-2">
          Target Image
        </Typography.Title>
        {selectionMessage ? (
          <div
            className={`flex justify-center items-center h-[${cardHeight}] p-3 bg-gray-100 rounded border border-dashed border-gray-200 text-gray-500 text-sm`}
          >
            {selectionMessage}
          </div>
        ) : selectedImage ? (
          <div>
            <img
              src={cachedImageSrc || selectedImage.imageDownloadUrl}
              alt={selectedImage.name}
              className={`w-full h-[${cardHeight}] rounded border border-gray-200 object-cover`}
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
      <div className="px-6 mt-auto pb-6">
        {isDisabled && disableReason && selectedImage && (
          <div className="mb-2">
            <Alert title={disableReason} type="warning" />
          </div>
        )}
        <Button
          block
          size="large"
          htmlType="button"
          disabled={isDisabled || !selectedImage}
          onClick={handleGenerate}
          className={`btn-generate h-11 text-base font-semibold rounded-md shadow-sm ${isDisabled || !selectedImage ? 'btn-disabled' : ''}`}
        >
          <AutoAwesomeIcon className="text-lg mr-2 align-middle" />
          Generate
        </Button>
      </div>
    </aside>
  );
};

export default AsideSection;
