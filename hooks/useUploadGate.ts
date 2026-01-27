import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@/contexts/AuthContext';
import { useGuest } from '@/contexts/GuestContext';
import {
  selectHasGeneratedImage,
  setPendingUpload,
  setPendingGeneratedImageSave,
  setShowLoginRequiredModal,
} from '@/stores/guestStore';
import { ImageData, ImageOperation } from '@/types';

export type PendingUploadType = 'image' | 'color' | 'texture' | 'item' | 'generated';

interface PendingGeneratedImageSave {
  base64: string;
  mimeType: string;
  name: string;
  sourceImage: ImageData;
  operation: ImageOperation;
}

/**
 * Hook to gate upload actions based on guest state.
 *
 * After a guest has generated any image, all subsequent upload actions
 * require login. This hook provides utilities to check and handle this.
 */
export function useUploadGate() {
  const dispatch = useDispatch();
  const { isAuthenticated } = useAuth();
  const { isGuestMode } = useGuest();
  const hasGeneratedImage = useSelector(selectHasGeneratedImage);

  /**
   * Whether upload actions should require login.
   * Returns true if:
   * - User is not authenticated AND
   * - User has already generated an image
   */
  const shouldRequireLogin = useCallback((): boolean => {
    if (isAuthenticated) return false;
    return hasGeneratedImage;
  }, [isAuthenticated, hasGeneratedImage]);

  /**
   * Check if an upload should be blocked and show login modal.
   * Call this before any upload action.
   *
   * @param type The type of upload being attempted
   * @param data The data to be uploaded (stored for retry after login)
   * @returns true if upload is allowed, false if blocked (login modal shown)
   */
  const gateUpload = useCallback(
    (type: PendingUploadType, data: any): boolean => {
      if (!shouldRequireLogin()) {
        return true; // Allow upload
      }

      // Store pending upload data
      dispatch(setPendingUpload({ type, data }));
      dispatch(setShowLoginRequiredModal(true));

      return false; // Block upload, show login modal
    },
    [dispatch, shouldRequireLogin]
  );

  /**
   * Gate a generated image save operation.
   * Special handling for generated images which have more complex data.
   */
  const gateGeneratedImageSave = useCallback(
    (pendingData: PendingGeneratedImageSave): boolean => {
      if (!shouldRequireLogin()) {
        return true; // Allow save
      }

      // Store pending save data
      dispatch(setPendingGeneratedImageSave(pendingData));
      dispatch(setShowLoginRequiredModal(true));

      return false; // Block save, show login modal
    },
    [dispatch, shouldRequireLogin]
  );

  /**
   * Clear pending upload data (after successful upload or cancellation).
   */
  const clearPendingUpload = useCallback(() => {
    dispatch(setPendingUpload(null));
    dispatch(setPendingGeneratedImageSave(null));
  }, [dispatch]);

  /**
   * Hide the login required modal.
   */
  const hideLoginModal = useCallback(() => {
    dispatch(setShowLoginRequiredModal(false));
  }, [dispatch]);

  return {
    /** Whether the user is in guest mode */
    isGuestMode,
    /** Whether uploads should require login */
    shouldRequireLogin,
    /** Gate an upload action - returns false if blocked */
    gateUpload,
    /** Gate a generated image save - returns false if blocked */
    gateGeneratedImageSave,
    /** Clear pending upload data */
    clearPendingUpload,
    /** Hide the login modal */
    hideLoginModal,
  };
}
