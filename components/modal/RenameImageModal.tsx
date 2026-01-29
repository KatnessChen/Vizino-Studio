import { useState, useEffect } from 'react';
import { ImageData } from '@/types';
import { Modal, Button, Typography, Input } from 'antd';
import { removeExtension, generateTimestamp } from '@/utils/fileNameUtils';
import { getFileExtension } from '@/utils/downloadUtils';
import CustomizeImageNameForm from '@/components/form/CustomizeImageNameForm';
import { MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH } from '@/constants/constants';

const MAX_IMAGE_NAME_LENGTH = 50;

interface RenameImageModalProps {
  isOpen: boolean;
  image: ImageData;
  onConfirm: (imageId: string, newName: string, description: string) => void;
  onCancel: () => void;
}

const RenameImageModal: React.FC<RenameImageModalProps> = ({
  isOpen,
  image,
  onConfirm,
  onCancel,
}) => {
  // Image naming states
  const [baseName, setBaseName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [prefixTimestamp, setPrefixTimestamp] = useState<boolean>(false);
  const [suffixMimeType, setSuffixMimeType] = useState<boolean>(false);
  const [suffixTimestamp, setSuffixTimestamp] = useState<boolean>(false);
  const [nameError, setNameError] = useState<string>('');

  // Initialize base name (remove extension from image name)
  useEffect(() => {
    if (isOpen) {
      setBaseName(removeExtension(image.name));
      setDescription(image.description || '');
      setPrefixTimestamp(false);
      setSuffixMimeType(false);
      setSuffixTimestamp(false);
    }
  }, [isOpen, image.name, image.description]);

  // Generate final name based on checkbox options
  let finalName = baseName.trim();

  // Prefix timestamp
  if (prefixTimestamp) {
    const timestamp = generateTimestamp();
    finalName = `${timestamp}_${finalName}`;
  }

  if (suffixTimestamp) {
    // Suffix timestamp
    const timestamp = generateTimestamp();
    finalName = `${finalName}_${timestamp}`;
  }

  // Suffix mime type extension
  if (suffixMimeType) {
    const extension = getFileExtension(image.mimeType);
    finalName = `${finalName}${extension}`;
  }

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
    if (nameError) return;
    onConfirm(image.id, finalName, description.trim());
    // Reset state
    setBaseName('');
    setDescription('');
    setPrefixTimestamp(false);
    setSuffixMimeType(false);
    setSuffixTimestamp(false);
  };

  return (
    <Modal
      title={
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Edit Image
          </Typography.Title>
        </div>
      }
      open={isOpen}
      onCancel={onCancel}
      width={600}
      zIndex={1400}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button key="confirm" type="primary" onClick={handleConfirm} disabled={!!nameError}>
          Save
        </Button>,
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <CustomizeImageNameForm
          baseName={baseName}
          onBaseNameChange={setBaseName}
          prefixTimestamp={prefixTimestamp}
          onPrefixTimestampChange={setPrefixTimestamp}
          suffixTimestamp={suffixTimestamp}
          onSuffixTimestampChange={setSuffixTimestamp}
          suffixMimeType={suffixMimeType}
          onSuffixMimeTypeChange={setSuffixMimeType}
          finalName={finalName}
          nameError={nameError}
        />

        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Description (Optional)
            <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 8 }}>
              {description.length}/{MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH}
            </span>
          </Typography.Text>
          <Input.TextArea
            value={description}
            onChange={(e) =>
              setDescription(e.target.value.substring(0, MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH))
            }
            placeholder="Add a description for this image"
            maxLength={MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH}
            autoSize={{ minRows: 3, maxRows: 6 }}
          />
        </div>
      </div>
    </Modal>
  );
};

export default RenameImageModal;
