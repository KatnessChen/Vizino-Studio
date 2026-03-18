import React, { createContext, useContext, useEffect, useState } from 'react';
import { backendService } from '@/services/backendService';
import { onAuthChange } from '@/services/authService';
import { getAdminSettings, setAdminSettings, AdminSettings } from '@/utils/storageUtils';
import { devError } from '@/utils/devLogger';
import { User } from '@/types';
import { identifyUser, resetAnalytics } from '@/services/analyticsService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  adminSettings: AdminSettings;
  updateAdminSettings: (settings: AdminSettings) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [adminSettings, setAdminSettingsState] = useState<AdminSettings>(() => getAdminSettings());

  const fetchUserData = async (authUser: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }) => {
    try {
      const userData = await backendService.getMe();

      setUser({
        uid: authUser.uid,
        email: authUser.email,
        displayName: authUser.displayName,
        photoURL: authUser.photoURL,
        usage: userData.usage || {},
        lastLoginAt: userData.lastLoginAt ? new Date(userData.lastLoginAt as string) : new Date(),
        apiKey: userData.apiKey,
        credit_limit: userData.credit_limit,
      } as User);

      identifyUser(authUser.uid, {
        email: authUser.email,
        displayName: authUser.displayName,
      });
    } catch (error) {
      devError('Error fetching user data from backend:', error);
      // Fallback
      setUser({
        uid: authUser.uid,
        email: authUser.email,
        displayName: authUser.displayName,
        photoURL: authUser.photoURL,
        usage: {} as User['usage'],
        lastLoginAt: new Date(),
      } as User);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribeAuth = onAuthChange((authUser) => {
      if (authUser) {
        fetchUserData(authUser);
      } else {
        setUser(null);
        resetAnalytics();
        setIsLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const refreshUser = async () => {
    if (user) {
      await fetchUserData(user);
    }
  };

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
    refreshUser,
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
