/**
 * useStorageAdapter Hook
 *
 * Returns the appropriate storage adapter based on authentication state.
 * - Authenticated users get UserStorageAdapter
 * - Guests get GuestStorageAdapter
 * - Neither gets NoOpStorageAdapter
 *
 * Usage:
 * ```tsx
 * const storage = useStorageAdapter();
 *
 * // Works for both guests and users:
 * const colors = await storage.fetchColors();
 * await storage.addColor({ name: 'Red', hex: '#FF0000' });
 * ```
 */

import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useAuth } from '@/contexts/AuthContext';
import { useGuest } from '@/contexts/GuestContext';
import { selectActiveProjectId, selectActiveSpaceId } from '@/stores/projectStore';
import { StorageAdapter, NoOpStorageAdapter } from '@/services/storageAdapter';
import { createGuestStorageAdapter } from '@/services/guestStorageAdapter';
import { createUserStorageAdapter } from '@/services/userStorageAdapter';

export interface UseStorageAdapterResult {
  /** The storage adapter instance */
  adapter: StorageAdapter;

  /** Whether the adapter is ready (has valid context) */
  isReady: boolean;

  /** Whether in guest mode */
  isGuestMode: boolean;

  /** Whether authenticated */
  isAuthenticated: boolean;
}

/**
 * Hook to get the appropriate storage adapter based on auth state
 */
export function useStorageAdapter(): UseStorageAdapterResult {
  const { user, isAuthenticated } = useAuth();
  const { guestSessionId, isGuestMode } = useGuest();
  const activeProjectId = useSelector(selectActiveProjectId);
  const activeSpaceId = useSelector(selectActiveSpaceId);

  const adapter = useMemo((): StorageAdapter => {
    // Authenticated user
    if (isAuthenticated && user?.uid) {
      return createUserStorageAdapter(user.uid, activeProjectId, activeSpaceId);
    }

    // Guest with valid session
    if (isGuestMode && guestSessionId) {
      return createGuestStorageAdapter(guestSessionId);
    }

    // No valid context
    return new NoOpStorageAdapter();
  }, [isAuthenticated, user?.uid, isGuestMode, guestSessionId, activeProjectId, activeSpaceId]);

  const isReady = useMemo(() => {
    if (isAuthenticated && user?.uid) {
      return true; // User is ready (may or may not have project/space)
    }
    if (isGuestMode && guestSessionId) {
      return true; // Guest is ready
    }
    return false;
  }, [isAuthenticated, user?.uid, isGuestMode, guestSessionId]);

  return {
    adapter,
    isReady,
    isGuestMode,
    isAuthenticated,
  };
}
