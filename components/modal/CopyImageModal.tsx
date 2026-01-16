import React from 'react';
import { Modal, Button } from 'antd';

interface CopyImageModalProps {
  isOpen: boolean;
  numberOfImages: number;
  imageType: 'original' | 'updated';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const CopyImageModal: React.FC<CopyImageModalProps> = ({
  isOpen,
  numberOfImages,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Modal
      title={`Copy Image${numberOfImages > 1 ? 's' : ''}`}
      open={isOpen}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>,
        <Button key="copy" type="primary" onClick={handleConfirm} loading={isLoading}>
          Copy
        </Button>,
      ]}
      width={500}
    >
      <p>
        {numberOfImages > 1
          ? `${numberOfImages} images will be copied.`
          : `The selected image will be copied.`}
      </p>
    </Modal>
  );
};

export default CopyImageModal;
