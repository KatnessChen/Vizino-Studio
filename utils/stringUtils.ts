/**
 * Converts snake_case string to Title Case
 * @param snakeCaseStr - String in snake_case format (e.g., "task_name")
 * @returns String in Title Case format (e.g., "Task Name")
 */
export const formatTaskName = (snakeCaseStr: string): string => {
  return snakeCaseStr
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Converts a string to a URL-safe slug
 * - Keeps English letters
 * - Converts French accented characters to English (é → e, ç → c, etc.)
 * - Removes Chinese characters completely
 * - Converts to lowercase
 * - Replaces spaces and special characters with hyphens
 * - Removes consecutive hyphens
 * - Limits length to prevent excessively long URLs
 *
 * @param text - The text to convert to a slug
 * @param maxLength - Maximum length of the slug (default: 50)
 * @returns URL-safe slug
 *
 * @example
 * createSlug("My Project") // "my-project"
 * createSlug("Café Résumé") // "cafe-resume"
 * createSlug("我的項目 Project") // "project"
 * createSlug("My 廚房 Kitchen") // "my-kitchen"
 */
export const createSlug = (text: string, maxLength: number = 50): string => {
  return (
    text
      .trim()
      // Normalize Unicode characters and remove diacritics (é → e, ç → c)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Remove Chinese, Japanese, Korean characters (CJK Unified Ideographs)
      .replace(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g, '')
      // Remove Japanese Hiragana and Katakana
      .replace(/[\u3040-\u309F\u30A0-\u30FF]/g, '')
      // Remove Korean Hangul
      .replace(/[\uAC00-\uD7AF]/g, '')
      .toLowerCase()
      // Replace spaces and underscores with hyphens
      .replace(/[\s_]+/g, '-')
      // Remove all non-alphanumeric characters except hyphens
      .replace(/[^a-z0-9-]/g, '')
      // Replace multiple consecutive hyphens with a single hyphen
      .replace(/-+/g, '-')
      // Remove leading and trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Limit length
      .slice(0, maxLength)
  );
};

/**
 * Generates a short ID from a Firebase-style ID
 * Takes the first 8 characters to balance uniqueness and URL brevity
 *
 * @param id - Full Firebase ID
 * @returns Short ID (8 characters)
 *
 * @example
 * createShortId("abc123def456ghi789") // "abc123de"
 */
export const createShortId = (id: string): string => {
  return id.slice(0, 8);
};

/**
 * Creates a URL-friendly identifier combining slug and short ID
 * Format: {slug}-{shortId} or just {shortId} if slug is empty
 *
 * This format provides:
 * - Human readability (slug)
 * - Uniqueness (shortId)
 * - Security (doesn't expose full Firebase ID)
 * - Stability (URL works even if name changes, parsed by shortId)
 *
 * @param name - The display name
 * @param id - The full ID
 * @returns Combined slug-id string
 *
 * @example
 * createSlugId("My Kitchen Project", "abc123def456") // "my-kitchen-project-abc123de"
 * createSlugId("我的項目", "abc123def456") // "abc123de" (Chinese removed, only shortId)
 * createSlugId("Café Résumé", "xyz789abc123") // "cafe-resume-xyz789ab"
 */
export const createSlugId = (name: string, id: string): string => {
  const slug = createSlug(name);
  const shortId = createShortId(id);
  return slug ? `${slug}-${shortId}` : shortId;
};

/**
 * Extracts the short ID from a slug-id string
 * Works with format: {slug}-{shortId} or just {shortId}
 *
 * The short ID is always the last 8 characters after splitting by hyphen.
 * This ensures the function works even if the slug contains hyphens.
 *
 * @param slugId - The combined slug-id string from URL
 * @returns The short ID portion (8 characters)
 *
 * @example
 * extractShortId("my-kitchen-project-abc123de") // "abc123de"
 * extractShortId("abc123de") // "abc123de"
 * extractShortId("multi-word-slug-xyz789ab") // "xyz789ab"
 */
export const extractShortId = (slugId: string): string => {
  // The shortId is always 8 characters, so take the last 8 characters
  // This works for both "slug-shortId" and just "shortId" formats
  return slugId.slice(-8);
};
