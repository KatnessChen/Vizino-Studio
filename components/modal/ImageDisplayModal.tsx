import React, { useState, useEffect, useCallback } from 'react';
import { ImageData } from '@/types';
import { imageCache } from '@/utils/imageCache';
import { formatTimestamp } from '@/utils';
import { getMetadata, ref as storageRef } from 'firebase/storage';
import { storage } from '@/services/firestoreService';
import { Button, Modal } from 'antd';
import { EditOutlined } from '@ant-design/icons';

interface ImageDisplayModalProps {
  isOpen: boolean;
  image: ImageData;
  onClose: () => void;
  currentImageIndex?: number;
  totalImages?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  renderPreview?: () => React.ReactNode;
  detailModalTitle?: string;
  onEdit?: () => void;
}

const ImageDisplayModal: React.FC<ImageDisplayModalProps> = ({
  isOpen,
  image,
  onClose,
  currentImageIndex = -1,
  totalImages = 0,
  onPrevious,
  onNext,
  renderPreview,
  detailModalTitle,
  onEdit,
}) => {
  const hasEvolutionChain = image.evolutionChain && image.evolutionChain.length > 0;
  const isColor = image.mimeType === 'color/hex';
  const colorHex: string | null = isColor ? (image as unknown as { hex: string }).hex : null;

  // State for technical details
  const [cachedImageSrc, setCachedImageSrc] = useState<string>('');
  const [fileSizeMB, setFileSizeMB] = useState<string | null>(null);

  // Helpers
  const bytesToMBString = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  const base64ToBytes = (b64: string) => {
    const padding = (b64.match(/=+$/) || [''])[0].length;
    return Math.round((b64.length * 3) / 4 - padding);
  };

  // Load cached base64 and determine file size on mount
  useEffect(() => {
    const loadCachedImage = async () => {
      try {
        const base64 = await imageCache.get(image.imageDownloadUrl);
        if (base64) {
          // Convert base64 to data URL
          setCachedImageSrc(`data:${image.mimeType};base64,${base64}`);
        }
      } catch (error) {
        console.warn('[ImageDisplayModal] Failed to load cached image:', error);
      }
    };

    const determineFileSize = async () => {
      try {
        if (!isOpen) return;

        // Colors don't have file size
        if (isColor) {
          setFileSizeMB(null);
          return;
        }

        // 1) Estimate size from dimensions
        if (typeof image.width === 'number' && typeof image.height === 'number') {
          const estimatedBytes = image.width * image.height * 3;
          setFileSizeMB(bytesToMBString(estimatedBytes));
          return;
        }

        // 2) Actual size from storage metadata
        if (image.storageFilePath) {
          const metadata = await getMetadata(storageRef(storage, image.storageFilePath));
          if (metadata && typeof metadata.size === 'number') {
            setFileSizeMB(bytesToMBString(metadata.size));
            return;
          }
        }

        // 3) Fallback from data URI
        if (image.imageDownloadUrl && image.imageDownloadUrl.startsWith('data:')) {
          const parts = image.imageDownloadUrl.split('base64,');
          if (parts.length === 2) {
            setFileSizeMB(bytesToMBString(base64ToBytes(parts[1])));
            return;
          }
        }

        setFileSizeMB(null);
      } catch (err) {
        console.warn('[ImageDisplayModal] Failed to determine file size:', err);
        setFileSizeMB(null);
      }
    };

    loadCachedImage();
    determineFileSize();
  }, [
    image.imageDownloadUrl,
    image.mimeType,
    isColor,
    isOpen,
    image.width,
    image.height,
    image.storageFilePath,
  ]);

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

  if (!image) return null;

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      title={detailModalTitle || 'Image Information'}
      footer={null}
      width="80vw"
      centered
      styles={{ body: { padding: 0 } }}
    >
      <div className="flex flex-col transition-all duration-300" style={{ maxHeight: '90vh' }}>
        <div className="relative flex flex-col md:flex-row gap-6 overflow-y-auto pr-2 custom-scrollbar">
          {/* Left: Preview Area */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div
              className="relative bg-gray-950 rounded-lg overflow-visible flex items-center justify-center border border-gray-200 shadow-inner group"
              style={{ height: renderPreview ? '450px' : '75vh' }}
            >
              {renderPreview ? (
                <div className="w-full h-full flex items-center justify-center bg-[#f8fafc] rounded-lg">
                  {renderPreview()}
                </div>
              ) : isColor && colorHex ? (
                <div
                  className="w-full h-full rounded-lg shadow-2xl"
                  style={{ backgroundColor: colorHex || undefined }}
                />
              ) : (
                <img
                  src={cachedImageSrc || image.imageDownloadUrl}
                  alt={image.name}
                  className="max-w-full max-h-full object-contain shadow-2xl transition-transform duration-500"
                />
              )}
            </div>
          </div>

          {/* Right: Metadata Area */}
          <div className="md:w-80 flex-shrink-0">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
                <h4 className="text-base font-bold text-gray-900 m-0">Details</h4>
                {onEdit && (
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={onEdit}>
                    Edit
                  </Button>
                )}
              </div>
              <div className="space-y-4">
                {/* Name */}
                <div className="flex justify-between pb-1">
                  <span className="text-sm font-medium text-gray-500">
                    {isColor ? 'Color Name' : 'Name'}
                  </span>
                  <span
                    className="text-sm text-gray-700 max-w-[180px] text-right"
                    title={image.name}
                  >
                    {image.name}
                  </span>
                </div>

                {/* Hex Value (for colors) */}
                {isColor && colorHex && (
                  <div className="flex justify-between items-center pb-1">
                    <span className="text-sm font-medium text-gray-500">Hex Value</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-sm border border-gray-300 shadow-sm"
                        style={{ backgroundColor: colorHex || undefined }}
                      />
                      <span className="text-xs font-bold text-gray-700 font-mono">
                        {colorHex?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}

                {/* File Type */}
                {!isColor && (
                  <div className="flex justify-between items-center pb-1">
                    <span className="text-sm font-medium text-gray-500">File Type</span>
                    <span className="text-sm text-gray-700">{image.mimeType || '-'}</span>
                  </div>
                )}

                {/* Dimensions */}
                {!isColor && (
                  <div className="flex justify-between items-center pb-1">
                    <span className="text-sm font-medium text-gray-500">Dimensions</span>
                    <span className="text-sm text-gray-700">
                      {image.width && image.height ? `${image.width} × ${image.height} px` : '-'}
                    </span>
                  </div>
                )}

                {/* File Size */}
                {!isColor && (
                  <div className="flex justify-between items-center pb-1">
                    <span className="text-sm font-medium text-gray-500">File Size</span>
                    <span className="text-sm text-gray-700">{fileSizeMB ?? '-'}</span>
                  </div>
                )}

                {/* Description */}
                {image.description && (
                  <div className="flex justify-between items-start pb-1">
                    <span className="text-sm font-medium text-gray-500">Description</span>
                    <span className="text-sm text-gray-700 text-right max-w-[180px] break-words italic">
                      {image.description}
                    </span>
                  </div>
                )}

                {/* Timestamps */}
                <div className="flex justify-between items-center pb-1">
                  <span className="text-sm font-medium text-gray-500">
                    {hasEvolutionChain ? 'Generated Time' : 'Created Time'}
                  </span>
                  <span className="text-sm text-gray-700">
                    {image.createdAt ? formatTimestamp(image.createdAt) : '-'}
                  </span>
                </div>
                {image.updatedAt && image.updatedAt !== image.createdAt && (
                  <div className="flex justify-between items-center pb-1">
                    <span className="text-sm font-medium text-gray-500">Last Updated</span>
                    <span className="text-sm text-gray-700">
                      {formatTimestamp(image.updatedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {totalImages > 1 && (
          <div className="absolute left-1/2 -bottom-8 -translate-x-1/2 flex items-center justify-center z-20 pointer-events-none">
            <p className="text-sm font-medium text-white tracking-wide">
              Press <span className="text-indigo-300">⬅️</span> to view Previous •{' '}
              <span className="text-indigo-300">➡️</span> for Next •{' '}
              <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">Esc</span> to Close
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ImageDisplayModal;
