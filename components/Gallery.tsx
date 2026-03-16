import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { ImageData } from '@/types';
import { ASSET_IMAGE } from '@/constants/constants';
import {
  selectSelectedOriginalImageIds,
  selectSelectedUpdatedImageIds,
  selectAllImages,
} from '@/stores/imageStore';
import { selectGuestImages } from '@/stores/guestStore';
import { RootState } from '@/stores/store';
import AssetCard from './ui/AssetCard';
import SortableAssetCard from './ui/SortableAssetCard';
import { Card } from 'antd';
import { devError, devWarn } from '@/utils/devLogger';
import MyEmpty from '@/components/ui/MyEmpty';
import { setShowLoginRequiredModal } from '@/stores/guestStore';
import { useGuest } from '@/contexts/GuestContext';

// Extracted Sub-components
import GalleryToolbar from './gallery/GalleryToolbar';
import GallerySkeleton from './gallery/GallerySkeleton';
import GalleryModals from './gallery/GalleryModals';

interface GalleryProps {
  title: string;
  images: ImageData[];
  selectedImageId?: string | null;
  selectedImageIds?: Set<string>;
  onSelectImage?: (imageId: string, event?: React.MouseEvent) => void;
  onSelectMultiple?: (imageId: string, event?: React.MouseEvent) => void;
  onRenameImage?: (imageId: string, newName: string, description: string) => void;
  showDownloadButtons?: boolean;
  onRemoveImage?: (imageId: string) => void;
  showRemoveButtons?: boolean;
  emptyMessage: string;
  onUploadImage?: (
    file: File,
    metadata: {
      width?: number;
      height?: number;
      aspect_ratio?: number;
      name: string;
      description: string;
    }
  ) => Promise<void>;
  onUploadError?: (message: string) => void;
  onBulkDelete?: () => void;
  onBulkDownload?: () => void;
  onBulkCopy?: () => void;
  onBulkMove?: () => void;
  onClearSelection?: () => void;
  onSelectAll?: () => void;
  onGenerateMoreSuccess?: () => void;
  userId?: string | undefined;
  isImageLimitReached?: boolean;
  onReorder?: (newOrderedImageIds: string[]) => void;
  isLoading?: boolean;
  onSingleRename?: (imageId: string) => void;
  onSingleDelete?: (imageId: string) => void;
  onSingleCopy?: (imageId: string) => void;
  onSingleUpscale?: (imageId: string) => void;
  uploadButtonText?: string;
  uploadModalTitle?: string;
  batchUploadMode?: 'image' | 'asset';
  assetType?: 'image' | 'texture' | 'item' | 'color';
  existingNames?: Set<string>;
  renderItemPreview?: (image: ImageData) => React.ReactNode;
  showViewButton?: boolean;
  detailModalTitle?: string;
  editLabel?: string;
  viewMoreModalTitle?: string;
  showCompare?: boolean;
}

const Gallery: React.FC<GalleryProps> = ({
  title,
  images,
  selectedImageIds = new Set(),
  emptyMessage,
  isImageLimitReached = false,
  isLoading = false,
  onClearSelection,
  onUploadImage,
  onUploadError,
  onBulkDelete,
  onBulkDownload,
  onBulkCopy,
  onBulkMove,
  onReorder,
  onSelectImage,
  onSelectMultiple,
  onSingleRename,
  onSingleDelete,
  onSingleCopy,
  onSingleUpscale,
  uploadButtonText = 'Images',
  uploadModalTitle = 'Upload Images',
  batchUploadMode = 'image',
  assetType,
  existingNames,
  renderItemPreview,
  showViewButton = true,
  detailModalTitle,
  editLabel = 'Edit',
  showCompare = true,
}) => {
  const dispatch = useDispatch();
  const { isGuestMode } = useGuest();
  
  // State for ImageDisplayModal
  const [showImageDisplayModal, setShowImageDisplayModal] = useState<boolean>(false);
  const [imageToDisplayInModal, setImageToDisplayInModal] = useState<ImageData | null>(null);

  // State for GenerationHistoryModal
  const [showGenerationHistoryModal, setShowGenerationHistoryModal] = useState<boolean>(false);
  const [imageForGenerationHistory, setImageForGenerationHistory] = useState<ImageData | null>(
    null
  );

  // State for BatchUploadModal
  const [showBatchUploadModal, setShowBatchUploadModal] = useState<boolean>(false);

  // Drag and drop state
  const [activeId, setActiveId] = useState<string | null>(null);

  // Selection state for drag selection
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Layout mode: 'Kanban' (grid) or 'List' (vertical list)
  const [layoutMode, setLayoutMode] = useState<'Kanban' | 'List'>('Kanban');

  const galleryRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleExpandPhotoImage = useCallback((imageData: ImageData) => {
    setImageToDisplayInModal(imageData);
    setShowImageDisplayModal(true);
  }, []);

  const handleCloseImageDisplayModal = useCallback(() => {
    setShowImageDisplayModal(false);
    setImageToDisplayInModal(null);
  }, []);

  const onViewGenerationHistoryClick = useCallback((imageData: ImageData) => {
    setImageForGenerationHistory(imageData);
    setShowGenerationHistoryModal(true);
  }, []);

  const handleCloseGenerationHistoryModal = useCallback(() => {
    setShowGenerationHistoryModal(false);
    setImageForGenerationHistory(null);
  }, []);

  // Calculate current image index
  const currentImageIndex = useMemo(() => 
    imageToDisplayInModal ? images.findIndex((img) => img.id === imageToDisplayInModal.id) : -1,
    [imageToDisplayInModal, images]
  );

  const handlePrevious = useCallback(() => {
    if (currentImageIndex > 0) {
      setImageToDisplayInModal(images[currentImageIndex - 1]);
    }
  }, [currentImageIndex, images]);

  const handleNext = useCallback(() => {
    if (currentImageIndex >= 0 && currentImageIndex < images.length - 1) {
      setImageToDisplayInModal(images[currentImageIndex + 1]);
    }
  }, [currentImageIndex, images]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = images.findIndex((img) => img.id === active.id);
      const newIndex = images.findIndex((img) => img.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newImages = [...images];
        const [movedImage] = newImages.splice(oldIndex, 1);
        newImages.splice(newIndex, 0, movedImage);

        const newOrderedImageIds = newImages.map((img) => img.id);
        onReorder?.(newOrderedImageIds);
      }
    },
    [images, onReorder]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const handleCardClick = useCallback(
    (imageId: string, event?: React.MouseEvent) => {
      if (event?.shiftKey) {
        onSelectMultiple?.(imageId, event);
      } else {
        onSelectImage?.(imageId, event);
      }
    },
    [onSelectMultiple, onSelectImage]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-card-id]')) {
        return;
      }

      const rect = galleryRef.current?.getBoundingClientRect();
      if (!rect) return;

      onClearSelection?.();

      setIsSelecting(true);
      setSelectionStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setSelectionBox(null);
    },
    [onClearSelection]
  );

  useEffect(() => {
    if (!isSelecting) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!selectionStart || !galleryRef.current) return;

      const rect = galleryRef.current.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const box = {
        x: Math.min(selectionStart.x, currentX),
        y: Math.min(selectionStart.y, currentY),
        width: Math.abs(currentX - selectionStart.x),
        height: Math.abs(currentY - selectionStart.y),
      };

      setSelectionBox(box);

      if (onSelectMultiple) {
        cardRefs.current.forEach((cardElement, imageId) => {
          const cardRect = cardElement.getBoundingClientRect();
          const galleryRect = galleryRef.current!.getBoundingClientRect();

          const cardBox = {
            x: cardRect.left - galleryRect.left,
            y: cardRect.top - galleryRect.top,
            width: cardRect.width,
            height: cardRect.height,
          };

          const intersects =
            box.x < cardBox.x + cardBox.width &&
            box.x + box.width > cardBox.x &&
            box.y < cardBox.y + cardBox.height &&
            box.y + box.height > cardBox.y;

          if (intersects && !selectedImageIds.has(imageId)) {
            onSelectMultiple(imageId);
          }
        });
      }
    };

    const onMouseUp = () => {
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionBox(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isSelecting, selectionStart, onSelectMultiple, selectedImageIds]);

  const hasSelection = selectedImageIds.size > 0;

  const selectedOriginalImageIds = useSelector((state: RootState) =>
    selectSelectedOriginalImageIds(state)
  );
  const selectedUpdatedImageIds = useSelector((state: RootState) =>
    selectSelectedUpdatedImageIds(state)
  );

  const storeAllImages = useSelector((state: RootState) => selectAllImages(state));
  const guestImages = useSelector((state: RootState) => selectGuestImages(state));
  const allImages = isGuestMode ? guestImages : storeAllImages;

  const totalSelectedItems = useMemo(() => {
    if (assetType === ASSET_IMAGE) {
      return selectedOriginalImageIds.size + selectedUpdatedImageIds.size;
    } else if (assetType) {
      return selectedImageIds?.size || 0;
    }
    return selectedOriginalImageIds.size + selectedUpdatedImageIds.size;
  }, [selectedImageIds, selectedOriginalImageIds, selectedUpdatedImageIds, assetType]);

  const allSelectedItemsForComparison = useMemo(() => {
    if (assetType === ASSET_IMAGE) {
      const selected: ImageData[] = [];
      const allSelectedIds = new Set([...selectedOriginalImageIds, ...selectedUpdatedImageIds]);

      allSelectedIds.forEach((id) => {
        const img = allImages.find((i) => i.id === id);
        if (img) selected.push(img);
      });

      return selected;
    }

    if (assetType && selectedImageIds && selectedImageIds.size > 0) {
      return images.filter((img) => selectedImageIds.has(img.id));
    }

    return [];
  }, [
    selectedImageIds,
    images,
    selectedOriginalImageIds,
    selectedUpdatedImageIds,
    allImages,
    assetType,
  ]);

  const totalImageCount = useMemo(() => allImages.length, [allImages]);

  const handleBatchUpload = async (
    filesWithMetadata: Array<{
      file: File;
      width: number;
      height: number;
      name?: string;
      description?: string;
    }>
  ) => {
    if (!onUploadImage) return;

    for (const fileData of filesWithMetadata) {
      const { file, width, height, name: customName, description = '' } = fileData;
      const name = customName || file.name;
      try {
        const aspect_ratio = width && height ? width / height : undefined;
        await onUploadImage(file, {
          width,
          height,
          aspect_ratio: aspect_ratio || 1,
          name,
          description,
        });
      } catch (error) {
        devError('Failed to upload file:', file.name, error);
        onUploadError?.(`Failed to upload ${file.name}`);
        throw error;
      }
    }
  };

  const onUploadClick = useCallback(() => {
    if (isGuestMode) {
      dispatch(setShowLoginRequiredModal(true));
      return;
    }

    if (onUploadImage) {
      const fn = onUploadImage as (...args: unknown[]) => unknown;
      if (fn.length === 0) {
        try {
          fn();
          return;
        } catch (err) {
          devWarn('onUploadImage handler threw when invoked without args:', err);
        }
      }
    }

    if (!isImageLimitReached) {
      setShowBatchUploadModal(true);
    }
  }, [isGuestMode, onUploadImage, isImageLimitReached, dispatch]);

  const activeImage = activeId ? images.find((img) => img.id === activeId) : null;

  const galleryContent = (
    <>
      {isLoading ? (
        <GallerySkeleton layoutMode={layoutMode} />
      ) : images.length === 0 ? (
        <div className="p-8">
          <MyEmpty description={emptyMessage} />
        </div>
      ) : (
        <div
          ref={galleryRef}
          onMouseDown={handleMouseDown}
          className={
            layoutMode === 'Kanban'
              ? 'grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 p-6 relative select-none'
              : 'flex flex-col gap-4 p-6 relative select-none'
          }
        >
          <SortableContext items={images.map((img) => img.id)} strategy={rectSortingStrategy}>
            {images.map((image) => (
              <div
                key={image.id}
                data-card-id={image.id}
                ref={(el) => {
                  if (el) {
                    cardRefs.current.set(image.id, el);
                  } else {
                    cardRefs.current.delete(image.id);
                  }
                }}
              >
                <SortableAssetCard
                  asset={image}
                  isSelected={selectedImageIds.has(image.id)}
                  layout={layoutMode === 'List' ? 'list' : 'grid'}
                  onSelect={(e?: React.MouseEvent) => handleCardClick(image.id, e)}
                  onViewExpand={() => handleExpandPhotoImage(image)}
                  onViewDetails={() => onViewGenerationHistoryClick(image)}
                  onRename={onSingleRename ? () => onSingleRename(image.id) : undefined}
                  onDelete={onSingleDelete ? () => onSingleDelete(image.id) : undefined}
                  onCopy={onSingleCopy ? () => onSingleCopy(image.id) : undefined}
                  onUpscale={onSingleUpscale ? () => onSingleUpscale(image.id) : undefined}
                  renderPreview={renderItemPreview ? () => renderItemPreview(image) : undefined}
                  showViewButton={showViewButton}
                  editLabel={editLabel}
                />
              </div>
            ))}
          </SortableContext>

          {selectionBox && (
            <div
              style={{
                position: 'absolute',
                left: selectionBox.x,
                top: selectionBox.y,
                width: selectionBox.width,
                height: selectionBox.height,
                border: '2px dashed #cccccc',
                backgroundColor: 'indigo',
                opacity: 0.1,
                pointerEvents: 'none',
                zIndex: 1000,
              }}
            />
          )}
        </div>
      )}
    </>
  );

  return (
    <Card 
      title={
        <GalleryToolbar 
          title={title}
          hasSelection={hasSelection}
          selectedCount={selectedImageIds.size}
          onClearSelection={onClearSelection}
          showCompare={showCompare}
          totalSelectedItems={totalSelectedItems}
          allSelectedItemsForComparison={allSelectedItemsForComparison}
          onBulkDownload={onBulkDownload}
          onBulkCopy={onBulkCopy}
          onBulkMove={onBulkMove}
          onBulkDelete={onBulkDelete}
          onUploadClick={onUploadClick}
          isImageLimitReached={isImageLimitReached}
          isGuestMode={isGuestMode}
          uploadButtonText={uploadButtonText}
          layoutMode={layoutMode}
          onLayoutChange={setLayoutMode}
          hasImages={images.length > 0}
        />
      } 
      styles={{ body: { padding: 0 } }}
    >
      {onReorder ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {galleryContent}
          <DragOverlay>
            {activeImage ? (
              <div style={{ opacity: 0.8, transform: 'scale(1.05)' }}>
                <AssetCard
                  asset={activeImage}
                  isSelected={selectedImageIds.has(activeImage.id)}
                  onSelect={() => {}}
                  onViewExpand={() => {}}
                  onViewDetails={() => {}}
                  layout={layoutMode === 'List' ? 'list' : 'grid'}
                  renderPreview={
                    activeImage && renderItemPreview
                      ? () => renderItemPreview(activeImage)
                      : undefined
                  }
                  showViewButton={showViewButton}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        galleryContent
      )}

      <GalleryModals 
        imageToDisplayInModal={imageToDisplayInModal}
        showImageDisplayModal={showImageDisplayModal}
        onCloseImageDisplayModal={handleCloseImageDisplayModal}
        currentImageIndex={currentImageIndex}
        totalImages={images.length}
        handlePrevious={handlePrevious}
        handleNext={handleNext}
        renderItemPreview={renderItemPreview}
        detailModalTitle={detailModalTitle}
        onSingleRename={onSingleRename}
        imageForGenerationHistory={imageForGenerationHistory}
        showGenerationHistoryModal={showGenerationHistoryModal}
        onCloseGenerationHistoryModal={handleCloseGenerationHistoryModal}
        onUploadImage={onUploadImage}
        onUploadError={onUploadError}
        showBatchUploadModal={showBatchUploadModal}
        setShowBatchUploadModal={setShowBatchUploadModal}
        handleBatchUpload={handleBatchUpload}
        totalImageCount={totalImageCount}
        uploadModalTitle={uploadModalTitle}
        batchUploadMode={batchUploadMode}
        assetType={assetType}
        existingNames={existingNames}
      />
    </Card>
  );
};

export default React.memo(Gallery);
