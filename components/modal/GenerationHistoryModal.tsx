import React, { useEffect, useState } from 'react';
import { Modal, Button, Typography } from 'antd';
import { ArrowDownOutlined } from '@ant-design/icons';
import { devWarn } from '@/utils/devLogger';
import { ImageData } from '@/types';
import { imageCache } from '@/utils/imageCache';
import { formatTimestamp } from '@/utils/fileUtils';

interface GenerationHistoryModalProps {
  isOpen: boolean;
  image: ImageData;
  onClose: () => void;
}

const GenerationHistoryModal: React.FC<GenerationHistoryModalProps> = ({
  isOpen,
  image,
  onClose,
}) => {
  const [imageSources, setImageSources] = useState<Record<string, string>>({});

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
          devWarn('[GenerationHistoryModal] Failed to load current image from cache:', error);
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
                const mimeType = image.mimeType || 'image/jpeg';
                sources[operation.imageDownloadUrl] = `data:${mimeType};base64,${base64}`;
              }
            } catch (error) {
              devWarn('[GenerationHistoryModal] Failed to load source image from cache:', error);
            }
          }
        }
      }

      setImageSources(sources);
    };

    loadImages();
  }, [isOpen, image, hasEvolutionChain]);

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      title={
        <Typography.Title level={4} style={{ margin: 0 }}>
          {'Generation History'}
        </Typography.Title>
      }
      width="60vw"
      centered
      footer={[
        <Button key="close" onClick={onClose} type="primary">
          Close
        </Button>,
      ]}
      style={{ minWidth: '500px' }}
    >
      <div className="space-y-6">
        {hasEvolutionChain ? (
          <div className="space-y-3">
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
                    {/* Left Column - Target Image or Color (50%) */}
                    {operation.imageDownloadUrl ? (
                      <div className="md:w-[50%] p-4 bg-gray-100 flex items-center justify-center">
                        <div className="w-full max-w-[400px]">
                          <img
                            src={
                              imageSources[operation.imageDownloadUrl] || operation.imageDownloadUrl
                            }
                            alt="Target image"
                            className="w-full h-auto object-contain rounded-md border border-gray-200 bg-white"
                          />
                        </div>
                      </div>
                    ) : operation.options?.colorSnapshot?.hex ? (
                      <div className="md:w-[50%] p-4 bg-gray-100 flex items-center justify-center">
                        <div
                          className="w-full h-64 rounded-md border-2 border-gray-200 shadow-sm flex flex-col items-center justify-center text-white"
                          style={{ backgroundColor: operation.options.colorSnapshot.hex }}
                        >
                          <span className="text-sm font-bold drop-shadow-md">
                            {operation.options.colorSnapshot.name}
                          </span>
                          <span className="text-xs opacity-90 drop-shadow-md font-mono">
                            {operation.options.colorSnapshot.hex}
                          </span>
                        </div>
                      </div>
                    ) : operation.options?.colorSnapshot?.hex ? (
                      <div className="md:w-[50%] p-4 bg-gray-100 flex items-center justify-center">
                        <div
                          className="w-full h-64 rounded-md border-2 border-gray-200 shadow-sm"
                          style={{ backgroundColor: operation.options?.colorSnapshot?.hex }}
                        />
                      </div>
                    ) : null}

                    {/* Right Column - Details (50%) */}
                    <div
                      className={`${operation.imageDownloadUrl || operation.options?.colorSnapshot?.hex ? 'md:w-[50%]' : 'w-full'} p-4 space-y-3`}
                    >
                      {operation.customPrompt && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-600 mb-2">
                            Custom Prompt:
                          </div>
                          <div className="text-sm text-gray-800 italic bg-blue-50 px-3 py-2 rounded border-l-4 border-blue-400">
                            "{operation.customPrompt}"
                          </div>
                        </div>
                      )}

                      {((operation.options?.colorSnapshot && operation.imageDownloadUrl) ||
                        (operation.options?.textureSnapshot && !operation.customPrompt) ||
                        (operation.options?.itemSnapshot && !operation.customPrompt)) && (
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-gray-600 mb-2">Options:</div>
                          <div className="bg-white rounded p-3 space-y-2 border border-gray-200">
                            {operation.options?.colorSnapshot && operation.imageDownloadUrl && (
                              <div className="space-y-1">
                                <span className="text-xs text-gray-600">New Color:</span>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-6 h-6 rounded border-2 border-gray-200 shadow-sm flex-shrink-0"
                                    style={{ backgroundColor: operation.options.colorSnapshot.hex }}
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

                            {operation.options?.textureSnapshot && !operation.customPrompt && (
                              <div className="space-y-1">
                                <span className="text-xs text-gray-600">Add Texture:</span>
                                <div className="flex items-center gap-2">
                                  {operation.options.textureSnapshot.url ? (
                                    <img
                                      src={operation.options.textureSnapshot.url}
                                      alt={operation.options.textureSnapshot.name}
                                      className="w-8 h-8 object-cover rounded border border-gray-200"
                                    />
                                  ) : null}
                                  <span className="text-sm font-medium text-gray-800">
                                    {operation.options.textureSnapshot.name}
                                  </span>
                                </div>
                              </div>
                            )}

                            {operation.options?.itemSnapshot && !operation.customPrompt && (
                              <div className="space-y-1">
                                <div className="text-xs text-gray-600 mb-2">Add Object:</div>
                                <div className="flex items-center gap-2">
                                  {operation.options.itemSnapshot.url ? (
                                    <img
                                      src={operation.options.itemSnapshot.url}
                                      alt={operation.options.itemSnapshot.name}
                                      className="w-24 h-24 object-cover rounded border border-gray-200"
                                    />
                                  ) : null}
                                  <span className="text-sm font-medium text-gray-800">
                                    {operation.options.itemSnapshot.name}
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

                <div className="flex justify-center py-2">
                  <ArrowDownOutlined style={{ fontSize: 32, color: '#9ca3af' }} />
                </div>
              </React.Fragment>
            ))}

            {/* Current Image */}
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
                  {image.imageDownloadUrl ? (
                    <img
                      src={imageSources[image.imageDownloadUrl] || image.imageDownloadUrl}
                      alt={image.name}
                      className="w-full object-contain rounded-md border border-gray-200 bg-white"
                    />
                  ) : (
                    <div className="w-full h-24 flex items-center justify-center bg-gray-100 rounded border border-dashed text-gray-400">
                      No Image Available
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-6 text-center">
            <p className="text-sm text-gray-500 italic">This asset has no generation history.</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default GenerationHistoryModal;
