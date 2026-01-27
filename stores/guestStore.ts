import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ImageData, ImageOperation } from '@/types';

const GUEST_SESSION_KEY = 'guest_session_id';
const GUEST_GREETING_KEY = 'guest_has_seen_greeting';

/**
 * Pending upload data that needs to be saved after login
 */
interface PendingUpload {
  type: 'image' | 'color' | 'texture' | 'item' | 'generated';
  data: any;
}

/**
 * Pending generated image save data
 */
interface PendingGeneratedImageSave {
  base64: string;
  mimeType: string;
  name: string;
  sourceImage: ImageData;
  operation: ImageOperation;
}

interface GuestState {
  /**
   * Unique session ID for the guest, stored in localStorage
   */
  sessionId: string | null;

  /**
   * Whether the guest has generated any image
   * After this is true, all upload actions require login
   */
  hasGeneratedImage: boolean;

  /**
   * Guest's images (both original and generated)
   */
  guestImages: ImageData[];

  /**
   * Pending upload that was blocked due to login requirement
   */
  pendingUpload: PendingUpload | null;

  /**
   * Pending generated image save that was blocked due to login requirement
   */
  pendingGeneratedImageSave: PendingGeneratedImageSave | null;

  /**
   * Whether the login required modal is visible
   */
  showLoginRequiredModal: boolean;

  /**
   * Whether the guest has seen the greeting modal
   */
  hasSeenGreeting: boolean;
}

/**
 * Get or create guest session ID from localStorage
 */
function getOrCreateGuestSessionId(): string {
  if (typeof window === 'undefined') {
    return crypto.randomUUID();
  }

  let sessionId = localStorage.getItem(GUEST_SESSION_KEY);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(GUEST_SESSION_KEY, sessionId);
  }

  return sessionId;
}

/**
 * Clear guest session ID from localStorage
 */
function clearGuestSessionId(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(GUEST_SESSION_KEY);
    localStorage.removeItem(GUEST_GREETING_KEY);
  }
}

/**
 * Get hasSeenGreeting from localStorage
 */
function getHasSeenGreeting(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(GUEST_GREETING_KEY) === 'true';
}

const initialState: GuestState = {
  sessionId: null, // Will be initialized in useEffect
  hasGeneratedImage: false,
  guestImages: [],
  pendingUpload: null,
  pendingGeneratedImageSave: null,
  showLoginRequiredModal: false,
  hasSeenGreeting: getHasSeenGreeting(),
};

export const guestStore = createSlice({
  name: 'guest',
  initialState,
  reducers: {
    /**
     * Initialize guest session ID from localStorage
     */
    initializeGuestSession(state) {
      state.sessionId = getOrCreateGuestSessionId();
    },

    /**
     * Set hasGeneratedImage to true after first generation
     */
    setHasGeneratedImage(state, action: PayloadAction<boolean>) {
      state.hasGeneratedImage = action.payload;
    },

    /**
     * Set guest images (for loading from Firebase)
     */
    setGuestImages(state, action: PayloadAction<ImageData[]>) {
      state.guestImages = action.payload;
    },

    /**
     * Add a single guest image (for optimistic updates)
     */
    addGuestImage(state, action: PayloadAction<ImageData>) {
      state.guestImages.push(action.payload);
    },

    /**
     * Set pending upload data when login is required
     */
    setPendingUpload(state, action: PayloadAction<PendingUpload | null>) {
      state.pendingUpload = action.payload;
    },

    /**
     * Set pending generated image save data
     */
    setPendingGeneratedImageSave(
      state,
      action: PayloadAction<PendingGeneratedImageSave | null>
    ) {
      state.pendingGeneratedImageSave = action.payload;
    },

    /**
     * Show/hide login required modal
     */
    setShowLoginRequiredModal(state, action: PayloadAction<boolean>) {
      state.showLoginRequiredModal = action.payload;
    },

    /**
     * Set hasSeenGreeting to true
     */
    setHasSeenGreeting(state) {
      state.hasSeenGreeting = true;
      if (typeof window !== 'undefined') {
        localStorage.setItem(GUEST_GREETING_KEY, 'true');
      }
    },

    /**
     * Clear all guest state after successful login and migration
     */
    clearGuestState(state) {
      clearGuestSessionId();
      state.sessionId = null;
      state.hasGeneratedImage = false;
      state.guestImages = [];
      state.pendingUpload = null;
      state.pendingGeneratedImageSave = null;
      state.showLoginRequiredModal = false;
      state.hasSeenGreeting = false;
    },
  },
  selectors: {
    selectGuestSessionId: (state) => state.sessionId,
    selectHasGeneratedImage: (state) => state.hasGeneratedImage,
    selectGuestImages: (state) => state.guestImages,
    selectPendingUpload: (state) => state.pendingUpload,
    selectPendingGeneratedImageSave: (state) => state.pendingGeneratedImageSave,
    selectShowLoginRequiredModal: (state) => state.showLoginRequiredModal,
    selectHasSeenGreeting: (state) => state.hasSeenGreeting,
  },
});

export const {
  initializeGuestSession,
  setHasGeneratedImage,
  setGuestImages,
  addGuestImage,
  setPendingUpload,
  setPendingGeneratedImageSave,
  setShowLoginRequiredModal,
  setHasSeenGreeting,
  clearGuestState,
} = guestStore.actions;

export const {
  selectGuestSessionId,
  selectHasGeneratedImage,
  selectGuestImages,
  selectPendingUpload,
  selectPendingGeneratedImageSave,
  selectShowLoginRequiredModal,
  selectHasSeenGreeting,
} = guestStore.selectors;

export default guestStore.reducer;
