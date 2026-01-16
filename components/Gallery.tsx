import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import AssetCard from './ui/AssetCard';
import SortableAssetCard from './ui/SortableAssetCard';
import UploadCard from './ui/UploadCard';
import ImageDisplayModal from './modal/ImageDisplayModal';
import ViewMoreDisplayModal from './modal/ViewMoreDisplayModal';
import { Card, Button, Tooltip } from 'antd';
import MyEmpty from '@/components/ui/MyEmpty';
import {
  DriveFileMoveOutline as DriveFileMoveOutline,
  Downloading as DownloadIcon,
  DeleteOutlined as DeleteIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';

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
  onUploadImage?: (file: File) => void;
  showUploadCard?: boolean;
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
  enableReordering?: boolean;
  isLoading?: boolean;
  onSingleRename?: (imageId: string) => void;
  onSingleDuplicate?: (imageId: string) => void;
  onSingleCopy?: (imageId: string) => void;
}

const Gallery: React.FC<GalleryProps> = ({
  title,
  images,
  selectedImageIds = new Set(),
  onSelectMultiple,
  emptyMessage,
  onUploadImage,
  showUploadCard = false,
  onUploadError,
  onBulkDelete,
  onBulkDownload,
  onBulkCopy,
  onBulkMove,
  onClearSelection,
  isImageLimitReached = false,
  onReorder,
  enableReordering = false,
  isLoading = false,
  onSingleRename,
  onSingleDuplicate,
  onSingleCopy,
}) => {
  // State for ImageDisplayModal
  const [showImageDisplayModal, setShowImageDisplayModal] = useState<boolean>(false);
  const [imageToDisplayInModal, setImageToDisplayInModal] = useState<ImageData | null>(null);

  // State for ViewMoreDisplayModal
  const [showViewMoreModal, setShowViewMoreModal] = useState<boolean>(false);
  const [imageForViewMore, setImageForViewMore] = useState<ImageData | null>(null);

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

  const cardTitle = (
    <div
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}
    >
      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{title}</h2>

      {/* Selection toolbar - only show when images are selected */}
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
    </div>
  );

  const activeImage = activeId ? images.find((img) => img.id === activeId) : null;

  const galleryContent = (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading images...</span>
        </div>
      ) : images.length === 0 && !showUploadCard ? (
        <MyEmpty description={emptyMessage} />
      ) : (
        <div
          ref={galleryRef}
          onMouseDown={handleMouseDown}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px',
            position: 'relative',
            userSelect: 'none',
            padding: '24px',
          }}
        >
          {showUploadCard && onUploadImage && onUploadError && (
            <UploadCard
              onImageUpload={onUploadImage}
              onError={onUploadError}
              isLimitReached={isImageLimitReached}
            />
          )}
          {enableReordering ? (
            <SortableContext items={images.map((img) => img.id)} strategy={rectSortingStrategy}>
              {images.map((image) => (
                <div
                  key={image.id}
                  data-card-id={image.id}
                  ref={(el) => {
                    if (el) {
                      cardRefs.current.set(image.id, el);
                    }
                  }}
                >
                  <SortableAssetCard
                    asset={image}
                    isSelected={selectedImageIds.has(image.id)}
                    onSelect={(e?: React.MouseEvent) => handleCardClick(image.id, e)}
                    onViewExpand={() => handleExpandPhotoImage(image)}
                    onViewDetails={() => onViewMoreButtonClick(image)}
                    onRename={onSingleRename ? () => onSingleRename(image.id) : undefined}
                    onCopy={onSingleCopy ? () => onSingleCopy(image.id) : undefined}
                  />
                </div>
              ))}
            </SortableContext>
          ) : (
            images.map((image) => (
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
                <AssetCard
                  asset={image}
                  isSelected={selectedImageIds.has(image.id)}
                  onSelect={(e) => handleCardClick(image.id, e)}
                  onViewExpand={() => handleExpandPhotoImage(image)}
                  onViewDetails={() => onViewMoreButtonClick(image)}
                  onRename={onSingleRename ? () => onSingleRename(image.id) : undefined}
                  onCopy={onSingleCopy ? () => onSingleCopy(image.id) : undefined}
                />
              </div>
            ))
          )}

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
                backgroundColor: 'rgba(204, 204, 204, 0.1)',
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
      {enableReordering && onReorder ? (
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
    </Card>
  );
};

export default Gallery;
