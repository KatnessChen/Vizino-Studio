import {
  getFirestore,
  doc,
  setDoc,
  Timestamp,
  collection,
  collectionGroup,
  query,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  orderBy,
  where,
  limit,
} from 'firebase/firestore';
import { ASSET_COLOR, ASSET_TEXTURE, ASSET_ITEM, ASSET_IMAGE } from '@/constants/constants';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from '@/config/firebaseConfig';
import {
  ImageData,
  ImageOperation,
  Project,
  Space,
  ProjectDocument,
  SpaceDocument,
  Color,
  Texture,
  Item,
  CustomPrompt,
} from '@/types';
import {
  base64ToFile,
  FirestoreDataHandler,
  cacheImageBase64s,
  imageCache,
  imageDownloadUrlToBase64,
} from '@/utils';
import { devLog, devWarn, devError } from '@/utils/devLogger';
import { withTracking } from './analyticsService';

// Initialize Firestore and Storage with the shared Firebase app instance
export const db = getFirestore(app);
export const storage = getStorage(app);

/**
 * Gets the maximum order value for images in a space.
 * Used to determine the order for newly created or duplicated images.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param spaceId The ID of the space.
 * @returns The maximum order value, or 0 if no images exist.
 */
/**
 * Gets the maximum order value for assets (images, textures, items).
 * Used to determine the order for newly created or duplicated assets.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param spaceId The ID of the space (required for images, ignored for others).
 * @param collectionName The name of the collection ('images', 'custom_textures', 'custom_items').
 * @returns The maximum order value, or 0 if no assets exist.
 */
async function getMaxAssetOrder({
  userId,
  projectId,
  spaceId,
  collectionName = 'images',
}: {
  userId: string;
  projectId: string;
  spaceId?: string | null;
  collectionName?: 'images' | 'custom_textures' | 'custom_items';
}): Promise<number> {
  let collectionRef;

  if (collectionName === 'images') {
    if (!spaceId) throw new Error('Space ID is required for image order calculation');
    collectionRef = collection(
      db,
      'users',
      userId,
      'projects',
      projectId,
      'spaces',
      spaceId,
      'images'
    );
  } else {
    collectionRef = collection(db, 'users', userId, 'projects', projectId, collectionName);
  }

  // Optimize query: order by 'order' descending and limit to 1
  const assetsQuery = query(collectionRef, orderBy('order', 'desc'), limit(1));

  const snapshot = await getDocs(assetsQuery);

  if (!snapshot.empty) {
    const data = snapshot.docs[0].data();
    return data.order || 0;
  }

  return 0;
}

/**
 * Creates a new project in Firestore for a user.
 *
 * @param userId The ID of the user.
 * @param projectName The name of the project.
 * @returns The newly created Project object.
 */
export async function createProject(userId: string, projectName: string): Promise<Project> {
  return withTracking(
    'firestore_create_project',
    async () => {
      if (!userId) {
        throw new Error('User ID is required to create a home.');
      }

      if (!projectName.trim()) {
        throw new Error('Project name is required.');
      }

      const projectId = crypto.randomUUID();
      const now = new Date();
      const newProject: Project = {
        id: projectId,
        name: projectName.trim(),
        spaces: [],
        createdAt: now.toISOString(),
      };

      const docRef = doc(db, 'users', userId, 'projects', projectId);
      await setDoc(docRef, {
        id: newProject.id,
        name: newProject.name,
        createdAt: Timestamp.fromDate(now),
      });

      devLog('Project created in Firestore:', projectId);
      return newProject;
    },
    { projectName }
  );
}

/**
 * Fetches all projects for a specific user from Firestore.
 * Optimized to fetch all spaces in a single collectionGroup query (2 queries total instead of N+1).
 *
 * @param userId The ID of the user.
 * @returns An array of Project objects with spaces populated (but spaces have empty images arrays).
 */
export async function fetchProjects(userId: string): Promise<Project[]> {
  return withTracking('firestore_fetch_projects', async () => {
    if (!userId) {
      throw new Error('User ID is required to fetch projects.');
    }

    devLog('Fetching projects from Firestore for user:', userId);

    // Query 1: Fetch all projects for the user
    const projectsRef = collection(db, 'users', userId, 'projects');
    const projectsQuery = query(projectsRef, orderBy('createdAt', 'asc'));
    const projectsSnapshot = await getDocs(projectsQuery);

    // Query 2: Fetch all spaces for this user using collectionGroup (single query for all spaces)
    const spacesQuery = query(
      collectionGroup(db, 'spaces'),
      where('userId', '==', userId),
      orderBy('createdAt', 'asc')
    );
    const spacesSnapshot = await getDocs(spacesQuery);

    // Group spaces by projectId on the client side
    const spacesByProject = new Map<string, Space[]>();
    spacesSnapshot.docs.forEach((spaceDoc) => {
      const spaceData = spaceDoc.data() as SpaceDocument;
      const space: Space = {
        id: spaceData.id,
        projectId: spaceData.projectId,
        name: spaceData.name,
        images: null, // Empty - load separately with fetchSpaceImages() if needed
        createdAt:
          typeof spaceData.createdAt === 'string'
            ? spaceData.createdAt
            : spaceData.createdAt &&
                typeof (spaceData.createdAt as Record<string, unknown>).toDate === 'function'
              ? (spaceData.createdAt as { toDate(): Date }).toDate().toISOString()
              : spaceData.createdAt &&
                  ((spaceData.createdAt as unknown) instanceof Date ? true : false)
                ? (spaceData.createdAt as Date).toISOString()
                : String(spaceData.createdAt),
      };

      const projectSpaces = spacesByProject.get(spaceData.projectId) || [];
      projectSpaces.push(space);
      spacesByProject.set(spaceData.projectId, projectSpaces);
    });

    // Combine projects with their spaces
    const projects: Project[] = projectsSnapshot.docs.map((projectDoc) => {
      const projectData = projectDoc.data() as ProjectDocument;

      return {
        id: projectData.id,
        name: projectData.name,
        spaces: spacesByProject.get(projectData.id) || [],
        createdAt:
          typeof projectData.createdAt === 'string'
            ? projectData.createdAt
            : projectData.createdAt &&
                typeof (projectData.createdAt as Record<string, unknown>).toDate === 'function'
              ? (projectData.createdAt as { toDate(): Date }).toDate().toISOString()
              : projectData.createdAt &&
                  ((projectData.createdAt as unknown) instanceof Date ? true : false)
                ? (projectData.createdAt as Date).toISOString()
                : String(projectData.createdAt),
      };
    });

    devLog('Projects fetched from Firestore:', projects.length, 'projects');
    return projects;
  });
}

/**
 * Updates a project's name in Firestore.re.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project to update.
 * @param newName The new name for the project.
 */
export async function updateProject(
  userId: string,
  projectId: string,
  newName: string
): Promise<void> {
  return withTracking(
    'firestore_update_project',
    async () => {
      if (!userId) {
        throw new Error('User ID is required to update a project.');
      }

      if (!newName.trim()) {
        throw new Error('Project name cannot be empty.');
      }

      const docRef = doc(db, 'users', userId, 'projects', projectId);
      await updateDoc(docRef, { name: newName.trim() });

      devLog('Project updated in Firestore:', projectId);
    },
    { projectId, newName }
  );
}

/**
 * Deletes a project from Firestore.
 * Checks the spaces subcollection to ensure it's empty before deletion.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project to delete.
 */
export async function deleteProject(userId: string, projectId: string): Promise<void> {
  return withTracking(
    'firestore_delete_project',
    async () => {
      if (!userId) {
        throw new Error('User ID is required to delete a project.');
      }

      const projectRef = doc(db, 'users', userId, 'projects', projectId);

      // First, check if the project exists
      const projectDoc = await getDoc(projectRef);

      if (!projectDoc.exists()) {
        throw new Error('Project not found.');
      }

      const projectData = projectDoc.data() as ProjectDocument;

      // Check if the spaces subcollection is empty
      const spacesRef = collection(db, 'users', userId, 'projects', projectId, 'spaces');
      const spacesSnapshot = await getDocs(spacesRef);

      if (!spacesSnapshot.empty) {
        // If spaces exist, throw an error to prevent deletion
        throw new Error(
          `Cannot delete "${projectData.name}" because it still contains ${spacesSnapshot.size} space(s). Please delete all spaces first.`
        );
      }

      // If there are no spaces, proceed with deleting the project document
      await deleteDoc(projectRef);

      devLog('Project deleted successfully:', projectId);
    },
    { projectId }
  );
}

/**
 * Creates a new space in a project.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param spaceName The name of the space.
 * @returns The newly created Space object.
 */
export async function createSpace(
  userId: string,
  projectId: string,
  spaceName: string
): Promise<Space> {
  return withTracking(
    'firestore_create_space',
    async () => {
      if (!userId) {
        throw new Error('User ID is required to create a space.');
      }

      if (!spaceName.trim()) {
        throw new Error('Space name is required.');
      }

      const spaceId = crypto.randomUUID();
      const now = new Date();
      const newSpace: Space = {
        id: spaceId,
        projectId,
        name: spaceName.trim(),
        images: [],
        createdAt: now.toISOString(),
      };

      // Create the space document in the subcollection
      const spaceDocRef = doc(db, 'users', userId, 'projects', projectId, 'spaces', spaceId);
      const spaceDoc: SpaceDocument = {
        id: newSpace.id,
        userId, // Required for collectionGroup queries
        projectId: newSpace.projectId,
        name: newSpace.name,
        createdAt: now.toISOString(),
      };

      await setDoc(spaceDocRef, {
        ...spaceDoc,
        createdAt: Timestamp.fromDate(now),
      });

      devLog('Space created in Firestore:', spaceId);
      return newSpace;
    },
    { projectId, spaceName }
  );
}

/**
 * Updates a space's name in Firestore.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param spaceId The ID of the space to update.
 * @param newName The new name for the space.
 */
export async function updateSpace(
  userId: string,
  projectId: string,
  spaceId: string,
  newName: string
): Promise<void> {
  return withTracking(
    'firestore_update_space',
    async () => {
      if (!userId) {
        throw new Error('User ID is required to update a space.');
      }

      if (!newName.trim()) {
        throw new Error('Space name cannot be empty.');
      }

      // Update the space document in the subcollection
      const spaceDocRef = doc(db, 'users', userId, 'projects', projectId, 'spaces', spaceId);
      await updateDoc(spaceDocRef, { name: newName.trim() });

      devLog('Space updated in Firestore:', spaceId);
    },
    { projectId, spaceId, newName }
  );
}

/**
 * Deletes a space from Firestore.
 * Note: Images associated with the space will NOT be deleted.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param spaceId The ID of the space to delete.
 */
export async function deleteSpace(
  userId: string,
  projectId: string,
  spaceId: string
): Promise<void> {
  return withTracking(
    'firestore_delete_space',
    async () => {
      if (!userId) {
        throw new Error('User ID is required to delete a space.');
      }
      if (!projectId) {
        throw new Error('Project ID is required to delete a space.');
      }

      // Delete the space document from the subcollection
      const spaceDocRef = doc(db, 'users', userId, 'projects', projectId, 'spaces', spaceId);
      await deleteDoc(spaceDocRef);

      devLog('Space deleted from Firestore:', spaceId);
    },
    { projectId, spaceId }
  );
}

/**
 * Fetches all images for a specific space.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param spaceId The ID of the space.
 * @returns An array of ImageData objects.
 */
export async function fetchSpaceImages(
  userId: string,
  projectId: string,
  spaceId: string
): Promise<ImageData[]> {
  return withTracking(
    'firestore_fetch_space_images',
    async () => {
      if (!userId || !projectId || !spaceId) {
        throw new Error('User ID, Project ID, and Space ID are required to fetch images.');
      }

      devLog('Fetching images for space:', spaceId);

      const imagesRef = collection(
        db,
        'users',
        userId,
        'projects',
        projectId,
        'spaces',
        spaceId,
        'images'
      );
      const imagesQuery = query(imagesRef, orderBy('createdAt', 'asc'));
      const imagesSnapshot = await getDocs(imagesQuery);

      const images: ImageData[] = imagesSnapshot.docs
        .map((imageDoc) => {
          const imageData = imageDoc.data();
          const processedImage = new FirestoreDataHandler(imageData).serializeTimestamps()
            .value as ImageData;

          // Ensure assetType exists for backward compatibility
          return {
            ...processedImage,
            assetType: processedImage.assetType || ASSET_IMAGE,
          };
        })
        .filter((image) => !image.isDeleted);

      devLog('Images fetched for space:', spaceId, '-', images.length, 'images');

      // Cache images in background
      void cacheImageBase64s(images);

      return images;
    },
    { projectId, spaceId }
  );
}

/**
 * Creates a new image document in Firestore with uploaded storage information.
 * This function handles the entire workflow:
 * 1. Upload the image file to Firebase Storage
 * 2. Obtain the storageUrl and storagePath
 * 3. Create the image document in Firestore
 *
 * @param userId The ID of the user uploading the image.
 * @param projectId The ID of the project.
 * @param spaceId The ID of the space.
 * @param imageFile The image file to upload (Blob or File). Can be null if base64 is provided.
 * @param imageMetadata Basic metadata: id, name, mimeType.
 * @param processingInfo Optional processing information including base64, parentImageId, and operation.
 * @returns The newly created ImageData object for local state use.
 */
export async function createImage(
  userId: string,
  projectId: string,
  spaceId: string,
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
  return withTracking(
    'firestore_create_image',
    async () => {
      if (!userId) {
        throw new Error('User ID is required to add an image.');
      }

      const { operation, parentImage, base64, base64MimeType } = processingInfo || {};

      try {
        devLog('Uploading image to Firebase Storage...');

        // Determine the file to upload and extension
        let fileToUpload: Blob | File;
        let extension = 'jpg';

        if (base64 && base64MimeType) {
          // Convert base64 to File
          extension = base64MimeType.split('/')[1] || 'jpg';
          const filename = `${imageMetadata.id}.${extension}`;
          fileToUpload = base64ToFile(base64, base64MimeType, filename);
          devLog('Converted base64 to file:', filename);
        } else if (imageFile) {
          // Use provided file
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

        // For generating download URL
        const storageFilePath = `users/${userId}/images/${imageMetadata.id}.${extension}`;

        // The Firebase Storage File Path
        const storageRef = ref(storage, `users/${userId}/images/${imageMetadata.id}.${extension}`);

        // Upload the file to Firebase Storage
        await uploadBytes(storageRef, fileToUpload);
        devLog('Image uploaded to Firebase Storage:', storageFilePath);

        // Get the download URL
        const imageDownloadUrl = await getDownloadURL(storageRef);
        devLog('Image download URL obtained:', imageDownloadUrl);

        // Step 2: Calculate order value for the new image
        const maxOrder = await getMaxAssetOrder({
          userId,
          projectId,
          spaceId,
          collectionName: 'images',
        });
        const newImageOrder = maxOrder > 0 ? maxOrder + 1 : 1;

        // Step 3: Create the image document in Firestore with storage information
        const now = Timestamp.fromDate(new Date());

        // Build evolution chain by spreading parent chain and appending current operation
        const buildEvolutionChain = (): ImageOperation[] => {
          if (!operation) return [];
          return [...(parentImage?.evolutionChain || []), operation];
        };

        const newImageData: ImageData = {
          ...imageMetadata,
          spaceId,
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
          // Persist dimensions if provided
          width: imageMetadata.width ?? null,
          height: imageMetadata.height ?? null,
          aspect_ratio: imageMetadata.aspect_ratio ?? null,
          assetType: ASSET_IMAGE,
        };

        devLog({ newImageData });

        // Create the image document in the space's images subcollection
        const docRef = doc(
          db,
          'users',
          userId,
          'projects',
          projectId,
          'spaces',
          spaceId,
          'images',
          newImageData.id
        );

        const batch = writeBatch(db);
        const { parentImageId, ...firestoreData } = newImageData;
        batch.set(docRef, {
          ...firestoreData,
          parentImageId,
        });

        await batch.commit();
        devLog('Image metadata document created in Firestore:', newImageData.id);

        // Return the ImageData object with Firestore Timestamps
        return newImageData;
      } catch (error) {
        devError('Failed to add image:', error);
        if (error instanceof Error) {
          throw new Error(`Failed to add image: ${error.message}`);
        }
        throw new Error('Failed to add image to Firebase.');
      }
    },
    { projectId, spaceId, metadata_name: imageMetadata.name }
  );
}

/**
 * Updates an image's metadata (name and description) in Firestore.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param spaceId The ID of the space.
 * @param imageId The ID of the image to update.
 * @param updates The updates to apply: { name?: string; description?: string }.
 */
export async function updateImageMetadata(
  userId: string,
  projectId: string,
  spaceId: string,
  imageId: string,
  updates: { name?: string; description?: string }
): Promise<void> {
  return withTracking(
    'firestore_update_image_metadata',
    async () => {
      if (!userId || !projectId || !spaceId || !imageId) {
        throw new Error(
          'User ID, Project ID, Space ID, and Image ID are required to update image.'
        );
      }

      const sanitizedUpdates: Partial<Pick<ImageData, 'name' | 'description' | 'updatedAt'>> = {};
      if (updates.name !== undefined) {
        if (!updates.name.trim()) {
          throw new Error('Image name cannot be empty.');
        }
        sanitizedUpdates.name = updates.name.trim();
      }
      if (updates.description !== undefined) {
        sanitizedUpdates.description = updates.description.trim();
      }

      if (Object.keys(sanitizedUpdates).length === 0) return;

      const docRef = doc(
        db,
        'users',
        userId,
        'projects',
        projectId,
        'spaces',
        spaceId,
        'images',
        imageId
      );

      const now = new Date();
      sanitizedUpdates.updatedAt = Timestamp.fromDate(now);

      await updateDoc(docRef, sanitizedUpdates);

      devLog('Image metadata updated in Firestore:', imageId);
    },
    { projectId, spaceId, imageId, ...updates }
  );
}

/**
 * Updates an image's name in Firestore.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param spaceId The ID of the space.
 * @param imageId The ID of the image to update.
 * @param newName The new name for the image.
 * @deprecated Use updateImageMetadata instead.
 */
export async function updateImageName(
  userId: string,
  projectId: string,
  spaceId: string,
  imageId: string,
  newName: string
): Promise<void> {
  return updateImageMetadata(userId, projectId, spaceId, imageId, { name: newName });
}

/**
 * Soft deletes images by marking them as deleted in Firestore.
 * Hard deletes the actual image files from Firebase Storage.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param spaceId The ID of the space.
 * @param imageIds The IDs of the images to delete.
 */
export async function deleteImages(
  userId: string,
  projectId: string,
  spaceId: string,
  imageIds: string[]
): Promise<void> {
  return withTracking(
    'firestore_delete_images',
    async () => {
      if (!userId) {
        throw new Error('User ID is required to delete images.');
      }

      if (imageIds.length === 0) {
        return;
      }

      devLog(`Deleting ${imageIds.length} images for user ${userId}`);

      // Process each image
      for (const imageId of imageIds) {
        try {
          const docRef = doc(
            db,
            'users',
            userId,
            'projects',
            projectId,
            'spaces',
            spaceId,
            'images',
            imageId
          );

          // Get the image document to retrieve storage path
          const imageDoc = await getDoc(docRef);

          if (imageDoc.exists()) {
            const now = new Date();

            // Soft delete in Firestore - mark as deleted
            await updateDoc(docRef, {
              isDeleted: true,
              deletedAt: Timestamp.fromDate(now),
              updatedAt: Timestamp.fromDate(now),
            });

            devLog(`Soft deleted image in Firestore: ${imageId}`);
          } else {
            devWarn(`Image document not found: ${imageId}`);
          }
        } catch (error) {
          devError(`Failed to delete image ${imageId}:`, error);
          // Continue with next image even if one fails
        }
      }

      devLog(`Completed deletion of ${imageIds.length} images`);
    },
    { projectId, spaceId, count: imageIds.length }
  );
}

/**
 * Duplicates an image in Firestore with optional processing.
 * Can either keep the operation history or create a new image without history.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param spaceId The ID of the space.
 * @param sourceImageId The ID of the image to duplicate.
 * @param newImageName The name for the duplicated image.
 * @param mode 'keep-history' to preserve evolution chain, 'duplicate-as-original' to start fresh.
 * @returns The newly created ImageData.
 */
export async function duplicateImage(
  userId: string,
  projectId: string,
  spaceId: string,
  sourceImageId: string,
  newImageName: string
): Promise<ImageData> {
  if (!userId || !projectId || !spaceId || !sourceImageId) {
    throw new Error('User ID, Project ID, Space ID, and Source Image ID are required.');
  }

  if (!newImageName.trim()) {
    throw new Error('New image name is required.');
  }

  return withTracking(
    'firestore_duplicate_image',
    async () => {
      // Fetch the source image
      const sourceDocRef = doc(
        db,
        'users',
        userId,
        'projects',
        projectId,
        'spaces',
        spaceId,
        'images',
        sourceImageId
      );

      const sourceImageDoc = await getDoc(sourceDocRef);
      if (!sourceImageDoc.exists()) {
        throw new Error(`Source image not found: ${sourceImageId}`);
      }

      const sourceImageData = sourceImageDoc.data() as ImageData;

      // Generate new image ID
      const newImageId = crypto.randomUUID();
      const now = Timestamp.fromDate(new Date());

      // Get the maximum order for the new image
      const maxOrder = await getMaxAssetOrder({
        userId,
        projectId,
        spaceId,
        collectionName: 'images',
      });
      const newImageOrder = maxOrder > 0 ? maxOrder + 1 : 1;

      // Create the new image document
      const newImageData: ImageData = {
        id: newImageId,
        name: newImageName.trim(),
        spaceId,
        evolutionChain: sourceImageData.evolutionChain || [],
        parentImageId: sourceImageData.parentImageId,
        imageDownloadUrl: sourceImageData.imageDownloadUrl,
        storageFilePath: sourceImageData.storageFilePath,
        mimeType: sourceImageData.mimeType,
        order: newImageOrder,
        isDeleted: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        // Preserve dimensions from source
        width: sourceImageData.width ?? null,
        height: sourceImageData.height ?? null,
        aspect_ratio: sourceImageData.aspect_ratio ?? null,
        assetType: ASSET_IMAGE,
      };

      // Write to Firestore
      const newDocRef = doc(
        db,
        'users',
        userId,
        'projects',
        projectId,
        'spaces',
        spaceId,
        'images',
        newImageId
      );

      const batch = writeBatch(db);
      const { parentImageId, ...firestoreData } = newImageData;
      batch.set(newDocRef, {
        ...firestoreData,
        parentImageId,
      });

      await batch.commit();
      devLog(`Image duplicated successfully: ${newImageId}`);

      return newImageData;
    },
    { projectId, spaceId, sourceImageId, newImageName }
  );
}

/**
 * Moves an image to a different space while preserving generation history.
 * This creates a new copy of the image with evolutionChain and parentImageId intact.
 *
 * @param userId The ID of the user.
 * @param sourceProjectId The ID of the source project.
 * @param sourceSpaceId The ID of the source space.
 * @param sourceImageId The ID of the source image.
 * @param targetProjectId The ID of the target project.
 * @param targetSpaceId The ID of the target space.
 * @returns The newly created ImageData in the target space.
 */
export async function moveImageToSpace(
  userId: string,
  sourceProjectId: string,
  sourceSpaceId: string,
  sourceImageId: string,
  targetProjectId: string,
  targetSpaceId: string
): Promise<ImageData> {
  if (
    !userId ||
    !sourceProjectId ||
    !sourceSpaceId ||
    !sourceImageId ||
    !targetProjectId ||
    !targetSpaceId
  ) {
    throw new Error('All parameters are required for moving an image.');
  }

  return withTracking(
    'firestore_move_image_to_space',
    async () => {
      // Fetch the source image
      const sourceDocRef = doc(
        db,
        'users',
        userId,
        'projects',
        sourceProjectId,
        'spaces',
        sourceSpaceId,
        'images',
        sourceImageId
      );

      const sourceImageDoc = await getDoc(sourceDocRef);
      if (!sourceImageDoc.exists()) {
        throw new Error(`Source image not found: ${sourceImageId}`);
      }

      const sourceImageData = sourceImageDoc.data() as ImageData;

      // Generate new image ID
      const newImageId = crypto.randomUUID();
      const now = Timestamp.fromDate(new Date());

      // Get the maximum order for the target space
      const maxOrder = await getMaxAssetOrder({
        userId,
        projectId: targetProjectId,
        spaceId: targetSpaceId,
        collectionName: 'images',
      });
      const newImageOrder = maxOrder > 0 ? maxOrder + 1 : 1;

      // Create the new image document WITH generation history preserved
      const newImageData: ImageData = {
        id: newImageId,
        name: sourceImageData.name,
        spaceId: targetSpaceId,
        evolutionChain: sourceImageData.evolutionChain || [], // Keep evolution chain
        parentImageId: sourceImageData.parentImageId, // Keep parent reference
        imageDownloadUrl: sourceImageData.imageDownloadUrl,
        storageFilePath: sourceImageData.storageFilePath,
        mimeType: sourceImageData.mimeType,
        order: newImageOrder,
        isDeleted: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        // Preserve dimensions from source
        width: sourceImageData.width ?? null,
        height: sourceImageData.height ?? null,
        aspect_ratio: sourceImageData.aspect_ratio ?? null,
        assetType: ASSET_IMAGE,
      };

      // Write to Firestore in target space
      const newDocRef = doc(
        db,
        'users',
        userId,
        'projects',
        targetProjectId,
        'spaces',
        targetSpaceId,
        'images',
        newImageId
      );

      const batch = writeBatch(db);
      const { parentImageId, ...firestoreData } = newImageData;
      batch.set(newDocRef, {
        ...firestoreData,
        parentImageId,
      });

      await batch.commit();
      devLog(`Image moved successfully to space ${targetSpaceId}: ${newImageId}`);

      // Soft delete the original image in the source space
      await deleteImages(userId, sourceProjectId, sourceSpaceId, [sourceImageId]);

      return newImageData;
    },
    { sourceProjectId, sourceSpaceId, targetProjectId, targetSpaceId, sourceImageId }
  );
}

/**
 * Copy a generated image into the target space as a new original image.
 * This clears the evolution chain and parentImageId so it acts as an original image.
 */
export async function copyImageAsOriginal(
  userId: string,
  sourceProjectId: string,
  sourceSpaceId: string,
  sourceImageId: string,
  targetProjectId: string,
  targetSpaceId: string
): Promise<ImageData> {
  return withTracking(
    'firestore_copy_image_as_original',
    async () => {
      if (
        !userId ||
        !sourceProjectId ||
        !sourceSpaceId ||
        !sourceImageId ||
        !targetProjectId ||
        !targetSpaceId
      ) {
        throw new Error('All parameters are required for copying an image as original.');
      }

      // Fetch the source image
      const sourceDocRef = doc(
        db,
        'users',
        userId,
        'projects',
        sourceProjectId,
        'spaces',
        sourceSpaceId,
        'images',
        sourceImageId
      );

      const sourceImageDoc = await getDoc(sourceDocRef);
      if (!sourceImageDoc.exists()) {
        throw new Error(`Source image not found: ${sourceImageId}`);
      }

      const sourceImageData = sourceImageDoc.data() as ImageData;

      // Generate new image ID
      const newImageId = crypto.randomUUID();
      const now = Timestamp.fromDate(new Date());

      // Get the maximum order for the target space
      const maxOrder = await getMaxAssetOrder({
        userId,
        projectId: targetProjectId,
        spaceId: targetSpaceId,
        collectionName: 'images',
      });
      const newImageOrder = maxOrder > 0 ? maxOrder + 1 : 1;

      // Create the new image document WITHOUT generation history (original)
      const newImageData: ImageData = {
        id: newImageId,
        name: sourceImageData.name,
        spaceId: targetSpaceId,
        evolutionChain: [], // Clear evolution chain
        parentImageId: null, // No parent
        imageDownloadUrl: sourceImageData.imageDownloadUrl,
        storageFilePath: sourceImageData.storageFilePath,
        mimeType: sourceImageData.mimeType,
        order: newImageOrder,
        isDeleted: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        // Preserve dimensions from source
        width: sourceImageData.width ?? null,
        height: sourceImageData.height ?? null,
        aspect_ratio: sourceImageData.aspect_ratio ?? null,
        assetType: ASSET_IMAGE,
      };

      // Write to Firestore in target space
      const newDocRef = doc(
        db,
        'users',
        userId,
        'projects',
        targetProjectId,
        'spaces',
        targetSpaceId,
        'images',
        newImageId
      );

      const batch = writeBatch(db);
      const { parentImageId, ...firestoreData } = newImageData;
      batch.set(newDocRef, {
        ...firestoreData,
        parentImageId,
      });

      await batch.commit();
      devLog(`Image copied as original successfully: ${newImageId}`);

      // Soft delete the original image in the source space
      await deleteImages(userId, sourceProjectId, sourceSpaceId, [sourceImageId]);

      return newImageData;
    },
    { sourceProjectId, sourceSpaceId, targetProjectId, targetSpaceId, sourceImageId }
  );
}

// ============================================================================
// Custom Colors Management
// ============================================================================

/**
 * Adds a custom color to a project.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param colorData The color data (name, hex, description).
 * @returns The newly created Color object.
 */
export async function addColor(
  userId: string,
  projectId: string,
  colorData: {
    name: string;
    hex: string;
    description?: string;
    evolutionChain?: ImageOperation[];
  }
): Promise<Color> {
  return withTracking(
    'firestore_add_color',
    async () => {
      if (!userId || !projectId) {
        throw new Error('User ID and Project ID are required');
      }

      const colorId = crypto.randomUUID();
      const now = Timestamp.now();

      const colorDoc: Color = {
        id: colorId,
        name: colorData.name.trim(),
        hex: colorData.hex.toUpperCase(),
        assetType: ASSET_COLOR,
        description: colorData.description?.trim() || '',
        createdAt: now,
        updatedAt: now,
        evolutionChain: colorData.evolutionChain || [],
      };

      const docRef = doc(db, 'users', userId, 'projects', projectId, 'custom_colors', colorId);

      await setDoc(docRef, colorDoc);

      devLog('Custom color added to Firestore:', colorId);

      return {
        id: colorDoc.id,
        name: colorDoc.name,
        hex: colorDoc.hex,
        assetType: colorDoc.assetType || ASSET_COLOR,
        description: colorDoc.description,
        evolutionChain: new FirestoreDataHandler(
          colorDoc.evolutionChain || []
        ).serializeTimestamps().value as ImageOperation[],
      };
    },
    { projectId, colorName: colorData.name }
  );
}

/**
 * Fetches all custom colors for a project.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @returns An array of Color objects.
 */
export async function fetchColors(userId: string, projectId: string): Promise<Color[]> {
  return withTracking(
    'firestore_fetch_colors',
    async () => {
      if (!userId || !projectId) {
        throw new Error('User ID and Project ID are required');
      }

      const colorsRef = collection(db, 'users', userId, 'projects', projectId, 'custom_colors');

      const colorsQuery = query(colorsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(colorsQuery);

      return snapshot.docs.map((doc) => {
        const data = doc.data() as Color;
        return {
          id: data.id,
          name: data.name,
          hex: data.hex,
          assetType: data.assetType || ASSET_COLOR,
          description: data.description,
          evolutionChain: new FirestoreDataHandler(data.evolutionChain || []).serializeTimestamps()
            .value as ImageOperation[],
        };
      });
    },
    { projectId }
  );
}

/**
 * Updates a custom color.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param colorId The ID of the color.
 * @param updates The fields to update.
 */
export async function updateColor(
  userId: string,
  projectId: string,
  colorId: string,
  updates: { name?: string; hex?: string; description?: string }
): Promise<void> {
  return withTracking(
    'firestore_update_color',
    async () => {
      if (!userId || !projectId || !colorId) {
        throw new Error('User ID, Project ID, and Color ID are required');
      }

      const docRef = doc(db, 'users', userId, 'projects', projectId, 'custom_colors', colorId);

      const updateData: Partial<
        Pick<Color, 'name' | 'hex' | 'description'> & { updatedAt: Timestamp }
      > = {
        updatedAt: Timestamp.now(),
      };

      if (updates.name !== undefined) updateData.name = updates.name.trim();
      if (updates.hex !== undefined) updateData.hex = updates.hex.toUpperCase();
      if (updates.description !== undefined) updateData.description = updates.description.trim();

      await updateDoc(docRef, updateData);
      devLog('Custom color updated:', colorId);
    },
    { projectId, colorId, ...updates }
  );
}

/**
 * Deletes a custom color.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param colorId The ID of the color.
 */
export async function deleteColor(
  userId: string,
  projectId: string,
  colorId: string
): Promise<void> {
  return withTracking(
    'firestore_delete_color',
    async () => {
      if (!userId || !projectId || !colorId) {
        throw new Error('User ID, Project ID, and Color ID are required');
      }

      const docRef = doc(db, 'users', userId, 'projects', projectId, 'custom_colors', colorId);

      await deleteDoc(docRef);
      devLog('Custom color deleted:', colorId);
    },
    { projectId, colorId }
  );
}

/**
 * ============================
 * Custom Textures Operations
 * ============================
 */

/**
 * Adds a custom texture to a project.
 * Uploads the texture image to Firebase Storage and stores metadata in Firestore.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param textureData The texture data (name, file).
 * @returns The newly created Texture object.
 */
export async function addTexture(
  userId: string,
  projectId: string,
  textureData: {
    name: string;
    file: File;
    description?: string;
    width?: number;
    height?: number;
    aspect_ratio?: number;
    evolutionChain?: ImageOperation[];
  }
): Promise<Texture> {
  return withTracking(
    'firestore_add_texture',
    async () => {
      if (!userId || !projectId) {
        throw new Error('User ID and Project ID are required');
      }

      const textureId = crypto.randomUUID();
      const now = Timestamp.now();

      // Get and validate file extension
      const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']);
      const extension = textureData.file.name.split('.').pop()?.toLowerCase();
      if (!extension || !allowedExtensions.has(extension)) {
        throw new Error(
          'Invalid texture file type. Allowed types are: jpg, jpeg, png, gif, webp, bmp.'
        );
      }

      // Upload texture image to Firebase Storage
      const storagePath = `users/${userId}/projects/${projectId}/custom_textures/${textureId}.${extension}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, textureData.file);
      const textureImageDownloadUrl = await getDownloadURL(storageRef);

      const maxOrder = await getMaxAssetOrder({
        userId,
        projectId,
        collectionName: 'custom_textures',
      });
      const newOrder = maxOrder > 0 ? maxOrder + 1 : 1;

      const textureDoc: Texture = {
        id: textureId,
        name: textureData.name.trim(),
        textureImageDownloadUrl,
        assetType: ASSET_TEXTURE,
        description: textureData.description?.trim() || '',
        width: textureData.width ?? null,
        height: textureData.height ?? null,
        aspect_ratio: textureData.aspect_ratio ?? null,
        createdAt: now,
        updatedAt: now,
        evolutionChain: textureData.evolutionChain || [],
        order: newOrder,
      };

      const docRef = doc(db, 'users', userId, 'projects', projectId, 'custom_textures', textureId);

      await setDoc(docRef, textureDoc);

      devLog('Custom texture added to Firestore:', textureId);

      return {
        id: textureDoc.id,
        name: textureDoc.name,
        textureImageDownloadUrl: textureDoc.textureImageDownloadUrl,
        imageDownloadUrl: textureDoc.textureImageDownloadUrl,
        assetType: textureDoc.assetType || ASSET_TEXTURE,
        description: textureDoc.description,
        width: textureDoc.width,
        height: textureDoc.height,
        aspect_ratio: textureDoc.aspect_ratio,
        mimeType: textureDoc.mimeType || 'image/jpeg',
        spaceId: '',
        parentImageId: null,
        storageFilePath: '',
        order: textureDoc.order,
        isDeleted: false,
        deletedAt: null,
        createdAt: textureDoc.createdAt || now,
        updatedAt: textureDoc.updatedAt || now,
        evolutionChain: new FirestoreDataHandler(
          textureDoc.evolutionChain || []
        ).serializeTimestamps().value as ImageOperation[],
      };
    },
    { projectId, textureName: textureData.name }
  );
}

/**
 * Fetches all custom textures for a project.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @returns An array of Texture objects.
 */
export async function fetchTextures(userId: string, projectId: string): Promise<Texture[]> {
  return withTracking(
    'firestore_fetch_textures',
    async () => {
      if (!userId || !projectId) {
        throw new Error('User ID and Project ID are required');
      }

      const texturesRef = collection(db, 'users', userId, 'projects', projectId, 'custom_textures');

      const texturesQuery = query(texturesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(texturesQuery);

      const textures = snapshot.docs.map((doc) => {
        const textureDoc = doc.data() as Texture;
        return {
          id: textureDoc.id,
          name: textureDoc.name,
          textureImageDownloadUrl: textureDoc.textureImageDownloadUrl,
          imageDownloadUrl: textureDoc.textureImageDownloadUrl,
          assetType: textureDoc.assetType || ASSET_TEXTURE,
          description: textureDoc.description,
          width: textureDoc.width,
          height: textureDoc.height,
          aspect_ratio: textureDoc.aspect_ratio,
          mimeType: textureDoc.mimeType || 'image/jpeg',
          spaceId: '',
          parentImageId: null,
          storageFilePath: '',
          order: textureDoc.order,
          isDeleted: false,
          deletedAt: null,
          createdAt: textureDoc.createdAt || Timestamp.now(),
          updatedAt: textureDoc.updatedAt || Timestamp.now(),
          evolutionChain: new FirestoreDataHandler(
            textureDoc.evolutionChain || []
          ).serializeTimestamps().value as ImageOperation[],
        };
      });

      // Cache texture images in background (using download URL as cache key)
      void cacheTextureImages(textures);

      return textures;
    },
    { projectId }
  );
}

/**
 * Updates a custom texture.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param textureId The ID of the texture.
 * @param updates The fields to update.
 */
export async function updateTexture(
  userId: string,
  projectId: string,
  textureId: string,
  updates: { name?: string; description?: string }
): Promise<void> {
  return withTracking(
    'firestore_update_texture',
    async () => {
      if (!userId || !projectId || !textureId) {
        throw new Error('User ID, Project ID, and Texture ID are required');
      }

      const docRef = doc(db, 'users', userId, 'projects', projectId, 'custom_textures', textureId);

      const updateData: Partial<Texture> = {
        updatedAt: Timestamp.now(),
      };

      if (updates.name !== undefined) updateData.name = updates.name.trim();
      if (updates.description !== undefined) updateData.description = updates.description.trim();

      await updateDoc(docRef, updateData);
      devLog('Custom texture updated:', textureId);
    },
    { projectId, textureId, ...updates }
  );
}

/**
 * Deletes a custom texture.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param textureId The ID of the texture.
 */
export async function deleteTexture(
  userId: string,
  projectId: string,
  textureId: string
): Promise<void> {
  return withTracking(
    'firestore_delete_texture',
    async () => {
      if (!userId || !projectId || !textureId) {
        throw new Error('User ID, Project ID, and Texture ID are required');
      }

      const docRef = doc(db, 'users', userId, 'projects', projectId, 'custom_textures', textureId);

      await deleteDoc(docRef);
      devLog('Custom texture deleted:', textureId);
    },
    { projectId, textureId }
  );
}

/**
 * Cache texture images in the background by converting download URLs to base64
 * This runs asynchronously without blocking the main flow
 */
async function cacheTextureImages(textures: Texture[]): Promise<void> {
  if (textures.length === 0) {
    devLog('[Texture Cache] No textures to cache');
    return;
  }

  let cachedCount = 0;
  let skippedCount = 0;

  for (const texture of textures) {
    if (!texture.textureImageDownloadUrl) {
      skippedCount++;
      continue;
    }

    try {
      // Check if already cached (using download URL as cache key)

      const existingCache = await imageCache.get(texture.textureImageDownloadUrl);

      if (existingCache) {
        skippedCount++;
        devLog(`[Texture Cache] Skipped (already cached): ${texture.name}`);
        continue;
      }

      // Fire and forget - cache in background
      imageDownloadUrlToBase64(texture.textureImageDownloadUrl)
        .then(() => {
          cachedCount++;
          if (cachedCount % 5 === 0 || cachedCount === textures.length - skippedCount) {
            devLog(
              `[Texture Cache] Progress: ${cachedCount}/${
                textures.length - skippedCount
              } textures cached (${skippedCount} skipped)`
            );
          }
        })
        .catch((error) => {
          devWarn(`[Texture Cache] Failed to cache texture ${texture.name}:`, error);
        });
    } catch (error) {
      devWarn(`[Texture Cache] Error caching texture ${texture.name}:`, error);
    }
  }

  devLog(
    `[Texture Cache] Queued ${
      textures.length - skippedCount
    } textures for caching (${skippedCount} already cached)`
  );
}

// ============================================================================
// Custom Items
// ============================================================================

/**
 * Adds a new custom item to a project.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param itemData The item data (name, file, description).
 * @returns The newly created Item object.
 */
export async function addItem(
  userId: string,
  projectId: string,
  itemData: {
    name: string;
    file: File;
    description?: string;
    width?: number;
    height?: number;
    aspect_ratio?: number;
    evolutionChain?: ImageOperation[];
  }
): Promise<Item> {
  return withTracking(
    'firestore_add_item',
    async () => {
      if (!userId || !projectId) {
        throw new Error('User ID and Project ID are required');
      }

      const itemId = crypto.randomUUID();
      const now = Timestamp.now();

      // Get and validate file extension
      const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']);
      const extension = itemData.file.name.split('.').pop()?.toLowerCase();
      if (!extension || !allowedExtensions.has(extension)) {
        throw new Error(
          'Invalid item file type. Allowed types are: jpg, jpeg, png, gif, webp, bmp.'
        );
      }

      // Upload item image to Firebase Storage
      const storagePath = `users/${userId}/projects/${projectId}/custom_items/${itemId}.${extension}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, itemData.file);
      const itemImageDownloadUrl = await getDownloadURL(storageRef);

      const maxOrder = await getMaxAssetOrder({
        userId,
        projectId,
        collectionName: 'custom_items',
      });
      const newOrder = maxOrder > 0 ? maxOrder + 1 : 1;

      const itemDoc: Item = {
        id: itemId,
        name: itemData.name.trim(),
        itemImageDownloadUrl,
        assetType: ASSET_ITEM,
        description: itemData.description?.trim() || '',
        width: itemData.width ?? null,
        height: itemData.height ?? null,
        aspect_ratio: itemData.aspect_ratio ?? null,
        createdAt: now,
        updatedAt: now,
        evolutionChain: itemData.evolutionChain || [],
        order: newOrder,
      };

      const docRef = doc(db, 'users', userId, 'projects', projectId, 'custom_items', itemId);

      await setDoc(docRef, itemDoc);

      devLog('Custom item added to Firestore:', itemId);

      return {
        id: itemDoc.id,
        name: itemDoc.name,
        itemImageDownloadUrl: itemDoc.itemImageDownloadUrl,
        imageDownloadUrl: itemDoc.itemImageDownloadUrl,
        assetType: itemDoc.assetType || ASSET_ITEM,
        description: itemDoc.description,
        width: itemDoc.width,
        height: itemDoc.height,
        aspect_ratio: itemDoc.aspect_ratio,
        mimeType: itemDoc.mimeType || 'image/jpeg',
        spaceId: '',
        parentImageId: null,
        storageFilePath: '',
        order: itemDoc.order,
        isDeleted: false,
        deletedAt: null,
        createdAt: itemDoc.createdAt || now,
        updatedAt: itemDoc.updatedAt || now,
        evolutionChain: new FirestoreDataHandler(itemDoc.evolutionChain || []).serializeTimestamps()
          .value as ImageOperation[],
      };
    },
    { projectId, itemName: itemData.name }
  );
}

/**
 * Fetches all custom items for a project.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @returns An array of Item objects.
 */
export async function fetchItems(userId: string, projectId: string): Promise<Item[]> {
  return withTracking(
    'firestore_fetch_items',
    async () => {
      if (!userId || !projectId) {
        throw new Error('User ID and Project ID are required');
      }

      const itemsRef = collection(db, 'users', userId, 'projects', projectId, 'custom_items');

      const itemsQuery = query(itemsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(itemsQuery);

      const items = snapshot.docs.map((doc) => {
        const itemDoc = doc.data() as Item;
        return {
          id: itemDoc.id,
          name: itemDoc.name,
          itemImageDownloadUrl: itemDoc.itemImageDownloadUrl,
          imageDownloadUrl: itemDoc.itemImageDownloadUrl,
          assetType: itemDoc.assetType || ASSET_ITEM,
          description: itemDoc.description,
          width: itemDoc.width,
          height: itemDoc.height,
          aspect_ratio: itemDoc.aspect_ratio,
          mimeType: itemDoc.mimeType || 'image/jpeg',
          spaceId: '',
          parentImageId: null,
          storageFilePath: '',
          order: itemDoc.order,
          isDeleted: false,
          deletedAt: null,
          createdAt: itemDoc.createdAt || Timestamp.now(),
          updatedAt: itemDoc.updatedAt || Timestamp.now(),
          evolutionChain: new FirestoreDataHandler(
            itemDoc.evolutionChain || []
          ).serializeTimestamps().value as ImageOperation[],
        };
      });

      // Cache item images in background (using download URL as cache key)
      void cacheItemImages(items);

      return items;
    },
    { projectId }
  );
}

/**
 * Updates a custom item.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param itemId The ID of the item.
 * @param updates The fields to update.
 */
export async function updateItem(
  userId: string,
  projectId: string,
  itemId: string,
  updates: { name?: string; description?: string }
): Promise<void> {
  return withTracking(
    'firestore_update_item',
    async () => {
      if (!userId || !projectId || !itemId) {
        throw new Error('User ID, Project ID, and Item ID are required');
      }

      const docRef = doc(db, 'users', userId, 'projects', projectId, 'custom_items', itemId);

      const updateData: Partial<Item> = {
        updatedAt: Timestamp.now(),
      };

      if (updates.name !== undefined) updateData.name = updates.name.trim();
      if (updates.description !== undefined) updateData.description = updates.description.trim();

      await updateDoc(docRef, updateData);
      devLog('Custom item updated:', itemId);
    },
    { projectId, itemId, ...updates }
  );
}

/**
 * Deletes a custom item.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param itemId The ID of the item.
 */
export async function deleteItem(userId: string, projectId: string, itemId: string): Promise<void> {
  return withTracking(
    'firestore_delete_item',
    async () => {
      if (!userId || !projectId || !itemId) {
        throw new Error('User ID, Project ID, and Item ID are required');
      }

      const docRef = doc(db, 'users', userId, 'projects', projectId, 'custom_items', itemId);

      await deleteDoc(docRef);
      devLog('Custom item deleted:', itemId);
    },
    { projectId, itemId }
  );
}

/**
 * Cache item images in the background by converting download URLs to base64
 * This runs asynchronously without blocking the main flow
 */
async function cacheItemImages(items: Item[]): Promise<void> {
  if (items.length === 0) {
    devLog('[Item Cache] No items to cache');
    return;
  }

  let cachedCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    if (!item.itemImageDownloadUrl) {
      skippedCount++;
      continue;
    }

    try {
      // Check if already cached (using download URL as cache key)
      const existingCache = await imageCache.get(item.itemImageDownloadUrl);

      if (existingCache) {
        skippedCount++;
        devLog(`[Item Cache] Skipped (already cached): ${item.name}`);
        continue;
      }

      // Fire and forget - cache in background
      imageDownloadUrlToBase64(item.itemImageDownloadUrl)
        .then(() => {
          cachedCount++;
          if (cachedCount % 5 === 0 || cachedCount === items.length - skippedCount) {
            devLog(
              `[Item Cache] Progress: ${cachedCount}/${
                items.length - skippedCount
              } items cached (${skippedCount} skipped)`
            );
          }
        })
        .catch((error) => {
          devWarn(`[Item Cache] Failed to cache item ${item.name}:`, error);
        });
    } catch (error) {
      devWarn(`[Item Cache] Error caching item ${item.name}:`, error);
    }
  }

  devLog(
    `[Item Cache] Queued ${
      items.length - skippedCount
    } items for caching (${skippedCount} already cached)`
  );
}

/**
 * Saves a custom prompt to Firestore for a project
 * @param userId The ID of the user
 * @param projectId The ID of the project
 * @param taskName The task name
 * @param content The prompt content
 */
export async function saveCustomPrompt(
  userId: string,
  projectId: string,
  taskName: string,
  content: string
): Promise<void> {
  return withTracking(
    'firestore_save_custom_prompt',
    async () => {
      if (!userId || !projectId || !taskName || !content) {
        throw new Error('Missing required fields for saving custom prompt');
      }

      const promptId = crypto.randomUUID();
      const customPromptsPath = `/users/${userId}/projects/${projectId}/custom_prompts`;
      const docRef = doc(db, customPromptsPath, promptId);

      const promptData: CustomPrompt = {
        id: promptId,
        task_name: taskName,
        timestamp: Timestamp.now(),
        content: content,
      };

      await setDoc(docRef, promptData);
    },
    { projectId, taskName }
  );
}

/**
 * Fetches all custom prompts for a project from Firestore
 * @param userId The ID of the user
 * @param projectId The ID of the project
 * @returns Array of custom prompts sorted by timestamp (newest first)
 */
export async function fetchAllCustomPrompts(
  userId: string,
  projectId: string
): Promise<CustomPrompt[]> {
  return withTracking(
    'firestore_fetch_all_custom_prompts',
    async () => {
      if (!userId || !projectId) {
        throw new Error('Missing userId or projectId');
      }

      const customPromptsPath = `/users/${userId}/projects/${projectId}/custom_prompts`;
      const collectionRef = collection(db, customPromptsPath);

      const q = query(collectionRef, orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as CustomPrompt
      );
    },
    { projectId }
  );
}

/**
 * Deletes a single custom prompt from Firestore
 * @param userId The ID of the user
 * @param projectId The ID of the project
 * @param promptId The ID of the prompt to delete
 */
export async function deleteCustomPrompt(
  userId: string,
  projectId: string,
  promptId: string
): Promise<void> {
  return withTracking(
    'firestore_delete_custom_prompt',
    async () => {
      if (!userId || !projectId || !promptId) {
        throw new Error('Missing userId, projectId, or promptId');
      }

      const promptDocRef = doc(
        db,
        'users',
        userId,
        'projects',
        projectId,
        'custom_prompts',
        promptId
      );
      await deleteDoc(promptDocRef);
      devLog('Custom prompt deleted successfully:', promptId);
    },
    { projectId, promptId }
  );
}

/**
 * Batch update the order property of multiple images or assets
 * @param userId The ID of the user
 * @param projectId The ID of the project
 * @param spaceId The ID of the space (optional for project-level assets)
 * @param updates Array of {id, order} objects to update
 * @param collectionName The name of the collection (default: 'images')
 */
export async function batchUpdateImagesOrder(
  userId: string,
  projectId: string,
  spaceId: string | null,
  updates: Array<{ id: string; order: number }>,
  collectionName: string = 'images'
): Promise<void> {
  return withTracking(
    'firestore_batch_update_images_order',
    async () => {
      if (!userId || !projectId) {
        throw new Error('User ID and Project ID are required.');
      }

      // If collection is 'images', spaceId is required
      if (collectionName === 'images' && !spaceId) {
        throw new Error('Space ID is required for image updates.');
      }

      if (!updates || updates.length === 0) {
        return; // Nothing to update
      }

      const CHUNK_SIZE = 450; // Safety margin below 500
      const now = Timestamp.fromDate(new Date());

      for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
        const chunk = updates.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        for (const { id, order } of chunk) {
          let docRef;

          if (collectionName === 'images' && spaceId) {
            // Space-level images
            docRef = doc(
              db,
              'users',
              userId,
              'projects',
              projectId,
              'spaces',
              spaceId,
              'images',
              id
            );
          } else {
            // Project-level assets (custom_textures, custom_items)
            docRef = doc(db, 'users', userId, 'projects', projectId, collectionName, id);
          }

          batch.update(docRef, {
            order,
            updatedAt: now,
          });
        }

        await batch.commit();
      }

      devLog(`Successfully updated order for ${updates.length} items in ${collectionName}`);
    },
    { projectId, spaceId, count: updates.length, collectionName }
  );
}
