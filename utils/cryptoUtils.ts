import { devError, devWarn } from '@/utils/devLogger';

const SECRET_KEY = import.meta.env.VITE_USER_API_KEY_SECRET || 'default-dev-secret';

/**
 * Simple XOR encryption for client-side storage
 */
const xorCipher = (text: string): string => {
  const textChars = text.split('');
  const keyChars = SECRET_KEY.split('');

  return textChars
    .map((char, index) => {
      const charCode = char.charCodeAt(0);
      const keyCode = keyChars[index % keyChars.length].charCodeAt(0);
      return String.fromCharCode(charCode ^ keyCode);
    })
    .join('');
};

/**
 * Encrypts the API key before sending to backend
 */
export const encryptUserApiKey = (apiKey: string): string => {
  if (!apiKey) return '';
  try {
    const trimmed = apiKey.trim();
    const xored = xorCipher(trimmed);
    return btoa(xored);
  } catch (e) {
    devError('Encryption failed:', e);
    return '';
  }
};

/**
 * Decrypts the API key received from backend
 */
export const decryptUserApiKey = (encryptedKey: string): string => {
  if (!encryptedKey) return '';
  try {
    const xored = atob(encryptedKey);
    const decrypted = xorCipher(xored);
    const sanitized = decrypted.replace(/[\x00-\x1f\x7f-\x9f]/g, '').trim();
    if (sanitized.length !== decrypted.trim().length) {
      devWarn(
        '[CryptoUtils] Decrypted API key contained control characters.',
        `Original length: ${decrypted.length}, Sanitized: ${sanitized.length}`
      );
    }
    return sanitized;
  } catch (e) {
    devError('Decryption failed:', e);
    return '';
  }
};
