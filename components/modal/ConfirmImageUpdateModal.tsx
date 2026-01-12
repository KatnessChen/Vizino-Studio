import { useState, useEffect, useMemo } from 'react';
import { ImageData } from '@/types';
import { imageCache } from '@/utils/imageCache';
import { Modal, Button, Input, Checkbox, Typography } from 'antd';
import { GeminiTaskName, GEMINI_TASKS } from '@/services/gemini/geminiTasks';
import { getFileExtension } from '@/utils/downloadUtils';
import { removeExtension, generateTimestamp } from '@/utils/fileNameUtils';

const MAX_IMAGE_NAME_LENGTH = 50;

interface ConfirmImageUpdateModalProps {
  isOpen: boolean;
  originalImage: ImageData;
  generatedImage: { base64: string; mimeType: string } | null;
  onConfirm: (imageData: { base64: string; mimeType: string }, customName: string) => void;
  onCancel: () => void;
  taskName: GeminiTaskName;
  colorName?: string;
  textureName?: string;
  itemName?: string;
}

const ConfirmImageUpdateModal: React.FC<ConfirmImageUpdateModalProps> = ({
  isOpen,
  originalImage,
  generatedImage,
  onConfirm,
  onCancel,
  taskName,
  colorName,
  textureName,
  itemName,
}) => {
  // Cached image state for original image
  const [cachedImageSrc, setCachedImageSrc] = useState<string | null>(null);

  // Image naming states
  const [baseName, setBaseName] = useState<string>('');
  const [prefixTimestamp, setPrefixTimestamp] = useState<boolean>(false);
  const [suffixMimeType, setSuffixMimeType] = useState<boolean>(false);
  const [suffixColorName, setSuffixColorName] = useState<boolean>(false);
  const [suffixTextureName, setSuffixTextureName] = useState<boolean>(false);
  const [suffixItemName, setSuffixItemName] = useState<boolean>(false);
  const [suffixTimestamp, setSuffixTimestamp] = useState<boolean>(false);
  const [nameError, setNameError] = useState<string>('');

  // Initialize base name (remove extension from original image name)
  useEffect(() => {
    setBaseName(removeExtension(originalImage.name));
  }, [originalImage.name]);

  // Load cached base64 on mount
  useEffect(() => {
    const loadCachedImage = async () => {
      try {
        const base64 = await imageCache.get(originalImage.imageDownloadUrl);
        if (base64) {
          // Convert base64 to data URL
          setCachedImageSrc(`data:${originalImage.mimeType};base64,${base64}`);
        }
      } catch (error) {
        console.warn('[AssetCard] Failed to load cached image:', error);
      }
    };

    loadCachedImage();
  }, [originalImage.imageDownloadUrl, originalImage.mimeType]);

  // Generate final name based on checkbox options
  const finalName = useMemo(() => {
    let name = baseName.trim();

    // Prefix timestamp
    if (prefixTimestamp) {
      const timestamp = generateTimestamp();
      name = `${timestamp}_${name}`;
    }

    // Suffix color name
    if (suffixColorName && colorName) {
      name = `${name}_${colorName}`;
    }

    // Suffix texture name
    if (suffixTextureName && textureName) {
      name = `${name}_${textureName}`;
    }

    if (suffixItemName && itemName) {
      name = `${name}_${itemName}`;
    }

    if (suffixTimestamp) {
      // Suffix timestamp
      const timestamp = generateTimestamp();
      name = `${name}_${timestamp}`;
    }

    // Suffix mime type extension
    if (suffixMimeType && generatedImage) {
      const extension = getFileExtension(generatedImage.mimeType);
      name = `${name}${extension}`;
    }

    return name;
  }, [
    baseName,
    prefixTimestamp,
    suffixMimeType,
    suffixColorName,
    suffixTextureName,
    suffixItemName,
    suffixTimestamp,
    colorName,
    textureName,
    itemName,
    generatedImage,
  ]);

  // Validate name and update error
  useEffect(() => {
    const trimmedBase = baseName.trim();

    if (trimmedBase === '') {
      setNameError('Image name cannot be empty');
    } else if (finalName.length > MAX_IMAGE_NAME_LENGTH) {
      setNameError(
        `Name is too long (${finalName.length}/${MAX_IMAGE_NAME_LENGTH} characters). Please shorten the base name.`
      );
    } else {
      setNameError('');
    }
  }, [baseName, finalName]);

  // Handle confirm
  const handleConfirm = () => {
    if (nameError || !generatedImage) return;
    onConfirm(generatedImage, finalName);
  };

  const getModalDescription = () => {
    if (taskName === GEMINI_TASKS.RECOLOR_WALL.task_name && colorName) {
      return (
        <>
          The walls have been recolored to <strong>{colorName}</strong>.
        </>
      );
    } else if (taskName === GEMINI_TASKS.ADD_TEXTURE.task_name && textureName) {
      return (
        <>
          The <strong>{textureName}</strong> texture has been applied to the walls.
        </>
      );
    }
    return 'The image has been processed.';
  };

  if (!generatedImage || !originalImage) return null;

  return (
    <Modal
      title={
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Is this result satisfactory?
          </Typography.Title>
          <Typography.Text type="secondary">{getModalDescription()}</Typography.Text>
        </div>
      }
      open={isOpen}
      onCancel={onCancel}
      width="90vw"
      style={{ top: 20, maxWidth: 1600 }}
      zIndex={1500}
      footer={[
        <Button key="cancel" onClick={onCancel} size="large">
          No, refine
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={handleConfirm}
          disabled={!!nameError}
          size="large"
        >
          Yes, save
        </Button>,
      ]}
    >
      {/* Image Comparison Section */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
        {/* Original Image */}
        <div
          style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', minHeight: 400 }}
        >
          <Typography.Title level={5} style={{ marginBottom: 12 }}>
            Original Image
          </Typography.Title>
          <div
            style={{
              flex: 1,
              backgroundColor: '#f0f0f0',
              borderRadius: 8,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={cachedImageSrc || originalImage.imageDownloadUrl}
              alt="Original"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </div>
        </div>

        {/* Recolored Image */}
        <div
          style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', minHeight: 400 }}
        >
          <Typography.Title level={5} style={{ marginBottom: 12 }}>
            Generated Image
          </Typography.Title>
          <div
            style={{
              flex: 1,
              backgroundColor: '#f0f0f0',
              borderRadius: 8,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={`data:${generatedImage.mimeType};base64,${generatedImage.base64}`}
              alt="Generated Image"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </div>
        </div>
      </div>

      {/* Image Naming Section */}
      <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: 16 }}>
        <Typography.Title level={5} style={{ marginBottom: 12 }}>
          Customize Image Name
        </Typography.Title>

        {/* Base Name Input */}
        <div style={{ marginBottom: 16 }}>
          <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
            Base Name
          </Typography.Text>
          <Input
            value={baseName}
            onChange={(e) => setBaseName(e.target.value)}
            maxLength={MAX_IMAGE_NAME_LENGTH}
            placeholder="Enter image name"
            status={nameError ? 'error' : ''}
          />
          {nameError && (
            <Typography.Text type="danger" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              {nameError}
            </Typography.Text>
          )}
        </div>

        {/* Checkbox Options */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Checkbox
            checked={prefixTimestamp}
            onChange={(e) => setPrefixTimestamp(e.target.checked)}
          >
            Prefix with timestamp
          </Checkbox>
          <Checkbox
            checked={suffixTimestamp}
            onChange={(e) => setSuffixTimestamp(e.target.checked)}
          >
            Suffix with timestamp
          </Checkbox>
          <Checkbox checked={suffixMimeType} onChange={(e) => setSuffixMimeType(e.target.checked)}>
            Suffix with file extension
          </Checkbox>
          {taskName === GEMINI_TASKS.RECOLOR_WALL.task_name && colorName && (
            <Checkbox
              checked={suffixColorName}
              onChange={(e) => setSuffixColorName(e.target.checked)}
            >
              Suffix with color name
            </Checkbox>
          )}
          {taskName === GEMINI_TASKS.ADD_TEXTURE.task_name && textureName && (
            <Checkbox
              checked={suffixTextureName}
              onChange={(e) => setSuffixTextureName(e.target.checked)}
            >
              Suffix with texture name
            </Checkbox>
          )}
          {taskName === GEMINI_TASKS.ADD_HOME_ITEM.task_name && itemName && (
            <Checkbox
              checked={suffixItemName}
              onChange={(e) => setSuffixItemName(e.target.checked)}
            >
              Suffix with texture name
            </Checkbox>
          )}
        </div>

        {/* Final Name Preview */}
        <div
          style={{
            backgroundColor: '#fafafa',
            borderRadius: 4,
            padding: 12,
            border: '1px solid #e8e8e8',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Typography.Text strong>Final Name Preview:</Typography.Text>
            <Typography.Text
              type={finalName.length > MAX_IMAGE_NAME_LENGTH ? 'danger' : 'secondary'}
              style={{ fontSize: 12 }}
            >
              {finalName.length} / {MAX_IMAGE_NAME_LENGTH} characters
            </Typography.Text>
          </div>
          <Typography.Text
            code
            style={{
              display: 'block',
              wordBreak: 'break-all',
              color: nameError ? '#ff4d4f' : undefined,
            }}
          >
            {finalName || '(empty)'}
          </Typography.Text>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmImageUpdateModal;
