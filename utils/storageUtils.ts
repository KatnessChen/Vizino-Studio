import { devError } from '@/utils/devLogger';

/**
 * Admin Settings stored in localStorage
 */
export interface AdminSettings {
  mock_limit_reached: boolean; // Existing operation limit mock
  mock_credit_limit_reached: boolean; // New: Mock V points limit reached
  bypass_credit_limit: boolean; // New: Bypass V points limit checks
}

const ADMIN_SETTINGS_KEY = 'admin_settings';

const DEFAULT_SETTINGS: AdminSettings = {
  mock_limit_reached: false,
  mock_credit_limit_reached: false,
  bypass_credit_limit: false,
};

/**
 * Get admin settings from localStorage
 */
export const getAdminSettings = (): AdminSettings => {
  try {
    const stored = localStorage.getItem(ADMIN_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    devError('Failed to load admin settings from localStorage:', error);
  }
  return DEFAULT_SETTINGS;
};

/**
 * Save admin settings to localStorage
 */
export const setAdminSettings = (settings: AdminSettings): void => {
  try {
    localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    devError('Failed to save admin settings to localStorage:', error);
  }
};
