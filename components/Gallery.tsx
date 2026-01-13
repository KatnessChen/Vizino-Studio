import React, { useState, useCallback } from 'react';
import { ImageData } from '@/types';
import ImageCard from './ImageCard';
import UploadCard from './UploadCard';
import ImageDisplayModal from './ImageDisplayModal';
import ViewMoreDisplayModal from './ViewMoreDisplayModal';
import { Card, Button, Tooltip, Space } from 'antd';
import { DeleteOutlined, DownloadOutlined, ClearOutlined, CopyOutlined } from '@ant-design/icons';

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
  onClearSelection?: () => void;
  onSelectAll?: () => void;
  onGenerateMoreSuccess?: () => void;
  userId?: string | undefined;
  isImageLimitReached?: boolean;
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
  onClearSelection,
  onSelectAll,
  userId,
  isImageLimitReached = false,
}) => {
  // State for ImageDisplayModal
  const [showImageDisplayModal, setShowImageDisplayModal] = useState<boolean>(false);
  const [imageToDisplayInModal, setImageToDisplayInModal] = useState<ImageData | null>(null);

  // State for ViewMoreDisplayModal
  const [showViewMoreModal, setShowViewMoreModal] = useState<boolean>(false);
  const [imageForViewMore, setImageForViewMore] = useState<ImageData | null>(null);

  const handleViewPhotoImage = useCallback((imageData: ImageData) => {
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

  const hasSelection = selectedImageIds.size > 0;

  const cardTitle = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
      <h2 className="m-0 text-base sm:text-lg font-semibold">{title}</h2>
      <Space size="small" wrap>
        {hasSelection && (
          <span style={{ fontSize: '14px', color: '#666' }}>{selectedImageIds.size} selected</span>
        )}
        {images.length > 0 && (
          <>
            {onSelectAll && (
              <>
                {/* Desktop version with text */}
                <Button
                  onClick={onSelectAll}
                  icon={<ClearOutlined style={{ transform: 'scaleY(-1)' }} />}
                  size="small"
                  className="hidden sm:inline-flex"
                >
                  Select All
                </Button>
                {/* Mobile version icon-only */}
                <Tooltip title="Select All">
                  <Button
                    onClick={onSelectAll}
                    icon={<ClearOutlined style={{ transform: 'scaleY(-1)' }} />}
                    size="small"
                    className="sm:hidden"
                  />
                </Tooltip>
              </>
            )}
            {onClearSelection && (
              <>
                {/* Desktop version with text */}
                <Button 
                  onClick={onClearSelection} 
                  disabled={!hasSelection} 
                  icon={<ClearOutlined />}
                  size="small"
                  className="hidden sm:inline-flex"
                >
                  Deselect All
                </Button>
                {/* Mobile version icon-only */}
                <Tooltip title="Deselect All">
                  <Button 
                    onClick={onClearSelection} 
                    disabled={!hasSelection} 
                    icon={<ClearOutlined />}
                    size="small"
                    className="sm:hidden"
                  />
                </Tooltip>
              </>
            )}
            {onBulkDownload && (
              <Button 
                onClick={onBulkDownload} 
                disabled={!hasSelection} 
                icon={<DownloadOutlined />}
                size="small"
              >
                <span className="hidden sm:inline">Download</span>
              </Button>
            )}
            {onBulkCopy && (
              <Tooltip title="Copy the selected photos">
                <Button 
                  onClick={onBulkCopy} 
                  disabled={!hasSelection} 
                  icon={<CopyOutlined />}
                  size="small"
                >
                  <span className="hidden sm:inline">Duplicate</span>
                </Button>
              </Tooltip>
            )}
            {onBulkDelete && (
              <Button
                onClick={onBulkDelete}
                disabled={!hasSelection}
                danger
                icon={<DeleteOutlined />}
                size="small"
              >
                <span className="hidden sm:inline">Delete</span>
              </Button>
            )}
          </>
        )}
      </Space>
    </div>
  );

  return (
    <Card title={cardTitle}>
      {images.length === 0 && !showUploadCard ? (
        <div style={{ textAlign: 'center', padding: '0 32px', color: '#999', fontStyle: 'italic' }}>
          {emptyMessage}
        </div>
      ) : (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {showUploadCard && onUploadImage && onUploadError && (
            <UploadCard
              onImageUpload={onUploadImage}
              onError={onUploadError}
              isLimitReached={isImageLimitReached}
            />
          )}
          {images.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              isSelected={selectedImageIds.has(image.id)}
              onSelect={onSelectMultiple}
              onViewPhotoButtonClick={handleViewPhotoImage}
              onViewMoreButtonClick={onViewMoreButtonClick}
              userId={userId}
            />
          ))}
        </div>
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
