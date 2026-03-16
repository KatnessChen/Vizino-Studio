/**
 * Cloud Function for AI Image Upscaling
 * Uses Replicate's Real-ESRGAN model to upscale images to 4K/8K
 * For large images (8K), uploads directly to Firebase Storage to avoid response size limits
 */

import * as ff from '@google-cloud/functions-framework';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    storageBucket: 'vizion-studio-dev-ab6a5.firebasestorage.app', // Specify the storage bucket explicitly
  });
}

const REPLICATE_API_URL = 'https://api.replicate.com/v1/predictions';
const REAL_ESRGAN_VERSION = 'f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa';

interface UpscaleRequest {
  imageBase64: string;
  imageMimeType: string;
  scale: 2 | 4;
}

interface UpscaleResponse {
  success: boolean;
  outputUrl?: string; // Original Replicate URL
  base64?: string; // For smaller images
  downloadUrl?: string; // Firebase Storage URL for larger images
  mimeType?: string;
  error?: string;
  sizeMB?: number; // Size info for debugging
}

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[];
  error?: string;
  urls?: {
    get: string;
  };
}

/**
 * Get Replicate API token from environment or Secret Manager
 */
function getReplicateToken(): string {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN environment variable is not set');
  }
  return token;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll for prediction result
 */
async function pollPrediction(
  predictionId: string,
  token: string,
  maxAttempts = 90,
  intervalMs = 2000
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`${REPLICATE_API_URL}/${predictionId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to check prediction status: ${response.statusText}`);
    }

    const prediction: ReplicatePrediction = await response.json();

    console.log(`[Upscaling] Attempt ${attempt + 1}: status=${prediction.status}`);

    if (prediction.status === 'succeeded') {
      const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;

      if (!outputUrl) {
        throw new Error('No output URL in prediction result');
      }

      return outputUrl;
    }

    if (prediction.status === 'failed') {
      throw new Error(`Upscaling failed: ${prediction.error || 'Unknown error'}`);
    }

    if (prediction.status === 'canceled') {
      throw new Error('Upscaling was canceled');
    }

    await sleep(intervalMs);
  }

  throw new Error('Upscaling timed out');
}

/**
 * Fetch image from URL and convert to base64
 */
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch upscaled image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  const mimeType = response.headers.get('content-type') || 'image/png';

  return { base64, mimeType };
}

/**
 * Check if image should be uploaded to Firebase Storage (for large files)
 */
function shouldUploadToStorage(sizeBytes: number, scale: number): boolean {
  const sizeMB = sizeBytes / (1024 * 1024);

  // For 8K images (scale=4) or images larger than 8MB, upload to Storage
  return scale === 4 || sizeMB > 8;
}

/**
 * Upload image to Firebase Storage
 */
async function uploadImageToStorage(
  imageBuffer: Buffer,
  mimeType: string,
  spaceId?: string,
  userId?: string
): Promise<string> {
  const bucket = admin.storage().bucket('vizion-studio-dev-ab6a5.firebasestorage.app');

  // Generate unique filename matching normal image path: users/{userId}/images/{id}.{ext}
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  const extension = mimeType.includes('png') ? 'png' : 'jpg';
  const fileName = `upscaled_${timestamp}_${randomId}.${extension}`;

  // Use same path format as normal images: users/{userId}/images/{fileName}
  let filePath: string;
  if (userId) {
    filePath = `users/${userId}/images/${fileName}`;
  } else {
    filePath = `images/${fileName}`;
  }

  console.log(`[Upscaling] Uploading to: ${filePath}`);

  const file = bucket.file(filePath);

  // Generate a download token (same mechanism as Firebase client SDK's getDownloadURL)
  const downloadToken = uuidv4();

  // Upload the buffer with the download token in metadata
  await file.save(imageBuffer, {
    metadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000',
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  });

  // Return download URL with token (same format as getDownloadURL from client SDK)
  const encodedPath = encodeURIComponent(filePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;
}

/**
 * Main upscaling function
 */
ff.http('upscaleImage', async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const {
      imageBase64,
      imageMimeType,
      scale = 2,
      spaceId,
      userId,
    }: UpscaleRequest & { spaceId?: string; userId?: string } = req.body;

    // Validate input
    if (!imageBase64) {
      res.status(400).json({ success: false, error: 'imageBase64 is required' });
      return;
    }

    if (!imageMimeType) {
      res.status(400).json({ success: false, error: 'imageMimeType is required' });
      return;
    }

    if (scale !== 2 && scale !== 4) {
      res.status(400).json({ success: false, error: 'scale must be 2 or 4' });
      return;
    }

    console.log(`[Upscaling] Starting upscale with scale=${scale}`);

    const token = getReplicateToken();

    // Create data URL for Replicate
    const dataUrl = `data:${imageMimeType};base64,${imageBase64}`;

    // Create prediction
    const createResponse = await fetch(REPLICATE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: REAL_ESRGAN_VERSION,
        input: {
          image: dataUrl,
          scale,
          face_enhance: false,
        },
      }),
    });

    if (!createResponse.ok) {
      const errorBody = await createResponse.text();
      console.error('[Upscaling] Replicate API error:', errorBody);
      res
        .status(500)
        .json({ success: false, error: `Replicate API error: ${createResponse.statusText}` });
      return;
    }

    const prediction: ReplicatePrediction = await createResponse.json();

    console.log(`[Upscaling] Prediction created: id=${prediction.id}`);

    // Poll for result
    const outputUrl = await pollPrediction(prediction.id, token);

    console.log('[Upscaling] Got output URL, fetching image...');

    // Fetch the upscaled image first to check size
    const imageResponse = await fetch(outputUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch upscaled image: ${imageResponse.statusText}`);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const mimeType = imageResponse.headers.get('content-type') || 'image/png';
    const sizeBytes = imageBuffer.length;
    const sizeMB = sizeBytes / (1024 * 1024);

    console.log(`[Upscaling] Image size: ${sizeMB.toFixed(2)}MB, scale=${scale}`);

    let response: UpscaleResponse;

    // Decide whether to upload to Storage or return base64
    if (shouldUploadToStorage(sizeBytes, scale)) {
      console.log('[Upscaling] Large image detected, uploading to Firebase Storage...');

      try {
        const downloadUrl = await uploadImageToStorage(imageBuffer, mimeType, spaceId, userId);

        console.log('[Upscaling] Upload to Storage complete');

        response = {
          success: true,
          outputUrl,
          downloadUrl,
          mimeType,
          sizeMB: parseFloat(sizeMB.toFixed(2)),
        };
      } catch (uploadError) {
        console.warn(
          '[Upscaling] Firebase Storage upload failed, falling back to base64:',
          uploadError
        );

        // Fallback to base64 if Storage upload fails
        const base64 = imageBuffer.toString('base64');
        response = {
          success: true,
          outputUrl,
          base64,
          mimeType,
          sizeMB: parseFloat(sizeMB.toFixed(2)),
        };
      }
    } else {
      console.log('[Upscaling] Returning base64 for small image');

      const base64 = imageBuffer.toString('base64');
      response = {
        success: true,
        outputUrl,
        base64,
        mimeType,
        sizeMB: parseFloat(sizeMB.toFixed(2)),
      };
    }

    console.log('[Upscaling] Upscale complete');

    res.status(200).json(response);
  } catch (error) {
    console.error('[Upscaling] Error:', error);
    const response: UpscaleResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});
