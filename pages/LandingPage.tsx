import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { message, Tag } from 'antd';
import ConfirmImageUpdateModal from '@/components/modal/ConfirmImageUpdateModal';
import GenerateMoreModal, { GenerateMoreModalRef } from '@/components/modal/GenerateMoreModal';
import Gallery from '@/components/Gallery';
import EmptyState from '@/components/EmptyState';
import GenericConfirmModal from '@/components/modal/GenericConfirmModal';
import CopyImageModal from '@/components/modal/CopyImageModal';
import MoveImageModal from '@/components/modal/MoveImageModal';
import RenameImageModal from '@/components/modal/RenameImageModal';
import MyBreadcrumb from '@/components/ui/MyBreadcrumb';
import GreetingModal from '@/components/modal/GreetingModal';
import Footer from '@/components/layout/Footer';
import AsideSection from '@/components/layout/AsideSection';
import ColorSelect from '@/components/select/ColorSelect';
import TextureOrItemSelect from '@/components/select/TextureOrItemSelect';
import { GEMINI_TASKS } from '@/services/gemini/geminiTasks';
import { ImageData, ImageOperation } from '@/types';
import {
  createImage,
  deleteImages,
  fetchSpaceImages,
  updateImageName,
  duplicateImage,
  moveImageToSpace,
  copyImageAsOriginal,
  createSpace,
} from '@/services/firestoreService';
import { useAuth } from '@/contexts/AuthContext';
import { useGuest } from '@/contexts/GuestContext';
import { useAppInit } from '@/hooks/useAppInit';
import { formatImageOperationData, downloadFile, buildDownloadFilename } from '@/utils';
import { generateRoute } from '@/constants/routes';
import { checkImageLimit, getLimitExceededMessage } from '@/utils/limitationUtils';
import {
  selectOriginalImages,
  selectUpdatedImages,
  selectSelectedOriginalImageIds,
  selectSelectedUpdatedImageIds,
  setSelectedOriginalImageIds,
  setSelectedUpdatedImageIds,
} from '@/stores/imageStore';
import {
  setSpaceImages,
  selectProjects,
  selectActiveProjectId,
  selectActiveSpaceId,
  setActiveProjectId,
  setActiveSpaceId,
  selectIsAppInitiated,
  selectInitError,
  selectIsFetchingSpaceImages,
  addImageOptimistic,
  removeImageOptimistic,
  removeImagesOptimistic,
  updateImageOptimistic,
  addSpace,
  setIsFetchingSpaceImages,
} from '@/stores/projectStore';
import { reorderImagesWithDebounce } from '@/stores/imageOrderThunks';
import {
  selectSelectedTaskNames,
  selectSelectedColor,
  selectSelectedTexture,
  selectSelectedItem,
  selectSourceImage,
  setSourceImage,
  setSelectedColor,
} from '@/stores/taskStore';
import GuestOnboardingTour, { GuestOnboardingTourRef } from '@/components/GuestOnboardingTour';
import { getDemoImages, getDefaultGuestColor, getDefaultDemoImageId } from '@/constants/demoImages';
import {
  selectGuestImages,
  selectHasSeenGreeting,
  setHasSeenGreeting,
  setShowLoginRequiredModal,
} from '@/stores/guestStore';

interface LandingPageProps {
  tourRef: React.RefObject<GuestOnboardingTourRef | null>;
}

const LandingPage: React.FC<LandingPageProps> = ({ tourRef }) => {
  // Get authenticated user
  const { user, adminSettings } = useAuth();
  const { isGuestMode } = useGuest();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Ref for GenerateMoreModal to trigger generation from Tour
  const generateModalRef = useRef<GenerateMoreModalRef>(null);

  const isAppInitiated = useSelector(selectIsAppInitiated);
  const initError = useSelector(selectInitError);
  const isFetchingSpaceImages = useSelector(selectIsFetchingSpaceImages);

  // Get active space from store
  const projects = useSelector(selectProjects);
  const activeProjectId = useSelector(selectActiveProjectId);
  const activeSpaceId = useSelector(selectActiveSpaceId);

  // Get images from store (computed from rooms)
  const storeOriginalImages = useSelector(selectOriginalImages);
  const storeUpdatedImages = useSelector(selectUpdatedImages);
  const guestImages = useSelector(selectGuestImages);

  // For guests, show demo images if no images uploaded yet
  const originalImages = useMemo(() => {
    if (isGuestMode && storeOriginalImages.length === 0) {
      return getDemoImages();
    }
    return storeOriginalImages;
  }, [isGuestMode, storeOriginalImages]);

  // For guests, show guest generated images; for users, show space updated images
  const updatedImages = useMemo(() => {
    if (isGuestMode) {
      // Filter to only show images with parentImageId (generated images)
      return guestImages.filter((img) => img.parentImageId);
    }
    return storeUpdatedImages;
  }, [isGuestMode, guestImages, storeUpdatedImages]);

  // Get task-related state from taskStore
  const selectedTaskNames = useSelector(selectSelectedTaskNames);
  const selectedColor = useSelector(selectSelectedColor);
  const selectedTexture = useSelector(selectSelectedTexture);
  const selectedItem = useSelector(selectSelectedItem);
  const sourceImage = useSelector(selectSourceImage);

  // Get selected image IDs from Redux
  const selectedOriginalImageIds = useSelector(selectSelectedOriginalImageIds);
  const selectedUpdatedImageIds = useSelector(selectSelectedUpdatedImageIds);

  const [generatedImage, setGeneratedImage] = useState<{ base64: string; mimeType: string } | null>(
    null
  );

  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  // State for processing context (to track source image and custom prompt)
  const [processingContext, setProcessingContext] = useState<{
    selectedImage: ImageData | null;
    customPrompt: string | undefined;
  }>({
    selectedImage: null,
    customPrompt: undefined,
  });

  const hasSeenGreeting = useSelector(selectHasSeenGreeting);
  const [isGreetingModalOpen, setIsGreetingModalOpen] = useState(false);

  // Show greeting modal for new guests
  useEffect(() => {
    if (isGuestMode && !hasSeenGreeting && isAppInitiated) {
      // Delay slightly to ensure layout is ready
      const timer = setTimeout(() => {
        setIsGreetingModalOpen(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isGuestMode, hasSeenGreeting, isAppInitiated]);

  const handleCloseGreetingModal = () => {
    setIsGreetingModalOpen(false);
    dispatch(setHasSeenGreeting());
  };

  const handleGreetingSignIn = () => {
    setIsGreetingModalOpen(false);
    dispatch(setHasSeenGreeting());
    dispatch(setShowLoginRequiredModal(true));
  };

  const handleGreetingTakeTour = () => {
    setIsGreetingModalOpen(false);
    dispatch(setHasSeenGreeting());
    // Start tour after a short delay
    setTimeout(() => {
      tourRef.current?.openTour();
    }, 400);
  };

  // Derive modal visibility from Redux state
  const showGenerateMoreModal = useCallback(() => {
    return sourceImage !== null;
  }, [sourceImage]);

  // State for generic confirm modal (for delete operations)
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<boolean>(false);
  const [deleteConfirmConfig, setDeleteConfirmConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [isDeletingImages, setIsDeletingImages] = useState<boolean>(false);

  // State for copy modal
  const [showCopyModal, setShowCopyModal] = useState<boolean>(false);
  const [imageTypeToCopy, setImageTypeToCopy] = useState<'original' | 'generated' | null>(null);
  const [isCopyingImages, setIsCopyingImages] = useState<boolean>(false);

  // State for move modal
  const [showMoveModal, setShowMoveModal] = useState<boolean>(false);
  const [imageTypeToMove, setImageTypeToMove] = useState<'original' | 'generated' | null>(null);
  const [imagesToMove, setImagesToMove] = useState<ImageData[]>([]);
  const [isMovingImage, setIsMovingImage] = useState<boolean>(false);

  // State for rename modal
  const [showRenameModal, setShowRenameModal] = useState<boolean>(false);
  const [imageToRename, setImageToRename] = useState<ImageData | null>(null);

  // Initialize app on mount
  useAppInit();

  // Error message state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Show error message when errorMessage changes
  useEffect(() => {
    if (errorMessage) {
      message.error(errorMessage);
    }
  }, [errorMessage]);

  // Pre-select demo image and default color for guest mode
  useEffect(() => {
    if (isGuestMode && isAppInitiated) {
      // Pre-select first demo image
      const defaultImageId = getDefaultDemoImageId();
      dispatch(setSelectedOriginalImageIds(new Set([defaultImageId])));

      // Pre-select default color
      const defaultColor = getDefaultGuestColor();
      dispatch(setSelectedColor(defaultColor));
    }
  }, [isGuestMode, isAppInitiated, dispatch]);

  // Get current active space
  const activeSpace = useMemo(() => {
    if (!activeProjectId || !activeSpaceId) return null;
    const project = projects.find((p) => p.id === activeProjectId);
    if (!project) return null;
    return project.spaces.find((s) => s.id === activeSpaceId) || null;
  }, [projects, activeProjectId, activeSpaceId]);

  // Check image limit in current space
  const imageLimitCheck = useMemo(
    () => checkImageLimit(activeSpace, adminSettings.mock_limit_reached),
    [activeSpace, adminSettings.mock_limit_reached]
  );

  // Format image limit info for breadcrumb display
  const imageLimitInfo = useMemo(
    () =>
      activeSpace && imageLimitCheck
        ? { current: imageLimitCheck.current, max: imageLimitCheck.max }
        : null,
    [activeSpace, imageLimitCheck]
  );

  const handleImageUpload = useCallback(
    async (
      file: File,
      metadata?: {
        width: number;
        height: number;
        aspect_ratio: number;
        name?: string;
        description?: string;
      }
    ) => {
      if (!user) {
        // TODO: redirect user to login steps instead of error
        setErrorMessage('Please log in to upload images.');
        return;
      }

      if (!activeProjectId || !activeSpaceId) {
        setErrorMessage('Please select project/space to upload image.');
        return;
      }

      if (!imageLimitCheck.canAdd) {
        setErrorMessage(getLimitExceededMessage('images', 50));
        return;
      }

      const tempImageId = crypto.randomUUID();
      const now = Timestamp.fromDate(new Date());

      // Calculate optimistic order value (max current order + 1)
      const currentMaxOrder = Math.max(0, ...originalImages.map((img) => img.order ?? 0));
      const optimisticOrder = currentMaxOrder + 1;

      // Use provided name or fall back to file name
      const imageName = metadata?.name || file.name;

      // Optimistic update - add image immediately to UI
      const optimisticImage = {
        id: tempImageId,
        name: imageName,
        mimeType: file.type,
        spaceId: activeSpaceId,
        evolutionChain: [],
        parentImageId: null,
        imageDownloadUrl: URL.createObjectURL(file), // Temporary local URL
        storageFilePath: '',
        order: optimisticOrder,
        isDeleted: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        description: metadata?.description,
        // Add optimistic dimensions
        width: metadata?.width,
        height: metadata?.height,
        aspect_ratio: metadata?.aspect_ratio,
      };

      dispatch(
        addImageOptimistic({
          projectId: activeProjectId,
          spaceId: activeSpaceId,
          image: optimisticImage,
        })
      );

      try {
        // Call firestoreService.createImage() to upload the file to Firebase Storage
        // and create the image document in Firestore
        await createImage(user.uid, activeProjectId, activeSpaceId, file, {
          id: tempImageId,
          name: imageName,
          description: metadata?.description,
          mimeType: file.type,
          // Include dimensions from client metadata when available
          width: metadata?.width,
          height: metadata?.height,
          aspect_ratio: metadata?.aspect_ratio,
        });

        // Fetch updated space images
        const images = await fetchSpaceImages(user.uid, activeProjectId, activeSpaceId);
        dispatch(setSpaceImages({ projectId: activeProjectId, spaceId: activeSpaceId, images }));

        setErrorMessage(null); // Clear error on successful upload
      } catch (error) {
        console.error('Failed to upload image:', error);

        // Rollback optimistic update on error
        dispatch(
          removeImageOptimistic({
            projectId: activeProjectId,
            spaceId: activeSpaceId,
            imageId: tempImageId,
          })
        );

        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to upload image to Firebase.'
        );
      }
    },
    [
      user,
      activeProjectId,
      activeSpaceId,
      dispatch,
      setErrorMessage,
      imageLimitCheck,
      originalImages,
    ]
  );

  const handleRenameImage = useCallback(
    async (imageId: string, newName: string) => {
      if (!user) {
        setErrorMessage('Please log in to rename images.');
        return;
      }

      if (!activeProjectId || !activeSpaceId) {
        setErrorMessage('No project and space selected.');
        return;
      }

      if (!newName.trim()) {
        setErrorMessage('Image name cannot be empty.');
        return;
      }

      // Optimistic update - update immediately in UI
      dispatch(
        updateImageOptimistic({
          projectId: activeProjectId,
          spaceId: activeSpaceId,
          imageId,
          newName: newName.trim(),
        })
      );

      try {
        // Update image name in Firestore
        await updateImageName(user.uid, activeProjectId, activeSpaceId, imageId, newName.trim());

        // Fetch updated space images to sync
        const images = await fetchSpaceImages(user.uid, activeProjectId, activeSpaceId);
        dispatch(setSpaceImages({ projectId: activeProjectId, spaceId: activeSpaceId, images }));

        message.success('Image renamed successfully');
        setErrorMessage(null);
      } catch (error) {
        console.error('Failed to rename image:', error);

        // Rollback - refresh from server
        const images = await fetchSpaceImages(user.uid, activeProjectId, activeSpaceId);
        dispatch(setSpaceImages({ projectId: activeProjectId, spaceId: activeSpaceId, images }));

        setErrorMessage('Failed to save renamed image. Please try again.');
      }
    },
    [user, activeProjectId, activeSpaceId, dispatch, setErrorMessage]
  );

  const handleOpenRenameModal = useCallback(
    (imageId: string) => {
      if (!activeProjectId || !activeSpaceId) {
        setErrorMessage('No project and space selected.');
        return;
      }

      const project = projects.find((p) => p.id === activeProjectId);
      if (!project) return;

      const space = project.spaces.find((s) => s.id === activeSpaceId);
      if (!space) return;

      // Find the image from both original and updated images
      const allImages = [...originalImages, ...updatedImages];
      const image = allImages.find((img) => img.id === imageId);

      if (image) {
        setImageToRename(image);
        setShowRenameModal(true);
      }
    },
    [activeProjectId, activeSpaceId, projects, originalImages, updatedImages]
  );

  const handleConfirmRename = useCallback(
    (imageId: string, newName: string) => {
      setShowRenameModal(false);
      setImageToRename(null);
      handleRenameImage(imageId, newName);
    },
    [handleRenameImage]
  );

  const handleImageSatisfied = useCallback(
    async (processedImageResult: { base64: string; mimeType: string }, customFileName: string) => {
      dispatch(setSourceImage(null));

      if (!user) {
        setErrorMessage('Please log in to save images.');
        return;
      }

      if (!processingContext.selectedImage) {
        setErrorMessage('Processing context lost. Please try again.');
        return;
      }

      if (!activeProjectId || !activeSpaceId) {
        setErrorMessage('No project and space selected. Please try again.');
        return;
      }

      const tempImageId = crypto.randomUUID();
      const now = Timestamp.fromDate(new Date());

      // Use custom name from modal
      const imageName = customFileName;

      // Create ImageOperation for evolution chain using utility function
      const operation: ImageOperation = formatImageOperationData(
        processingContext.selectedImage,
        selectedTaskNames[0] || GEMINI_TASKS.RECOLOR_WALL.task_name,
        processingContext.customPrompt,
        selectedColor,
        selectedTexture,
        selectedItem
      );

      // Calculate optimistic order value (max current order + 1) for generated images
      const currentMaxOrder = Math.max(0, ...updatedImages.map((img) => img.order ?? 0));
      const optimisticOrder = currentMaxOrder + 1;

      // Optimistic update - show processed image immediately
      const optimisticImage = {
        id: tempImageId,
        name: imageName,
        mimeType: processedImageResult.mimeType,
        spaceId: activeSpaceId,
        evolutionChain: [operation],
        parentImageId: processingContext.selectedImage.id,
        imageDownloadUrl: `data:${processedImageResult.mimeType};base64,${processedImageResult.base64}`,
        storageFilePath: '',
        order: optimisticOrder,
        isDeleted: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      dispatch(
        addImageOptimistic({
          projectId: activeProjectId!,
          spaceId: activeSpaceId!,
          image: optimisticImage,
        })
      );

      setShowConfirmationModal(false);
      setGeneratedImage(null);
      setProcessingContext({ selectedImage: null, customPrompt: undefined });

      try {
        // Save processed image to Firestore
        await createImage(
          user.uid,
          activeProjectId,
          activeSpaceId,
          null,
          {
            id: tempImageId,
            name: imageName,
            mimeType: processedImageResult.mimeType,
          },
          {
            base64: processedImageResult.base64,
            base64MimeType: processedImageResult.mimeType,
            parentImage: processingContext.selectedImage,
            operation,
          }
        );

        // Fetch updated space images to get real Firebase Storage URL
        dispatch(setIsFetchingSpaceImages(true));
        try {
          const images = await fetchSpaceImages(user.uid, activeProjectId, activeSpaceId);
          dispatch(setSpaceImages({ projectId: activeProjectId, spaceId: activeSpaceId, images }));
        } finally {
          dispatch(setIsFetchingSpaceImages(false));
        }
      } catch (error) {
        console.error('Failed to save processed image:', error);

        // Rollback on error
        dispatch(
          removeImageOptimistic({
            projectId: activeProjectId!,
            spaceId: activeSpaceId!,
            imageId: tempImageId,
          })
        );

        setErrorMessage(error instanceof Error ? error.message : 'Failed to save processed image.');
      }
    },
    [
      user,
      selectedColor,
      selectedTexture,
      selectedItem,
      updatedImages,
      selectedTaskNames,
      processingContext,
      activeProjectId,
      activeSpaceId,
      dispatch,
      setErrorMessage,
    ]
  );

  const handleCancelRecolor = useCallback(() => {
    setShowConfirmationModal(false);
    setGeneratedImage(null);
  }, []);

  const handleGenerateMoreSuccess = useCallback(async () => {
    if (!user || !activeProjectId || !activeSpaceId) return;

    try {
      dispatch(setIsFetchingSpaceImages(true));
      // Fetch updated space images from Firestore
      const images = await fetchSpaceImages(user.uid, activeProjectId, activeSpaceId);
      dispatch(setSpaceImages({ projectId: activeProjectId, spaceId: activeSpaceId, images }));
    } catch (error) {
      console.error('Failed to refresh images:', error);
      setErrorMessage('Failed to refresh images. Please reload the page.');
    } finally {
      dispatch(setIsFetchingSpaceImages(false));
    }
  }, [user, activeProjectId, activeSpaceId, dispatch, setErrorMessage]);

  const handleGenerateMoreCancel = useCallback(() => {
    dispatch(setSourceImage(null));
  }, [dispatch]);

  const handleSelectOriginalImage = useCallback(
    (imageId: string) => {
      // Single-select mode: toggle selection, max 1 image
      const newSet = new Set(selectedOriginalImageIds);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        // Clear and add only this one
        newSet.clear();
        newSet.add(imageId);
      }
      dispatch(setSelectedOriginalImageIds(newSet));
    },
    [selectedOriginalImageIds, dispatch]
  );

  const handleSelectMultipleOriginal = useCallback(
    (imageId: string) => {
      const newSet = new Set(selectedOriginalImageIds);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      dispatch(setSelectedOriginalImageIds(newSet));
    },
    [selectedOriginalImageIds, dispatch]
  );

  const handleBulkDelete = useCallback(
    async (imageType: 'original' | 'generated') => {
      const selectedImageIds =
        imageType === 'original' ? selectedOriginalImageIds : selectedUpdatedImageIds;
      const setSelectedImageIds =
        imageType === 'original' ? setSelectedOriginalImageIds : setSelectedUpdatedImageIds;

      if (selectedImageIds.size === 0) return;

      if (!user) {
        setErrorMessage('Please log in to delete images.');
        return;
      }

      if (!activeProjectId || !activeSpaceId) {
        setErrorMessage('No project and space selected. Please try again.');
        return;
      }

      setDeleteConfirmConfig({
        title: 'Delete Image',
        message: `Are you sure you want to delete ${selectedImageIds.size} selected ${imageType} photo(s)?\n\nThis action cannot be undone.`,
        onConfirm: async () => {
          try {
            setIsDeletingImages(true);

            // Optimistic update - remove immediately from UI
            dispatch(
              removeImagesOptimistic({
                projectId: activeProjectId!,
                spaceId: activeSpaceId!,
                imageIds: Array.from(selectedImageIds),
              })
            );

            dispatch(setSelectedImageIds(new Set()));

            // Delete images from Firestore and Firebase Storage
            await deleteImages(
              user.uid,
              activeProjectId,
              activeSpaceId,
              Array.from(selectedImageIds)
            );

            // Fetch updated space images to sync
            const images = await fetchSpaceImages(user.uid, activeProjectId, activeSpaceId);
            dispatch(
              setSpaceImages({ projectId: activeProjectId, spaceId: activeSpaceId, images })
            );

            setErrorMessage(null);

            setShowDeleteConfirmModal(false);
            setDeleteConfirmConfig(null);
          } catch (error) {
            console.error('Failed to delete images:', error);

            // Rollback - refresh from server
            const images = await fetchSpaceImages(user.uid, activeProjectId, activeSpaceId);
            dispatch(
              setSpaceImages({ projectId: activeProjectId, spaceId: activeSpaceId, images })
            );

            setErrorMessage('Failed to delete images.');
          } finally {
            setIsDeletingImages(false);
          }
        },
      });
      setShowDeleteConfirmModal(true);
    },
    [
      selectedOriginalImageIds,
      selectedUpdatedImageIds,
      user,
      activeProjectId,
      activeSpaceId,
      dispatch,
      setErrorMessage,
    ]
  );

  const handleClearOriginalSelection = useCallback(() => {
    dispatch(setSelectedOriginalImageIds(new Set()));
  }, [dispatch]);

  const handleSelectAllOriginal = useCallback(() => {
    const allIds = new Set(originalImages.map((img) => img.id));
    dispatch(setSelectedOriginalImageIds(allIds));
  }, [originalImages, dispatch]);

  // Multi-select handlers for updated photos
  const handleSelectUpdatedImage = useCallback(
    (imageId: string) => {
      const newSet = new Set(selectedUpdatedImageIds);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      dispatch(setSelectedUpdatedImageIds(newSet));
    },
    [selectedUpdatedImageIds, dispatch]
  );

  const handleClearUpdatedSelection = useCallback(() => {
    dispatch(setSelectedUpdatedImageIds(new Set()));
  }, [dispatch]);

  const handleSelectAllUpdated = useCallback(() => {
    const allIds = new Set(updatedImages.map((img) => img.id));
    dispatch(setSelectedUpdatedImageIds(allIds));
  }, [updatedImages, dispatch]);

  const handleBulkDownload = useCallback(
    (imageType: 'original' | 'generated') => {
      const selectedImageIds =
        imageType === 'original' ? selectedOriginalImageIds : selectedUpdatedImageIds;
      const imagesToDownload = imageType === 'original' ? originalImages : updatedImages;

      if (selectedImageIds.size === 0) return;

      // Download each selected image
      imagesToDownload.forEach((img) => {
        if (selectedImageIds.has(img.id)) {
          const filename = buildDownloadFilename(img.name, img.mimeType);
          downloadFile(img.imageDownloadUrl, filename).catch((error) => {
            console.error('Download failed for image:', img.id, error);
            setErrorMessage('Failed to download one or more images. Please try again.');
          });
        }
      });
    },
    [
      selectedOriginalImageIds,
      selectedUpdatedImageIds,
      originalImages,
      updatedImages,
      setErrorMessage,
    ]
  );

  const handleBulkCopy = useCallback(
    (imageType: 'original' | 'generated') => {
      const selectedImageIds =
        imageType === 'original' ? selectedOriginalImageIds : selectedUpdatedImageIds;

      if (selectedImageIds.size === 0) return;

      setImageTypeToCopy(imageType);
      setShowCopyModal(true);
    },
    [selectedOriginalImageIds, selectedUpdatedImageIds]
  );

  const handleCopyConfirm = useCallback(async () => {
    if (!user) {
      setErrorMessage('Please log in to copy images.');
      return;
    }

    if (!activeProjectId || !activeSpaceId || !imageTypeToCopy) {
      setErrorMessage('No project and space selected. Please try again.');
      return;
    }

    const selectedImageIds =
      imageTypeToCopy === 'original' ? selectedOriginalImageIds : selectedUpdatedImageIds;
    const imagesToCopy = imageTypeToCopy === 'original' ? originalImages : updatedImages;

    if (selectedImageIds.size === 0) return;

    setIsCopyingImages(true);
    try {
      // Copy each selected image
      const imagesToCopyArray = imagesToCopy.filter((img) => selectedImageIds.has(img.id));

      for (const sourceImage of imagesToCopyArray) {
        // Generate name by appending " Copy" to the original image name
        const finalName = `${sourceImage.name} Copy`;

        const newImage = await duplicateImage(
          user.uid,
          activeProjectId,
          activeSpaceId,
          sourceImage.id,
          finalName
        );

        // Optimistic update - add the new image immediately to UI
        dispatch(
          addImageOptimistic({
            projectId: activeProjectId,
            spaceId: activeSpaceId,
            image: newImage,
          })
        );
      }

      // Fetch updated space images to sync with server
      const images = await fetchSpaceImages(user.uid, activeProjectId, activeSpaceId);
      dispatch(setSpaceImages({ projectId: activeProjectId, spaceId: activeSpaceId, images }));

      // Clear selection and close modal
      if (imageTypeToCopy === 'original') {
        dispatch(setSelectedOriginalImageIds(new Set()));
      } else {
        dispatch(setSelectedUpdatedImageIds(new Set()));
      }

      setShowCopyModal(false);
      setImageTypeToCopy(null);
      setErrorMessage(null);

      message.success(`${imagesToCopyArray.length} image(s) copied successfully!`);
    } catch (error) {
      console.error('Failed to copy images:', error);

      // Rollback - refresh from server
      try {
        const images = await fetchSpaceImages(user.uid, activeProjectId, activeSpaceId);
        dispatch(setSpaceImages({ projectId: activeProjectId, spaceId: activeSpaceId, images }));
      } catch (refreshError) {
        console.error('Failed to refresh images:', refreshError);
      }

      setErrorMessage('Failed to copy images. Please try again.');
    } finally {
      setIsCopyingImages(false);
    }
  }, [
    user,
    activeProjectId,
    activeSpaceId,
    imageTypeToCopy,
    selectedOriginalImageIds,
    selectedUpdatedImageIds,
    originalImages,
    updatedImages,
    dispatch,
    setErrorMessage,
  ]);

  const handleReorderOriginalImages = useCallback(
    (newOrderedImageIds: string[]) => {
      if (!user || !activeProjectId || !activeSpaceId) return;
      reorderImagesWithDebounce(
        user.uid,
        activeProjectId,
        activeSpaceId,
        newOrderedImageIds,
        originalImages
      )(dispatch);
    },
    [user, activeProjectId, activeSpaceId, originalImages, dispatch]
  );

  const handleReorderGeneratedImages = useCallback(
    (newOrderedImageIds: string[]) => {
      if (!user || !activeProjectId || !activeSpaceId) return;
      reorderImagesWithDebounce(
        user.uid,
        activeProjectId,
        activeSpaceId,
        newOrderedImageIds,
        updatedImages
      )(dispatch);
    },
    [user, activeProjectId, activeSpaceId, updatedImages, dispatch]
  );

  // Single image operations
  const handleSingleRename = useCallback(
    (imageId: string) => {
      handleOpenRenameModal(imageId);
    },
    [handleOpenRenameModal]
  );

  const handleSingleCopy = useCallback(
    (imageId: string) => {
      const image = [...originalImages, ...updatedImages].find((img) => img.id === imageId);
      if (!image) return;

      // Select this image and trigger bulk copy
      const isOriginal = originalImages.some((img) => img.id === imageId);
      const imageType = isOriginal ? 'original' : 'generated';

      // Temporarily set selection to this single image
      if (isOriginal) {
        dispatch(setSelectedOriginalImageIds(new Set([imageId])));
      } else {
        dispatch(setSelectedUpdatedImageIds(new Set([imageId])));
      }

      // Show copy modal
      setImageTypeToCopy(imageType);
      setShowCopyModal(true);
    },
    [originalImages, updatedImages, dispatch]
  );

  const handleBulkMove = useCallback(
    (imageType: 'original' | 'generated') => {
      const selectedIds =
        imageType === 'original' ? selectedOriginalImageIds : selectedUpdatedImageIds;
      const images = imageType === 'original' ? originalImages : updatedImages;

      if (selectedIds.size === 0) return;

      // For bulk move, we'll use the first selected image for the modal display
      // But we'll move all selected images
      const firstImageId = Array.from(selectedIds)[0];
      const firstImage = images.find((img) => img.id === firstImageId);

      if (!firstImage) return;

      setImageTypeToMove(imageType);
      setImagesToMove(
        Array.from(selectedIds)
          .map((id) => images.find((img) => img.id === id)!)
          .filter(Boolean)
      );
      setShowMoveModal(true);
    },
    [selectedOriginalImageIds, selectedUpdatedImageIds, originalImages, updatedImages]
  );

  const handleMoveConfirm = useCallback(
    async (targetSpaceId: string, newSpaceName?: string, copyAsOriginal?: boolean) => {
      if (!user || !activeProjectId || !activeSpaceId || imagesToMove.length === 0) return;

      try {
        setIsMovingImage(true);

        let finalTargetSpaceId = targetSpaceId;

        // Create new space if requested
        if (newSpaceName) {
          const newSpace = await createSpace(user.uid, activeProjectId, newSpaceName);
          finalTargetSpaceId = newSpace.id;

          // Add to Redux state
          dispatch(
            addSpace({
              projectId: activeProjectId,
              space: newSpace,
            })
          );
        }

        // If copying as originals is requested, perform that flow
        if (copyAsOriginal) {
          const copyPromises = imagesToMove.map((image) =>
            copyImageAsOriginal(
              user.uid,
              activeProjectId,
              activeSpaceId,
              image.id,
              activeProjectId,
              finalTargetSpaceId
            )
          );
          await Promise.all(copyPromises);

          // Optimistic remove from current space
          dispatch(
            removeImagesOptimistic({
              projectId: activeProjectId,
              spaceId: activeSpaceId,
              imageIds: imagesToMove.map((img) => img.id),
            })
          );

          // Refresh both source and target spaces
          const [sourceImages, targetImages] = await Promise.all([
            fetchSpaceImages(user.uid, activeProjectId, activeSpaceId),
            fetchSpaceImages(user.uid, activeProjectId, finalTargetSpaceId),
          ]);

          dispatch(
            setSpaceImages({
              projectId: activeProjectId,
              spaceId: activeSpaceId,
              images: sourceImages,
            })
          );
          dispatch(
            setSpaceImages({
              projectId: activeProjectId,
              spaceId: finalTargetSpaceId,
              images: targetImages,
            })
          );
        } else {
          // Move all selected images
          const movePromises = imagesToMove.map((image) =>
            moveImageToSpace(
              user.uid,
              activeProjectId,
              activeSpaceId,
              image.id,
              activeProjectId,
              finalTargetSpaceId
            )
          );

          await Promise.all(movePromises);
        }

        // Update Redux state - remove images from current space (skip if copyAsOriginal already handled it)
        if (!copyAsOriginal) {
          dispatch(
            removeImagesOptimistic({
              projectId: activeProjectId,
              spaceId: activeSpaceId,
              imageIds: imagesToMove.map((img) => img.id),
            })
          );
        }

        // Clear selection
        if (imageTypeToMove === 'original') {
          dispatch(setSelectedOriginalImageIds(new Set()));
        } else {
          dispatch(setSelectedUpdatedImageIds(new Set()));
        }

        setShowMoveModal(false);
        setImagesToMove([]);
        setImageTypeToMove(null);

        const actionLabel = copyAsOriginal ? 'copied as originals to ' : 'moved to ';

        message.success(
          <span>
            {`${imagesToMove.length} image${imagesToMove.length > 1 ? 's' : ''} ${actionLabel}`}
            <a
              onClick={() => {
                const project = projects.find((p) => p.id === activeProjectId);
                const space = project?.spaces.find((s) => s.id === finalTargetSpaceId);
                // Use newly created space name as fallback when project state hasn't updated yet
                const spaceNameToUse = newSpaceName || space?.name;
                if (project && spaceNameToUse) {
                  // Update Redux state so LandingPage reacts (same as MyBreadcrumb)
                  dispatch(setActiveProjectId(activeProjectId));
                  dispatch(setActiveSpaceId(finalTargetSpaceId));

                  navigate(
                    generateRoute.space(
                      project.name,
                      activeProjectId,
                      spaceNameToUse,
                      finalTargetSpaceId
                    )
                  );
                }
              }}
              style={{ color: '#1890ff', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {newSpaceName ||
                projects
                  .find((p) => p.id === activeProjectId)
                  ?.spaces.find((s) => s.id === finalTargetSpaceId)?.name ||
                'target space'}
            </a>
            {' successfully'}
          </span>
        );
      } catch (error) {
        console.error('Failed to move image:', error);
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to move image. Please try again.'
        );
      } finally {
        setIsMovingImage(false);
      }
    },
    [
      user,
      activeProjectId,
      activeSpaceId,
      imagesToMove,
      imageTypeToMove,
      dispatch,
      projects,
      navigate,
    ]
  );

  const getEmptyStateComponent = useMemo(() => {
    // Guest mode: don't show empty state, show main content
    if (isGuestMode) {
      return null;
    }

    const hasNoProject = projects.length === 0 || !activeProjectId;
    const hasNoSpace = !activeSpaceId;

    if (hasNoProject) {
      return (
        <EmptyState
          title="No Project Yet"
          message="Create or select a project to start designing!"
        />
      );
    } else if (hasNoSpace) {
      return <EmptyState title="No Space Yet" message="Create or select a space to get started!" />;
    }

    return null;
  }, [activeProjectId, activeSpaceId, projects.length, isGuestMode]);

  const selectedOriginalImageId = Array.from(selectedOriginalImageIds)[0] || null;
  const selectedOriginalImage =
    originalImages.find((img) => img.id === selectedOriginalImageId) || null;

  return (
    <div className="flex bg-gray-50">
      <AsideSection />
      <main
        className="flex-1 overflow-scroll"
        style={{ height: 'calc(100vh - var(--header-height))' }}
      >
        <div
          className="bg-gray-100"
          style={{ minHeight: 'calc(100vh - var(--header-height) - var(--footer-height))' }}
        >
          <div className="flex items-end justify-between pr-6">
            <MyBreadcrumb onStartTour={() => tourRef.current?.openTour()} />
            {imageLimitInfo && (
              <Tag variant="outlined" color="purple">
                {imageLimitInfo.current} / {imageLimitInfo.max} images in space
              </Tag>
            )}
          </div>
          <div className="p-6">
            {!isAppInitiated ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : initError ? (
              <div className="flex items-center justify-center">
                <div className="text-center max-w-md p-6">
                  <div className="text-red-600 text-5xl mb-4">🤯</div>
                  <h2 className="text-xl text-gray-600 mb-2">Sorry, something went wrong.</h2>
                  <span>{initError}</span>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-blue-700 transition"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <>
                {getEmptyStateComponent}

                {(activeSpaceId || isGuestMode) && (
                  <div className="flex flex-col gap-6">
                    <div data-tour="original-gallery">
                      <Gallery
                        title="Original Images"
                        images={originalImages}
                        selectedImageIds={selectedOriginalImageIds}
                        onSelectImage={handleSelectOriginalImage}
                        onSelectMultiple={handleSelectMultipleOriginal}
                        onRenameImage={handleRenameImage}
                        showRemoveButtons={selectedOriginalImageIds.size === 0}
                        emptyMessage="No images uploaded yet."
                        onUploadImage={handleImageUpload}
                        onBulkDownload={() => handleBulkDownload('original')}
                        onUploadError={setErrorMessage}
                        onBulkDelete={() => handleBulkDelete('original')}
                        onBulkCopy={() => handleBulkCopy('original')}
                        onBulkMove={() => handleBulkMove('original')}
                        onClearSelection={handleClearOriginalSelection}
                        onSelectAll={handleSelectAllOriginal}
                        onGenerateMoreSuccess={handleGenerateMoreSuccess}
                        userId={user?.uid}
                        isImageLimitReached={!imageLimitCheck.canAdd}
                        onReorder={handleReorderOriginalImages}
                        onSingleRename={handleSingleRename}
                        onSingleCopy={handleSingleCopy}
                        isLoading={isFetchingSpaceImages}
                      />
                    </div>

                    {selectedTaskNames[0] === GEMINI_TASKS.RECOLOR_WALL.task_name && (
                      <div data-tour="color-select">
                        <ColorSelect selectedColor={selectedColor} />
                      </div>
                    )}
                    {selectedTaskNames[0] === GEMINI_TASKS.ADD_TEXTURE.task_name && (
                      <TextureOrItemSelect type="texture" onError={setErrorMessage} />
                    )}
                    {selectedTaskNames[0] === GEMINI_TASKS.ADD_HOME_ITEM.task_name && (
                      <TextureOrItemSelect type="item" onError={setErrorMessage} />
                    )}

                    <div data-tour="generated-gallery">
                      <Gallery
                        title="Generated Images"
                        images={updatedImages}
                        selectedImageIds={selectedUpdatedImageIds}
                        onSelectMultiple={handleSelectUpdatedImage}
                        onRenameImage={handleRenameImage}
                        emptyMessage="No generated images yet."
                        onBulkDelete={() => handleBulkDelete('generated')}
                        onBulkCopy={() => handleBulkCopy('generated')}
                        onBulkMove={() => handleBulkMove('generated')}
                        onClearSelection={handleClearUpdatedSelection}
                        onSelectAll={handleSelectAllUpdated}
                        onBulkDownload={() => handleBulkDownload('generated')}
                        onGenerateMoreSuccess={handleGenerateMoreSuccess}
                        userId={user?.uid}
                        isImageLimitReached={!imageLimitCheck.canAdd}
                        onReorder={handleReorderGeneratedImages}
                        onSingleRename={handleSingleRename}
                        onSingleCopy={handleSingleCopy}
                        isLoading={isFetchingSpaceImages}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <Footer />
      </main>

      {showConfirmationModal && selectedOriginalImage && (
        <ConfirmImageUpdateModal
          isOpen={showConfirmationModal}
          originalImage={selectedOriginalImage}
          generatedImage={generatedImage}
          onConfirm={handleImageSatisfied}
          onCancel={handleCancelRecolor}
          colorName={selectedColor?.name || 'N/A'}
          taskName={selectedTaskNames[0] || GEMINI_TASKS.RECOLOR_WALL.task_name}
        />
      )}

      {/* Generic Delete Confirmation Modal */}
      {showDeleteConfirmModal && deleteConfirmConfig && (
        <GenericConfirmModal
          isOpen={showDeleteConfirmModal}
          title={deleteConfirmConfig.title}
          message={deleteConfirmConfig.message}
          confirmButtonText="Delete"
          cancelButtonText="Cancel"
          confirmButtonColor="red"
          onConfirm={deleteConfirmConfig.onConfirm}
          onCancel={() => {
            setShowDeleteConfirmModal(false);
            setDeleteConfirmConfig(null);
          }}
          isLoading={isDeletingImages}
        />
      )}

      {/* Copy Image Modal */}
      {showCopyModal && imageTypeToCopy && (
        <CopyImageModal
          isOpen={showCopyModal}
          numberOfImages={
            imageTypeToCopy === 'original'
              ? selectedOriginalImageIds.size
              : selectedUpdatedImageIds.size
          }
          imageType={imageTypeToCopy}
          onConfirm={handleCopyConfirm}
          onCancel={() => {
            setShowCopyModal(false);
            setImageTypeToCopy(null);
          }}
          isLoading={isCopyingImages}
        />
      )}

      {/* Move Image Modal */}
      {showMoveModal && imagesToMove.length > 0 && (
        <MoveImageModal
          isOpen={showMoveModal}
          numberOfImages={imagesToMove.length}
          onConfirm={handleMoveConfirm}
          onCancel={() => {
            setShowMoveModal(false);
            setImagesToMove([]);
            setImageTypeToMove(null);
          }}
          isLoading={isMovingImage}
          allowCopyAsOriginal={
            imagesToMove.length > 0 && imagesToMove.every((img) => !!img.parentImageId) && !!user
          }
        />
      )}

      {/* Generate More Modal */}
      {showGenerateMoreModal && sourceImage && (
        <GenerateMoreModal
          ref={generateModalRef}
          isOpen={showGenerateMoreModal()}
          sourceImage={sourceImage}
          userId={user?.uid}
          onSuccess={() => {
            handleGenerateMoreCancel();
            handleGenerateMoreSuccess();
          }}
          onCancel={handleGenerateMoreCancel}
          onGenerateClick={() => {
            // Close the tour when generate button is clicked
            tourRef.current?.closeTour();
          }}
        />
      )}

      {/* Rename Image Modal */}
      {imageToRename && (
        <RenameImageModal
          isOpen={showRenameModal}
          image={imageToRename}
          onConfirm={handleConfirmRename}
          onCancel={() => {
            setShowRenameModal(false);
            setImageToRename(null);
          }}
        />
      )}

      {/* Guest Onboarding Tour */}
      <GuestOnboardingTour ref={tourRef} generateModalRef={generateModalRef} />

      {/* Initial Greeting Modal for Guests */}
      <GreetingModal
        open={isGreetingModalOpen}
        onSignIn={handleGreetingSignIn}
        onTakeTour={handleGreetingTakeTour}
        onClose={handleCloseGreetingModal}
      />
    </div>
  );
};

export default LandingPage;
