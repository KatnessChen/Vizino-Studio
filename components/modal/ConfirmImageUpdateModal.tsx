import { useState, useEffect, useMemo } from 'react';
import { ImageData } from '@/types';
import { imageCache } from '@/utils/imageCache';
import { Modal, Button, Typography } from 'antd';
import { GeminiTaskName } from '@/services/gemini/geminiTasks';
import { getFileExtension } from '@/utils/downloadUtils';
import { removeExtension, generateTimestamp } from '@/utils/fileNameUtils';
import CustomizeImageNameForm from '@/components/form/CustomizeImageNameForm';

const MAX_IMAGE_NAME_LENGTH = 50;

interface ConfirmImageUpdateModalProps {
  isOpen: boolean;
  originalImage: ImageData;
  generatedImage: { base64: string; mimeType: string; hex?: string; name?: string } | null;
  onConfirm: (
    imageData: { base64: string; mimeType: string; hex?: string },
    customName: string,
    description: string
  ) => void;
  onCancel: () => void;
  taskName: GeminiTaskName;
  colorName?: string;
  textureName?: string;
  itemName?: string;
  originalHex?: string;
  defaultDescription?: string;
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
  originalHex,
  defaultDescription = '',
}) => {
  const isColorMode = taskName === 'color_adjustment' || !!originalHex;
  // Cached image state for original image
  const [cachedImageSrc, setCachedImageSrc] = useState<string | null>(null);

  // Description state
  const [description, setDescription] = useState<string>(defaultDescription);

  // Update description when defaultDescription changes (e.g. re-open)
  useEffect(() => {
    if (isOpen) {
      setDescription(defaultDescription);
    }
  }, [defaultDescription, isOpen]);

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
  // Initialize base name
  useEffect(() => {
    if (generatedImage?.name) {
      setBaseName(generatedImage.name);
    } else {
      setBaseName(removeExtension(originalImage.name));
    }
  }, [originalImage.name, generatedImage]);

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
    onConfirm(generatedImage, finalName, description);
  };

  if (!generatedImage || !originalImage) return null;

  return (
    <Modal
      title={
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Generation Review
          </Typography.Title>
        </div>
      }
      open={isOpen}
      onCancel={onCancel}
      width={isColorMode ? 800 : '90vw'}
      style={isColorMode ? {} : { top: 20, maxWidth: 1600 }}
      zIndex={1500}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Refine
        </Button>,
        <Button key="confirm" type="primary" onClick={handleConfirm} disabled={!!nameError}>
          Save
        </Button>,
      ]}
    >
      {/* Image Comparison Section */}
      <div
        style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}
        data-tour="result-preview"
      >
        {/* Original Image/Color */}
        <div
          style={{
            flex: '1 1 300px',
            display: 'flex',
            flexDirection: 'column',
            minHeight: isColorMode ? 300 : 400,
          }}
        >
          <Typography.Title level={5} style={{ marginBottom: 12 }}>
            {isColorMode ? 'Original Color' : 'Original Image'}
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
              position: 'relative',
            }}
          >
            {originalHex ? (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: originalHex,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    marginTop: 'auto',
                    marginBottom: 16,
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    padding: '8px 16px',
                    borderRadius: 20,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <Typography.Title level={4} copyable style={{ margin: 0 }}>
                    {originalHex.toUpperCase()}
                  </Typography.Title>
                  {colorName && (
                    <Typography.Text
                      style={{ fontSize: 13, color: '#666', fontWeight: 500, marginTop: 4 }}
                    >
                      {colorName}
                    </Typography.Text>
                  )}
                </div>
              </div>
            ) : (
              <img
                src={cachedImageSrc || originalImage.imageDownloadUrl}
                alt="Original"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            )}
          </div>
        </div>

        {/* Generated Image/Color */}
        <div
          style={{
            flex: '1 1 300px',
            display: 'flex',
            flexDirection: 'column',
            minHeight: isColorMode ? 300 : 400,
          }}
        >
          <Typography.Title level={5} style={{ marginBottom: 12 }}>
            {isColorMode ? 'Generated Color' : 'Generated Image'}
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
              position: 'relative',
            }}
          >
            {generatedImage.hex ? (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: generatedImage.hex,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    marginTop: 'auto',
                    marginBottom: 16,
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    padding: '8px 16px',
                    borderRadius: 20,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Typography.Title level={4} copyable style={{ margin: 0 }}>
                    {generatedImage.hex.toUpperCase()}
                  </Typography.Title>
                  {generatedImage.name && (
                    <Typography.Text style={{ fontSize: 13, color: '#666', fontWeight: 500 }}>
                      {generatedImage.name}
                    </Typography.Text>
                  )}
                </div>
              </div>
            ) : (
              <img
                src={`data:${generatedImage.mimeType};base64,${generatedImage.base64}`}
                alt="Generated Image"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            )}
          </div>
        </div>
      </div>
      {/* Image Naming Section */}
      <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: 16 }}>
        <CustomizeImageNameForm
          baseName={baseName}
          onBaseNameChange={setBaseName}
          prefixTimestamp={prefixTimestamp}
          onPrefixTimestampChange={setPrefixTimestamp}
          suffixTimestamp={suffixTimestamp}
          onSuffixTimestampChange={setSuffixTimestamp}
          suffixMimeType={isColorMode ? false : suffixMimeType}
          // Force hide mismatch if needed, or pass prop to hide
          onSuffixMimeTypeChange={setSuffixMimeType}
          hideSuffixMimeType={isColorMode}
          finalName={finalName}
          nameError={nameError}
          taskName={taskName}
          colorName={colorName}
          textureName={textureName}
          itemName={itemName}
          suffixColorName={suffixColorName}
          onSuffixColorNameChange={setSuffixColorName}
          suffixTextureName={suffixTextureName}
          onSuffixTextureNameChange={setSuffixTextureName}
          suffixItemName={suffixItemName}
          onSuffixItemNameChange={setSuffixItemName}
          description={description}
          onDescriptionChange={setDescription}
          aiSuggestedName={generatedImage?.name}
        />
      </div>
    </Modal>
  );
};

export default ConfirmImageUpdateModal;
