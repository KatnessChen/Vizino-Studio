import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { decryptUserApiKey } from '@/services/userService';
import { initializeGeminiClient } from '@/services/gemini/geminiConfig';

/**
 * Component to manage global Gemini Client state based on user auth
 * Keeps side effects out of AuthContext
 */
const GeminiClientManager: React.FC = () => {
  const { user } = useAuth();

  // Manage Gemini Client Instantiation based on User API Key
  useEffect(() => {
    if (user?.apiKey?.isActive && user?.apiKey?.geminiKey) {
      try {
        const decryptedKey = decryptUserApiKey(user.apiKey.geminiKey);
        if (decryptedKey) {
          initializeGeminiClient(decryptedKey);
        } else {
          console.warn('Failed to decrypt user API key, reverting to default.');
          initializeGeminiClient();
        }
      } catch (e) {
        console.error('Error decrypting API key:', e);
        initializeGeminiClient();
      }
    } else {
      // Revert to default/env key if no custom key or not active
      initializeGeminiClient();
    }
  }, [user?.apiKey?.geminiKey, user?.apiKey?.isActive]);

  return null;
};

export default GeminiClientManager;
