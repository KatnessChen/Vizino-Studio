import React, { useState } from 'react';
import { Modal, Typography, Button, message, Spin } from 'antd';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
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
import { migrateGuestDataToUser } from '@/utils/migrateGuestData';
import { ROUTES, generateRoute } from '@/constants/routes';

interface LoginRequiredModalProps {
  /**
   * Callback when login and migration is successful.
   */
  onLoginSuccess?: (projectId: string, spaceId: string) => void;

  /**
   * Callback when user cancels the login.
   */
  onCancel?: () => void;
}

/**
 * Modal shown when a guest user tries to perform an action that requires login.
 * Displays after the user has generated at least one image.
 * Handles migration of guest data after successful login.
 */
const LoginRequiredModal: React.FC<LoginRequiredModalProps> = ({ onLoginSuccess, onCancel }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { guestSessionId, clearGuestSession } = useGuest();

  const isOpen = useSelector(selectShowLoginRequiredModal);
  const pendingUpload = useSelector(selectPendingUpload);
  const pendingGeneratedSave = useSelector(selectPendingGeneratedImageSave);

  const [isMigrating, setIsMigrating] = useState(false);

  const handleClose = () => {
    if (isMigrating) return; // Prevent closing during migration
    dispatch(setShowLoginRequiredModal(false));
    onCancel?.();
  };

  const handleLoginSuccess = async () => {
    if (!user?.uid || !guestSessionId) {
      console.error('[LoginRequiredModal] Missing user or guest session after login');
      dispatch(setShowLoginRequiredModal(false));
      return;
    }

    setIsMigrating(true);

    try {
      console.log('[LoginRequiredModal] Starting migration...');

      // Migrate guest data to user account
      const result = await migrateGuestDataToUser(guestSessionId, user.uid);

      console.log('[LoginRequiredModal] Migration complete:', result);

      // Clear guest session
      clearGuestSession();

      // Clear pending upload data
      dispatch(setPendingUpload(null));
      dispatch(setPendingGeneratedImageSave(null));

      // Close modal
      dispatch(setShowLoginRequiredModal(false));

      // Show success message
      message.success('Login successful! Your work has been saved.');

      // Navigate to the new project/space if created
      if (result.projectId && result.spaceId) {
        // Use the default names used in migration
        const projectName = 'My First Project';
        const spaceName = 'My First Space';
        navigate(generateRoute.space(projectName, result.projectId, spaceName, result.spaceId));
        onLoginSuccess?.(result.projectId, result.spaceId);
      } else {
        // Just navigate to home
        navigate(ROUTES.HOME);
        onLoginSuccess?.('', '');
      }
    } catch (error) {
      console.error('[LoginRequiredModal] Migration failed:', error);
      message.error('Data migration failed. Please try again.');
      setIsMigrating(false);
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
      maskClosable={!isMigrating}
      closable={!isMigrating}
    >
      <div className="flex flex-col items-center py-6 px-4 gap-6">
        {isMigrating ? (
          // Migration in progress
          <>
            <Spin size="large" />
            <Typography.Title level={4} className="m-0 text-center">
              Saving your work...
            </Typography.Title>
            <Typography.Text type="secondary" className="text-center">
              Please wait while we migrate your data to your account.
            </Typography.Text>
          </>
        ) : (
          // Login prompt
          <>
            {/* Icon */}
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-blue-500"
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
              Login to Continue
            </Typography.Title>

            {/* Description */}
            <Typography.Text type="secondary" className="text-center">
              You've experienced the full image generation feature!
              <br />
              Log in to {getPendingActionText()} and keep your work.
            </Typography.Text>

            {/* Preview of generated image if saving */}
            {pendingGeneratedSave && (
              <div className="w-full max-w-[200px] aspect-square rounded-lg overflow-hidden border border-gray-200">
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
            <Button type="text" onClick={handleClose} className="text-gray-500">
              Maybe Later
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
};

export default LoginRequiredModal;
