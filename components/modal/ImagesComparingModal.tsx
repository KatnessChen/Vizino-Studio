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
import { ImageData } from '@/types';
import { imageCache } from '@/utils/imageCache';
import { CloseOutlined as CloseIcon } from '@ant-design/icons';
import { Button } from 'antd';

interface ComparePhotosModalProps {
  isOpen: boolean;
  images: ImageData[];
  onClose: () => void;
  onRemoveImage?: (imageId: string) => void;
}

// Draggable image card component
interface DraggableImageCardProps {
  image: ImageData;
  cachedImageSrc: string | null;
  onRemove: (imageId: string) => void;
}

const DraggableImageCard: React.FC<DraggableImageCardProps> = ({
  image,
  cachedImageSrc,
  onRemove,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: image.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    transition: 'opacity 200ms ease',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col items-center overflow-hidden h-full group bg-white overflow-visible"
    >
      {/* Image Container */}
      <div
        className="relative flex-1 w-full flex items-center justify-center min-h-0 overflow-hidden cursor-grab active:cursor-grabbing overflow-visible"
        {...attributes}
        {...listeners}
      >
        {/* Remove Button */}
        <button
          type="button"
          onClick={() => onRemove(image.id)}
          className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-gray-500 bg-opacity-50 opacity-0 hover:bg-opacity-70 transition-opacity group-hover:opacity-100 cursor-pointer p-0 border-none"
          aria-label="Remove image"
        >
          <CloseIcon className="text-white text-xs" />
        </button>
        <img
          src={cachedImageSrc || image.imageDownloadUrl}
          alt={image.name}
          className="w-full object-contain bg-white"
          draggable="false"
        />
      </div>

      {/* Image Info Footer */}
      <div className="w-full px-3 py-2 border-t border-gray-200 flex-shrink-0 text-center">
        <p className="text-xs font-regular text-gray-800 truncate">{image.name}</p>
      </div>
    </div>
  );
};

const ImagesComparingModal: React.FC<ComparePhotosModalProps> = ({
  isOpen,
  images,
  onClose,
  onRemoveImage,
}) => {
  const [localImages, setLocalImages] = useState<ImageData[]>(images);
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
    setLocalImages(images);
  }, [images]);

  // Load cached base64 on mount
  useEffect(() => {
    const loadCachedImage = async () => {
      const newCachedImages: Record<string, string | null> = {};

      for (const image of localImages) {
        try {
          const base64 = await imageCache.get(image.imageDownloadUrl);
          if (base64) {
            newCachedImages[image.id] = `data:${image.mimeType};base64,${base64}`;
          } else {
            newCachedImages[image.id] = null;
          }
        } catch (error) {
          console.warn('[ImagesComparingModal] Failed to load cached image:', error);
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

  // Calculate responsive grid columns based on image count for optimal space usage
  const gridColumns = useMemo(() => {
    const count = localImages.length;
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count === 3) return 'grid-cols-3';
    if (count === 4) return 'grid-cols-2'; // 2x2 grid for 4 images
    if (count <= 9) return 'grid-cols-3'; // 3 columns for 5-9 images
    return 'grid-cols-4'; // 4 columns for 10+ images
  }, [localImages.length]);

  if (!isOpen || localImages.length === 0) return null;

  const activeImage = activeId ? localImages.find((img) => img.id === activeId) : null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-95 flex flex-col items-center justify-center p-4 transition-opacity duration-300 gap-4"
      onClick={onClose}
      style={{ zIndex: 1200 }}
    >
      <div
        className="relative w-full max-h-[85vh] overflow-auto flex flex-col bg-white rounded-lg flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Content - Masonry Grid Layout */}
        <div className="flex-1 overflow-visible p-4 flex items-start justify-center">
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
              <div className={`grid ${gridColumns} gap-2 auto-rows-max h-full`}>
                {localImages.map((image) => (
                  <div key={image.id} className={`h-full min-h-0`}>
                    <DraggableImageCard
                      image={image}
                      cachedImageSrc={cachedImagesSrc[image.id] || null}
                      onRemove={handleRemoveImage}
                    />
                  </div>
                ))}
              </div>
            </SortableContext>

            {/* Drag Overlay */}
            <DragOverlay>
              {activeImage ? (
                <div className="w-64 h-64 rounded-lg overflow-hidden border-2 border-blue-400 shadow-2xl bg-white">
                  <img
                    src={cachedImagesSrc[activeImage.id] || activeImage.imageDownloadUrl}
                    alt={activeImage.name}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Instruction Text - Outside Modal */}
      <div className="flex-shrink-0">
        <p className="text-xs text-white text-center">
          Press <span className="font-semibold">ESC</span> to close modal •{' '}
          <span className="font-semibold">Drag</span> to move •{' '}
          <span className="font-semibold">Click ×</span> to remove image from comparing mode
        </p>
      </div>
    </div>
  );
};

export default ImagesComparingModal;
