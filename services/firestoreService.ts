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
async function getMaxImageOrder(
  userId: string,
  projectId: string,
  spaceId: string
): Promise<number> {
  const imagesCollectionRef = collection(
    db,
    'users',
    userId,
    'projects',
    projectId,
    'spaces',
    spaceId,
    'images'
  );
  const imagesQuery = query(imagesCollectionRef, where('isDeleted', '==', false));
  const imagesSnapshot = await getDocs(imagesQuery);

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
 * Creates a new project in Firestore for a user.
 *
 * @param userId The ID of the user.
 * @param projectName The name of the project.
 * @returns The newly created Project object.
 */
export async function createProject(userId: string, projectName: string): Promise<Project> {
  if (!userId) {
    throw new Error('User ID is required to create a home.');
  }

  if (!projectName.trim()) {
    throw new Error('Project name is required.');
  }

  try {
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

    console.log('Project created in Firestore:', projectId);
    return newProject;
  } catch (error) {
    console.error('Failed to create project:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }
    throw new Error('Failed to create project in Firebase.');
  }
}

/**
 * Fetches all projects for a specific user from Firestore.
 * Optimized to fetch all spaces in a single collectionGroup query (2 queries total instead of N+1).
 *
 * @param userId The ID of the user.
 * @returns An array of Project objects with spaces populated (but spaces have empty images arrays).
 */
export async function fetchProjects(userId: string): Promise<Project[]> {
  if (!userId) {
    throw new Error('User ID is required to fetch projects.');
  }

  try {
    console.log('Fetching projects from Firestore for user:', userId);

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

    console.log('Projects fetched from Firestore:', projects.length, 'projects');
    return projects;
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }
    throw new Error('Failed to fetch projects from Firebase.');
  }
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
  console.log({ userId, projectId, newName });
  if (!userId) {
    throw new Error('User ID is required to update a project.');
  }

  if (!newName.trim()) {
    throw new Error('Project name cannot be empty.');
  }

  try {
    const docRef = doc(db, 'users', userId, 'projects', projectId);
    await updateDoc(docRef, { name: newName.trim() });

    console.log('Project updated in Firestore:', projectId);
  } catch (error) {
    console.error('Failed to update project:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }
    throw new Error('Failed to update project in Firebase.');
  }
}

/**
 * Deletes a project from Firestore.
 * Checks the spaces subcollection to ensure it's empty before deletion.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project to delete.
 */
export async function deleteProject(userId: string, projectId: string): Promise<void> {
  if (!userId) {
    throw new Error('User ID is required to delete a project.');
  }

  const projectRef = doc(db, 'users', userId, 'projects', projectId);

  try {
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

    console.log('Project deleted successfully:', projectId);
  } catch (error) {
    console.error('Failed to delete project:', error);
    // Re-throw the error so the UI can catch it and display a message
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred while deleting the project.');
  }
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
  if (!userId) {
    throw new Error('User ID is required to create a space.');
  }

  if (!spaceName.trim()) {
    throw new Error('Space name is required.');
  }

  try {
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

    console.log('Space created in Firestore:', spaceId);
    return newSpace;
  } catch (error) {
    console.error('Failed to create space:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to create space: ${error.message}`);
    }
    throw new Error('Failed to create space in Firebase.');
  }
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
  if (!userId) {
    throw new Error('User ID is required to update a space.');
  }

  if (!newName.trim()) {
    throw new Error('Space name cannot be empty.');
  }

  try {
    // Update the space document in the subcollection
    const spaceDocRef = doc(db, 'users', userId, 'projects', projectId, 'spaces', spaceId);
    await updateDoc(spaceDocRef, { name: newName.trim() });

    console.log('Space updated in Firestore:', spaceId);
  } catch (error) {
    console.error('Failed to update space:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to update space: ${error.message}`);
    }
    throw new Error('Failed to update space in Firebase.');
  }
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
  if (!userId) {
    throw new Error('User ID is required to delete a space.');
  }
  if (!projectId) {
    throw new Error('Project ID is required to delete a space.');
  }

  try {
    // Delete the space document from the subcollection
    const spaceDocRef = doc(db, 'users', userId, 'projects', projectId, 'spaces', spaceId);
    await deleteDoc(spaceDocRef);

    console.log('Space deleted from Firestore:', spaceId);
  } catch (error) {
    console.error('Failed to delete space:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to delete space: ${error.message}`);
    }
    throw new Error('Failed to delete space from Firebase.');
  }
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
  if (!userId || !projectId || !spaceId) {
    throw new Error('User ID, Project ID, and Space ID are required to fetch images.');
  }

  try {
    console.log('Fetching images for space:', spaceId);

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
        return new FirestoreDataHandler(imageData).serializeTimestamps().value as ImageData;
      })
      .filter((image) => !image.isDeleted);

    console.log('Images fetched for space:', spaceId, '-', images.length, 'images');

    // Cache images in background
    void cacheImageBase64s(images);

    return images;
  } catch (error) {
    console.error('Failed to fetch images:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch images: ${error.message}`);
    }
    throw new Error('Failed to fetch images from Firebase.');
  }
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
  if (!userId) {
    throw new Error('User ID is required to add an image.');
  }

  const { operation, parentImage, base64, base64MimeType } = processingInfo || {};

  try {
    console.log('Uploading image to Firebase Storage...');

    // Determine the file to upload and extension
    let fileToUpload: Blob | File;
    let extension = 'jpg';

    if (base64 && base64MimeType) {
      // Convert base64 to File
      extension = base64MimeType.split('/')[1] || 'jpg';
      const filename = `${imageMetadata.id}.${extension}`;
      fileToUpload = base64ToFile(base64, base64MimeType, filename);
      console.log('Converted base64 to file:', filename);
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
    console.log('Image uploaded to Firebase Storage:', storageFilePath);

    // Get the download URL
    const imageDownloadUrl = await getDownloadURL(storageRef);
    console.log('Image download URL obtained:', imageDownloadUrl);

    // Step 2: Calculate order value for the new image
    const maxOrder = await getMaxImageOrder(userId, projectId, spaceId);
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

    console.log({ newImageData });

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
    console.log('Image metadata document created in Firestore:', newImageData.id);

    // Return the ImageData object with Firestore Timestamps
    return newImageData;
  } catch (error) {
    console.error('Failed to add image:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to add image: ${error.message}`);
    }
    throw new Error('Failed to add image to Firebase.');
  }
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
  if (!userId || !projectId || !spaceId || !imageId) {
    throw new Error('User ID, Project ID, Space ID, and Image ID are required to update image.');
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

    const now = new Date();
    sanitizedUpdates.updatedAt = Timestamp.fromDate(now);

    await updateDoc(docRef, sanitizedUpdates);

    console.log('Image metadata updated in Firestore:', imageId);
  } catch (error) {
    console.error('Failed to update image metadata:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to update image metadata: ${error.message}`);
    }
    throw new Error('Failed to update image metadata in Firebase.');
  }
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
  if (!userId) {
    throw new Error('User ID is required to delete images.');
  }

  if (imageIds.length === 0) {
    return;
  }

  try {
    console.log(`Deleting ${imageIds.length} images for user ${userId}`);

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

          console.log(`Soft deleted image in Firestore: ${imageId}`);

          // TODO: determine the hard delete logic
          // Hard delete from Firebase Storage
          // if (imageData.storageFilePath) {
          //   try {
          //     const storageRef = ref(storage, imageData.storageFilePath);
          //     await deleteObject(storageRef);
          //     console.log(`Hard deleted image from Storage: ${imageData.storageFilePath}`);
          //   } catch (storageError) {
          //     console.warn(`Failed to delete storage file for image ${imageId}:`, storageError);
          //     // Continue even if storage deletion fails
          //   }
          // } else {
          //   console.warn(`No storage path found for image ${imageId}`);
          // }
        } else {
          console.warn(`Image document not found: ${imageId}`);
        }
      } catch (error) {
        console.error(`Failed to delete image ${imageId}:`, error);
        // Continue with next image even if one fails
      }
    }

    console.log(`Completed deletion of ${imageIds.length} images`);
  } catch (error) {
    console.error('Failed to delete images:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to delete images: ${error.message}`);
    }
    throw new Error('Failed to delete images from Firebase.');
  }
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

  try {
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
    const maxOrder = await getMaxImageOrder(userId, projectId, spaceId);
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
    console.log(`Image duplicated successfully: ${newImageId}`);

    return newImageData;
  } catch (error) {
    console.error('Failed to duplicate image:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to duplicate image: ${error.message}`);
    }
    throw new Error('Failed to duplicate image in Firebase.');
  }
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

  try {
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
    const maxOrder = await getMaxImageOrder(userId, targetProjectId, targetSpaceId);
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
    console.log(`Image moved successfully to space ${targetSpaceId}: ${newImageId}`);

    // Soft delete the original image in the source space
    await deleteImages(userId, sourceProjectId, sourceSpaceId, [sourceImageId]);

    return newImageData;
  } catch (error) {
    console.error('Failed to move image:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to move image: ${error.message}`);
    }
    throw new Error('Failed to move image in Firebase.');
  }
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

  try {
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
    const maxOrder = await getMaxImageOrder(userId, targetProjectId, targetSpaceId);
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
    console.log(`Image copied as original successfully: ${newImageId}`);

    // Soft delete the original image in the source space
    await deleteImages(userId, sourceProjectId, sourceSpaceId, [sourceImageId]);

    return newImageData;
  } catch (error) {
    console.error('Failed to copy image as original:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to copy image as original: ${error.message}`);
    }
    throw new Error('Failed to copy image as original in Firebase.');
  }
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
  if (!userId || !projectId) {
    throw new Error('User ID and Project ID are required');
  }

  try {
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

    console.log('Custom color added to Firestore:', colorId);

    return {
      id: colorDoc.id,
      name: colorDoc.name,
      hex: colorDoc.hex,
      assetType: colorDoc.assetType || ASSET_COLOR,
      description: colorDoc.description,
      evolutionChain: new FirestoreDataHandler(colorDoc.evolutionChain || []).serializeTimestamps()
        .value as ImageOperation[],
    };
  } catch (error) {
    console.error('Failed to add color:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to add color: ${error.message}`);
    }
    throw new Error('Failed to add color to Firestore.');
  }
}

/**
 * Fetches all custom colors for a project.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @returns An array of Color objects.
 */
export async function fetchColors(userId: string, projectId: string): Promise<Color[]> {
  if (!userId || !projectId) {
    throw new Error('User ID and Project ID are required');
  }

  try {
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
  } catch (error) {
    console.error('Failed to fetch colors:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch colors: ${error.message}`);
    }
    throw new Error('Failed to fetch colors from Firestore.');
  }
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
  if (!userId || !projectId || !colorId) {
    throw new Error('User ID, Project ID, and Color ID are required');
  }

  try {
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
    console.log('Custom color updated:', colorId);
  } catch (error) {
    console.error('Failed to update color:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to update color: ${error.message}`);
    }
    throw new Error('Failed to update color in Firestore.');
  }
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
  if (!userId || !projectId || !colorId) {
    throw new Error('User ID, Project ID, and Color ID are required');
  }

  try {
    const docRef = doc(db, 'users', userId, 'projects', projectId, 'custom_colors', colorId);

    await deleteDoc(docRef);
    console.log('Custom color deleted:', colorId);
  } catch (error) {
    console.error('Failed to delete color:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to delete color: ${error.message}`);
    }
    throw new Error('Failed to delete color from Firestore.');
  }
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
  if (!userId || !projectId) {
    throw new Error('User ID and Project ID are required');
  }

  try {
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
    };

    const docRef = doc(db, 'users', userId, 'projects', projectId, 'custom_textures', textureId);

    await setDoc(docRef, textureDoc);

    console.log('Custom texture added to Firestore:', textureId);

    return {
      id: textureDoc.id,
      name: textureDoc.name,
      textureImageDownloadUrl: textureDoc.textureImageDownloadUrl,
      assetType: textureDoc.assetType || ASSET_TEXTURE,
      description: textureDoc.description,
      width: textureDoc.width,
      height: textureDoc.height,
      aspect_ratio: textureDoc.aspect_ratio,
      evolutionChain: new FirestoreDataHandler(
        textureDoc.evolutionChain || []
      ).serializeTimestamps().value as ImageOperation[],
    };
  } catch (error) {
    console.error('Failed to add texture:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to add texture: ${error.message}`);
    }
    throw new Error('Failed to add texture to Firestore.');
  }
}

/**
 * Fetches all custom textures for a project.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @returns An array of Texture objects.
 */
export async function fetchTextures(userId: string, projectId: string): Promise<Texture[]> {
  if (!userId || !projectId) {
    throw new Error('User ID and Project ID are required');
  }

  try {
    const texturesRef = collection(db, 'users', userId, 'projects', projectId, 'custom_textures');

    const texturesQuery = query(texturesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(texturesQuery);

    const textures = snapshot.docs.map((doc) => {
      const data = doc.data() as Texture;
      return {
        id: data.id,
        name: data.name,
        textureImageDownloadUrl: data.textureImageDownloadUrl,
        assetType: data.assetType || ASSET_TEXTURE,
        description: data.description,
        width: data.width,
        height: data.height,
        aspect_ratio: data.aspect_ratio,
        evolutionChain: new FirestoreDataHandler(data.evolutionChain || []).serializeTimestamps()
          .value as ImageOperation[],
      };
    });

    // Cache texture images in background (using download URL as cache key)
    void cacheTextureImages(textures);

    return textures;
  } catch (error) {
    console.error('Failed to fetch textures:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch textures: ${error.message}`);
    }
    throw new Error('Failed to fetch textures from Firestore.');
  }
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
  if (!userId || !projectId || !textureId) {
    throw new Error('User ID, Project ID, and Texture ID are required');
  }

  try {
    const docRef = doc(db, 'users', userId, 'projects', projectId, 'custom_textures', textureId);

    const updateData: Partial<Texture> = {
      updatedAt: Timestamp.now(),
    };

    if (updates.name !== undefined) updateData.name = updates.name.trim();
    if (updates.description !== undefined) updateData.description = updates.description.trim();

    await updateDoc(docRef, updateData);
    console.log('Custom texture updated:', textureId);
  } catch (error) {
    console.error('Failed to update texture:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to update texture: ${error.message}`);
    }
    throw new Error('Failed to update texture in Firestore.');
  }
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
  if (!userId || !projectId || !textureId) {
    throw new Error('User ID, Project ID, and Texture ID are required');
  }

  try {
    const docRef = doc(db, 'users', userId, 'projects', projectId, 'custom_textures', textureId);

    await deleteDoc(docRef);
    console.log('Custom texture deleted:', textureId);
  } catch (error) {
    console.error('Failed to delete texture:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to delete texture: ${error.message}`);
    }
    throw new Error('Failed to delete texture from Firestore.');
  }
}

/**
 * Cache texture images in the background by converting download URLs to base64
 * This runs asynchronously without blocking the main flow
 */
async function cacheTextureImages(textures: Texture[]): Promise<void> {
  if (textures.length === 0) {
    console.log('[Texture Cache] No textures to cache');
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
        console.log(`[Texture Cache] Skipped (already cached): ${texture.name}`);
        continue;
      }

      // Fire and forget - cache in background
      imageDownloadUrlToBase64(texture.textureImageDownloadUrl)
        .then(() => {
          cachedCount++;
          if (cachedCount % 5 === 0 || cachedCount === textures.length - skippedCount) {
            console.log(
              `[Texture Cache] Progress: ${cachedCount}/${
                textures.length - skippedCount
              } textures cached (${skippedCount} skipped)`
            );
          }
        })
        .catch((error) => {
          console.warn(`[Texture Cache] Failed to cache texture ${texture.name}:`, error);
        });
    } catch (error) {
      console.warn(`[Texture Cache] Error caching texture ${texture.name}:`, error);
    }
  }

  console.log(
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
  if (!userId || !projectId) {
    throw new Error('User ID and Project ID are required');
  }

  try {
    const itemId = crypto.randomUUID();
    const now = Timestamp.now();

    // Get and validate file extension
    const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']);
    const extension = itemData.file.name.split('.').pop()?.toLowerCase();
    if (!extension || !allowedExtensions.has(extension)) {
      throw new Error('Invalid item file type. Allowed types are: jpg, jpeg, png, gif, webp, bmp.');
    }

    // Upload item image to Firebase Storage
    const storagePath = `users/${userId}/projects/${projectId}/custom_items/${itemId}.${extension}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, itemData.file);
    const itemImageDownloadUrl = await getDownloadURL(storageRef);

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
    };

    const docRef = doc(db, 'users', userId, 'projects', projectId, 'custom_items', itemId);

    await setDoc(docRef, itemDoc);

    console.log('Custom item added to Firestore:', itemId);

    return {
      id: itemDoc.id,
      name: itemDoc.name,
      itemImageDownloadUrl: itemDoc.itemImageDownloadUrl,
      assetType: itemDoc.assetType || ASSET_ITEM,
      description: itemDoc.description,
      width: itemDoc.width,
      height: itemDoc.height,
      aspect_ratio: itemDoc.aspect_ratio,
      evolutionChain: new FirestoreDataHandler(itemDoc.evolutionChain || []).serializeTimestamps()
        .value as ImageOperation[],
    };
  } catch (error) {
    console.error('Failed to add item:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to add item: ${error.message}`);
    }
    throw new Error('Failed to add item to Firestore.');
  }
}

/**
 * Fetches all custom items for a project.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @returns An array of Item objects.
 */
export async function fetchItems(userId: string, projectId: string): Promise<Item[]> {
  if (!userId || !projectId) {
    throw new Error('User ID and Project ID are required');
  }

  try {
    const itemsRef = collection(db, 'users', userId, 'projects', projectId, 'custom_items');

    const itemsQuery = query(itemsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(itemsQuery);

    const items = snapshot.docs.map((doc) => {
      const data = doc.data() as Item;
      return {
        id: data.id,
        name: data.name,
        itemImageDownloadUrl: data.itemImageDownloadUrl,
        assetType: data.assetType || ASSET_ITEM,
        description: data.description,
        width: data.width,
        height: data.height,
        aspect_ratio: data.aspect_ratio,
        evolutionChain: new FirestoreDataHandler(data.evolutionChain || []).serializeTimestamps()
          .value as ImageOperation[],
      };
    });

    // Cache item images in background (using download URL as cache key)
    void cacheItemImages(items);

    return items;
  } catch (error) {
    console.error('Failed to fetch items:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch items: ${error.message}`);
    }
    throw new Error('Failed to fetch items from Firestore.');
  }
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
  if (!userId || !projectId || !itemId) {
    throw new Error('User ID, Project ID, and Item ID are required');
  }

  try {
    const docRef = doc(db, 'users', userId, 'projects', projectId, 'custom_items', itemId);

    const updateData: Partial<Item> = {
      updatedAt: Timestamp.now(),
    };

    if (updates.name !== undefined) updateData.name = updates.name.trim();
    if (updates.description !== undefined) updateData.description = updates.description.trim();

    await updateDoc(docRef, updateData);
    console.log('Custom item updated:', itemId);
  } catch (error) {
    console.error('Failed to update item:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to update item: ${error.message}`);
    }
    throw new Error('Failed to update item in Firestore.');
  }
}

/**
 * Deletes a custom item.
 *
 * @param userId The ID of the user.
 * @param projectId The ID of the project.
 * @param itemId The ID of the item.
 */
export async function deleteItem(userId: string, projectId: string, itemId: string): Promise<void> {
  if (!userId || !projectId || !itemId) {
    throw new Error('User ID, Project ID, and Item ID are required');
  }

  try {
    const docRef = doc(db, 'users', userId, 'projects', projectId, 'custom_items', itemId);

    await deleteDoc(docRef);
    console.log('Custom item deleted:', itemId);
  } catch (error) {
    console.error('Failed to delete item:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to delete item: ${error.message}`);
    }
    throw new Error('Failed to delete item from Firestore.');
  }
}

/**
 * Cache item images in the background by converting download URLs to base64
 * This runs asynchronously without blocking the main flow
 */
async function cacheItemImages(items: Item[]): Promise<void> {
  if (items.length === 0) {
    console.log('[Item Cache] No items to cache');
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
        console.log(`[Item Cache] Skipped (already cached): ${item.name}`);
        continue;
      }

      // Fire and forget - cache in background
      imageDownloadUrlToBase64(item.itemImageDownloadUrl)
        .then(() => {
          cachedCount++;
          if (cachedCount % 5 === 0 || cachedCount === items.length - skippedCount) {
            console.log(
              `[Item Cache] Progress: ${cachedCount}/${
                items.length - skippedCount
              } items cached (${skippedCount} skipped)`
            );
          }
        })
        .catch((error) => {
          console.warn(`[Item Cache] Failed to cache item ${item.name}:`, error);
        });
    } catch (error) {
      console.warn(`[Item Cache] Error caching item ${item.name}:`, error);
    }
  }

  console.log(
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
}

/**
 * Batch update the order property of multiple images
 * @param userId The ID of the user
 * @param projectId The ID of the project
 * @param spaceId The ID of the space
 * @param updates Array of {imageId, order} objects to update
 */
export async function batchUpdateImagesOrder(
  userId: string,
  projectId: string,
  spaceId: string,
  updates: Array<{ imageId: string; order: number }>
): Promise<void> {
  if (!userId || !projectId || !spaceId) {
    throw new Error('User ID, Project ID, and Space ID are required.');
  }

  if (!updates || updates.length === 0) {
    return; // Nothing to update
  }

  try {
    const batch = writeBatch(db);
    const now = Timestamp.fromDate(new Date());

    for (const { imageId, order } of updates) {
      const imageDocRef = doc(
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

      batch.update(imageDocRef, {
        order,
        updatedAt: now,
      });
    }

    await batch.commit();
    console.log(`Successfully updated order for ${updates.length} images`);
  } catch (error) {
    console.error('Failed to batch update images order:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to update images order: ${error.message}`);
    }
    throw new Error('Failed to update images order in Firestore.');
  }
}
