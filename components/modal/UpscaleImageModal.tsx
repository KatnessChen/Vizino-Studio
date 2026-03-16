import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal, Button, Typography, Segmented, Alert, Progress } from 'antd';
import { ArrowUpOutlined, StopOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { ImageData } from '@/types';
import {
  ImageResolution,
  RESOLUTION_4K,
  RESOLUTION_8K,
  RESOLUTION_PIXELS,
  getUpscaleFactor,
} from '@/constants/constants';
import VPointsIcon from '@/components/icons/VPointsIcon';
import { devError } from '@/utils/devLogger';

const { Text, Title } = Typography;

export interface UpscaleImageModalProps {
  isOpen: boolean;
  image: ImageData | null;
  onConfirm: (targetResolution: ImageResolution) => Promise<void>;
  onCancel: () => void;
  isUpscaling?: boolean;
  upscaleProgress?: number;
  errorMessage?: string | null;
  hasEnabledOwnKey?: boolean;
}

const UpscaleImageModal: React.FC<UpscaleImageModalProps> = ({
  isOpen,
  image,
  onConfirm,
  onCancel,
  isUpscaling = false,
  upscaleProgress = 0,
  errorMessage = null,
  hasEnabledOwnKey = false,
}) => {
  const [selectedResolution, setSelectedResolution] = useState<ImageResolution>(RESOLUTION_4K);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedResolution(RESOLUTION_4K);
    }
  }, [isOpen]);

  // Calculate upscaling details
  const upscaleDetails = useMemo(() => {
    if (!image) return null;

    const currentResolution = image.currentResolution || '2K';
    const targetPixels = RESOLUTION_PIXELS[selectedResolution];
    const upscaleFactor = getUpscaleFactor(selectedResolution);

    return {
      currentResolution,
      targetResolution: selectedResolution,
      currentPixels: RESOLUTION_PIXELS[currentResolution as ImageResolution] || 2048,
      targetPixels,
      upscaleFactor,
    };
  }, [image, selectedResolution]);

  // Calculate credit cost for upscaling
  const creditCost = useMemo(() => {
    if (!upscaleDetails) return 0;

    // Upscaling cost is based on the scale factor
    // 4K (2x) = 4 credits, 8K (4x) = 8 credits
    const baseCost = upscaleDetails.upscaleFactor === 2 ? 4 : 8;
    return baseCost;
  }, [upscaleDetails]);

  // Handle upscale confirmation
  const handleConfirm = useCallback(async () => {
    if (!image || !upscaleDetails) return;

    try {
      await onConfirm(selectedResolution);
    } catch (error) {
      devError('Failed to start upscaling:', error);
    }
  }, [image, selectedResolution, upscaleDetails, onConfirm]);

  // Cannot upscale if image is already at target resolution or higher
  const canUpscale = useMemo(() => {
    if (!image || !upscaleDetails) return false;

    const currentPixels = upscaleDetails.currentPixels;
    const targetPixels = upscaleDetails.targetPixels;

    return targetPixels > currentPixels;
  }, [image, upscaleDetails]);

  if (!image) return null;

  const isProcessing = isUpscaling;
  const showProgress = isProcessing && upscaleProgress > 0;

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <ArrowUpOutlined className="text-blue-500" />
          <Title level={4} className="m-0">
            Scale Up Image
          </Title>
        </div>
      }
      open={isOpen}
      onCancel={onCancel}
      width={600}
      maskClosable={!isProcessing}
      keyboard={!isProcessing}
      footer={
        <div className="flex items-center justify-between">
          <Button
            onClick={onCancel}
            disabled={isProcessing}
            icon={isProcessing ? <StopOutlined /> : undefined}
          >
            {isProcessing ? 'Cancel' : 'Close'}
          </Button>
          <div className="flex items-center gap-3">
            {!hasEnabledOwnKey && upscaleDetails && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <span>Cost:</span>
                <div className="flex items-center bg-blue-50 px-2 py-1 rounded font-medium">
                  {creditCost}
                  <VPointsIcon size={16} className="ml-1" />
                </div>
              </div>
            )}
            <Button
              type="primary"
              onClick={handleConfirm}
              disabled={!canUpscale || isProcessing}
              loading={isProcessing}
              icon={!isProcessing ? <ArrowUpOutlined /> : undefined}
            >
              {isProcessing ? 'Upscaling...' : 'Scale Up'}
            </Button>
          </div>
        </div>
      }
    >
      {/* Error Message */}
      {errorMessage && <Alert type="error" message={errorMessage} showIcon className="mb-4" />}

      {/* Current Image Info */}
      <div className="mb-6">
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
            <img
              src={image.imageDownloadUrl}
              alt={image.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
              }}
            />
            <div className="hidden text-gray-400 text-xs">Image</div>
          </div>
          <div className="flex-1">
            <Text strong className="text-base">
              {image.name}
            </Text>
            <div className="text-sm text-gray-600 mt-1">
              Current: <span className="font-medium">{image.currentResolution || '2K'}</span>
              {upscaleDetails && (
                <>
                  {' • '}
                  {upscaleDetails.currentPixels.toLocaleString()}px
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Resolution Selection */}
      <div className="mb-6">
        <div className="mb-3">
          <Text strong>Select Target Resolution:</Text>
        </div>
        <Segmented<ImageResolution>
          value={selectedResolution}
          onChange={setSelectedResolution}
          disabled={isProcessing}
          size="large"
          className="w-full"
          options={[
            {
              label: (
                <div className="text-center py-2">
                  <div className="font-medium">4K</div>
                  <div className="text-xs text-gray-500">4096px • 2x scale</div>
                </div>
              ),
              value: RESOLUTION_4K,
            },
            {
              label: (
                <div className="text-center py-2">
                  <div className="font-medium">8K</div>
                  <div className="text-xs text-gray-500">8192px • 4x scale</div>
                </div>
              ),
              value: RESOLUTION_8K,
            },
          ]}
        />
      </div>

      {/* Upscale Details */}
      {upscaleDetails && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <Text>Scale Factor:</Text>
            <Text strong>{upscaleDetails.upscaleFactor}x</Text>
          </div>
          <div className="flex items-center justify-between mb-2">
            <Text>Output Size:</Text>
            <Text strong>{upscaleDetails.targetPixels.toLocaleString()}px</Text>
          </div>
          {!hasEnabledOwnKey && (
            <div className="flex items-center justify-between">
              <Text>V Points Cost:</Text>
              <div className="flex items-center gap-1">
                <Text strong>{creditCost}</Text>
                <VPointsIcon size={16} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upscaling Progress */}
      {showProgress && (
        <div className="mb-4 p-4 bg-green-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpOutlined className="text-green-600 animate-pulse" />
            <Text strong className="text-green-800">
              Upscaling to {selectedResolution}...
            </Text>
          </div>
          <Progress percent={upscaleProgress} status="active" />
          <Text className="text-sm text-gray-600 mt-1">
            Please wait, this may take 1-2 minutes.
          </Text>
        </div>
      )}

      {/* Cannot Upscale Warning */}
      {!canUpscale && upscaleDetails && (
        <Alert
          type="warning"
          message="Cannot Upscale"
          description={`This image is already at ${upscaleDetails.currentResolution} resolution or higher. Only images at 2K resolution can be upscaled.`}
          showIcon
          icon={<ExclamationCircleOutlined />}
        />
      )}

      {/* Info */}
      {canUpscale && (
        <Alert
          type="info"
          message="Upscaling uses AI enhancement to increase image resolution while maintaining quality."
          showIcon
          className="mt-4"
        />
      )}
    </Modal>
  );
};

export default UpscaleImageModal;
