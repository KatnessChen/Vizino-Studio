import { devLog } from '@/utils/devLogger';
import { imageCache } from './imageCache';

/**
 * Converts a base64 string to a File object.
 *
 * @param base64 The base64-encoded image data (without data URL prefix).
 * @param mimeType The MIME type of the image.
 * @param filename The name for the file.
 * @returns A File object.
 */
function base64ToFile(base64: string, mimeType: string, filename: string): File {
  // Convert base64 to binary string
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  // Create a Blob from the binary data
  const blob = new Blob([bytes], { type: mimeType });
  // Create and return a File object
  return new File([blob], filename, { type: mimeType });
}

/**
 * Fetches an image from a Firebase Storage URL and converts it to base64.
 * Results are cached in-memory and IndexedDB to improve performance on subsequent calls.
 *
 * @param imageDownloadUrl The Firebase Storage download URL.
 * @returns A promise that resolves to the base64-encoded image data (without data URL prefix).
 * @throws Error if the fetch fails or the response is not an image.
 */
async function imageDownloadUrlToBase64(imageDownloadUrl: string): Promise<string> {
  // Check cache first (memory + IndexedDB)
  const cached = await imageCache.get(imageDownloadUrl);
  if (cached) {
    devLog('[imageDownloadUrlToBase64] Retrieved from cache:', imageDownloadUrl);
    return cached;
  }

  try {
    devLog('[imageDownloadUrlToBase64] Fetching and converting:', imageDownloadUrl);
    const response = await fetch(imageDownloadUrl, {
      mode: 'cors',
      credentials: 'omit',
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const blob = await response.blob();
    const mimeType = blob.type || 'image/png';

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        // Remove 'data:image/...;base64,' prefix if present
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;

        // Store in cache
        await imageCache.set(imageDownloadUrl, base64, mimeType);
        devLog('[imageDownloadUrlToBase64] Stored in cache');

        resolve(base64);
      };
      reader.onerror = () => {
        reject(new Error('Failed to convert blob to base64'));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    throw new Error(
      `Error converting storage path to base64: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Formats a timestamp (string, Date, or Firestore Timestamp) to a localized date string.
 *
 * @param timestamp The timestamp to format (can be ISO string, Date object, or Firestore Timestamp).
 * @returns A formatted date string in the format "Dec 22, 2025, 03:45 PM".
 */
interface FirestoreTimestampLike {
  toDate?: () => Date;
  _seconds?: number;
}
type TimestampInput = string | Date | FirestoreTimestampLike;

function formatTimestamp(timestamp: TimestampInput | null | undefined): string {
  if (!timestamp) return '-';
  
  let date: Date;
  
  if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp.toDate === 'function') {
    // Firestore Timestamp object
    date = timestamp.toDate!();
  } else if (typeof timestamp._seconds === 'number') {
    // JSON serialized Firestore Timestamp
    date = new Date(timestamp._seconds * 1000);
  } else {
    // Fallback
    date = new Date(String(timestamp));
  }

  // Final check for invalid date
  if (isNaN(date.getTime())) return '-';

  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export { base64ToFile, imageDownloadUrlToBase64, formatTimestamp };
