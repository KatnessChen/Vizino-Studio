import React from 'react';
import ImageDisplayModal from '../modal/ImageDisplayModal';
import GenerationHistoryModal from '../modal/GenerationHistoryModal';
import BatchUploadModal from '../modal/BatchUploadModal';
import { ImageData } from '@/types';

interface GalleryModalsProps {
  imageToDisplayInModal: ImageData | null;
  showImageDisplayModal: boolean;
  onCloseImageDisplayModal: () => void;
  currentImageIndex: number;
  totalImages: number;
  handlePrevious: () => void;
  handleNext: () => void;
  renderItemPreview?: (image: ImageData) => React.ReactNode;
  detailModalTitle?: string;
  onSingleRename?: (imageId: string) => void;

  imageForGenerationHistory: ImageData | null;
  showGenerationHistoryModal: boolean;
  onCloseGenerationHistoryModal: () => void;

  onUploadImage?: unknown;
  onUploadError?: unknown;
  showBatchUploadModal: boolean;
  setShowBatchUploadModal: (show: boolean) => void;
  handleBatchUpload: (
    files: Array<{ file: File; width: number; height: number; name?: string; description?: string }>
  ) => Promise<void>;
  totalImageCount: number;
  uploadModalTitle: string;
  batchUploadMode: 'image' | 'asset';
  assetType?: 'image' | 'texture' | 'item' | 'color';
  existingNames?: Set<string>;
}

const GalleryModals: React.FC<GalleryModalsProps> = ({
  imageToDisplayInModal,
  showImageDisplayModal,
  onCloseImageDisplayModal,
  currentImageIndex,
  totalImages,
  handlePrevious,
  handleNext,
  renderItemPreview,
  detailModalTitle,
  onSingleRename,

  imageForGenerationHistory,
  showGenerationHistoryModal,
  onCloseGenerationHistoryModal,

  onUploadImage,
  onUploadError,
  showBatchUploadModal,
  setShowBatchUploadModal,
  handleBatchUpload,
  totalImageCount,
  uploadModalTitle,
  batchUploadMode,
  assetType,
  existingNames,
}) => {
  return (
    <>
      {/* Image Display Modal */}
      {imageToDisplayInModal && (
        <ImageDisplayModal
          isOpen={showImageDisplayModal}
          image={imageToDisplayInModal}
          onClose={onCloseImageDisplayModal}
          currentImageIndex={currentImageIndex}
          totalImages={totalImages}
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
          onClose={onCloseGenerationHistoryModal}
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
    </>
  );
};

export default React.memo(GalleryModals);
