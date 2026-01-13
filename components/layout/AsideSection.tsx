import React, { useMemo, useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Alert, Typography } from 'antd';
import TaskSelect from '@/components/select/TaskSelect';
import SelectedAssets from '@/components/SelectedAssets';
import ToolkitPanel from './ToolkitPanel';
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
        <Typography.Title level={5} style={{ margin: 0, marginBottom: '8px' }}>
          Target Image
        </Typography.Title>
        {selectionMessage ? (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#f3f4f6',
              borderRadius: '4px',
              border: '1px dashed #d1d5db',
              color: '#9ca3af',
              fontSize: '0.875rem',
              textAlign: 'center',
            }}
          >
            {selectionMessage}
          </div>
        ) : selectedImage ? (
          <div>
            <img
              src={cachedImageSrc || selectedImage.imageDownloadUrl}
              alt={selectedImage.name}
              style={{
                width: '100%',
                height: 'auto',
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                marginBottom: '8px',
              }}
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

      {/* Generate Button */}
      <div className="px-6">
        <button
          disabled={isDisabled || !selectedImage}
          onClick={handleGenerate}
          className={`flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm transition-colors w-full cursor-pointer ${
            isDisabled || !selectedImage
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500'
          }`}
          style={{
            height: '44px',
            fontSize: '1rem',
            fontWeight: 600,
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 20, marginRight: 1, color: 'inherit' }} />
          Generate
        </button>
        {isDisabled && disableReason && selectedImage && (
          <Alert title={disableReason} type="warning" style={{ marginTop: '8px' }} />
        )}
      </div>

      {/* Toolkit Panel at the bottom */}
      <div className="mt-auto border-t border-gray-200">
        <ToolkitPanel />
      </div>
    </aside>
  );
};

export default AsideSection;
