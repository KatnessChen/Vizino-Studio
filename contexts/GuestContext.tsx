import React, { createContext, useContext, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from './AuthContext';
import {
  initializeGuestSession,
  selectGuestSessionId,
  selectHasGeneratedImage,
  setHasGeneratedImage,
  setGuestImages,
  clearGuestState,
} from '@/stores/guestStore';
import { fetchGuestImages } from '@/services/guestFirestoreService';

interface GuestContextType {
  /**
   * Unique session ID for the guest
   * null after login
   */
  guestSessionId: string | null;

  /**
   * Whether the app is in guest mode (not authenticated)
   */
  isGuestMode: boolean;

  /**
   * Whether the guest has generated any image
   * After this is true, all upload actions require login
   */
  hasGeneratedImage: boolean;

  /**
   * Mark that the guest has generated an image
   * Should be called after successful image generation
   */
  markImageGenerated: () => void;

  /**
   * Clear guest session after successful login and migration
   */
  clearGuestSession: () => void;
}

const GuestContext = createContext<GuestContextType | undefined>(undefined);

export const GuestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const { isAuthenticated, isLoading } = useAuth();

  const guestSessionId = useSelector(selectGuestSessionId);
  const hasGeneratedImage = useSelector(selectHasGeneratedImage);

  // Initialize guest session on mount (only if not authenticated)
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !guestSessionId) {
      dispatch(initializeGuestSession());
    }
  }, [isLoading, isAuthenticated, guestSessionId, dispatch]);

  // Load guest images from Firebase when session is initialized
  useEffect(() => {
    const loadGuestImages = async () => {
      if (!guestSessionId || isAuthenticated) return;
      
      try {
        console.log('[GuestContext] Loading guest images...');
        const images = await fetchGuestImages(guestSessionId);
        dispatch(setGuestImages(images));
        
        // If guest has any generated images, mark as having generated
        const hasGenerated = images.some(img => img.parentImageId);
        if (hasGenerated) {
          dispatch(setHasGeneratedImage(true));
        }
        
        console.log('[GuestContext] Loaded', images.length, 'guest images');
      } catch (error) {
        console.error('[GuestContext] Failed to load guest images:', error);
      }
    };
    
    loadGuestImages();
  }, [guestSessionId, isAuthenticated, dispatch]);

  // Clear guest state when user logs in
  useEffect(() => {
    if (isAuthenticated && guestSessionId) {
      // Note: Migration should happen before clearing
      // This is a fallback in case migration wasn't triggered
      console.log('[GuestContext] User authenticated, guest session will be cleared after migration');
    }
  }, [isAuthenticated, guestSessionId]);

  const markImageGenerated = () => {
    dispatch(setHasGeneratedImage(true));
  };

  const clearGuestSession = () => {
    dispatch(clearGuestState());
  };

  const value: GuestContextType = {
    guestSessionId,
    isGuestMode: !isAuthenticated,
    hasGeneratedImage,
    markImageGenerated,
    clearGuestSession,
  };

  return <GuestContext.Provider value={value}>{children}</GuestContext.Provider>;
};

/**
 * Hook to access guest context
 */
export const useGuest = () => {
  const context = useContext(GuestContext);
  if (context === undefined) {
    throw new Error('useGuest must be used within a GuestProvider');
  }
  return context;
};
