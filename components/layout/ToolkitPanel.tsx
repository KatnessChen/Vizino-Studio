import React, { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ChevronRight as ChevronRightIcon } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import ImagesComparingButton from '@/components/button/ImagesComparingButton';
import {
  selectSelectedOriginalImageIds,
  selectSelectedUpdatedImageIds,
  selectOriginalImages,
  selectUpdatedImages,
} from '@/stores/imageStore';
import { ImageData } from '@/types';

const ToolkitPanel: React.FC = () => {
  const selectedOriginalImageIds = useSelector(selectSelectedOriginalImageIds);
  const selectedUpdatedImageIds = useSelector(selectSelectedUpdatedImageIds);
  const originalImages = useSelector(selectOriginalImages);
  const updatedImages = useSelector(selectUpdatedImages);
  const [isExpanded, setIsExpanded] = useState(true);

  const selectedImageCount = selectedOriginalImageIds.size + selectedUpdatedImageIds.size;
  const isEnabled = selectedImageCount >= 2 && selectedImageCount <= 4;

  // Get actual image objects for comparison modal
  const getSelectedPhotosForComparison = useMemo(() => {
    const selectedPhotos: ImageData[] = [];

    // Add selected original images
    selectedOriginalImageIds.forEach((id) => {
      const img = originalImages.find((img) => img.id === id);
      if (img) selectedPhotos.push(img);
    });

    // Add selected updated images
    selectedUpdatedImageIds.forEach((id) => {
      const img = updatedImages.find((img) => img.id === id);
      if (img) selectedPhotos.push(img);
    });

    return selectedPhotos;
  }, [selectedOriginalImageIds, selectedUpdatedImageIds, originalImages, updatedImages]);

  return (
    <div className="w-full border-t border-gray-100 relative pt-4">
      {/* Expand/Collapse Icon - positioned on border */}
      <div
        className="absolute -top-4 left-1/2 transform -translate-x-1/2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <IconButton
          size="small"
          sx={{
            backgroundColor: 'white',
            padding: '6px',
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
            },
          }}
        >
          <ChevronRightIcon
            sx={{
              fontSize: 20,
              color: '#374151',
              transition: 'transform 0.3s ease',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(-90deg)',
            }}
          />
        </IconButton>
      </div>

      {/* Content area */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isExpanded ? '500px' : '0px',
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <div className="px-6 pb-4">
          {/* Compare Button - Show when expanded */}
          <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
            <ImagesComparingButton
              totalSelectedPhotos={selectedImageCount}
              isEnabled={isEnabled}
              onClick={() => {}}
              selectedPhotos={getSelectedPhotosForComparison}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolkitPanel;
