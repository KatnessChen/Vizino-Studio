import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { arrayMove, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { ImageData, Color, Texture, Item } from '@/types';
import { ASSET_IMAGE, ASSET_TEXTURE, ASSET_ITEM, ASSET_COLOR } from '@/constants/constants';
import { imageCache } from '@/utils/imageCache';
import { devWarn, devError } from '@/utils/devLogger';
import { CloseOutlined as CloseIcon } from '@ant-design/icons';

type AssetType = ImageData | Color | Texture | Item;

interface ComparePhotosModalProps {
  isOpen: boolean;
  selectedAssets: AssetType[];
  onClose: () => void;
  onRemoveImage?: (imageId: string) => void;
}

// Draggable image card component
interface DraggableImageCardProps {
  image: AssetType;
  cachedImageSrc: string | null;
  onRemove: (imageId: string) => void;
}

const isColorData = (obj: AssetType): obj is Color => {
  return obj.assetType === ASSET_COLOR;
};

const getAssetUrl = (asset: AssetType): string | null => {
  if (asset.assetType === ASSET_IMAGE) return (asset as ImageData).imageDownloadUrl;
  if (asset.assetType === ASSET_TEXTURE) return (asset as Texture).textureImageDownloadUrl;
  if (asset.assetType === ASSET_ITEM) return (asset as Item).itemImageDownloadUrl;
  return null;
};

const getMimeType = (asset: AssetType): string => {
  if (asset.assetType === ASSET_IMAGE) {
    return (asset as ImageData).mimeType || 'image/png';
  }
  return 'image/png';
};

const DraggableImageCard: React.FC<DraggableImageCardProps> = ({
  image,
  cachedImageSrc,
  onRemove,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: image.id,
  });

  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);

  const assetUrl = getAssetUrl(image);

  // Effect to update currentSrc when props change
  useEffect(() => {
    if (!isColorData(image)) {
      if (cachedImageSrc) {
        setCurrentSrc(cachedImageSrc);
      } else {
        setCurrentSrc(assetUrl);
      }
      setHasError(false); // Reset error state when image changes
    }
  }, [image, cachedImageSrc, assetUrl]);

  const handleError = () => {
    if (!isColorData(image) && currentSrc === cachedImageSrc && assetUrl) {
      // If cached image fails, try the original download URL
      devWarn(`[DraggableImageCard] Cached image failed for ${image.id}, retrying with URL`);
      setCurrentSrc(assetUrl);
    } else {
      // If original URL also fails (or we were already using it), show error
      devError(`[DraggableImageCard] Failed to load image for ${image.id}`);
      setHasError(true);
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    transition: 'opacity 200ms ease',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col items-center overflow-hidden group bg-white rounded-lg shadow-md h-full"
    >
      {/* Image Container - flex-1 to fill available space */}
      <div
        className="relative w-full flex-1 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing bg-gray-50 min-h-0"
        {...attributes}
        {...listeners}
      >
        {/* Remove Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(image.id);
          }}
          className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-gray-500 bg-opacity-50 opacity-0 hover:bg-opacity-70 transition-opacity group-hover:opacity-100 cursor-pointer p-0 border-none"
          aria-label="Remove image"
        >
          <CloseIcon className="text-white text-xs" />
        </button>
        {isColorData(image) ? (
          <div className="w-full h-full" style={{ backgroundColor: image.hex }} />
        ) : hasError ? (
          <div className="flex flex-col items-center justify-center text-gray-400 p-4 text-center">
            <span className="text-2xl mb-2">⚠️</span>
            <span className="text-xs">Failed to load</span>
          </div>
        ) : (
          <img
            src={currentSrc || assetUrl || ''}
            alt={image.name}
            onError={handleError}
            className="max-w-full max-h-full object-contain"
            draggable="false"
          />
        )}
      </div>

      {/* Image Info Footer */}
      <div className="w-full px-3 py-2 border-t border-gray-200 flex-shrink-0 text-center bg-white">
        <p className="text-xs font-medium text-gray-800 truncate">{image.name}</p>
      </div>
    </div>
  );
};

const ImagesComparingModal: React.FC<ComparePhotosModalProps> = ({
  isOpen,
  selectedAssets,
  onClose,
  onRemoveImage,
}) => {
  const [localImages, setLocalImages] = useState<AssetType[]>(selectedAssets);
  const [cachedImagesSrc, setCachedImagesSrc] = useState<Record<string, string | null>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Sync local images with props
  useEffect(() => {
    setLocalImages(selectedAssets);
  }, [selectedAssets]);

  // Load cached base64 on mount
  useEffect(() => {
    const loadCachedImage = async () => {
      const newCachedImages: Record<string, string | null> = {};

      for (const image of localImages) {
        try {
          if (!isColorData(image)) {
            const url = getAssetUrl(image);
            if (url) {
              const base64 = await imageCache.get(url);
              if (base64) {
                // For textures/items, we might not have mimeType easily available if not standard
                // Assuming png/jpg based on logic elsewhere or storing mimeType would be better.
                // But often imageCache stores only base64 string.
                // ImageData has mimeType. Texture/Item might have it optional.
                // We'll try to use image.mimeType if available, else standard fallback logic or just data URI prefix if cache stores full data URI (it doesn't usually).
                // Looking at utils/imageCache, it stores pure base64.
                // We need a mimetype.
                const mimeType = getMimeType(image);
                newCachedImages[image.id] = `data:${mimeType};base64,${base64}`;
              } else {
                newCachedImages[image.id] = null;
              }
            } else {
              newCachedImages[image.id] = null;
            }
          } else {
            // Color swatches don't have image data
            newCachedImages[image.id] = null;
          }
        } catch (error) {
          devWarn('[ImagesComparingModal] Failed to load cached image:', error);
          newCachedImages[image.id] = null;
        }
      }

      setCachedImagesSrc(newCachedImages);
    };

    loadCachedImage();
  }, [localImages]);

  // Handle Esc key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  // Handle drag end for reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = localImages.findIndex((img) => img.id === active.id);
      const newIndex = localImages.findIndex((img) => img.id === over.id);
      const newOrder = arrayMove(localImages, oldIndex, newIndex);
      setLocalImages(newOrder);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle image removal
  const handleRemoveImage = (imageId: string) => {
    const newImages = localImages.filter((img) => img.id !== imageId);
    setLocalImages(newImages);
    onRemoveImage?.(imageId);
  };

  // Calculate optimal grid layout based on image count to fit all images in viewport
  const { gridColumns, gridRows } = useMemo(() => {
    const count = localImages.length;
    if (count === 1) return { gridColumns: 1, gridRows: 1 };
    if (count === 2) return { gridColumns: 2, gridRows: 1 };
    if (count === 3) return { gridColumns: 3, gridRows: 1 };
    if (count === 4) return { gridColumns: 2, gridRows: 2 };
    if (count <= 6) return { gridColumns: 3, gridRows: 2 };
    if (count <= 9) return { gridColumns: 3, gridRows: 3 };
    if (count <= 12) return { gridColumns: 4, gridRows: 3 };
    if (count <= 16) return { gridColumns: 4, gridRows: 4 };
    // For larger counts, calculate optimal grid
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    return { gridColumns: cols, gridRows: rows };
  }, [localImages.length]);

  if (!isOpen || localImages.length === 0) return null;

  const activeImage = activeId ? localImages.find((img) => img.id === activeId) : null;
  const activeImageUrl = activeImage ? getAssetUrl(activeImage) : null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-95 flex flex-col items-center justify-center p-4 transition-opacity duration-300"
      onClick={onClose}
      style={{ zIndex: 1200 }}
    >
      {/* Main container - use calc to account for instruction text */}
      <div
        className="relative w-full flex-1 flex flex-col bg-white rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: 'calc(100vh - 80px)' }}
      >
        {/* Content - Grid Layout that fills the container */}
        <div className="flex-1 p-4 overflow-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localImages.map((img) => img.id)}
              strategy={rectSortingStrategy}
            >
              <div
                className="grid gap-3 h-full"
                style={{
                  gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                  gridTemplateRows: `repeat(${gridRows}, 1fr)`,
                }}
              >
                {localImages.map((image) => (
                  <DraggableImageCard
                    key={image.id}
                    image={image}
                    cachedImageSrc={cachedImagesSrc[image.id] || null}
                    onRemove={handleRemoveImage}
                  />
                ))}
              </div>
            </SortableContext>

            {/* Drag Overlay */}
            <DragOverlay>
              {activeImage ? (
                <div className="w-64 h-64 rounded-lg overflow-hidden border-2 border-blue-400 shadow-2xl bg-white">
                  {isColorData(activeImage) ? (
                    <div
                      className="w-full h-full"
                      style={{
                        backgroundColor: activeImage.hex,
                      }}
                    />
                  ) : (
                    <img
                      src={cachedImagesSrc[activeImage.id] || activeImageUrl || ''}
                      alt={activeImage.name}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Instruction Text - Outside Modal */}
      <div className="flex-shrink-0 mt-3">
        <p className="text-xs text-white text-center">
          Press <span className="font-semibold">ESC</span> to close modal •{' '}
          <span className="font-semibold">Drag</span> to reorder •{' '}
          <span className="font-semibold">Click ×</span> to remove from comparison
        </p>
      </div>
    </div>
  );
};

export default ImagesComparingModal;
