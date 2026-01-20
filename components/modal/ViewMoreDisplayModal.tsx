import React, { useEffect, useState } from 'react';
import { Modal, Button, Typography } from 'antd';
import { ArrowDownward as ArrowDownwardIcon } from '@mui/icons-material';
import { ImageData } from '@/types';
import { imageCache, formatTimestamp } from '@/utils';
import { getMetadata, ref as storageRef } from 'firebase/storage';
import { storage } from '@/services/firestoreService';

interface ViewMoreDisplayModalProps {
  isOpen: boolean;
  image: ImageData;
  onClose: () => void;
}

const ViewMoreDisplayModal: React.FC<ViewMoreDisplayModalProps> = ({ isOpen, image, onClose }) => {
  const [imageSources, setImageSources] = useState<Record<string, string>>({});
  const [fileSizeMB, setFileSizeMB] = useState<string | null>(null);

  const hasEvolutionChain = image.evolutionChain && image.evolutionChain.length > 0;

  useEffect(() => {
    if (!isOpen) return;

    const loadImages = async () => {
      const sources: Record<string, string> = {};

      // Load current image
      if (image.imageDownloadUrl) {
        try {
          const base64 = await imageCache.get(image.imageDownloadUrl);
          if (base64) {
            sources[image.imageDownloadUrl] = `data:${image.mimeType};base64,${base64}`;
          }
        } catch (error) {
          console.warn('[ViewMoreDisplayModal] Failed to load current image from cache:', error);
        }
      }

      // Load sources images from evolution chain
      if (hasEvolutionChain) {
        for (const operation of image.evolutionChain) {
          if (operation.imageDownloadUrl && !sources[operation.imageDownloadUrl]) {
            try {
              const base64 = await imageCache.get(operation.imageDownloadUrl);
              if (base64) {
                // Use operation's mimeType if available, fallback to image.mimeType, then default to image/jpeg
                const mimeType = (operation as any).mimeType || image.mimeType || 'image/jpeg';
                sources[operation.imageDownloadUrl] = `data:${mimeType};base64,${base64}`;
              }
            } catch (error) {
              console.warn('[ViewMoreDisplayModal] Failed to load source image from cache:', error);
            }
          }
        }
      }

      setImageSources(sources);

      // Determine file size (MB)
      try {
        // 1) If dimensions are present, estimate size using 3 bytes per pixel (RGB)
        if (typeof image.width === 'number' && typeof image.height === 'number') {
          const estimatedBytes = image.width * image.height * 3; // rough RGB estimate
          setFileSizeMB(bytesToMBString(estimatedBytes));
          return;
        }

        // 2) Prefer storageFilePath if available (actual size)
        if (image.storageFilePath) {
          const metadata = await getMetadata(storageRef(storage, image.storageFilePath));
          if (metadata && typeof metadata.size === 'number') {
            setFileSizeMB(bytesToMBString(metadata.size));
            return;
          }
        }

        // 3) Fallback: if imageDownloadUrl is data URI, compute from base64
        if (image.imageDownloadUrl && image.imageDownloadUrl.startsWith('data:')) {
          const parts = image.imageDownloadUrl.split('base64,');
          if (parts.length === 2) {
            const base64Str = parts[1];
            const bytes = base64ToBytes(base64Str);
            setFileSizeMB(bytesToMBString(bytes));
            return;
          }
        }

        // Unknown size
        setFileSizeMB(null);
      } catch (err) {
        console.warn('[ViewMoreDisplayModal] Failed to determine file size:', err);
        setFileSizeMB(null);
      }
    };

    loadImages();
  }, [isOpen, image, hasEvolutionChain]);

  // Helpers
  const bytesToMBString = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  const base64ToBytes = (b64: string) => {
    const padding = (b64.match(/=+$/) || [''])[0].length;
    return Math.round((b64.length * 3) / 4 - padding);
  };

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      title={
        <Typography.Title level={4} style={{ margin: 0 }}>
          Image Information
        </Typography.Title>
      }
      width={800}
      centered
      footer={[
        <Button key="close" onClick={onClose} type="primary">
          Close
        </Button>,
      ]}
    >
      {/* Content */}
      <div className="space-y-6">
        {/* Section A: Basic Image Information */}
        <div className="space-y-3 mt-6">
          <div className="space-y-2">
            {/* Image Name */}
            <div className="flex items-start">
              <span className="text-sm font-medium text-gray-600 w-32 flex-shrink-0">
                Image Name:
              </span>
              <span className="text-sm text-gray-800">{image.name}</span>
            </div>

            {/* File Type */}
            <div className="flex items-start">
              <span className="text-sm font-medium text-gray-600 w-32 flex-shrink-0">
                File Type:
              </span>
              <span className="text-sm text-gray-800">{image.mimeType || '-'}</span>
            </div>

            {/* Dimensions */}
            <div className="flex items-start">
              <span className="text-sm font-medium text-gray-600 w-32 flex-shrink-0">
                Dimensions:
              </span>
              <span className="text-sm text-gray-800">
                {image.width && image.height ? `W${image.width} × H${image.height} pixels` : '-'}
              </span>
            </div>

            {/* File Size */}
            <div className="flex items-start">
              <span className="text-sm font-medium text-gray-600 w-32 flex-shrink-0">
                File Size:
              </span>
              <span className="text-sm text-gray-800">{fileSizeMB ?? '-'}</span>
            </div>

            {/* Description */}
            {image.description && (
              <div className="flex items-start">
                <span className="text-sm font-medium text-gray-600 w-32 flex-shrink-0">
                  Description:
                </span>
                <span className="text-sm text-gray-800">{image.description}</span>
              </div>
            )}

            {/* Created/Generation Time */}
            <div className="flex items-start">
              <span className="text-sm font-medium text-gray-600 w-32 flex-shrink-0">
                {hasEvolutionChain ? 'Generation Time:' : 'Created Time:'}
              </span>
              <span className="text-sm text-gray-800">{formatTimestamp(image.createdAt)}</span>
            </div>

            {/* Update Time */}
            {image.updatedAt && image.updatedAt !== image.createdAt && (
              <div className="flex items-start">
                <span className="text-sm font-medium text-gray-600 w-32 flex-shrink-0">
                  Last Updated:
                </span>
                <span className="text-sm text-gray-800">{formatTimestamp(image.updatedAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Section B: Evolution Chain */}
        {hasEvolutionChain && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
              Generation History
            </h3>

            {image.evolutionChain.map((operation, index) => (
              <React.Fragment key={index}>
                <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h4 className="text-sm font-semibold text-gray-700">
                        Generation {index + 1}:
                      </h4>
                    </div>
                    {operation.timestamp && (
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(operation.timestamp)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col md:flex-row">
                    {/* Left Column - Target Image (60%) */}
                    {operation.imageDownloadUrl && (
                      <div className="md:w-[60%] p-4 bg-gray-100">
                        <div className="space-y-2">
                          <img
                            src={
                              imageSources[operation.imageDownloadUrl] || operation.imageDownloadUrl
                            }
                            alt="Target image"
                            className="w-full object-contain rounded-md border border-gray-200 bg-white"
                          />
                        </div>
                      </div>
                    )}

                    {/* Right Column - Details (40%) */}
                    <div
                      className={`${
                        operation.imageDownloadUrl ? 'md:w-[40%]' : 'w-full'
                      } p-4 space-y-3`}
                    >
                      {/* 1. Custom Prompt */}
                      {operation.customPrompt && (
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-gray-600">Custom Prompt:</span>
                          <div className="text-sm text-gray-800 italic bg-blue-50 px-3 py-2 rounded border-l-4 border-blue-400">
                            "{operation.customPrompt}"
                          </div>
                        </div>
                      )}

                      {/* 2. Options */}
                      {operation.options && (
                        <div className="space-y-2">
                          <span className="text-xs font-medium text-gray-600">Options:</span>
                          <div className="bg-white rounded p-3 space-y-2 border border-gray-200">
                            {/* Color Option */}
                            {operation.options.colorSnapshot && (
                              <div className="space-y-1">
                                <span className="text-xs text-gray-600">New Color:</span>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-6 h-6 rounded border-2 border-gray-200 shadow-sm flex-shrink-0"
                                    style={{
                                      backgroundColor: operation.options.colorSnapshot.hex,
                                    }}
                                  />
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-medium text-gray-800 truncate">
                                      {operation.options.colorSnapshot.name}
                                    </span>
                                    <span className="text-xs text-gray-500 font-mono">
                                      {operation.options.colorSnapshot.hex}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Texture Option */}
                            {operation.options.textureSnapshot && (
                              <div className="space-y-1">
                                <span className="text-xs text-gray-600">Texture:</span>
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-gray-800">
                                    {operation.options.textureSnapshot.name}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Arrow between generations and current image */}
                <div className="flex justify-center py-2">
                  <ArrowDownwardIcon sx={{ fontSize: 32, color: '#9ca3af' }} />
                </div>
              </React.Fragment>
            ))}

            {/* Section C: Current Image */}
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                <div className="flex justify-between items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700">
                    Generation {image.evolutionChain.length + 1} (Current Image)
                  </h4>
                  {image.createdAt && (
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(image.createdAt)}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <img
                    src={imageSources[image.imageDownloadUrl] || image.imageDownloadUrl}
                    alt={image.name}
                    className="w-full object-contain rounded-md border border-gray-200 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Evolution Chain Message */}
        {!hasEvolutionChain && (
          <div className="bg-gray-50 rounded-lg p-6 text-center">
            <p className="text-sm text-gray-500 italic">
              This is an original image with no processing history.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ViewMoreDisplayModal;
