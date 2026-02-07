import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firestoreService';
import { onAuthChange } from '@/services/authService';
import { getAdminSettings, setAdminSettings, AdminSettings } from '@/utils/storageUtils';
import { User } from '@/types';
import { initializeUsage } from '@/services/userService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  adminSettings: AdminSettings;
  updateAdminSettings: (settings: AdminSettings) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [adminSettings, setAdminSettingsState] = useState<AdminSettings>(() => getAdminSettings());

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;

    // Subscribe to auth state changes
    const unsubscribeAuth = onAuthChange((authUser) => {
      if (authUser) {
        // User logged in, subscribe to Firestore document
        const userRef = doc(db, 'users', authUser.uid);

        // Initial setup for loading state if needed, though we wait for snapshot

        unsubscribeSnapshot = onSnapshot(
          userRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const userData = docSnap.data();

              // Construct full user object merging Auth and Firestore data
              // We prioritize Firestore data for app-specific fields
              setUser({
                uid: authUser.uid,
                email: authUser.email,
                displayName: authUser.displayName,
                photoURL: authUser.photoURL,
                usage: userData.usage || {},
                lastLoginAt: userData.lastLoginAt?.toDate() || new Date(),
                apiKey: userData.apiKey,
              } as User);
            } else {
              // Fallback if doc doesn't exist yet (race condition with creation)
              setUser({
                uid: authUser.uid,
                email: authUser.email,
                displayName: authUser.displayName,
                photoURL: authUser.photoURL,
                usage: initializeUsage(),
                lastLoginAt: new Date(),
              } as User);
            }
            setIsLoading(false);
          },
          (error) => {
            console.error('Error fetching user data:', error);
            setIsLoading(false);
          }
        );
      } else {
        // User logged out
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = undefined;
        }
        setUser(null);
        setIsLoading(false);
      }
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  const updateAdminSettings = (settings: AdminSettings) => {
    setAdminSettingsState(settings);
    setAdminSettings(settings);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    adminSettings,
    updateAdminSettings,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook to use auth context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
