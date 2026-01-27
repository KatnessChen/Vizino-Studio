import { useState, useEffect } from 'react';
import { ImageData } from '@/types';
import { Modal, Button, Typography } from 'antd';
import { removeExtension, generateTimestamp } from '@/utils/fileNameUtils';
import { getFileExtension } from '@/utils/downloadUtils';
import CustomizeImageNameForm from '@/components/form/CustomizeImageNameForm';

const MAX_IMAGE_NAME_LENGTH = 50;

interface RenameImageModalProps {
  isOpen: boolean;
  image: ImageData;
  onConfirm: (imageId: string, newName: string) => void;
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
  const [prefixTimestamp, setPrefixTimestamp] = useState<boolean>(false);
  const [suffixMimeType, setSuffixMimeType] = useState<boolean>(false);
  const [suffixTimestamp, setSuffixTimestamp] = useState<boolean>(false);
  const [nameError, setNameError] = useState<string>('');

  // Initialize base name (remove extension from image name)
  useEffect(() => {
    if (isOpen) {
      setBaseName(removeExtension(image.name));
      setPrefixTimestamp(false);
      setSuffixMimeType(false);
      setSuffixTimestamp(false);
    }
  }, [isOpen, image.name]);

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
    onConfirm(image.id, finalName);
    // Reset state
    setBaseName('');
    setPrefixTimestamp(false);
    setSuffixMimeType(false);
    setSuffixTimestamp(false);
  };

  return (
    <Modal
      title={
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Rename Image
          </Typography.Title>
        </div>
      }
      open={isOpen}
      onCancel={onCancel}
      width={600}
      zIndex={1400}
      footer={[
        <Button key="cancel" onClick={onCancel} size="large">
          Cancel
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={handleConfirm}
          disabled={!!nameError}
          size="large"
        >
          Rename
        </Button>,
      ]}
    >
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
    </Modal>
  );
};

export default RenameImageModal;
