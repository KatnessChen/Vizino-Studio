import {
  getFirestore,
  collection,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadString,
  getDownloadURL,
} from 'firebase/storage';
import { app } from '@/config/firebaseConfig';
import { withTracking } from './analyticsService';

const db = getFirestore(app);
const storage = getStorage(app);

/**
 * Optional data for feedback analysis
 */
export interface FeedbackOptions {
  sourceColorHex?: string;      // Original color hex (for recolor tasks)
  generatedColorHex?: string;   // Generated color hex (for color adjustment)
  prompt?: string;              // Custom prompt used
  selectedColor?: {             // Selected color asset info
    id: string;
    name: string;
    hex: string;
  };
  selectedTexture?: {           // Selected texture asset info
    id: string;
    name: string;
    textureImageDownloadUrl: string;
  };
  selectedItem?: {              // Selected item asset info
    id: string;
    name: string;
    itemImageDownloadUrl: string;
  };
}

/**
 * Simplified feedback data structure for Firestore
 * Only includes essential fields to minimize database storage
 * 
 * Note: For image-based tasks (recolor_wall, add_texture, etc.), both image URLs are required.
 *       For color adjustment tasks, image URLs are optional and color info is in options.
 */
export interface FeedbackData {
  sourceImageDownloadUrl?: string;    // Original source image URL (optional for color tasks)
  generatedImageDownloadUrl?: string; // Generated result image URL (optional for color tasks)
  taskName: string;                   // e.g. 'recolor_wall', 'add_texture', 'color_adjustment'
  isSaved: boolean;                   // true if user saved, false if rejected
  rate: number;                       // 0: bad, 1: good
  comments: string;                   // User feedback comments
  createdAt?: Timestamp;              // Set automatically by service
  userId: string;                     // User ID or guest session ID
  options?: FeedbackOptions;          // Optional analysis data (required for color tasks)
}

/**
 * Helper function to clean options object by removing undefined values
 * Firestore doesn't accept undefined values
 */
function cleanOptions(options?: FeedbackOptions): FeedbackOptions | undefined {
  if (!options) return undefined;
  
  const cleaned: any = {};
  
  // Only add fields that are not undefined
  if (options.sourceColorHex !== undefined) cleaned.sourceColorHex = options.sourceColorHex;
  if (options.generatedColorHex !== undefined) cleaned.generatedColorHex = options.generatedColorHex;
  if (options.prompt !== undefined) cleaned.prompt = options.prompt;
  if (options.selectedColor !== undefined) cleaned.selectedColor = options.selectedColor;
  if (options.selectedTexture !== undefined) cleaned.selectedTexture = options.selectedTexture;
  if (options.selectedItem !== undefined) cleaned.selectedItem = options.selectedItem;
  
  // Return undefined if no fields were added
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/**
 * Saves feedback to the 'feedbacks' collection.
 * Only saves essential fields to minimize database storage.
 */
export async function saveFeedback(data: FeedbackData): Promise<string> {
  return withTracking('feedback_save', async () => {
    try {
      const feedbackRef = collection(db, 'feedbacks');
      
      // Save only the essential fields
      const feedbackDoc: any = {
        taskName: data.taskName,
        isSaved: data.isSaved,
        rate: data.rate,
        comments: data.comments || '',
        createdAt: Timestamp.now(),
        userId: data.userId,
      };
      
      // Add image URLs if provided (not present for color adjustment tasks)
      if (data.sourceImageDownloadUrl) {
        feedbackDoc.sourceImageDownloadUrl = data.sourceImageDownloadUrl;
      }
      if (data.generatedImageDownloadUrl) {
        feedbackDoc.generatedImageDownloadUrl = data.generatedImageDownloadUrl;
      }
      
      // Add options if provided (for analysis), cleaned of undefined values
      const cleanedOptions = cleanOptions(data.options);
      if (cleanedOptions) {
        feedbackDoc.options = cleanedOptions;
      }
      
      const docRef = await addDoc(feedbackRef, feedbackDoc);
      console.log('Feedback saved with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error saving feedback:', error);
      // We don't want to block the user flow if feedback fails, so we just log it
      return '';
    }
  });
}

/**
 * Uploads a rejected/discarded generated image to 'discarded_images' storage.
 * This is only used for images that the user rejected (bad rating).
 * For saved images (good rating), we use the already-uploaded image URL from the gallery.
 * 
 * @param base64 The base64 string of the image (without data prefix preferred, or handle both)
 * @param mimeType The mime type of the image
 * @param userId The user ID (used in filename for tracking, not folder structure)
 * @returns The download URL of the uploaded image
 */
export async function uploadFeedbackImage(
  base64: string,
  mimeType: string,
  userId: string
): Promise<string> {
  return withTracking('feedback_upload_image', async () => {
    try {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const extension = mimeType.split('/')[1] || 'jpg';
      // Store in flat structure: discarded_images/{timestamp}_{userId}_{random}.ext
      const filename = `${timestamp}_${userId}_${random}.${extension}`;
      const storagePath = `discarded_images/${filename}`;
      const storageRef = ref(storage, storagePath);

      // Ensure base64 string is formatted correctly for uploadString 'base64'
      // If it contains data URI prefix, strip it or use 'data_url'
      let uploadFormat: 'base64' | 'data_url' = 'base64';
      let content = base64;

      if (base64.startsWith('data:')) {
        uploadFormat = 'data_url';
        content = base64;
      }

      await uploadString(storageRef, content, uploadFormat, {
        contentType: mimeType,
      });

      const downloadUrl = await getDownloadURL(storageRef);
      console.log('Discarded feedback image uploaded:', downloadUrl);
      return downloadUrl;
    } catch (error) {
      console.error('Error uploading discarded feedback image:', error);
      throw error;
    }
  });
}
