import React from 'react';
import { Modal, Typography, Button, message } from 'antd';
import { useSelector, useDispatch } from 'react-redux';
import GoogleLoginButton from '@/components/button/GoogleLoginButton';
import { useAuth } from '@/contexts/AuthContext';
import { useGuest } from '@/contexts/GuestContext';
import {
  selectShowLoginRequiredModal,
  selectPendingUpload,
  selectPendingGeneratedImageSave,
  setShowLoginRequiredModal,
  setPendingUpload,
  setPendingGeneratedImageSave,
} from '@/stores/guestStore';

interface LoginRequiredModalProps {
  /**
   * Callback when login is successful.
   */
  onLoginSuccess?: () => void;

  /**
   * Callback when user cancels the login.
   */
  onCancel?: () => void;
}

/**
 * Modal shown when a guest user tries to perform an action that requires login.
 * Displays after the user has generated at least one image.
 * Guest data is stored locally and will be cleared upon login.
 */
const LoginRequiredModal: React.FC<LoginRequiredModalProps> = ({ onLoginSuccess, onCancel }) => {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { clearGuestSession } = useGuest();

  const isOpen = useSelector(selectShowLoginRequiredModal);
  const pendingUpload = useSelector(selectPendingUpload);
  const pendingGeneratedSave = useSelector(selectPendingGeneratedImageSave);

  const handleClose = () => {
    dispatch(setShowLoginRequiredModal(false));
    onCancel?.();
  };

  const handleLoginSuccess = async () => {
    if (!user?.uid) {
      console.error('[LoginRequiredModal] Missing user after login');
      dispatch(setShowLoginRequiredModal(false));
      return;
    }

    try {
      console.log('[LoginRequiredModal] Login successful, clearing guest session...');

      // Clear guest session (IndexedDB + Redux)
      await clearGuestSession();

      // Clear pending upload data
      dispatch(setPendingUpload(null));
      dispatch(setPendingGeneratedImageSave(null));

      // Close modal
      dispatch(setShowLoginRequiredModal(false));

      // Show success message
      message.success('Login successful! You can now start creating your projects.');

      // Call success callback
      onLoginSuccess?.();
    } catch (error) {
      console.error('[LoginRequiredModal] Failed to clear guest session:', error);
      message.error('Login successful, but failed to clear guest data.');
    }
  };

  const handleLoginError = (error: string) => {
    console.error('[LoginRequiredModal] Login error:', error);
    message.error('Login failed. Please try again.');
  };

  // Determine what action is pending
  const getPendingActionText = (): string => {
    if (pendingGeneratedSave) {
      return 'save your generated image';
    }

    if (pendingUpload) {
      switch (pendingUpload.type) {
        case 'image':
          return 'upload photos';
        case 'color':
          return 'add colors';
        case 'texture':
          return 'add textures';
        case 'item':
          return 'add items';
        default:
          return 'continue';
      }
    }

    return 'continue';
  };

  return (
    <Modal
      open={isOpen}
      onCancel={handleClose}
      footer={null}
      width={400}
      centered
      maskClosable={true}
      closable={true}
    >
      <div className="flex flex-col items-center py-6 px-4 gap-6">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-indigo-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        {/* Title */}
        <Typography.Title level={4} className="m-0 text-center">
          Signin to Continue
        </Typography.Title>

        {/* Description */}
        <Typography.Text type="secondary" className="text-center">
          You've experienced the full image generation feature!
          <br />
          Log in to {getPendingActionText()} and unlock all features.
        </Typography.Text>

        {/* Preview of generated image if saving */}
        {pendingGeneratedSave && (
          <div className="w-full max-w-[200px] aspect-square rounded-lg overflow-hidden border-2 border-indigo-200">
            <img
              src={`data:${pendingGeneratedSave.mimeType};base64,${pendingGeneratedSave.base64}`}
              alt="Generated preview"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Login Button */}
        <div className="w-full">
          <GoogleLoginButton
            onSuccess={handleLoginSuccess}
            onError={handleLoginError}
            fullWidth
          />
        </div>

        {/* Cancel Button */}
        <Button type="text" onClick={handleClose} className="text-gray-500 hover:text-indigo-600">
          Maybe Later
        </Button>
      </div>
    </Modal>
  );
};

export default LoginRequiredModal;
