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
import ImageDisplayModal from './modal/ImageDisplayModal';
import GenerationHistoryModal from './modal/GenerationHistoryModal';
import BatchUploadModal from './modal/BatchUploadModal';
import ImagesComparingButton from './button/ImagesComparingButton';
import { Card, Button, Tooltip, Segmented } from 'antd';
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
import { setShowLoginRequiredModal } from '@/stores/guestStore';
import { useGuest } from '@/contexts/GuestContext';

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

  // Selection state for shift-click and drag selection
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

  const onViewGenerationHistoryClick = useCallback((imageData: ImageData) => {
    setImageForGenerationHistory(imageData);
    setShowGenerationHistoryModal(true);
  }, []);

  const handleCloseGenerationHistoryModal = useCallback(() => {
    setShowGenerationHistoryModal(false);
    setImageForGenerationHistory(null);
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

  const handleCardClick = useCallback(
    (imageId: string, event?: React.MouseEvent) => {
      if (event?.shiftKey) {
        // Shift-click: multi-select toggle mode
        onSelectMultiple?.(imageId, event);
      } else {
        // Normal click: single-select mode
        onSelectImage?.(imageId, event);
      }
    },
    [onSelectMultiple, onSelectImage]
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

  // Calculate total selected items.
  // For Image galleries (ASSET_IMAGE): use global count to enable cross-gallery comparison
  // For other asset types (Texture/Item/Color): use local gallery selection only
  const totalSelectedItems = useMemo(() => {
    if (assetType === ASSET_IMAGE) {
      // Images: count across both Original and Generated galleries
      return selectedOriginalImageIds.size + selectedUpdatedImageIds.size;
    } else if (assetType) {
      // Other assets: count only within this gallery
      return selectedImageIds?.size || 0;
    }
    // Fallback: use global count (backward compatibility)
    return selectedOriginalImageIds.size + selectedUpdatedImageIds.size;
  }, [selectedImageIds, selectedOriginalImageIds, selectedUpdatedImageIds, assetType]);

  // Get all selected objects for comparison modal
  const allSelectedItemsForComparison = useMemo(() => {
    // For images (Original/Generated): use global Redux state to allow cross-gallery comparison
    if (assetType === ASSET_IMAGE) {
      const selected: ImageData[] = [];
      const allSelectedIds = new Set([...selectedOriginalImageIds, ...selectedUpdatedImageIds]);

      allSelectedIds.forEach((id) => {
        const img = allImages.find((i) => i.id === id);
        if (img) selected.push(img);
      });

      return selected;
    }

    // For other asset types (Texture/Item/Color): only compare items within this gallery
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
    color: 'gray',
    marginTop: '2px',
    marginLeft: '2px',
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
    <div className="flex justify-between items-center gap-5">
      <h2 className="m-0 text-lg font-semibold">{title}</h2>

      <div className="flex items-center gap-3">
        {hasSelection && (
          <div
            style={{
              display: 'flex',
              backgroundColor: '#f3f4f6',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px 4px 16px',
              borderRadius: 8,
              height: 32,
              color: 'black',
            }}
          >
            {/* Selection count */}
            <span style={{ fontSize: 13, color: '#4b5563', fontWeight: 500, marginRight: 4 }}>
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
            <div style={{ width: 1, height: 18, backgroundColor: '#d1d5db', margin: '0 4px' }} />

            {/* Compare button */}
            {showCompare && (
              <ImagesComparingButton
                totalSelectedCount={totalSelectedItems}
                selectedAssets={allSelectedItemsForComparison}
              />
            )}

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
              <Tooltip title="Duplicate">
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

        {/* Upload button (show if upload handler is provided) */}
        {onUploadImage && (
          <Button
            icon={<PlusOutlined />}
            onClick={() => {
              if (isGuestMode) {
                dispatch(setShowLoginRequiredModal(true));
                return;
              }

              // If a caller provided an onUploadImage handler with zero arguments
              // we treat it as an intent to open a custom upload modal (e.g., Add Color)
              if (onUploadImage) {
                const fn = onUploadImage as (...args: unknown[]) => unknown;
                if (fn.length === 0) {
                  try {
                    // Call with no args - handler should open its own modal
                    fn();
                    return;
                  } catch (err) {
                    console.warn('onUploadImage handler threw when invoked without args:', err);
                  }
                }
              }

              if (!isImageLimitReached) {
                setShowBatchUploadModal(true);
              }
            }}
            disabled={isImageLimitReached && !isGuestMode}
            className={`!flex items-center gap-1.5 ${isGuestMode ? 'opacity-60' : ''}`}
          >
            {uploadButtonText}
            {isGuestMode && <LockOutlined />}
          </Button>
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
          {/* Display 8 full-card color placeholders */}
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={`skeleton-${index}`} className={layoutMode === 'List' ? 'w-full' : ''}>
              <div
                className={`w-full ${layoutMode === 'List' ? 'min-h-[120px]' : 'min-h-[200px]'} rounded-md border-2 border-[#e5e7eb] bg-[#e5e7eb] overflow-hidden animate-pulse flex items-center justify-center`}
              >
                <div className="text-sm text-[#9ca3af]">Loading...</div>
              </div>
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
                  onViewDetails={() => onViewGenerationHistoryClick(image)}
                  onRename={onSingleRename ? () => onSingleRename(image.id) : undefined}
                  onDelete={onSingleDelete ? () => onSingleDelete(image.id) : undefined}
                  onCopy={onSingleCopy ? () => onSingleCopy(image.id) : undefined}
                  renderPreview={renderItemPreview ? () => renderItemPreview(image) : undefined}
                  showViewButton={showViewButton}
                  editLabel={editLabel}
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
          renderPreview={
            renderItemPreview ? () => renderItemPreview(imageToDisplayInModal) : undefined
          }
          detailModalTitle={detailModalTitle}
          onEdit={onSingleRename ? () => onSingleRename(imageToDisplayInModal.id) : undefined}
        />
      )}

      {/* View More Display Modal */}
      {imageForGenerationHistory && (
        <GenerationHistoryModal
          isOpen={showGenerationHistoryModal}
          image={imageForGenerationHistory}
          onClose={handleCloseGenerationHistoryModal}
        />
      )}

      {/* Batch Upload Modal */}
      {onUploadImage && onUploadError && (
        <BatchUploadModal
          isOpen={showBatchUploadModal}
          onClose={() => setShowBatchUploadModal(false)}
          onUpload={handleBatchUpload}
          currentCount={totalImageCount}
          title={uploadModalTitle}
          mode={batchUploadMode}
          assetType={assetType}
          existingNames={existingNames}
        />
      )}
    </Card>
  );
};

export default Gallery;
