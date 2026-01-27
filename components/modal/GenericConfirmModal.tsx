import React from 'react';
import { Modal, Button } from 'antd';

interface GenericConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonColor?: 'red' | 'blue' | 'green';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const GenericConfirmModal: React.FC<GenericConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
  confirmButtonColor = 'blue',
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const getConfirmButtonProps = () => {
    switch (confirmButtonColor) {
      case 'red':
        return { danger: true };
      case 'green':
        return {
          type: 'primary' as const,
          style: { backgroundColor: '#52c41a', borderColor: '#52c41a' },
        };
      case 'blue':
      default:
        return { type: 'primary' as const };
    }
  };

  return (
    <Modal
      title={title}
      open={isOpen}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={isLoading}>
          {cancelButtonText}
        </Button>,
        <Button key="confirm" {...getConfirmButtonProps()} onClick={onConfirm} loading={isLoading}>
          {confirmButtonText}
        </Button>,
      ]}
      width={500}
    >
      <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{message}</p>
    </Modal>
  );
};

export default GenericConfirmModal;
