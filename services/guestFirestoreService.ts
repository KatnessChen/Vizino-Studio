/**
 * Guest Firestore Service
 *
 * Handles all Firestore operations for guest users.
 * Data is stored under guests/{guestSessionId}/ instead of users/{userId}/
 *
 * After login, data should be migrated from guests/ to users/ using migrateGuestData utility.
 */

import {
  doc,
  setDoc,
  Timestamp,
  collection,
  query,
  getDocs,
  deleteDoc,
  writeBatch,
  orderBy,
  updateDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { db, storage } from './firestoreService';
import { ImageData, ImageOperation, Color, Texture, Item } from '@/types';
import { base64ToFile } from '@/utils';

// ============================================================================
// Guest Metadata
// ============================================================================

/**
 * Creates or updates guest session metadata in Firestore.
 */
export async function createGuestSession(sessionId: string): Promise<void> {
  const now = Timestamp.now();
  const metadataRef = doc(db, 'guests', sessionId);

  await setDoc(
    metadataRef,
    {
      createdAt: now,
      lastActiveAt: now,
      hasGeneratedImage: false,
    },
    { merge: true }
  );

  console.log('[Guest] Session created:', sessionId);
}

/**
 * Updates the lastActiveAt timestamp for a guest session.
 */
export async function updateGuestActivity(sessionId: string): Promise<void> {
  const metadataRef = doc(db, 'guests', sessionId);

  await updateDoc(metadataRef, {
    lastActiveAt: Timestamp.now(),
  });
}

/**
 * Marks that the guest has generated an image.
 */
export async function markGuestHasGeneratedImage(sessionId: string): Promise<void> {
  const metadataRef = doc(db, 'guests', sessionId);

  await updateDoc(metadataRef, {
    hasGeneratedImage: true,
    lastActiveAt: Timestamp.now(),
  });

  console.log('[Guest] Marked hasGeneratedImage:', sessionId);
}

// ============================================================================
// Guest Images
// ============================================================================

/**
 * Gets the maximum order value for images in a guest session.
 */
async function getMaxGuestImageOrder(sessionId: string): Promise<number> {
  const imagesCollectionRef = collection(db, 'guests', sessionId, 'images');
  const imagesSnapshot = await getDocs(imagesCollectionRef);

  let maxOrder = 0;
  imagesSnapshot.forEach((doc) => {
    const imageData = doc.data() as ImageData;
    if (imageData.order && imageData.order > maxOrder) {
      maxOrder = imageData.order;
    }
  });

  return maxOrder;
}

/**
 * Creates a new image for a guest session.
 */
export async function createGuestImage(
  sessionId: string,
  imageFile: Blob | File | null,
  imageMetadata: Pick<ImageData, 'id' | 'name' | 'mimeType' | 'description'> &
    Partial<Pick<ImageData, 'width' | 'height' | 'aspect_ratio'>>,
  processingInfo?: {
    parentImage?: ImageData | null;
    operation?: ImageOperation | null;
    base64?: string;
    base64MimeType?: string;
  }
): Promise<ImageData> {
  const { operation, parentImage, base64, base64MimeType } = processingInfo || {};

  try {
    console.log('[Guest] Uploading image to Firebase Storage...');

    // Determine the file to upload and extension
    let fileToUpload: Blob | File;
    let extension = 'jpg';

    if (base64 && base64MimeType) {
      extension = base64MimeType.split('/')[1] || 'jpg';
      const filename = `${imageMetadata.id}.${extension}`;
      fileToUpload = base64ToFile(base64, base64MimeType, filename);
    } else if (imageFile) {
      fileToUpload = imageFile;
      if (imageFile.type) {
        extension = imageFile.type.split('/')[1] || 'jpg';
      } else if (imageFile instanceof File) {
        const parts = imageFile.name.split('.');
        extension = parts[parts.length - 1] || 'jpg';
      }
    } else {
      throw new Error('Either imageFile or base64 data must be provided.');
    }

    // Guest storage path
    const storageFilePath = `guests/${sessionId}/images/${imageMetadata.id}.${extension}`;
    const storageRef = ref(storage, storageFilePath);

    await uploadBytes(storageRef, fileToUpload);
    console.log('[Guest] Image uploaded:', storageFilePath);

    const imageDownloadUrl = await getDownloadURL(storageRef);

    // Calculate order
    const maxOrder = await getMaxGuestImageOrder(sessionId);
    const newImageOrder = maxOrder > 0 ? maxOrder + 1 : 1;

    const now = Timestamp.fromDate(new Date());

    // Build evolution chain
    const buildEvolutionChain = (): ImageOperation[] => {
      if (!operation) return [];
      return [...(parentImage?.evolutionChain || []), operation];
    };

    const newImageData: ImageData = {
      ...imageMetadata,
      spaceId: null, // Guest images don't belong to a space yet
      evolutionChain: buildEvolutionChain(),
      parentImageId: parentImage?.id || null,
      imageDownloadUrl,
      storageFilePath,
      order: newImageOrder,
      isDeleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      description: imageMetadata.description || '',
      // Only include dimension fields if they have values (Firestore doesn't accept undefined)
      ...(imageMetadata.width !== undefined && { width: imageMetadata.width }),
      ...(imageMetadata.height !== undefined && { height: imageMetadata.height }),
      ...(imageMetadata.aspect_ratio !== undefined && { aspect_ratio: imageMetadata.aspect_ratio }),
    };

    // Save to Firestore - filter out undefined values
    const docRef = doc(db, 'guests', sessionId, 'images', newImageData.id);
    const { parentImageId, ...restData } = newImageData;
    
    // Remove any undefined values before saving to Firestore
    const firestoreData = Object.fromEntries(
      Object.entries({ ...restData, parentImageId }).filter(([_, v]) => v !== undefined)
    );
    
    await setDoc(docRef, firestoreData);

    console.log('[Guest] Image document created:', newImageData.id);
    return newImageData;
  } catch (error) {
    console.error('[Guest] Failed to add image:', error);
    throw error instanceof Error
      ? new Error(`Failed to add guest image: ${error.message}`)
      : new Error('Failed to add guest image.');
  }
}

/**
 * Fetches all images for a guest session.
 */
export async function fetchGuestImages(sessionId: string): Promise<ImageData[]> {
  try {
    const imagesRef = collection(db, 'guests', sessionId, 'images');
    const imagesQuery = query(imagesRef, orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(imagesQuery);

    const images = snapshot.docs
      .map((doc) => doc.data() as ImageData)
      .filter((image) => !image.isDeleted);

    console.log('[Guest] Fetched images:', images.length);
    return images;
  } catch (error) {
    console.error('[Guest] Failed to fetch images:', error);
    return [];
  }
}

// ============================================================================
// Guest Custom Colors
// ============================================================================

/**
 * Adds a custom color for a guest session.
 */
export async function addGuestColor(
  sessionId: string,
  colorData: { name: string; hex: string }
): Promise<Color> {
  try {
    const colorId = crypto.randomUUID();
    const now = Timestamp.now();

    const colorDoc: Color = {
      id: colorId,
      name: colorData.name.trim(),
      hex: colorData.hex,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = doc(db, 'guests', sessionId, 'custom_colors', colorId);
    await setDoc(docRef, colorDoc);

    console.log('[Guest] Custom color added:', colorId);
    return colorDoc;
  } catch (error) {
    console.error('[Guest] Failed to add color:', error);
    throw error instanceof Error
      ? new Error(`Failed to add guest color: ${error.message}`)
      : new Error('Failed to add guest color.');
  }
}

/**
 * Fetches all custom colors for a guest session.
 */
export async function fetchGuestColors(sessionId: string): Promise<Color[]> {
  try {
    const colorsRef = collection(db, 'guests', sessionId, 'custom_colors');
    const colorsQuery = query(colorsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(colorsQuery);

    return snapshot.docs.map((doc) => doc.data() as Color);
  } catch (error) {
    console.error('[Guest] Failed to fetch colors:', error);
    return [];
  }
}

// ============================================================================
// Guest Custom Textures
// ============================================================================

/**
 * Adds a custom texture for a guest session.
 */
export async function addGuestTexture(
  sessionId: string,
  textureData: {
    name: string;
    file: File;
    description?: string;
    width?: number;
    height?: number;
    aspect_ratio?: number;
  }
): Promise<Texture> {
  try {
    const textureId = crypto.randomUUID();
    const now = Timestamp.now();

    // Validate file extension
    const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']);
    const extension = textureData.file.name.split('.').pop()?.toLowerCase();
    if (!extension || !allowedExtensions.has(extension)) {
      throw new Error('Invalid texture file type.');
    }

    // Upload to guest storage
    const storagePath = `guests/${sessionId}/custom_textures/${textureId}.${extension}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, textureData.file);
    const textureImageDownloadUrl = await getDownloadURL(storageRef);

    const textureDoc: Texture = {
      id: textureId,
      name: textureData.name.trim(),
      textureImageDownloadUrl,
      description: textureData.description?.trim() || '',
      width: textureData.width,
      height: textureData.height,
      aspect_ratio: textureData.aspect_ratio,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = doc(db, 'guests', sessionId, 'custom_textures', textureId);
    await setDoc(docRef, textureDoc);

    console.log('[Guest] Custom texture added:', textureId);
    return textureDoc;
  } catch (error) {
    console.error('[Guest] Failed to add texture:', error);
    throw error instanceof Error
      ? new Error(`Failed to add guest texture: ${error.message}`)
      : new Error('Failed to add guest texture.');
  }
}

/**
 * Fetches all custom textures for a guest session.
 */
export async function fetchGuestTextures(sessionId: string): Promise<Texture[]> {
  try {
    const texturesRef = collection(db, 'guests', sessionId, 'custom_textures');
    const texturesQuery = query(texturesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(texturesQuery);

    return snapshot.docs.map((doc) => doc.data() as Texture);
  } catch (error) {
    console.error('[Guest] Failed to fetch textures:', error);
    return [];
  }
}

// ============================================================================
// Guest Custom Items
// ============================================================================

/**
 * Adds a custom item for a guest session.
 */
export async function addGuestItem(
  sessionId: string,
  itemData: {
    name: string;
    file: File;
    description?: string;
    width?: number;
    height?: number;
    aspect_ratio?: number;
  }
): Promise<Item> {
  try {
    const itemId = crypto.randomUUID();
    const now = Timestamp.now();

    // Validate file extension
    const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']);
    const extension = itemData.file.name.split('.').pop()?.toLowerCase();
    if (!extension || !allowedExtensions.has(extension)) {
      throw new Error('Invalid item file type.');
    }

    // Upload to guest storage
    const storagePath = `guests/${sessionId}/custom_items/${itemId}.${extension}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, itemData.file);
    const itemImageDownloadUrl = await getDownloadURL(storageRef);

    const itemDoc: Item = {
      id: itemId,
      name: itemData.name.trim(),
      itemImageDownloadUrl,
      description: itemData.description?.trim() || '',
      width: itemData.width,
      height: itemData.height,
      aspect_ratio: itemData.aspect_ratio,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = doc(db, 'guests', sessionId, 'custom_items', itemId);
    await setDoc(docRef, itemDoc);

    console.log('[Guest] Custom item added:', itemId);
    return itemDoc;
  } catch (error) {
    console.error('[Guest] Failed to add item:', error);
    throw error instanceof Error
      ? new Error(`Failed to add guest item: ${error.message}`)
      : new Error('Failed to add guest item.');
  }
}

/**
 * Fetches all custom items for a guest session.
 */
export async function fetchGuestItems(sessionId: string): Promise<Item[]> {
  try {
    const itemsRef = collection(db, 'guests', sessionId, 'custom_items');
    const itemsQuery = query(itemsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(itemsQuery);

    return snapshot.docs.map((doc) => doc.data() as Item);
  } catch (error) {
    console.error('[Guest] Failed to fetch items:', error);
    return [];
  }
}

// ============================================================================
// Guest Data Cleanup
// ============================================================================

/**
 * Deletes all guest data from Firestore and Storage.
 * Called after successful migration to user account.
 */
export async function deleteGuestData(sessionId: string): Promise<void> {
  try {
    console.log('[Guest] Deleting guest data:', sessionId);

    const batch = writeBatch(db);

    // Delete images
    const imagesRef = collection(db, 'guests', sessionId, 'images');
    const imagesSnapshot = await getDocs(imagesRef);
    imagesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    // Delete custom colors
    const colorsRef = collection(db, 'guests', sessionId, 'custom_colors');
    const colorsSnapshot = await getDocs(colorsRef);
    colorsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    // Delete custom textures
    const texturesRef = collection(db, 'guests', sessionId, 'custom_textures');
    const texturesSnapshot = await getDocs(texturesRef);
    texturesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    // Delete custom items
    const itemsRef = collection(db, 'guests', sessionId, 'custom_items');
    const itemsSnapshot = await getDocs(itemsRef);
    itemsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    // Delete metadata document
    const metadataRef = doc(db, 'guests', sessionId);
    batch.delete(metadataRef);

    await batch.commit();
    console.log('[Guest] Firestore data deleted');

    // Delete storage files
    try {
      const guestStorageRef = ref(storage, `guests/${sessionId}`);
      const listResult = await listAll(guestStorageRef);

      // Delete all files in subdirectories
      for (const prefix of listResult.prefixes) {
        const subListResult = await listAll(prefix);
        for (const item of subListResult.items) {
          await deleteObject(item);
        }
      }

      console.log('[Guest] Storage files deleted');
    } catch (storageError) {
      console.warn('[Guest] Failed to delete some storage files:', storageError);
      // Continue even if storage deletion fails
    }

    console.log('[Guest] Guest data cleanup complete:', sessionId);
  } catch (error) {
    console.error('[Guest] Failed to delete guest data:', error);
    throw error instanceof Error
      ? new Error(`Failed to delete guest data: ${error.message}`)
      : new Error('Failed to delete guest data.');
  }
}

/**
 * Fetches all guest data for migration.
 */
export async function fetchAllGuestData(sessionId: string): Promise<{
  images: ImageData[];
  colors: Color[];
  textures: Texture[];
  items: Item[];
}> {
  const [images, colors, textures, items] = await Promise.all([
    fetchGuestImages(sessionId),
    fetchGuestColors(sessionId),
    fetchGuestTextures(sessionId),
    fetchGuestItems(sessionId),
  ]);

  return { images, colors, textures, items };
}
