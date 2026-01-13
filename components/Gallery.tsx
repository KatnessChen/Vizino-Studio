import React, { useState, useCallback } from 'react';
import { ImageData } from '@/types';
import AssetCard from './ui/AssetCard';
import UploadCard from './ui/UploadCard';
import ImageDisplayModal from './modal/ImageDisplayModal';
import ViewMoreDisplayModal from './modal/ViewMoreDisplayModal';
import { Card, Button, Tooltip, Space } from 'antd';
import MyEmpty from '@/components/ui/MyEmpty';
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
  isImageLimitReached = false,
}) => {
  // State for ImageDisplayModal
  const [showImageDisplayModal, setShowImageDisplayModal] = useState<boolean>(false);
  const [imageToDisplayInModal, setImageToDisplayInModal] = useState<ImageData | null>(null);

  // State for ViewMoreDisplayModal
  const [showViewMoreModal, setShowViewMoreModal] = useState<boolean>(false);
  const [imageForViewMore, setImageForViewMore] = useState<ImageData | null>(null);

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

  const hasSelection = selectedImageIds.size > 0;

  const cardTitle = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{title}</h2>
      <Space size="small">
        {hasSelection && (
          <span style={{ fontSize: '14px', color: '#666' }}>{selectedImageIds.size} selected</span>
        )}
        {images.length > 0 && (
          <>
            {onSelectAll && (
              <Button
                onClick={onSelectAll}
                icon={<ClearOutlined style={{ transform: 'scaleY(-1)' }} />}
              >
                Select All
              </Button>
            )}
            {onClearSelection && (
              <Button onClick={onClearSelection} disabled={!hasSelection} icon={<ClearOutlined />}>
                Deselect All
              </Button>
            )}
            {onBulkDownload && (
              <Button onClick={onBulkDownload} disabled={!hasSelection} icon={<DownloadOutlined />}>
                Download
              </Button>
            )}
            {onBulkCopy && (
              <Tooltip title="Copy the selected photos">
                <Button onClick={onBulkCopy} disabled={!hasSelection} icon={<CopyOutlined />}>
                  Duplicate
                </Button>
              </Tooltip>
            )}
            {onBulkDelete && (
              <Button
                onClick={onBulkDelete}
                disabled={!hasSelection}
                danger
                icon={<DeleteOutlined />}
              >
                Delete
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
        <MyEmpty description={emptyMessage} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px',
          }}
        >
          {showUploadCard && onUploadImage && onUploadError && (
            <UploadCard
              onImageUpload={onUploadImage}
              onError={onUploadError}
              isLimitReached={isImageLimitReached}
            />
          )}
          {images.map((image) => (
            <AssetCard
              key={image.id}
              asset={image}
              isSelected={selectedImageIds.has(image.id)}
              onSelect={() => onSelectMultiple?.(image.id)}
              onViewExpand={() => handleExpandPhotoImage(image)}
              onViewDetails={() => onViewMoreButtonClick(image)}
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
