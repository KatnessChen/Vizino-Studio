import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
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
import {
  selectSelectedOriginalImageIds,
  selectSelectedUpdatedImageIds,
  selectAllImages,
} from '@/stores/imageStore';
import { selectGuestImages } from '@/stores/guestStore';
import { RootState } from '@/stores/store';
import AssetCard from './ui/AssetCard';
import SortableAssetCard from './ui/SortableAssetCard';
import ImageDisplayModal from './modal/ImageDisplayModal';
import ViewMoreDisplayModal from './modal/ViewMoreDisplayModal';
import BatchUploadModal from './modal/BatchUploadModal';
import ImagesComparingButton from './button/ImagesComparingButton';
import { Card, Button, Tooltip, Skeleton, Segmented } from 'antd';
import { BarsOutlined, AppstoreOutlined, LockOutlined } from '@ant-design/icons';
import MyEmpty from '@/components/ui/MyEmpty';
import {
  DriveFileMoveOutline as DriveFileMoveOutline,
  Downloading as DownloadIcon,
  DeleteOutlined as DeleteIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { PlusOutlined } from '@ant-design/icons';
import { useGuest } from '@/contexts/GuestContext';

interface GalleryProps {
  title: string;
  images: ImageData[];
  selectedImageId?: string | null;
  selectedImageIds?: Set<string>;
  onSelectImage?: (imageId: string) => void;
  onSelectMultiple?: (imageId: string) => void;
  onRenameImage?: (imageId: string, newName: string) => void;
  showDownloadButtons?: boolean;
  onRemoveImage?: (imageId: string) => void;
  showRemoveButtons?: boolean;
  emptyMessage: string;
  onUploadImage?: (
    file: File,
    metadata?: {
      width: number;
      height: number;
      aspect_ratio: number;
      name?: string;
      description?: string;
    }
  ) => void;
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
  onSingleCopy?: (imageId: string) => void;
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
  onSelectMultiple,
  onSingleRename,
  onSingleCopy,
}) => {
  const { isGuestMode } = useGuest();
  // State for ImageDisplayModal
  const [showImageDisplayModal, setShowImageDisplayModal] = useState<boolean>(false);
  const [imageToDisplayInModal, setImageToDisplayInModal] = useState<ImageData | null>(null);

  // State for ViewMoreDisplayModal
  const [showViewMoreModal, setShowViewMoreModal] = useState<boolean>(false);
  const [imageForViewMore, setImageForViewMore] = useState<ImageData | null>(null);

  // State for BatchUploadModal
  const [showBatchUploadModal, setShowBatchUploadModal] = useState<boolean>(false);

  // Drag and drop state
  const [activeId, setActiveId] = useState<string | null>(null);

  // Selection state for shift-click and drag selection
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
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
        distance: 8, // 8px movement required to start dragging (prevents accidental drags)
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

  const onViewMoreButtonClick = useCallback((imageData: ImageData) => {
    setImageForViewMore(imageData);
    setShowViewMoreModal(true);
  }, []);

  const handleCloseViewMoreModal = useCallback(() => {
    setShowViewMoreModal(false);
    setImageForViewMore(null);
  }, []);

  // Calculate current image index
  const currentImageIndex = imageToDisplayInModal
    ? images.findIndex((img) => img.id === imageToDisplayInModal.id)
    : -1;

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

  // Handle shift-click for range selection
  const handleCardClick = useCallback(
    (imageId: string, event?: React.MouseEvent) => {
      const currentIndex = images.findIndex((img) => img.id === imageId);

      if (event?.shiftKey && lastSelectedIndex !== null && onSelectMultiple) {
        // Shift-click: select range
        const start = Math.min(lastSelectedIndex, currentIndex);
        const end = Math.max(lastSelectedIndex, currentIndex);

        // Select all images in range
        for (let i = start; i <= end; i++) {
          if (!selectedImageIds.has(images[i].id)) {
            onSelectMultiple(images[i].id);
          }
        }
      } else {
        // Normal click
        onSelectMultiple?.(imageId);
        setLastSelectedIndex(currentIndex);
      }
    },
    [images, lastSelectedIndex, onSelectMultiple, selectedImageIds]
  );

  // Drag selection handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only start drag selection if clicking on the gallery background (not on a card)
      if ((e.target as HTMLElement).closest('[data-card-id]')) {
        return;
      }

      const rect = galleryRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Clear selection when starting a drag selection (like file managers)
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

  // Add/remove mouse event listeners for drag selection
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

      // Check which cards intersect with selection box
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

  // Get global selection state from Redux (both original and generated)
  const selectedOriginalImageIds = useSelector((state: RootState) =>
    selectSelectedOriginalImageIds(state)
  );
  const selectedUpdatedImageIds = useSelector((state: RootState) =>
    selectSelectedUpdatedImageIds(state)
  );
  
  // Get allImages from Redux - handle guest mode separately
  const storeAllImages = useSelector((state: RootState) => selectAllImages(state));
  const guestImages = useSelector((state: RootState) => selectGuestImages(state));
  
  // In guest mode, use guestImages; otherwise use store images
  const allImages = isGuestMode ? guestImages : storeAllImages;

  // Calculate total selected images across both original and generated
  const totalSelectedImages = useMemo(() => {
    return selectedOriginalImageIds.size + selectedUpdatedImageIds.size;
  }, [selectedOriginalImageIds, selectedUpdatedImageIds]);

  // Get all selected image objects (both original and generated) for comparison modal
  const allSelectedImagesForComparison = useMemo(() => {
    const allSelectedImages: ImageData[] = [];

    // Add selected original image IDs by finding them in all images
    selectedOriginalImageIds.forEach((id) => {
      const img = allImages.find((i) => i.id === id);
      if (img) {
        allSelectedImages.push(img);
      }
    });

    // Add selected generated image IDs by finding them in all images
    selectedUpdatedImageIds.forEach((id) => {
      const img = allImages.find((i) => i.id === id);
      if (img) {
        allSelectedImages.push(img);
      }
    });

    return allSelectedImages;
  }, [selectedOriginalImageIds, selectedUpdatedImageIds, allImages]);

  // Calculate total image count (original + generated) for upload limit
  const totalImageCount = useMemo(() => {
    return allImages.length;
  }, [allImages]);

  // Common button style for toolbar icons
  const toolbarButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: '#ffffff',
    margin: '3px 6px 0px 6px',
  };

  const iconStyle = {
    fontSize: '18px',
  };

  // Handle batch file upload
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

    // Upload files sequentially
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
        console.error('Failed to upload file:', file.name, error);
        onUploadError?.(`Failed to upload ${file.name}`);
        throw error; // Stop on first error
      }
    }
  };

  const cardTitle = (
    <div
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}
    >
      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{title}</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {hasSelection && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px 4px 16px',
              backgroundColor: '#bd6dff',
              borderRadius: '8px',
              height: '32px',
              color: '#ffffff',
            }}
          >
            {/* Selection count */}
            <span style={{ fontSize: '13px', fontWeight: 500 }}>
              {selectedImageIds.size} selected
            </span>

            {/* Close/Deselect button */}
            {onClearSelection && (
              <Tooltip title="Deselect all">
                <Button
                  type="text"
                  size="small"
                  icon={<CloseIcon style={iconStyle} />}
                  onClick={onClearSelection}
                  style={toolbarButtonStyle}
                />
              </Tooltip>
            )}

            {/* Divider */}
            <div
              style={{
                width: '1px',
                height: '18px',
                backgroundColor: '#d0d0d0',
                margin: '0 2px',
              }}
            />

            {/* Compare button */}
            <ImagesComparingButton
              totalSelectedPhotos={totalSelectedImages}
              selectedPhotos={allSelectedImagesForComparison}
              isToolbarMode={true}
            />

            {/* Action icon buttons */}
            {onBulkDownload && (
              <Tooltip title="Download">
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadIcon style={iconStyle} />}
                  onClick={onBulkDownload}
                  style={toolbarButtonStyle}
                />
              </Tooltip>
            )}

            {onBulkCopy && (
              <Tooltip title="Copy">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyIcon style={iconStyle} />}
                  onClick={onBulkCopy}
                  style={toolbarButtonStyle}
                />
              </Tooltip>
            )}
            {onBulkMove && (
              <Tooltip title="Move">
                <Button
                  type="text"
                  size="small"
                  icon={<DriveFileMoveOutline style={iconStyle} />}
                  onClick={onBulkMove}
                  style={toolbarButtonStyle}
                />
              </Tooltip>
            )}

            {onBulkDelete && (
              <Tooltip title="Delete">
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteIcon style={iconStyle} />}
                  onClick={onBulkDelete}
                  style={toolbarButtonStyle}
                />
              </Tooltip>
            )}
          </div>
        )}

        {/* Upload button (only show if upload is enabled) */}
        {onUploadImage && onUploadError && (
          <Tooltip
            title={
              isGuestMode
                ? 'Login to upload images'
                : isImageLimitReached
                  ? 'Image limit reached'
                  : ''
            }
            placement="left"
          >
            <Button
              icon={<PlusOutlined />}
              onClick={() => setShowBatchUploadModal(true)}
              disabled={isImageLimitReached || isGuestMode}
            >
              Images
              {isGuestMode && <LockOutlined />}
            </Button>
          </Tooltip>
        )}

        {/* Layout toggle (separate from toolbar) */}
        {images.length > 0 && (
          <Segmented
            value={layoutMode}
            onChange={(val) => setLayoutMode(val as 'Kanban' | 'List')}
            options={[
              { value: 'List', icon: <BarsOutlined /> },
              { value: 'Kanban', icon: <AppstoreOutlined /> },
            ]}
          />
        )}
      </div>
    </div>
  );

  const activeImage = activeId ? images.find((img) => img.id === activeId) : null;

  const galleryContent = (
    <>
      {isLoading ? (
        <div
          className={
            layoutMode === 'Kanban'
              ? 'grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 p-6'
              : 'flex flex-col gap-4 p-6'
          }
        >
          {/* Display 8 skeleton cards */}
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={`skeleton-${index}`} className={layoutMode === 'List' ? 'w-full' : ''}>
              <Skeleton.Image active style={{ width: '100%' }} />
            </div>
          ))}
        </div>
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
                  onViewDetails={() => onViewMoreButtonClick(image)}
                  onRename={onSingleRename ? () => onSingleRename(image.id) : undefined}
                  onCopy={onSingleCopy ? () => onSingleCopy(image.id) : undefined}
                />
              </div>
            ))}
          </SortableContext>

          {/* Selection box overlay */}
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
    <Card title={cardTitle} styles={{ body: { padding: 0 } }}>
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
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Image Display Modal */}
      {imageToDisplayInModal && (
        <ImageDisplayModal
          isOpen={showImageDisplayModal}
          image={imageToDisplayInModal}
          onClose={handleCloseImageDisplayModal}
          currentImageIndex={currentImageIndex}
          totalImages={images.length}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )}

      {/* View More Display Modal */}
      {imageForViewMore && (
        <ViewMoreDisplayModal
          isOpen={showViewMoreModal}
          image={imageForViewMore}
          onClose={handleCloseViewMoreModal}
        />
      )}

      {/* Batch Upload Modal */}
      {onUploadImage && onUploadError && (
        <BatchUploadModal
          isOpen={showBatchUploadModal}
          onClose={() => setShowBatchUploadModal(false)}
          onUpload={handleBatchUpload}
          currentCount={totalImageCount}
          title="Upload Images"
        />
      )}
    </Card>
  );
};

export default Gallery;
