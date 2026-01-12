import React, { useState, useEffect, useCallback } from 'react';
import { ImageData } from '@/types';
import { ChevronLeft as PrevIcon, ChevronRight as NextIcon } from '@mui/icons-material';
import { imageCache } from '@/utils/imageCache';

interface ImageDisplayModalProps {
  isOpen: boolean;
  image: ImageData;
  onClose: () => void;
  currentImageIndex?: number;
  totalImages?: number;
  onPrevious?: () => void;
  onNext?: () => void;
}

const ImageDisplayModal: React.FC<ImageDisplayModalProps> = ({
  isOpen,
  image,
  onClose,
  currentImageIndex = -1,
  totalImages = 0,
  onPrevious,
  onNext,
}) => {
  // Cached image state: imageDownloadUrl -> base64 data URL
  const [cachedImageSrc, setCachedImageSrc] = useState<string>('');

  // Load cached base64 on mount
  useEffect(() => {
    const loadCachedImage = async () => {
      try {
        const base64 = await imageCache.get(image.imageDownloadUrl);
        if (base64) {
          // Convert base64 to data URL
          setCachedImageSrc(`data:${image.mimeType};base64,${base64}`);
        }
      } catch (error) {
        console.warn('[AssetCard] Failed to load cached image:', error);
      }
    };

    loadCachedImage();
  }, [image.imageDownloadUrl, image.mimeType]);

  const hasPrevious = currentImageIndex > 0;
  const hasNext = currentImageIndex >= 0 && currentImageIndex < totalImages - 1;

  const handlePrevious = useCallback(() => {
    if (hasPrevious) {
      onPrevious?.();
    }
  }, [hasPrevious, onPrevious]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      onNext?.();
    }
  }, [hasNext, onNext]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    },
    [isOpen, onClose, handlePrevious, handleNext]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'; // Prevent scrolling of the background
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !image) return null;

  return (
    <>
      <style>{`
        @keyframes floatLeft {
          0% {
            transform: translateX(0);
            opacity: 0.5;
          }
          50% {
            transform: translateX(-12px);
            opacity: 1;
          }
          100% {
            transform: translateX(0);
            opacity: 0.5;
          }
        }

        @keyframes floatRight {
          0% {
            transform: translateX(0);
            opacity: 0.5;
          }
          50% {
            transform: translateX(12px);
            opacity: 1;
          }
          100% {
            transform: translateX(0);
            opacity: 0.5;
          }
        }

        .prev-icon-animated {
          animation: floatLeft 2s infinite;
        }

        .next-icon-animated {
          animation: floatRight 2s infinite;
        }
      `}</style>

      <div
        className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-2 transition-opacity duration-300"
        onClick={onClose}
        aria-modal="true"
        role="dialog"
        aria-label="Image viewer"
        style={{ zIndex: 1300 }}
      >
        <div
          className="relative bg-white rounded-lg shadow-xl sm:p-3 lg:p-2 max-w-4xl w-full max-h-[95vh] flex flex-col bg-gray-100"
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal content
        >
          <div className="relative">
            {/* Image Container */}
            <div
              className="flex-1 flex items-center justify-center min-h-0 overflow-hidden"
              style={{ height: 'calc(95vh - 80px)' }}
            >
              {/* Previous Button */}
              <button
                onClick={handlePrevious}
                className="absolute -left-16 top-1/2 -translate-y-1/2 flex items-center justify-center focus:outline-none z-10"
                aria-label="Previous image"
                title="Previous image (← arrow key)"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  opacity: hasPrevious ? 1 : 0,
                }}
              >
                <PrevIcon
                  sx={{
                    fontSize: 48,
                    color: 'white',
                  }}
                  className="prev-icon-animated"
                />
              </button>

              <img
                src={cachedImageSrc || image.imageDownloadUrl}
                alt={image.name}
                className="max-w-full max-h-full object-contain"
              />

              {/* Next Button */}
              <button
                onClick={handleNext}
                className="absolute -right-16 top-1/2 -translate-y-1/2 flex items-center justify-center focus:outline-none z-10"
                aria-label="Next image"
                title="Next image (→ arrow key)"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  opacity: hasNext ? 1 : 0,
                }}
              >
                <NextIcon
                  sx={{
                    fontSize: 48,
                    color: 'white',
                  }}
                  className="next-icon-animated"
                />
              </button>
            </div>
          </div>

          {/* Image Name Footer */}
          <div className="border-t border-gray-300 pt-1 text-center">
            <p className="text-sm font-medium text-gray-700 truncate">{image.name}</p>
          </div>

          {/* Shortcut tooltip */}
          <div className="absolute left-0 -bottom-8 w-full text-center px-3 py-2 text-xs text-gray-200">
            <p>Press ⬅️ to view the Previous • ➡️ to view the Next • Esc to Close the modal</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ImageDisplayModal;
