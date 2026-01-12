import React, { useState, useEffect, useCallback } from 'react';
import { ImageData } from '@/types';
import { imageCache } from '@/utils/imageCache';

interface ComparePhotosModalProps {
  isOpen: boolean;
  images: ImageData[];
  onClose: () => void;
}

const ImagesComparingModal: React.FC<ComparePhotosModalProps> = ({ isOpen, images, onClose }) => {
  // Cached image state: imageDownloadUrl -> base64 data URL
  const [cachedImagesSrc, setCachedImagesSrc] = useState<Record<string, string>>({});

  // Load cached base64 on mount
  useEffect(() => {
    const loadCachedImage = async () => {
      try {
        for (const image of images) {
          const base64 = await imageCache.get(image.imageDownloadUrl);
          if (base64) {
            // Convert base64 to data URL
            setCachedImagesSrc((prev) => ({
              ...prev,
              [image.imageDownloadUrl]: `data:${image.mimeType};base64,${base64}`,
            }));
          }
        }
      } catch (error) {
        console.warn('[AssetCard] Failed to load cached image:', error);
      }
    };

    loadCachedImage();
  }, [images]);

  // Handle Esc key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || images.length === 0) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-4 transition-opacity duration-300"
      onClick={onClose}
      style={{ zIndex: 1200 }}
    >
      <div
        className="relative bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Content - Grid Layout */}
        <div className="flex-1 overflow-scroll p-2">
          <div className="grid grid-cols-2 gap-3 h-full">
            {images.map((image) => (
              <div
                key={image.id}
                className="flex flex-col items-center rounded-lg overflow-hidden border border-gray-200 bg-gray-50"
              >
                {/* Image Container */}
                <div className="flex-1 w-full flex items-center justify-center min-h-0 overflow-visible">
                  <img
                    src={cachedImagesSrc[image.imageDownloadUrl] || image.imageDownloadUrl}
                    alt={image.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>

                {/* Image Info Footer */}
                <div className="w-full px-3 py-2 bg-white border-t border-gray-200 flex-shrink-0">
                  <p className="text-xs font-medium text-gray-700 truncate text-center">
                    {image.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImagesComparingModal;
